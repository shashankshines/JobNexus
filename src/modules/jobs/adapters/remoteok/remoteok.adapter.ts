import { JobProvider, fetchWithTimeout } from '../../providers/provider.types';
import { NormalizedJob } from '../../domain/job.types';
import {
  normalizeDate,
  normalizeLocation,
  normalizeEmploymentType,
  normalizeSeniority,
  isValidHttpUrl,
  stripHtml,
} from '../../domain/job.normalization';

interface RemoteOkItem {
  id?: number | string;
  position?: string;
  company?: string;
  location?: string;
  url?: string;
  apply_url?: string;
  date?: string;
  tags?: string[];
  description?: string;
  legal?: string;
}

export class RemoteOkAdapter implements JobProvider {
  readonly id = 'remoteok';
  readonly name = 'RemoteOK';
  readonly timeoutMs = 6000;

  private readonly apiUrl = 'https://remoteok.com/api';

  async fetchJobs(): Promise<NormalizedJob[]> {
    // CRITICAL BUG FIX: RemoteOK must use fetchWithTimeout to prevent hanging the API route
    const res = await fetchWithTimeout(
      this.apiUrl,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 JobNexus/1.0',
        },
      },
      this.timeoutMs
    );

    if (!res.ok) {
      throw new Error(`RemoteOK API returned HTTP ${res.status}`);
    }

    const json = (await res.json()) as unknown;
    if (!Array.isArray(json) || json.length === 0) {
      return [];
    }

    // First item is legal disclaimer; real jobs start at index 1
    const rawItems = (json as RemoteOkItem[]).slice(1);
    const jobs: NormalizedJob[] = [];

    for (const item of rawItems.slice(0, 300)) {
      if (!item.position || !item.id) continue;
      const appUrl = item.apply_url || item.url || '';
      if (!isValidHttpUrl(appUrl)) continue;

      const locInfo = normalizeLocation(item.location || 'Remote');
      const tags = Array.isArray(item.tags) ? item.tags : [];
      const title = item.position.trim();
      const company = (item.company || 'Unknown').trim();
      const empType = normalizeEmploymentType('Full Time');
      const seniority = normalizeSeniority(title, tags);
      const cleanDesc = stripHtml(item.description || '');

      jobs.push({
        id: `rok-${item.id}`,
        sourceId: String(item.id),
        sourceName: this.name,
        title,
        company,
        location: locInfo.location,
        isRemote: true,
        isIndiaEligible: locInfo.isIndiaEligible,
        workplaceType: 'remote',
        description: cleanDesc,
        applicationUrl: appUrl,
        publishedAt: normalizeDate(item.date),
        employmentType: empType,
        seniority,
        tags,
      });
    }

    return jobs;
  }
}
