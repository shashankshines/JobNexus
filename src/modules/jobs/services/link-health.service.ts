/**
 * JobNexus — Asynchronous Link Health Verification Engine
 * Lightweight, rate-limited health checking for provider application links.
 * Respects anti-bot protections (Cloudflare/403/429), preventing false expiry classification.
 */

import { isValidHttpUrl, isFabricatedJobUrl } from '../domain/job.normalization';

export type LinkHealthStatus = 'verified' | 'unverified' | 'broken' | 'blocked';

export interface LinkHealthRecord {
  url: string;
  status: LinkHealthStatus;
  httpStatus?: number;
  lastCheckedAt: string;
  lastVerifiedAt?: string;
  failureReason?: string;
}

const linkHealthCache = new Map<string, LinkHealthRecord>();

export class LinkHealthService {
  /**
   * Retrieves the cached link health for a URL in 0ms.
   */
  static getLinkHealth(url: string): LinkHealthRecord | undefined {
    if (!url) return undefined;
    return linkHealthCache.get(url);
  }

  /**
   * Verifies an application link asynchronously.
   * - 200..399: verified
   * - 403, 429, 999 (anti-bot challenge / Cloudflare): blocked (valid job, but blocked crawler)
   * - 404, 410: broken
   * - Synthetic / fabricated URL patterns: broken immediately without network hit
   */
  static async checkLink(url: string, timeoutMs = 4000): Promise<LinkHealthRecord> {
    const nowIso = new Date().toISOString();

    if (!isValidHttpUrl(url) || isFabricatedJobUrl(url)) {
      const record: LinkHealthRecord = {
        url,
        status: 'broken',
        lastCheckedAt: nowIso,
        failureReason: 'Fabricated or invalid URL scheme/pattern',
      };
      linkHealthCache.set(url, record);
      return record;
    }

    // Check recent cached status (cache valid for 1 hour)
    const existing = linkHealthCache.get(url);
    if (existing && Date.now() - new Date(existing.lastCheckedAt).getTime() < 60 * 60 * 1000) {
      return existing;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      // Try HEAD request first for minimal network overhead
      let res = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) JobNexus/1.0',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      }).catch(async (headErr) => {
        // Some servers reject HEAD with 405 Method Not Allowed; fallback to GET with small byte range
        return fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) JobNexus/1.0',
            Range: 'bytes=0-1024',
          },
          signal: controller.signal,
        });
      });

      clearTimeout(timer);

      const status = res.status;

      if (status >= 200 && status < 400) {
        const record: LinkHealthRecord = {
          url,
          status: 'verified',
          httpStatus: status,
          lastCheckedAt: nowIso,
          lastVerifiedAt: nowIso,
        };
        linkHealthCache.set(url, record);
        return record;
      }

      if (status === 403 || status === 429 || status === 999) {
        // Anti-bot response: Do not mark broken or expired
        const record: LinkHealthRecord = {
          url,
          status: 'blocked',
          httpStatus: status,
          lastCheckedAt: nowIso,
          lastVerifiedAt: existing?.lastVerifiedAt || nowIso,
          failureReason: `Protected by provider anti-bot policy (HTTP ${status})`,
        };
        linkHealthCache.set(url, record);
        return record;
      }

      if (status === 404 || status === 410) {
        const record: LinkHealthRecord = {
          url,
          status: 'broken',
          httpStatus: status,
          lastCheckedAt: nowIso,
          failureReason: `Job posting no longer active (HTTP ${status})`,
        };
        linkHealthCache.set(url, record);
        return record;
      }

      const record: LinkHealthRecord = {
        url,
        status: 'unverified',
        httpStatus: status,
        lastCheckedAt: nowIso,
        failureReason: `HTTP status ${status}`,
      };
      linkHealthCache.set(url, record);
      return record;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isTimeout = errMsg.toLowerCase().includes('abort') || errMsg.toLowerCase().includes('timeout');

      const record: LinkHealthRecord = {
        url,
        status: existing?.status || 'unverified',
        lastCheckedAt: nowIso,
        lastVerifiedAt: existing?.lastVerifiedAt,
        failureReason: isTimeout ? 'Verification timed out' : errMsg,
      };
      linkHealthCache.set(url, record);
      return record;
    }
  }

  /**
   * Bounded background verification batch.
   */
  static async verifyBatch(
    urls: string[],
    concurrency = 5,
    maxToCheck = 50
  ): Promise<Map<string, LinkHealthRecord>> {
    const results = new Map<string, LinkHealthRecord>();
    const toCheck = urls.slice(0, maxToCheck);

    const tasks = toCheck.map((url) => async () => {
      const record = await this.checkLink(url);
      results.set(url, record);
    });

    // Execute with limited concurrency
    const executing: Promise<void>[] = [];
    for (const task of tasks) {
      const p = task();
      executing.push(p);
      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }
    await Promise.allSettled(executing);

    return results;
  }

  static clearCache(): void {
    linkHealthCache.clear();
  }

  recordResult(url: string, status: LinkHealthStatus, httpStatus?: number): LinkHealthRecord {
    const record: LinkHealthRecord = {
      url,
      status,
      httpStatus,
      lastCheckedAt: new Date().toISOString(),
      lastVerifiedAt: status === 'verified' ? new Date().toISOString() : undefined,
    };
    linkHealthCache.set(url, record);
    return record;
  }

  checkCached(url: string): LinkHealthRecord | undefined {
    return LinkHealthService.getLinkHealth(url);
  }

  async verifyUrl(url: string, timeoutMs = 4000): Promise<LinkHealthRecord> {
    return LinkHealthService.checkLink(url, timeoutMs);
  }
}
