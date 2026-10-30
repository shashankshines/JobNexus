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
  normalizeSalary,
  stripHtml,
} from '../../domain/job.normalization';

export interface NcsRawJobItem {
  id?: string;
  jobId?: string;
  title: string;
  organization: string;
  location: string;
  employmentType?: string;
  functionalArea?: string;
  experienceLevel?: string;
  salary?: string;
  applicationUrl?: string;
  publishedDate?: string;
  skills?: string[];
  description?: string;
  isRemote?: boolean;
}

export interface NcsOgdResponse {
  records?: Array<{
    job_id?: string;
    job_title?: string;
    employer_name?: string;
    job_location?: string;
    employment_type?: string;
    salary_range?: string;
    date_posted?: string;
    sector?: string;
    application_url?: string;
    job_description?: string;
  }>;
}

import { NCS_TEST_FIXTURE_VACANCIES } from '../../__tests__/fixtures/ncs.fixture';

/**
 * Re-export quarantined NCS test fixtures for backward compatibility in test suites.
 * In live production, NcsAdapter requires authenticated OGD / NCS endpoints and NEVER
 * injects synthetic listings into search results.
 */
export const VERIFIED_NCS_VACANCIES: NcsRawJobItem[] = NCS_TEST_FIXTURE_VACANCIES;

export class NcsAdapter implements JobProvider {
  readonly id = 'ncs';
  readonly name = 'National Career Service';
  readonly timeoutMs = 6000;

  /**
   * @param testFixtures Optional test fixtures injected exclusively in offline test suites.
   * In production, this parameter is omitted, guaranteeing zero synthetic listings.
   */
  constructor(private readonly testFixtures?: NcsRawJobItem[]) {}

  /**
   * Fetches National Career Service jobs from the official OGD (data.gov.in) API
   * or the verified National Career Service open employment dataset.
   */
  async fetchJobs(params?: JobSearchParams): Promise<NormalizedJob[]> {
    const apiKey = process.env.DATA_GOV_IN_API_KEY || process.env.NCS_API_KEY;
    const customEndpoint = process.env.NCS_API_ENDPOINT;

    let rawListings: NcsRawJobItem[] = [];

    if (customEndpoint || apiKey) {
      try {
        const endpoint =
          customEndpoint ||
          `https://api.data.gov.in/resource/ncs-vacancies?api-key=${encodeURIComponent(
            apiKey || ''
          )}&format=json&limit=50`;

        const res = await fetchWithTimeout(
          endpoint,
          {
            headers: {
              'User-Agent': 'JobNexus/1.0 (National Job Aggregator; +https://jobnexus.dev)',
              Accept: 'application/json',
            },
            cache: 'no-store',
            signal: params?.signal,
          },
          this.timeoutMs
        );

        if (res.ok) {
          const data = (await res.json()) as NcsOgdResponse;
          if (Array.isArray(data.records) && data.records.length > 0) {
            rawListings = data.records.map((r, idx) => ({
              id: r.job_id || `ncs-live-${idx}`,
              title: r.job_title || 'Technical Vacancy',
              organization: r.employer_name || 'Government of India',
              location: r.job_location || 'India',
              employmentType: r.employment_type || 'Full Time',
              salary: r.salary_range,
              applicationUrl: r.application_url || 'https://www.ncs.gov.in',
              publishedDate: r.date_posted,
              functionalArea: r.sector,
              description: r.job_description || '',
            }));
          }
        }
      } catch (err: unknown) {
        console.warn(
          '[NCS Adapter] Live OGD fetch failed:',
          err instanceof Error ? err.message : String(err)
        );
      }
    }

    // In production, unconfigured or empty live responses return [] with zero synthetic listings.
    // If explicit test fixtures are injected (e.g. during offline unit tests), evaluate them.
    if (rawListings.length === 0 && this.testFixtures && this.testFixtures.length > 0) {
      rawListings = [...this.testFixtures];
    }

    const normalized: NormalizedJob[] = [];

    for (const item of rawListings) {
      if (!item.title || !item.organization) continue;

      const appUrl =
        isValidHttpUrl(item.applicationUrl)
          ? canonicalizeUrl(item.applicationUrl!)
          : 'https://www.ncs.gov.in';

      const locInfo = normalizeLocation(item.location);
      const isRemote = Boolean(item.isRemote || locInfo.isRemote);
      const workplaceType: 'remote' | 'hybrid' | 'onsite' = isRemote
        ? 'remote'
        : locInfo.workplaceType === 'hybrid'
        ? 'hybrid'
        : 'onsite';

      const tags = Array.isArray(item.skills)
        ? [...item.skills]
        : ['Government', 'Public Sector'];
      if (item.functionalArea && !tags.includes(item.functionalArea)) {
        tags.push(item.functionalArea);
      }

      const idSource = item.id || `${item.organization}-${item.title}-${item.location}`;
      const idHash = crypto.createHash('sha256').update(idSource).digest('hex').slice(0, 16);

      const job: NormalizedJob = {
        id: `ncs-${idHash}`,
        sourceId: item.id || 'ncs-vacancy',
        sourceName: this.name,
        title: item.title.trim(),
        company: item.organization.trim(),
        location: locInfo.location,
        isRemote,
        isIndiaEligible: true, // NCS postings are inherently open/eligible in India
        workplaceType,
        description: item.description ? stripHtml(item.description) : '',
        applicationUrl: appUrl,
        publishedAt: normalizeDate(item.publishedDate),
        employmentType: normalizeEmploymentType(item.employmentType),
        seniority: normalizeSeniority(item.title, tags),
        tags: tags.slice(0, 6),
        salary: normalizeSalary(item.salary),
      };

      normalized.push(job);
    }

    return normalized;
  }
}
