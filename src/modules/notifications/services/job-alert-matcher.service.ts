import { NormalizedJob } from '@/modules/jobs/domain/job.types';
import {
  matchesQuery,
  matchesRole,
  matchesCompany,
  matchesLocation,
  matchesRemote,
  matchesType,
  matchesLevel,
} from '@/modules/jobs/domain/job.ranking';
import { resolveJobIndustry } from '@/modules/jobs/domain/job.taxonomy';
import { SavedJobAlert } from '../domain/smart-notification.types';

export const IT_SECTOR_IDS = new Set([
  'it_software',
  'ai_data_science',
  'cybersecurity_cloud',
  'technology',
]);

/**
 * Checks whether a job belongs to IT, Non-IT, or All sectors.
 */
export function isJobInSector(job: NormalizedJob, sector: 'all' | 'it' | 'non_it'): boolean {
  if (sector === 'all') return true;
  const resolvedIndustry = job.industry || resolveJobIndustry(
    job.industry,
    job.category,
    job.title,
    job.tags,
    job.description
  );
  const isIt = IT_SECTOR_IDS.has(resolvedIndustry);
  return sector === 'it' ? isIt : !isIt;
}

/**
 * Normalizes text to check for excluded keywords with word-boundary awareness.
 */
function containsExcludedKeyword(haystack: string, keyword: string): boolean {
  const cleanKeyword = keyword.trim().toLowerCase();
  if (!cleanKeyword) return false;

  const escaped = cleanKeyword.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(haystack);
}

/**
 * Evaluates whether a canonical job satisfies a single user's SavedJobAlert preferences.
 */
export function matchesAlert(job: NormalizedJob, alert: SavedJobAlert): boolean {
  if (!alert.enabled) {
    return false;
  }

  // 1. Resolve Industry if not already populated
  const resolvedIndustry = job.industry || resolveJobIndustry(
    job.industry,
    job.category,
    job.title,
    job.tags,
    job.description
  );

  // 2. IT vs Non-IT Job Category Filter
  if (alert.jobCategories && alert.jobCategories !== 'all') {
    const isItJob = IT_SECTOR_IDS.has(resolvedIndustry);
    if (alert.jobCategories === 'it' && !isItJob) {
      return false;
    }
    if (alert.jobCategories === 'non_it' && isItJob) {
      return false;
    }
  }

  // 3. Excluded Keywords Check (Negative constraint)
  if (Array.isArray(alert.excludedKeywords) && alert.excludedKeywords.length > 0) {
    const searchableText = `${job.title} ${job.company} ${job.tags.join(' ')} ${job.description || ''}`;
    for (const exKw of alert.excludedKeywords) {
      if (containsExcludedKeyword(searchableText, exKw)) {
        return false;
      }
    }
  }

  // 4. Roles and Keywords (Positive text matching)
  const hasRoles = Array.isArray(alert.roles) && alert.roles.some((r) => r.trim().length > 0);
  const hasKeywords = Array.isArray(alert.keywords) && alert.keywords.some((k) => k.trim().length > 0);

  if (hasRoles || hasKeywords) {
    let textMatched = false;

    if (hasRoles) {
      for (const role of alert.roles!) {
        const trimmed = role.trim();
        if (!trimmed) continue;
        if (matchesRole(job, trimmed) || matchesQuery(job, trimmed).matches) {
          textMatched = true;
          break;
        }
      }
    }

    if (!textMatched && hasKeywords) {
      for (const kw of alert.keywords!) {
        const trimmed = kw.trim();
        if (!trimmed) continue;
        if (matchesQuery(job, trimmed).matches) {
          textMatched = true;
          break;
        }
      }
    }

    if (!textMatched) {
      return false;
    }
  }

  // 5. Work Modes (Remote / Hybrid / On-site)
  if (Array.isArray(alert.workModes) && alert.workModes.length > 0) {
    const modeMatched = alert.workModes.some((mode) => {
      const m = mode.toLowerCase().trim();
      if (m === 'remote') return matchesRemote(job, 'remote');
      if (m === 'hybrid') return matchesRemote(job, 'hybrid');
      if (m === 'onsite' || m === 'office') return matchesRemote(job, 'onsite');
      return matchesRemote(job, m);
    });

    if (!modeMatched) {
      return false;
    }
  }

  // 6. Employment Types (Full-time, Part-time, Contract, Internship, Freelance)
  if (Array.isArray(alert.jobTypes) && alert.jobTypes.length > 0) {
    const typeMatched = alert.jobTypes.some((t) => matchesType(job, t));
    if (!typeMatched) {
      return false;
    }
  }

  // 7. Preferred Locations
  if (Array.isArray(alert.locations) && alert.locations.length > 0) {
    const locMatched = alert.locations.some((loc) => matchesLocation(job, loc));
    if (!locMatched) {
      return false;
    }
  }

  // 8. Company Preferences
  if (Array.isArray(alert.companyPreferences) && alert.companyPreferences.length > 0) {
    const compMatched = alert.companyPreferences.some((comp) => matchesCompany(job, comp));
    if (!compMatched) {
      return false;
    }
  }

  // 9. Seniority / Experience Range
  if (Array.isArray(alert.experienceRange) && alert.experienceRange.length > 0) {
    const levelMatched = alert.experienceRange.some((lvl) => matchesLevel(job, lvl));
    if (!levelMatched) {
      return false;
    }
  }

  return true;
}

/**
 * Filters a list of user alerts to those that match the given canonical job.
 */
export function findMatchingAlertsForJob(
  job: NormalizedJob,
  alerts: SavedJobAlert[]
): SavedJobAlert[] {
  return alerts.filter((alert) => matchesAlert(job, alert));
}
