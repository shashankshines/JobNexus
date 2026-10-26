import { NormalizedJob } from './job.types';
import { canonicalizeUrl } from './job.normalization';

function cleanCompany(company: string): string {
  return company
    .toLowerCase()
    .replace(/\b(inc\.?|llc\.?|ltd\.?|pvt\.?|corp\.?|technologies|software|solutions|systems)\b/gi, '')
    .replace(/[^a-z0-9]/gi, '')
    .trim();
}

function cleanTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getLocationBucket(job: NormalizedJob): string {
  if (job.isRemote) return 'remote';
  return (job.location || 'unspecified')
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, '')
    .trim();
}

export function deduplicateJobs(jobs: NormalizedJob[]): NormalizedJob[] {
  const seenCanonicalUrls = new Map<string, NormalizedJob>();
  const seenRoleKeys = new Map<string, NormalizedJob>();
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
      mergeProvenance(existing, job);
      continue;
    }

    // Add as new unique job
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

function mergeProvenance(primary: NormalizedJob, duplicate: NormalizedJob): void {
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
  if ((!primary.description || primary.description.length < 50) && duplicate.description) {
    primary.description = duplicate.description;
  }
}
