import crypto from 'node:crypto';
import { JobProvider, fetchWithTimeout } from '../../providers/provider.types';
import { NormalizedJob } from '../../domain/job.types';
import {
  canonicalizeUrl,
  isValidHttpUrl,
  normalizeDate,
  normalizeEmploymentType,
  normalizeSeniority,
  stripHtml,
} from '../../domain/job.normalization';

export class WeWorkRemotelyAdapter implements JobProvider {
  readonly id = 'weworkremotely';
  readonly name = 'We Work Remotely';
  readonly isRemoteOnly = true;
  private readonly feedUrl = 'https://weworkremotely.com/remote-jobs.rss';

  async fetchJobs(): Promise<NormalizedJob[]> {
    const res = await fetchWithTimeout(
      this.feedUrl,
      {
        headers: {
          'User-Agent': 'JobNexus/1.0 (Public Job Search Platform)',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
        cache: 'no-store',
      },
      7000
    );

    if (!res.ok) {
      throw new Error(`WeWorkRemotely RSS responded with HTTP status ${res.status}`);
    }

    const xml = await res.text();
    return this.parseRssXml(xml);
  }

  parseRssXml(xml: string): NormalizedJob[] {
    const normalized: NormalizedJob[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;

    const extractTag = (xmlChunk: string, tagName: string): string => {
      const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
      const tagMatch = xmlChunk.match(regex);
      if (!tagMatch) return '';
      let text = tagMatch[1].trim();
      if (text.startsWith('<![CDATA[') && text.endsWith(']]>')) {
        text = text.substring(9, text.length - 3).trim();
      }
      return text;
    };

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemChunk = match[1];
      const rawTitle = extractTag(itemChunk, 'title');
      const link = extractTag(itemChunk, 'link') || extractTag(itemChunk, 'guid');
      const region = extractTag(itemChunk, 'region') || 'Remote (Worldwide)';
      const pubDate = extractTag(itemChunk, 'pubDate');
      const rawType = extractTag(itemChunk, 'type');
      const category = extractTag(itemChunk, 'category');
      const description = extractTag(itemChunk, 'description');

      if (!rawTitle || !link || !isValidHttpUrl(link)) {
        continue;
      }

      let company = 'We Work Remotely';
      let title = rawTitle;
      const colonIdx = rawTitle.indexOf(':');
      if (colonIdx > 0) {
        company = rawTitle.slice(0, colonIdx).trim();
        title = rawTitle.slice(colonIdx + 1).trim();
      }

      const canonicalUrl = canonicalizeUrl(link);
      const isWorldwide =
        region.toLowerCase().includes('anywhere') ||
        region.toLowerCase().includes('worldwide') ||
        region.toLowerCase().includes('world');
      const isIndia = region.toLowerCase().includes('india') || isWorldwide;

      // Generate deterministic 16-hex hash of canonical URL to guarantee uniqueness and mask company identity
      const idHash = crypto.createHash('sha256').update(canonicalUrl).digest('hex').slice(0, 16);

      const job: NormalizedJob = {
        id: `wwr-${idHash}`,
        sourceId: this.id,
        sourceName: this.name,
        title: title.trim(),
        company: company.trim(),
        location: region,
        applicationUrl: canonicalUrl,
        employmentType: normalizeEmploymentType(rawType),
        seniority: normalizeSeniority(title),
        isRemote: true,
        workplaceType: 'remote',
        isIndiaEligible: isIndia,
        publishedAt: normalizeDate(pubDate),
        tags: [category, 'Remote'].filter(Boolean),
        description: description ? stripHtml(description).slice(0, 500) : '',
      };

      normalized.push(job);
    }

    return normalized;
  }
}
