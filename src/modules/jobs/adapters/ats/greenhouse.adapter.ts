import { JobProvider, fetchWithTimeout } from '../../providers/provider.types';
import { NormalizedJob } from '../../domain/job.types';
import {
  canonicalizeUrl,
  isValidHttpUrl,
  normalizeDate,
  normalizeEmploymentType,
  normalizeLocation,
  normalizeSeniority,
} from '../../domain/job.normalization';

interface GreenhouseJobRaw {
  id: number;
  title?: string;
  absolute_url?: string;
  location?: {
    name?: string;
  };
  updated_at?: string;
}

interface GreenhouseBoardResponse {
  jobs?: GreenhouseJobRaw[];
}

export class GreenhouseAdapter implements JobProvider {
  readonly id = 'greenhouse';
  readonly name = 'Greenhouse ATS';
  private readonly defaultBoards: Array<{ slug: string; companyName: string }> = [
    { slug: 'canonical', companyName: 'Canonical' },
    { slug: 'automattic', companyName: 'Automattic' },
    { slug: 'gitlab', companyName: 'GitLab' },
  ];

  async fetchJobs(): Promise<NormalizedJob[]> {
    const allJobs: NormalizedJob[] = [];

    const results = await Promise.allSettled(
      this.defaultBoards.map((board) => this.fetchBoardJobs(board.slug, board.companyName))
    );

    for (const res of results) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        allJobs.push(...res.value);
      }
    }

    return allJobs;
  }

  async fetchBoardJobs(boardSlug: string, companyName: string): Promise<NormalizedJob[]> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${boardSlug}/jobs`;
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          'User-Agent': 'JobNexus/1.0 (Public Job Search Platform)',
          Accept: 'application/json',
        },
        cache: 'no-store',
      },
      6000
    );

    if (!res.ok) {
      throw new Error(`Greenhouse board ${boardSlug} returned HTTP status ${res.status}`);
    }

    const data: GreenhouseBoardResponse = await res.json();
    if (!data.jobs || !Array.isArray(data.jobs)) {
      return [];
    }

    const normalized: NormalizedJob[] = [];

    for (const raw of data.jobs) {
      if (!raw.title || !raw.absolute_url || !isValidHttpUrl(raw.absolute_url)) {
        continue;
      }

      const canonicalUrl = canonicalizeUrl(raw.absolute_url);
      const rawLocation = raw.location?.name || 'Worldwide';
      const locInfo = normalizeLocation(rawLocation);

      const job: NormalizedJob = {
        id: `gh-${boardSlug}-${raw.id}`,
        sourceId: this.id,
        sourceName: `${this.name} (${companyName})`,
        title: raw.title.trim(),
        company: companyName,
        location: locInfo.location,
        applicationUrl: canonicalUrl,
        employmentType: normalizeEmploymentType(undefined),
        seniority: normalizeSeniority(raw.title),
        isRemote: locInfo.isRemote,
        workplaceType: locInfo.workplaceType,
        isIndiaEligible: locInfo.isIndiaEligible,
        publishedAt: normalizeDate(raw.updated_at),
        tags: [companyName, locInfo.isRemote ? 'Remote' : 'On-site'],
        description: '',
      };

      normalized.push(job);
    }

    return normalized;
  }
}
