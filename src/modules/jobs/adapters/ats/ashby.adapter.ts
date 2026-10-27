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

interface AshbyJobRaw {
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

interface AshbyBoardResponse {
  jobs?: AshbyJobRaw[];
}

export class AshbyAdapter implements JobProvider {
  readonly id = 'ashby';
  readonly name = 'Ashby ATS';
  private readonly defaultBoards: Array<{ slug: string; companyName: string }> = [
    { slug: 'linear', companyName: 'Linear' },
    { slug: 'retool', companyName: 'Retool' },
    { slug: 'ramp', companyName: 'Ramp' },
  ];

  async fetchJobs(): Promise<NormalizedJob[]> {
    const allJobs: NormalizedJob[] = [];

    const results = await Promise.allSettled(
      this.defaultBoards.map((b) => this.fetchBoardJobs(b.slug, b.companyName))
    );

    for (const res of results) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        allJobs.push(...res.value);
      }
    }

    return allJobs;
  }

  async fetchBoardJobs(boardSlug: string, companyName: string): Promise<NormalizedJob[]> {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${boardSlug}`;
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
      throw new Error(`Ashby board ${boardSlug} returned HTTP status ${res.status}`);
    }

    const data: AshbyBoardResponse = await res.json();
    if (!data.jobs || !Array.isArray(data.jobs)) {
      return [];
    }

    const normalized: NormalizedJob[] = [];

    for (const raw of data.jobs) {
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

      const idHash = crypto.createHash('sha256').update(`${boardSlug}:${raw.id}`).digest('hex').slice(0, 16);
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
