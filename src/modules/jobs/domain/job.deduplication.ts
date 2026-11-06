import crypto from 'node:crypto';
import { NormalizedJob } from './job.types';
import { canonicalizeUrl } from './job.normalization';

export function cleanCompany(company: string): string {
  return company
    .toLowerCase()
    .replace(/\b(inc\.?|llc\.?|ltd\.?|pvt\.?|corp\.?|technologies|software|solutions|systems)\b/gi, '')
    .replace(/[^a-z0-9]/gi, '')
    .trim();
}

export function cleanTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getLocationBucket(job: NormalizedJob): string {
  if (job.isRemote) return 'remote';
  return (job.location || 'unspecified')
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, '')
    .trim();
}

export function deduplicateJobs(jobs: NormalizedJob[]): NormalizedJob[] {
  const seenCanonicalUrls = new Map<string, NormalizedJob>();
  const seenRoleKeys = new Map<string, NormalizedJob>();
  const seenJobIds = new Set<string>();
  const uniqueJobs: NormalizedJob[] = [];

  for (const job of jobs) {
    const canonicalUrl = canonicalizeUrl(job.applicationUrl);

    // Check layer 1: URL match
    if (canonicalUrl && seenCanonicalUrls.has(canonicalUrl)) {
      const existing = seenCanonicalUrls.get(canonicalUrl)!;
      mergeProvenance(existing, job);
      continue;
    }

    // Check layer 2: Company + Title + Location bucket
    const comp = cleanCompany(job.company);
    const title = cleanTitle(job.title);
    const loc = getLocationBucket(job);
    const roleKey = `${comp}:::${title}:::${loc}`;

    if (comp && title && seenRoleKeys.has(roleKey)) {
      const existing = seenRoleKeys.get(roleKey)!;
      // Multi-sector protection: If both listings define distinct non-empty industries,
      // they represent distinct departmental vacancies and should not be collapsed.
      if (!existing.industry || !job.industry || existing.industry === job.industry) {
        mergeProvenance(existing, job);
        continue;
      }
    }

    // Check layer 3: Defense-in-depth against duplicate job IDs
    if (seenJobIds.has(job.id)) {
      const disambiguator = crypto
        .createHash('sha256')
        .update(`${job.id}:${canonicalUrl || job.title}:${uniqueJobs.length}`)
        .digest('hex')
        .slice(0, 8);
      job.id = `${job.id}-${disambiguator}`;
    }

    seenJobIds.add(job.id);
    if (canonicalUrl) {
      seenCanonicalUrls.set(canonicalUrl, job);
    }
    if (comp && title) {
      seenRoleKeys.set(roleKey, job);
    }
    uniqueJobs.push(job);
  }

  return uniqueJobs;
}

export function mergeProvenance(primary: NormalizedJob, duplicate: NormalizedJob): void {
  // Merge tags
  const tagSet = new Set([...primary.tags, ...duplicate.tags]);
  primary.tags = Array.from(tagSet);

  // Preserve alternate source provenance
  if (!primary.alternateSources) {
    primary.alternateSources = [];
  }

  if (
    primary.sourceName !== duplicate.sourceName &&
    !primary.alternateSources.some((s) => s.sourceName === duplicate.sourceName)
  ) {
    primary.alternateSources.push({
      sourceName: duplicate.sourceName,
      sourceUrl: duplicate.sourceUrl,
      applicationUrl: duplicate.applicationUrl,
    });
  }

  // If duplicate has longer/better description, use it
  if ((!primary.description || primary.description.length < (duplicate.description?.length || 0)) && duplicate.description) {
    primary.description = duplicate.description;
  }

  // Update published date and title if duplicate is genuinely newer
  if (duplicate.publishedAt && (!primary.publishedAt || new Date(duplicate.publishedAt) > new Date(primary.publishedAt))) {
    primary.publishedAt = duplicate.publishedAt;
    if (duplicate.title) {
      primary.title = duplicate.title;
    }
  }

  // Update last seen tracking
  if (duplicate.lastSeenAt) {
    primary.lastSeenAt = duplicate.lastSeenAt;
  }

  // Preserve industry classification if primary lacks it or is 'other'
  if ((!primary.industry || primary.industry === 'other') && duplicate.industry && duplicate.industry !== 'other') {
    primary.industry = duplicate.industry;
    primary.category = duplicate.category;
  }

  // Update employment type or seniority if duplicate has more specific details
  if ((!primary.employmentType || primary.employmentType === 'Other') && duplicate.employmentType) {
    primary.employmentType = duplicate.employmentType;
  }
  if (!primary.seniority && duplicate.seniority) {
    primary.seniority = duplicate.seniority;
  }

  // Preserve salary if duplicate has it and primary lacks it
  if (!primary.salary && duplicate.salary) {
    primary.salary = duplicate.salary;
  }

  // Preserve status / expiry updates
  if (duplicate.status && duplicate.status !== 'unknown') {
    primary.status = duplicate.status;
  }
  if (duplicate.expiresAt) {
    primary.expiresAt = duplicate.expiresAt;
  }
}
