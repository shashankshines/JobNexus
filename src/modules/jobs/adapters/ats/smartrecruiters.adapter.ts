import crypto from 'node:crypto';
import { JobProvider, fetchWithTimeout } from '../../providers/provider.types';
import { NormalizedJob, JobSearchParams } from '../../domain/job.types';
import {
  canonicalizeUrl,
  isValidHttpUrl,
  normalizeDate,
  normalizeEmploymentType,
  normalizeLocation,
  normalizeSeniority,
  stripHtml,
} from '../../domain/job.normalization';
import {
  EmployerConfig,
  globalEmployerRegistry,
  isValidEmployerSlug,
} from '../../providers/employer.registry';
import { classifyJobIndustry } from '../../domain/job.taxonomy';
import { executeSettledWithConcurrencyLimit } from '../../services/concurrency';

export interface SmartRecruitersJobRaw {
  id: string;
  name?: string;
  company?: {
    name?: string;
  };
  location?: {
    city?: string;
    region?: string;
    country?: string;
    remote?: boolean;
  };
  industry?: {
    id?: string;
    label?: string;
  };
  department?: {
    id?: string;
    label?: string;
  };
  typeOfEmployment?: {
    id?: string;
    label?: string;
  };
  experienceLevel?: {
    id?: string;
    label?: string;
  };
  releasedDate?: string;
  refNumber?: string;
}

export interface SmartRecruitersResponse {
  content?: SmartRecruitersJobRaw[];
  totalFound?: number;
}

export class SmartRecruitersAdapter implements JobProvider {
  readonly id = 'smartrecruiters';
  readonly name = 'SmartRecruiters ATS';

  constructor(
    private readonly employers?: EmployerConfig[],
    private readonly testFixtures?: Record<string, SmartRecruitersJobRaw[]>
  ) {}

  private getActiveEmployers(): EmployerConfig[] {
    if (this.employers && this.employers.length > 0) {
      return this.employers.filter((e) => e.active);
    }
    return globalEmployerRegistry.getByAts('smartrecruiters');
  }

  async fetchJobs(params?: JobSearchParams): Promise<NormalizedJob[]> {
    const employers = this.getActiveEmployers();
    const allJobs: NormalizedJob[] = [];

    const results = await executeSettledWithConcurrencyLimit(
      employers.map((emp) => () => this.fetchBoardJobs(emp, params?.signal)),
      6
    );

    for (const res of results) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        allJobs.push(...res.value);
      }
    }

    return allJobs;
  }

  private async fetchBoardJobs(
    employer: EmployerConfig,
    signal?: AbortSignal
  ): Promise<NormalizedJob[]> {
    const slug = employer.slug.trim();
    if (!isValidEmployerSlug(slug)) {
      console.warn(`[SmartRecruitersAdapter] Rejected invalid slug "${slug}"`);
      return [];
    }

    try {
      let rawJobs: SmartRecruitersJobRaw[] = [];

      if (this.testFixtures && this.testFixtures[slug]) {
        rawJobs = this.testFixtures[slug];
      } else {
        const url = `https://api.smartrecruiters.com/v1/companies/${slug}/postings`;
        const res = await fetchWithTimeout(
          url,
          {
            signal,
            headers: {
              Accept: 'application/json',
              'User-Agent': 'JobNexus/2.0 (SmartRecruiters ATS Aggregator)',
            },
          },
          5000
        );

        if (!res.ok) {
          if (res.status === 404) return [];
          throw new Error(`SmartRecruiters API responded with HTTP ${res.status}`);
        }

        const data: SmartRecruitersResponse = await res.json();
        rawJobs = Array.isArray(data.content) ? data.content : [];
      }

      return rawJobs
        .map((raw) => this.normalizeJob(raw, employer))
        .filter((job): job is NormalizedJob => job !== null);
    } catch (err: unknown) {
      if (signal?.aborted) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[SmartRecruitersAdapter] Failed to fetch board ${employer.name} (${slug}): ${msg}`);
      return [];
    }
  }

  private normalizeJob(
    raw: SmartRecruitersJobRaw,
    employer: EmployerConfig
  ): NormalizedJob | null {
    const title = (raw.name || '').trim();
    if (!title || !raw.id) return null;

    const rawLocParts = [
      raw.location?.city,
      raw.location?.region,
      raw.location?.country?.toUpperCase(),
    ].filter(Boolean);
    const rawLocStr = rawLocParts.join(', ');
    const isExplicitRemote = raw.location?.remote === true;

    const locNorm = normalizeLocation(rawLocStr, undefined, isExplicitRemote);
    const appUrl = `https://jobs.smartrecruiters.com/${employer.slug}/${raw.id}`;
    if (!isValidHttpUrl(appUrl)) return null;

    const publishedAt = normalizeDate(raw.releasedDate);
    const tags: string[] = [];
    if (employer.industry) tags.push(employer.industry);
    if (raw.department?.label) tags.push(raw.department.label);
    if (raw.industry?.label) tags.push(raw.industry.label);
    if (locNorm.isRemote) tags.push('Remote');
    if (locNorm.isIndiaEligible) tags.push('India');

    const cleanDesc = `Role at ${employer.name} in ${locNorm.location}. Department: ${raw.department?.label || 'General'}. Employment: ${raw.typeOfEmployment?.label || 'Full Time'}.`;

    const { industry: classifiedIndustry, category: classifiedCategory } = classifyJobIndustry(
      title,
      tags,
      cleanDesc,
      { industry: employer.industry }
    );

    const hash = crypto
      .createHash('sha256')
      .update(`smartrecruiters:${employer.slug}:${raw.id}`)
      .digest('hex');

    return {
      id: `smartrecruiters_${hash.slice(0, 16)}`,
      sourceId: 'smartrecruiters',
      sourceName: `SmartRecruiters (${employer.name})`,
      title,
      company: employer.name,
      location: locNorm.location,
      isRemote: locNorm.isRemote,
      isIndiaEligible: locNorm.isIndiaEligible,
      workplaceType: locNorm.workplaceType,
      primaryWorkplaceType: locNorm.primaryType,
      remoteEligibility: locNorm.remoteEligibility,
      description: cleanDesc,
      applicationUrl: canonicalizeUrl(appUrl),
      sourceUrl: employer.careerPageUrl || appUrl,
      publishedAt,
      employmentType: normalizeEmploymentType(raw.typeOfEmployment?.label || raw.typeOfEmployment?.id),
      seniority: normalizeSeniority(title, tags),
      tags,
      industry: classifiedIndustry,
      category: classifiedCategory,
      status: 'active',
    };
  }
}

