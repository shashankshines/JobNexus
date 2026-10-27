import crypto from 'node:crypto';
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
import {
  EmployerConfig,
  globalEmployerRegistry,
  isValidEmployerSlug,
} from '../../providers/employer.registry';

export interface GreenhouseJobRaw {
  id: number;
  title?: string;
  absolute_url?: string;
  location?: {
    name?: string;
  };
  updated_at?: string;
}

export interface GreenhouseBoardResponse {
  jobs?: GreenhouseJobRaw[];
}

export class GreenhouseAdapter implements JobProvider {
  readonly id = 'greenhouse';
  readonly name = 'Greenhouse ATS';

  constructor(
    private readonly employers?: EmployerConfig[],
    private readonly testFixtures?: Record<string, GreenhouseJobRaw[]>
  ) {}

  private getActiveEmployers(): EmployerConfig[] {
    if (this.employers && this.employers.length > 0) {
      return this.employers.filter((e) => e.active);
    }
    return globalEmployerRegistry.getByAts('greenhouse');
  }

  async fetchJobs(): Promise<NormalizedJob[]> {
    const employers = this.getActiveEmployers();
    const allJobs: NormalizedJob[] = [];

    const results = await Promise.allSettled(
      employers.map((emp) => this.fetchBoardJobs(emp))
    );

    for (const res of results) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        allJobs.push(...res.value);
      }
    }

    return allJobs;
  }

  async fetchBoardJobs(employer: EmployerConfig): Promise<NormalizedJob[]> {
    const { slug, name: companyName } = employer;

    // SSRF & path traversal guard
    if (!isValidEmployerSlug(slug)) {
      console.warn(`[GreenhouseAdapter] Rejected unsafe board slug "${slug}"`);
      return [];
    }

    let jobsList: GreenhouseJobRaw[] = [];

    if (this.testFixtures && this.testFixtures[slug]) {
      jobsList = this.testFixtures[slug];
    } else {
      const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;
      const res = await fetchWithTimeout(
        url,
        {
          headers: {
            'User-Agent': 'JobNexus/1.0 (Public Global Job Search Platform)',
            Accept: 'application/json',
          },
          cache: 'no-store',
        },
        6000
      );

      if (!res.ok) {
        throw new Error(`Greenhouse board ${slug} returned HTTP status ${res.status}`);
      }

      const data: GreenhouseBoardResponse = await res.json();
      if (!data.jobs || !Array.isArray(data.jobs)) {
        return [];
      }
      jobsList = data.jobs;
    }

    const normalized: NormalizedJob[] = [];

    for (const raw of jobsList) {
      if (!raw.title || !raw.absolute_url || !isValidHttpUrl(raw.absolute_url)) {
        continue;
      }

      const canonicalUrl = canonicalizeUrl(raw.absolute_url);
      const rawLocation = raw.location?.name || 'Worldwide';
      const locInfo = normalizeLocation(rawLocation);

      const idHash = crypto
        .createHash('sha256')
        .update(`gh:${slug}:${raw.id}`)
        .digest('hex')
        .slice(0, 16);

      const safeId = `gh-${idHash}`;
      const job: NormalizedJob = {
        id: safeId,
        sourceId: this.id,
        sourceName: this.name,
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
        tags: [locInfo.isRemote ? 'Remote' : 'On-site'],
        description: '',
      };

      normalized.push(job);
    }

    return normalized;
  }
}
