import crypto from 'node:crypto';
import { JobProvider, fetchWithTimeout } from '../../providers/provider.types';
import { JobSearchParams } from '../../domain/job.types';
import { NormalizedJob } from '../../domain/job.types';
import {
  normalizeDate,
  normalizeLocation,
  normalizeEmploymentType,
  normalizeSeniority,
  isValidHttpUrl,
} from '../../domain/job.normalization';

interface ArbeitnowItem {
  slug: string;
  title: string;
  company_name: string;
  location: string;
  job_types?: string[];
  url: string;
  created_at: number;
  tags?: string[];
  description?: string;
  remote?: boolean;
}

interface ArbeitnowResponse {
  data?: ArbeitnowItem[];
}

export class ArbeitnowAdapter implements JobProvider {
  readonly id = 'arbeitnow';
  readonly name = 'Arbeitnow';
  readonly timeoutMs = 6000;

  // Use www. to prevent 301 redirect penalty
  private readonly apiUrl = 'https://www.arbeitnow.com/api/job-board-api';

  async fetchJobs(params?: JobSearchParams): Promise<NormalizedJob[]> {
    const res = await fetchWithTimeout(this.apiUrl, { cache: 'no-store', signal: params?.signal }, this.timeoutMs);
    if (!res.ok) {
      throw new Error(`Arbeitnow API returned HTTP ${res.status}`);
    }

    const json = (await res.json()) as ArbeitnowResponse;
    if (!json || !Array.isArray(json.data)) {
      return [];
    }

    const jobs: NormalizedJob[] = [];

    for (const item of json.data) {
      if (!item.title || !isValidHttpUrl(item.url)) continue;

      const locInfo = normalizeLocation(item.location);
      const tags = Array.isArray(item.tags) ? item.tags : [];
      const title = item.title.trim();
      const company = (item.company_name || 'Unknown').trim();
      const empType = normalizeEmploymentType((item.job_types || []).join(', '));
      const seniority = normalizeSeniority(title, tags);

      const idSource = item.slug || item.url;
      const idHash = crypto.createHash('sha256').update(idSource).digest('hex').slice(0, 16);

      jobs.push({
        id: `arb-${idHash}`,
        sourceId: item.slug || '',
        sourceName: this.name,
        title,
        company,
        location: locInfo.location,
        isRemote: item.remote || locInfo.isRemote,
        isIndiaEligible: locInfo.isIndiaEligible,
        workplaceType: item.remote ? 'remote' : locInfo.workplaceType,
        description: item.description || '',
        applicationUrl: item.url,
        publishedAt: normalizeDate(item.created_at),
        employmentType: empType,
        seniority,
        tags,
      });
    }

    return jobs;
  }
}
