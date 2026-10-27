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

export interface AshbyJobRaw {
  id: string;
  title?: string;
  jobUrl?: string;
  location?: string;
  isRemote?: boolean;
  workplaceType?: string;
  employmentType?: string;
  publishedAt?: string;
  department?: string;
}

export interface AshbyBoardResponse {
  jobs?: AshbyJobRaw[];
}

export class AshbyAdapter implements JobProvider {
  readonly id = 'ashby';
  readonly name = 'Ashby ATS';

  constructor(
    private readonly employers?: EmployerConfig[],
    private readonly testFixtures?: Record<string, AshbyJobRaw[]>
  ) {}

  private getActiveEmployers(): EmployerConfig[] {
    if (this.employers && this.employers.length > 0) {
      return this.employers.filter((e) => e.active);
    }
    return globalEmployerRegistry.getByAts('ashby');
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
      console.warn(`[AshbyAdapter] Rejected unsafe board slug "${slug}"`);
      return [];
    }

    let jobsList: AshbyJobRaw[] = [];

    if (this.testFixtures && this.testFixtures[slug]) {
      jobsList = this.testFixtures[slug];
    } else {
      const url = `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
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
        throw new Error(`Ashby board ${slug} returned HTTP status ${res.status}`);
      }

      const data: AshbyBoardResponse = await res.json();
      if (!data.jobs || !Array.isArray(data.jobs)) {
        return [];
      }
      jobsList = data.jobs;
    }

    const normalized: NormalizedJob[] = [];

    for (const raw of jobsList) {
      if (!raw.title || !raw.jobUrl || !isValidHttpUrl(raw.jobUrl)) {
        continue;
      }

      const canonicalUrl = canonicalizeUrl(raw.jobUrl);
      const locInfo = normalizeLocation(raw.location || (raw.isRemote ? 'Remote' : 'Worldwide'));

      const isRemote = Boolean(raw.isRemote || raw.workplaceType?.toLowerCase() === 'remote' || locInfo.isRemote);
      const workplaceType = isRemote
        ? 'remote'
        : raw.workplaceType?.toLowerCase() === 'hybrid'
        ? 'hybrid'
        : locInfo.workplaceType;

      const idHash = crypto
        .createHash('sha256')
        .update(`ashby:${slug}:${raw.id}`)
        .digest('hex')
        .slice(0, 16);

      const safeId = `ashby-${idHash}`;
      const job: NormalizedJob = {
        id: safeId,
        sourceId: this.id,
        sourceName: this.name,
        title: raw.title.trim(),
        company: companyName,
        location: locInfo.location,
        applicationUrl: canonicalUrl,
        employmentType: normalizeEmploymentType(raw.employmentType),
        seniority: normalizeSeniority(raw.title),
        isRemote,
        workplaceType,
        isIndiaEligible: locInfo.isIndiaEligible,
        publishedAt: normalizeDate(raw.publishedAt),
        tags: [raw.department || '', isRemote ? 'Remote' : 'On-site'].filter(Boolean),
        description: '',
      };

      normalized.push(job);
    }

    return normalized;
  }
}
