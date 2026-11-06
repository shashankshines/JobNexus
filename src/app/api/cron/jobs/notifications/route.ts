import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/modules/auth/server/admin.auth';
import { JobSearchService } from '@/modules/jobs/services/job-search.service';
import {
  processNewCanonicalJobs,
  processDeferredPendingNotifications,
} from '@/modules/notifications/services/smart-notification.store';
import { NormalizedJob } from '@/modules/jobs/domain/job.types';

/**
 * Verifies a Vercel Cron `Authorization: Bearer <CRON_SECRET>` header using
 * constant-time comparison. Fails closed when `CRON_SECRET` is unset or empty.
 */
function hasValidCronSecret(request: Request): boolean {
  const configuredSecret = (process.env.CRON_SECRET || '').trim();
  if (!configuredSecret) return false;

  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return false;

  const provided = authHeader.slice('Bearer '.length).trim();
  if (!provided || provided.length !== configuredSecret.length) return false;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(provided, 'utf8'),
      Buffer.from(configuredSecret, 'utf8')
    );
  } catch {
    return false;
  }
}

async function handleNotificationCron(request: Request) {
  const isCronAuthorized = hasValidCronSecret(request);

  if (!isCronAuthorized) {
    const adminAuth = await authorizeAdminRequest(request);
    if (!adminAuth.authorized) {
      return NextResponse.json(
        { error: adminAuth.error || 'Unauthorized cron invocation.' },
        { status: adminAuth.statusCode }
      );
    }
  }

  try {
    // 1. Process any previously deferred pending notifications whose scheduled time has passed
    const initialDeferred = await processDeferredPendingNotifications();

    // 2. Fetch canonical jobs to check for new candidates
    let canonicalJobs: NormalizedJob[] = [];
    if (JobSearchService.cachedUniqueJobs && JobSearchService.cachedUniqueJobs.length > 0) {
      canonicalJobs = JobSearchService.cachedUniqueJobs;
    } else {
      const searchService = new JobSearchService();
      const res = await searchService.searchJobs({ limit: 100 });
      // Retrieve canonical jobs from cache or snapshot
      canonicalJobs = JobSearchService.cachedUniqueJobs || [];
      if (canonicalJobs.length === 0) {
        const diskSnapshot = JobSearchService.loadDiskSnapshot();
        if (diskSnapshot?.allJobs) {
          canonicalJobs = diskSnapshot.allJobs;
        }
      }
    }

    // 3. Process new canonical jobs against active alerts
    const ingestionResult = await processNewCanonicalJobs(canonicalJobs);

    // 4. Sweep deferred queue one more time to catch newly queued jobs that may be immediately deliverable
    const finalDeferred = await processDeferredPendingNotifications();

    return NextResponse.json(
      {
        success: true,
        summary: {
          timestamp: new Date().toISOString(),
          canonicalJobsEvaluated: canonicalJobs.length,
          newJobsDetected: ingestionResult.newJobsDetected,
          notificationsCreated: ingestionResult.created,
          instantDelivered: ingestionResult.delivered,
          initialDeferredProcessed: initialDeferred,
          finalDeferredProcessed: finalDeferred,
        },
      },
      {
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('[Notification Cron Execution Error]:', error);
    return NextResponse.json(
      { error: 'Failed to execute job notification processing worker.' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleNotificationCron(request);
}

export async function POST(request: Request) {
  return handleNotificationCron(request);
}
