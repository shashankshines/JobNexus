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
} from '../../domain/job.normalization';
import {
  EmployerConfig,
  globalEmployerRegistry,
  isValidEmployerSlug,
} from '../../providers/employer.registry';

export interface LeverPostingRaw {
  id: string;
  text?: string;
  createdAt?: number;
  descriptionPlain?: string;
  descriptionBody?: string;
  description?: string;
  hostedUrl?: string;
  applyUrl?: string;
  categories?: {
    commitment?: string;
    department?: string;
    location?: string;
    team?: string;
    allLocations?: string[];
  };
  country?: string;
  workplaceType?: string;
}

export class LeverAdapter implements JobProvider {
  readonly id = 'lever';
  readonly name = 'Lever ATS';
  readonly timeoutMs = 2500;

  constructor(
    private readonly employers?: EmployerConfig[],
    private readonly testFixtures?: Record<string, LeverPostingRaw[]>
  ) {}

  private getActiveEmployers(): EmployerConfig[] {
    if (this.employers && this.employers.length > 0) {
      return this.employers.filter((e) => e.active);
    }
    return globalEmployerRegistry.getByAts('lever');
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
      console.warn(`[LeverAdapter] Rejected unsafe board slug "${slug}"`);
      return [];
    }

    let postings: LeverPostingRaw[] = [];

    // Offline test fixture support
    if (this.testFixtures && this.testFixtures[slug]) {
      postings = this.testFixtures[slug];
    } else {
      const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
      const res = await fetchWithTimeout(
        url,
        {
          headers: {
            'User-Agent': 'JobNexus/1.0 (Public Global Job Search Platform)',
            Accept: 'application/json',
          },
          cache: 'no-store',
        },
        this.timeoutMs
      );

      if (!res.ok) {
        throw new Error(`Lever board ${slug} returned HTTP status ${res.status}`);
      }

      const data = await res.json();
      if (!Array.isArray(data)) {
        return [];
      }
      postings = data;
    }

    const normalized: NormalizedJob[] = [];

    for (const raw of postings) {
      const title = raw.text?.trim();
      const rawUrl = raw.applyUrl || raw.hostedUrl;

      if (!title || !rawUrl || !isValidHttpUrl(rawUrl)) {
        continue;
      }

      const canonicalUrl = canonicalizeUrl(rawUrl);
      const rawLocation =
        raw.categories?.location ||
        (raw.categories?.allLocations && raw.categories.allLocations[0]) ||
        raw.country ||
        'Worldwide';

      const locInfo = normalizeLocation(rawLocation);

      const rawWp = raw.workplaceType?.toLowerCase();
      const isRemote = Boolean(
        rawWp === 'remote' ||
        locInfo.isRemote ||
        rawLocation.toLowerCase().includes('remote')
      );

      const workplaceType: 'remote' | 'hybrid' | 'onsite' = isRemote
        ? 'remote'
        : rawWp === 'hybrid' || locInfo.workplaceType === 'hybrid'
        ? 'hybrid'
        : 'onsite';

      const publishedAt = raw.createdAt
        ? new Date(raw.createdAt).toISOString()
        : undefined;

      const desc = raw.descriptionPlain
        ? raw.descriptionPlain.slice(0, 500)
        : raw.descriptionBody || raw.description
        ? stripHtml(raw.descriptionBody || raw.description || '').slice(0, 500)
        : '';

      const tags: string[] = [];
      if (raw.categories?.department) tags.push(raw.categories.department);
      if (raw.categories?.team && !tags.includes(raw.categories.team)) {
        tags.push(raw.categories.team);
      }
      if (isRemote && !tags.includes('Remote')) tags.push('Remote');

      const idHash = crypto
        .createHash('sha256')
        .update(`lever:${slug}:${raw.id}`)
        .digest('hex')
        .slice(0, 16);

      const job: NormalizedJob = {
        id: `lever-${idHash}`,
        sourceId: this.id,
        sourceName: this.name,
        title,
        company: companyName,
        location: locInfo.location,
        applicationUrl: canonicalUrl,
        employmentType: normalizeEmploymentType(raw.categories?.commitment),
        seniority: normalizeSeniority(title, tags),
        isRemote,
        workplaceType,
        isIndiaEligible: locInfo.isIndiaEligible,
        publishedAt: normalizeDate(publishedAt),
        tags: tags.slice(0, 6),
        description: desc,
      };

      normalized.push(job);
    }

    return normalized;
  }
}
