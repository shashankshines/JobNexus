import crypto from 'node:crypto';
import { JobProvider, fetchWithTimeout } from '../../providers/provider.types';
import { JobSearchParams } from '../../domain/job.types';
import { NormalizedJob } from '../../domain/job.types';
import {
  canonicalizeUrl,
  isValidHttpUrl,
  normalizeDate,
  normalizeEmploymentType,
  normalizeSeniority,
  stripHtml,
} from '../../domain/job.normalization';

interface HimalayasJobRaw {
  title?: string;
  companyName?: string;
  applicationLink?: string;
  guid?: string;
  locationRestrictions?: string[];
  employmentType?: string;
  seniority?: string[];
  categories?: string[];
  description?: string;
  pubDate?: number;
}

interface HimalayasApiResponse {
  jobs?: HimalayasJobRaw[];
}

export class HimalayasAdapter implements JobProvider {
  readonly id = 'himalayas';
  readonly name = 'Himalayas';
  readonly isRemoteOnly = true;
  private readonly baseUrl = 'https://himalayas.app/jobs/api?limit=50';

  async fetchJobs(params?: JobSearchParams): Promise<NormalizedJob[]> {
    const res = await fetchWithTimeout(
      this.baseUrl,
      {
        headers: {
          'User-Agent': 'JobNexus/1.0 (Public Job Search Platform)',
          Accept: 'application/json',
        },
        cache: 'no-store',
        signal: params?.signal,
      },
      7000
    );

    if (!res.ok) {
      throw new Error(`Himalayas API responded with HTTP status ${res.status}`);
    }

    const data: HimalayasApiResponse = await res.json();
    if (!data.jobs || !Array.isArray(data.jobs)) {
      return [];
    }

    const normalized: NormalizedJob[] = [];

    for (const raw of data.jobs) {
      if (!raw.title || !raw.companyName || !raw.applicationLink) {
        continue;
      }

      if (!isValidHttpUrl(raw.applicationLink)) {
        continue;
      }

      const canonicalUrl = canonicalizeUrl(raw.applicationLink);
      const restrictions = Array.isArray(raw.locationRestrictions) ? raw.locationRestrictions : [];
      const locationText = restrictions.length > 0 ? restrictions.join(', ') : 'Remote (Worldwide)';

      const isIndiaRestricted = restrictions.some(
        (r) =>
          r.toLowerCase().includes('india') ||
          r.toLowerCase().includes('worldwide') ||
          r.toLowerCase().includes('anywhere')
      );

      const idSource = raw.guid || canonicalUrl;
      const idHash = crypto.createHash('sha256').update(idSource).digest('hex').slice(0, 16);
      const job: NormalizedJob = {
        id: `himalayas-${idHash}`,
        sourceId: this.id,
        sourceName: this.name,
        title: raw.title.trim(),
        company: raw.companyName.trim(),
        location: locationText,
        applicationUrl: canonicalUrl,
        employmentType: normalizeEmploymentType(raw.employmentType),
        seniority: normalizeSeniority(raw.seniority?.[0] || raw.title),
        isRemote: true,
        workplaceType: 'remote',
        isIndiaEligible: restrictions.length === 0 || isIndiaRestricted,
        publishedAt: normalizeDate(raw.pubDate ? raw.pubDate * 1000 : undefined),
        tags: Array.isArray(raw.categories) ? raw.categories.slice(0, 6) : [],
        description: raw.description ? stripHtml(raw.description).slice(0, 500) : '',
      };

      normalized.push(job);
    }

    return normalized;
  }
}
