import { JobProvider, fetchWithTimeout } from '../../providers/provider.types';
import { NormalizedJob, JobSearchParams } from '../../domain/job.types';
import {
  normalizeDate,
  normalizeLocation,
  normalizeEmploymentType,
  normalizeSeniority,
  isValidHttpUrl,
} from '../../domain/job.normalization';

interface RemotiveItem {
  id: number | string;
  url: string;
  title: string;
  company_name: string;
  candidate_required_location?: string;
  job_type?: string;
  publication_date: string;
  tags?: string[];
  description?: string;
}

interface RemotiveResponse {
  jobs?: RemotiveItem[];
}

export class RemotiveAdapter implements JobProvider {
  readonly id = 'remotive';
  readonly name = 'Remotive';
  readonly timeoutMs = 6000;

  private readonly baseUrl = 'https://remotive.com/api/remote-jobs';

  async fetchJobs(params: JobSearchParams): Promise<NormalizedJob[]> {
    const url = params.query
      ? `${this.baseUrl}?search=${encodeURIComponent(params.query.trim())}`
      : this.baseUrl;

    const res = await fetchWithTimeout(url, {}, this.timeoutMs);
    if (!res.ok) {
      throw new Error(`Remotive API returned HTTP ${res.status}`);
    }

    const json = (await res.json()) as RemotiveResponse;
    if (!json || !Array.isArray(json.jobs)) {
      return [];
    }

    const limit = params.query ? 200 : 50;
    const candidates = json.jobs.slice(0, limit);
    const jobs: NormalizedJob[] = [];

    for (const item of candidates) {
      if (!item.title || !isValidHttpUrl(item.url)) continue;

      const locInfo = normalizeLocation(item.candidate_required_location || 'Remote');
      const tags = Array.isArray(item.tags) ? item.tags : [];
      const title = item.title.trim();
      const company = (item.company_name || 'Unknown').trim();
      const empType = normalizeEmploymentType(item.job_type);
      const seniority = normalizeSeniority(title, tags);

      jobs.push({
        id: `rem-${item.id}`,
        sourceId: String(item.id),
        sourceName: this.name,
        title,
        company,
        location: locInfo.location,
        isRemote: true,
        isIndiaEligible: locInfo.isIndiaEligible,
        workplaceType: 'remote',
        description: item.description || '',
        applicationUrl: item.url,
        publishedAt: normalizeDate(item.publication_date),
        employmentType: empType,
        seniority,
        tags,
      });
    }

    return jobs;
  }
}
