/**
 * External Job Discovery Links for Major Closed/Partnership Platforms.
 *
 * Platforms like LinkedIn, Indeed, Glassdoor, and ZipRecruiter do not provide
 * open, unauthenticated public REST APIs and explicitly prohibit scraping in their terms.
 * This module generates authorized, parameter-encoded external search actions that allow
 * job seekers to discover matching opportunities directly on those platforms.
 *
 * Critical rule: External discovery actions MUST be clearly distinguished from
 * verified listings imported directly by JobNexus providers.
 */

export type ExternalPlatformId = 'linkedin' | 'indeed' | 'glassdoor' | 'ziprecruiter';

export interface ExternalPlatformSearchLink {
  platformId: ExternalPlatformId;
  platformName: string;
  url: string;
  description: string;
  isExternalSearch: true;
  attribution: string;
}

export interface PlatformSearchOptions {
  query?: string;
  company?: string;
  location?: string;
}

/**
 * Generates parameter-encoded search URLs for external platforms.
 * All input parameters are sanitized and properly URL-encoded.
 */
export function buildExternalPlatformSearchLinks(
  options: PlatformSearchOptions = {}
): ExternalPlatformSearchLink[] {
  const query = (options.query || '').trim();
  const company = (options.company || '').trim();
  const location = (options.location || '').trim();

  // Combine query and company keywords if both are supplied
  const effectiveKeywords = [query, company].filter(Boolean).join(' ');

  // LinkedIn Jobs Search
  const linkedInParams = new URLSearchParams();
  if (effectiveKeywords) linkedInParams.set('keywords', effectiveKeywords);
  if (location) linkedInParams.set('location', location);
  const linkedInUrl = `https://www.linkedin.com/jobs/search/?${linkedInParams.toString()}`;

  // Indeed Jobs Search
  const indeedParams = new URLSearchParams();
  if (effectiveKeywords) indeedParams.set('q', effectiveKeywords);
  if (location) indeedParams.set('l', location);
  const indeedUrl = `https://www.indeed.com/jobs?${indeedParams.toString()}`;

  // Glassdoor Jobs Search
  const glassdoorParams = new URLSearchParams();
  if (effectiveKeywords) glassdoorParams.set('sc.keyword', effectiveKeywords);
  if (location) {
    glassdoorParams.set('locKeyword', location);
    glassdoorParams.set('locT', 'C');
  }
  const glassdoorUrl = `https://www.glassdoor.com/Job/jobs.htm?${glassdoorParams.toString()}`;

  // ZipRecruiter Jobs Search
  const zipParams = new URLSearchParams();
  if (effectiveKeywords) zipParams.set('search', effectiveKeywords);
  if (location) zipParams.set('location', location);
  const zipRecruiterUrl = `https://www.ziprecruiter.com/candidate/search?${zipParams.toString()}`;

  return [
    {
      platformId: 'linkedin',
      platformName: 'LinkedIn',
      url: linkedInUrl,
      description: 'Search matching opportunities on LinkedIn (opens official platform search)',
      isExternalSearch: true,
      attribution: 'External discovery link. Not an imported or verified listing.',
    },
    {
      platformId: 'indeed',
      platformName: 'Indeed',
      url: indeedUrl,
      description: 'Search matching vacancies on Indeed (opens official platform search)',
      isExternalSearch: true,
      attribution: 'External discovery link. Not an imported or verified listing.',
    },
    {
      platformId: 'glassdoor',
      platformName: 'Glassdoor',
      url: glassdoorUrl,
      description: 'Search matching jobs and salary insights on Glassdoor',
      isExternalSearch: true,
      attribution: 'External discovery link. Not an imported or verified listing.',
    },
    {
      platformId: 'ziprecruiter',
      platformName: 'ZipRecruiter',
      url: zipRecruiterUrl,
      description: 'Search matching positions on ZipRecruiter',
      isExternalSearch: true,
      attribution: 'External discovery link. Not an imported or verified listing.',
    },
  ];
}
