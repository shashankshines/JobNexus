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
  stripHtml,
  classifyJobIndustry,
} from '../../domain/job.normalization';

export interface ReliefWebItem {
  id: string;
  fields: {
    title?: string;
    body?: string;
    url?: string;
    date?: {
      created?: string;
    };
    source?: Array<{ name?: string }>;
    country?: Array<{ name?: string }>;
    city?: Array<{ name?: string }>;
    theme?: Array<{ name?: string }>;
    career_categories?: Array<{ name?: string }>;
    type?: Array<{ name?: string }>;
  };
}

export interface ReliefWebApiResponse {
  data?: ReliefWebItem[];
}

export class ReliefWebAdapter implements JobProvider {
  readonly id = 'reliefweb';
  readonly name = 'ReliefWeb (UN OCHA)';
  readonly timeoutMs = 6000;

  constructor(private readonly testFixtures?: ReliefWebItem[]) {}

  async fetchJobs(): Promise<NormalizedJob[]> {
    let items: ReliefWebItem[] = [];

    if (this.testFixtures && this.testFixtures.length > 0) {
      items = this.testFixtures;
    } else {
      const appName = process.env.RELIEFWEB_APPNAME;
      if (!appName) {
        // If unconfigured in environment, safely return empty array without crashing
        return [];
      }

      try {
        const endpoint = `https://api.reliefweb.int/v2/jobs?appname=${encodeURIComponent(
          appName
        )}&limit=50&profile=full`;
        const res = await fetchWithTimeout(endpoint, { cache: 'no-store' }, this.timeoutMs);
        if (!res.ok) {
          throw new Error(`ReliefWeb API returned HTTP ${res.status}`);
        }
        const json = (await res.json()) as ReliefWebApiResponse;
        if (json && Array.isArray(json.data)) {
          items = json.data;
        }
      } catch (err: unknown) {
        console.error('[JobNexus] ReliefWeb fetch failed:', err);
        return [];
      }
    }

    const jobs: NormalizedJob[] = [];

    for (const item of items) {
      const f = item.fields;
      if (!f || !f.title || !f.url || !isValidHttpUrl(f.url)) continue;

      const title = f.title.trim();
      const orgName = f.source?.[0]?.name || 'United Nations / NGO';
      const company = orgName.trim();

      const country = f.country?.[0]?.name;
      const city = f.city?.[0]?.name;
      const rawLocation = [city, country].filter(Boolean).join(', ') || 'International';
      const locInfo = normalizeLocation(rawLocation);

      const themes = (f.theme || []).map((t) => t.name).filter((n): n is string => Boolean(n));
      const categories = (f.career_categories || [])
        .map((c) => c.name)
        .filter((n): n is string => Boolean(n));
      const tags = Array.from(new Set([...themes, ...categories, 'Humanitarian', 'Public Sector']));

      const empType = normalizeEmploymentType(f.type?.[0]?.name || 'Full Time');
      const seniority = normalizeSeniority(title, tags);
      const description = stripHtml(f.body || '');

      const classified = classifyJobIndustry(title, tags, description);

      const idSource = item.id || f.url;
      const idHash = crypto.createHash('sha256').update(idSource).digest('hex').slice(0, 16);

      jobs.push({
        id: `rw-${idHash}`,
        sourceId: item.id || '',
        sourceName: this.name,
        title,
        company,
        location: locInfo.location,
        isRemote: locInfo.isRemote,
        isIndiaEligible: locInfo.isIndiaEligible,
        workplaceType: locInfo.workplaceType,
        description,
        applicationUrl: canonicalizeUrl(f.url),
        publishedAt: normalizeDate(f.date?.created),
        employmentType: empType,
        seniority,
        tags,
        industry: classified.industry,
        category: classified.category,
      });
    }

    return jobs;
  }
}
