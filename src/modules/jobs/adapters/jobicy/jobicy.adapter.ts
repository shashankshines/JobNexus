import { JobProvider, fetchWithTimeout } from '../../providers/provider.types';
import { NormalizedJob } from '../../domain/job.types';
import {
  normalizeDate,
  normalizeLocation,
  normalizeEmploymentType,
  normalizeSeniority,
  isValidHttpUrl,
  stripHtml,
} from '../../domain/job.normalization';

interface JobicyItem {
  id: number | string;
  url: string;
  jobTitle: string;
  companyName: string;
  jobGeo?: string;
  jobType?: string | string[];
  pubDate: string;
  jobLevel?: string;
  jobDescription?: string;
  jobExcerpt?: string;
}

interface JobicyResponse {
  jobs?: JobicyItem[];
}

export class JobicyAdapter implements JobProvider {
  readonly id = 'jobicy';
  readonly name = 'Jobicy';
  readonly timeoutMs = 6000;

  private readonly apiUrl = 'https://jobicy.com/api/v2/remote-jobs?count=100';

  async fetchJobs(): Promise<NormalizedJob[]> {
    const res = await fetchWithTimeout(this.apiUrl, {}, this.timeoutMs);
    if (!res.ok) {
      throw new Error(`Jobicy API returned HTTP ${res.status}`);
    }

    const json = (await res.json()) as JobicyResponse;
    if (!json || !Array.isArray(json.jobs)) {
      return [];
    }

    const jobs: NormalizedJob[] = [];

    for (const item of json.jobs) {
      if (!item.jobTitle || !isValidHttpUrl(item.url)) continue;

      const locInfo = normalizeLocation(item.jobGeo || 'Remote');
      const tags = item.jobLevel ? [item.jobLevel] : [];
      const title = item.jobTitle.trim();
      const company = (item.companyName || 'Unknown').trim();
      const empType = normalizeEmploymentType(item.jobType);
      const seniority = normalizeSeniority(title, tags);
      const cleanDesc = stripHtml(item.jobExcerpt || item.jobDescription || '');

      jobs.push({
        id: `jobicy-${item.id}`,
        sourceId: String(item.id),
        sourceName: this.name,
        title,
        company,
        location: locInfo.location,
        isRemote: true,
        isIndiaEligible: locInfo.isIndiaEligible,
        workplaceType: locInfo.workplaceType,
        description: cleanDesc,
        applicationUrl: item.url,
        publishedAt: normalizeDate(item.pubDate),
        employmentType: empType,
        seniority,
        tags,
      });
    }

    return jobs;
  }
}
