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
  normalizeSalary,
  stripHtml,
} from '../../domain/job.normalization';

export interface UkTeachingJobRaw {
  title?: string;
  url?: string;
  datePosted?: string;
  description?: string;
  employmentType?: string;
  industry?: string;
  hiringOrganization?: {
    name?: string;
    sameAs?: string;
  };
  jobLocation?: {
    address?: {
      addressLocality?: string;
      addressRegion?: string;
      addressCountry?: string;
      streetAddress?: string;
      postalCode?: string;
    };
  };
  baseSalary?: {
    value?: {
      value?: string;
    };
  };
}

export interface UkTeachingApiResponse {
  data?: UkTeachingJobRaw[];
}

export class TeachingAdapter implements JobProvider {
  readonly id = 'teaching_uk';
  readonly name = 'UK Teaching Vacancies';
  readonly timeoutMs = 6000;

  private readonly apiUrl = 'https://teaching-vacancies.service.gov.uk/api/v1/jobs.json';

  constructor(private readonly testFixtures?: UkTeachingJobRaw[]) {}

  async fetchJobs(): Promise<NormalizedJob[]> {
    let items: UkTeachingJobRaw[] = [];

    if (this.testFixtures && this.testFixtures.length > 0) {
      items = this.testFixtures;
    } else {
      try {
        const res = await fetchWithTimeout(this.apiUrl, { cache: 'no-store' }, this.timeoutMs);
        if (!res.ok) {
          throw new Error(`Teaching Vacancies API returned HTTP ${res.status}`);
        }
        const json = (await res.json()) as UkTeachingApiResponse;
        if (json && Array.isArray(json.data)) {
          items = json.data;
        }
      } catch (err: unknown) {
        console.error('[JobNexus] Teaching Vacancies fetch failed:', err);
        return [];
      }
    }

    const jobs: NormalizedJob[] = [];

    for (const item of items) {
      if (!item.title || !item.url || !isValidHttpUrl(item.url)) continue;

      const title = item.title.trim();
      const rawCompany = item.hiringOrganization?.name || 'Department for Education UK';
      const company = rawCompany.trim();

      const addr = item.jobLocation?.address;
      const locationParts = [
        addr?.addressLocality,
        addr?.addressRegion,
        addr?.addressCountry === 'GB' ? 'United Kingdom' : addr?.addressCountry,
      ].filter(Boolean);
      const rawLocation = locationParts.join(', ') || 'United Kingdom';
      const locInfo = normalizeLocation(rawLocation);

      const empType = normalizeEmploymentType(item.employmentType || 'Full Time');
      const tags = ['Education', 'Teaching', 'Schools', 'UK Public Sector'];
      const seniority = normalizeSeniority(title, tags);
      const salary = normalizeSalary(item.baseSalary?.value?.value);
      const description = stripHtml(item.description || '');

      const idSource = item.url;
      const idHash = crypto.createHash('sha256').update(idSource).digest('hex').slice(0, 16);

      jobs.push({
        id: `teach-${idHash}`,
        sourceId: item.url,
        sourceName: this.name,
        title,
        company,
        location: locInfo.location,
        isRemote: locInfo.isRemote,
        isIndiaEligible: locInfo.isIndiaEligible,
        workplaceType: locInfo.workplaceType,
        description,
        applicationUrl: canonicalizeUrl(item.url),
        publishedAt: normalizeDate(item.datePosted),
        employmentType: empType,
        seniority,
        tags,
        salary,
        industry: 'education',
        category: 'Education & Training',
      });
    }

    return jobs;
  }
}
