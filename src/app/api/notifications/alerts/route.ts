import { NextResponse } from 'next/server';
import { extractSessionId, validateSession } from '@/modules/auth/server/session.store';
import {
  getAlertsForUser,
  createAlert,
} from '@/modules/notifications/services/smart-notification.store';
import { JobCategoryFilter } from '@/modules/notifications/domain/smart-notification.types';

export async function GET(request: Request) {
  const sessionId = extractSessionId(request);
  const auth = validateSession(sessionId);

  if (!auth.valid || !auth.user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in to view your job alerts.' },
      { status: 401 }
    );
  }

  try {
    const alerts = await getAlertsForUser(auth.user.id);
    return NextResponse.json({ success: true, alerts });
  } catch (error) {
    console.error('[Job Alerts GET Error]:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve job alerts.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const sessionId = extractSessionId(request);
  const auth = validateSession(sessionId);

  if (!auth.valid || !auth.user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in to create job alerts.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    const alertName = typeof body.alertName === 'string' && body.alertName.trim()
      ? body.alertName.trim()
      : 'Custom Job Alert';

    const jobCategories: JobCategoryFilter =
      body.jobCategories === 'it' || body.jobCategories === 'non_it'
        ? body.jobCategories
        : 'all';

    const parseStringArray = (val: unknown): string[] => {
      if (!Array.isArray(val)) return [];
      return val
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((s) => s.trim());
    };

    const alert = await createAlert(auth.user.id, {
      alertName,
      enabled: body.enabled !== false,
      jobCategories,
      roles: parseStringArray(body.roles),
      keywords: parseStringArray(body.keywords),
      excludedKeywords: parseStringArray(body.excludedKeywords),
      jobTypes: parseStringArray(body.jobTypes),
      workModes: parseStringArray(body.workModes),
      locations: parseStringArray(body.locations),
      experienceRange: parseStringArray(body.experienceRange),
      companyPreferences: parseStringArray(body.companyPreferences),
      salaryRange:
        typeof body.salaryRange === 'object' && body.salaryRange !== null
          ? {
              min: typeof body.salaryRange.min === 'number' ? body.salaryRange.min : undefined,
              max: typeof body.salaryRange.max === 'number' ? body.salaryRange.max : undefined,
              currency: typeof body.salaryRange.currency === 'string' ? body.salaryRange.currency : undefined,
            }
          : undefined,
    });

    return NextResponse.json({ success: true, alert }, { status: 201 });
  } catch (error) {
    console.error('[Job Alerts POST Error]:', error);
    return NextResponse.json(
      { error: 'Failed to create job alert.' },
      { status: 500 }
    );
  }
}
