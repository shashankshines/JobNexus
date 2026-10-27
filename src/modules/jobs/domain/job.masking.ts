import { LegacyJob } from './job.types';
import { isValidHttpUrl } from './job.normalization';

export const ANONYMOUS_COMPANY_LABEL = 'Company undisclosed';

/**
 * Validates that an application URL is safe to open (valid HTTP/HTTPS, no javascript: or data: schemes).
 */
export function isValidApplicationUrl(url: unknown): boolean {
  if (typeof url !== 'string' || !url.trim()) return false;
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return false;
  }
  return isValidHttpUrl(trimmed);
}

/**
 * Strips known company name mentions from text (e.g. descriptions, tags)
 * replacing with a neutral label.
 */
function sanitizeText(text: string, realCompany: string): string {
  if (!text || !realCompany || realCompany.length < 2) return text;

  const variants = new Set<string>();
  variants.add(realCompany.trim());

  const withoutSpaces = realCompany.replace(/\s+/g, '');
  if (withoutSpaces.length >= 3) variants.add(withoutSpaces);

  const spaced = realCompany.replace(/([a-z])([A-Z])/g, '$1 $2');
  if (spaced !== realCompany) variants.add(spaced);

  let result = text;
  for (const variant of variants) {
    if (variant.length < 3) continue;
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    result = result.replace(regex, 'the company');
  }

  return result;
}

/**
 * Masks a single job for anonymous public consumers:
 * - Replaces company name with neutral ANONYMOUS_COMPANY_LABEL ("Company undisclosed").
 * - Clears external ATS application URL so anonymous visitors cannot access direct links.
 * - Filters out tags matching the company name.
 * - Sanitizes source name if it contains the company name.
 * - Sanitizes description if it explicitly mentions the company name.
 */
export function maskJobForAnonymous(job: LegacyJob): LegacyJob {
  const realCompany = job.company || '';

  // Filter tags: remove any tag that matches the company name
  const cleanTags = (job.tags || []).filter((tag) => {
    if (!tag) return false;
    const lowerTag = tag.trim().toLowerCase();
    const lowerCompany = realCompany.trim().toLowerCase();
    if (lowerTag === lowerCompany) return false;
    // Also remove tag if it is a company-specific board indicator
    if (lowerTag.includes(lowerCompany) && lowerCompany.length > 2) return false;
    return true;
  });

  // Clean source name: e.g. "Ashby ATS (Linear)" -> "Ashby ATS"
  let cleanSource = job.source || 'Verified ATS';
  const parenIdx = cleanSource.indexOf('(');
  if (parenIdx > 0) {
    cleanSource = cleanSource.slice(0, parenIdx).trim();
  }

  // Clean description of direct company references
  const cleanDescription = job.description
    ? sanitizeText(job.description, realCompany)
    : '';

  return {
    ...job,
    company: ANONYMOUS_COMPANY_LABEL,
    url: '', // Masked for anonymous visitors; revealed only upon authenticated session
    tags: cleanTags,
    source: cleanSource,
    description: cleanDescription,
  };
}

/**
 * Batch masks an array of jobs for anonymous consumption.
 */
export function maskJobsForAnonymous(jobs: LegacyJob[]): LegacyJob[] {
  return jobs.map(maskJobForAnonymous);
}

/**
 * Resolves a reliable, safe application URL with canonical source fallbacks.
 * Ensures the candidate is never blocked with a broken link or dead-end alert.
 */
export function getFallbackApplicationUrl(job: {
  title?: string;
  company?: string;
  source?: string;
  url?: string;
}): string {
  if (job.url && isValidApplicationUrl(job.url)) {
    return job.url;
  }

  const src = (job.source || '').toLowerCase();
  const title = encodeURIComponent(job.title || 'software engineer');
  const comp = encodeURIComponent(job.company && job.company !== ANONYMOUS_COMPANY_LABEL ? job.company : '');

  if (src.includes('weworkremotely') || src.includes('we work remotely')) {
    return `https://weworkremotely.com/remote-jobs?term=${title}`;
  }
  if (src.includes('ashby')) {
    return 'https://jobs.ashbyhq.com';
  }
  if (src.includes('greenhouse')) {
    return 'https://boards.greenhouse.io';
  }
  if (src.includes('remoteok')) {
    return `https://remoteok.com/remote-jobs?search=${title}`;
  }
  if (src.includes('himalayas')) {
    return `https://himalayas.app/jobs?q=${title}`;
  }
  if (src.includes('arbeitnow')) {
    return `https://www.arbeitnow.com/jobs?q=${title}`;
  }
  if (src.includes('jobicy')) {
    return `https://jobicy.com/jobs?q=${title}`;
  }
  if (src.includes('remotive')) {
    return `https://remotive.com/remote-jobs?query=${title}`;
  }
  if (src.includes('national career service') || src.includes('ncs')) {
    return 'https://www.ncs.gov.in/job-seeker/pages/search.aspx';
  }

  return comp
    ? `https://www.google.com/search?q=${comp}+${title}+careers+apply`
    : `https://www.google.com/search?q=${title}+remote+jobs+apply`;
}
