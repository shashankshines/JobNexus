import { NextResponse } from 'next/server';
import { extractSessionId, validateSession } from '@/modules/auth/server/session.store';
import {
  updateAlert,
  deleteAlert,
  getAlertById,
} from '@/modules/notifications/services/smart-notification.store';
import { JobCategoryFilter } from '@/modules/notifications/domain/smart-notification.types';

interface RouteContext {
  params: Promise<{ alertId: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  const sessionId = extractSessionId(request);
  const auth = validateSession(sessionId);

  if (!auth.valid || !auth.user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in to update job alerts.' },
      { status: 401 }
    );
  }

  const resolvedParams = await context.params;
  const alertId = resolvedParams.alertId;

  if (!alertId) {
    return NextResponse.json({ error: 'Missing alert ID.' }, { status: 400 });
  }

  try {
    const existing = await getAlertById(auth.user.id, alertId);
    if (!existing) {
      return NextResponse.json({ error: 'Job alert not found.' }, { status: 404 });
    }

    const body = await request.json();
    const parseStringArray = (val: unknown): string[] | undefined => {
      if (val === undefined) return undefined;
      if (!Array.isArray(val)) return [];
      return val
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((s) => s.trim());
    };

    const updates: Parameters<typeof updateAlert>[2] = {};

    if (typeof body.alertName === 'string' && body.alertName.trim().length > 0) {
      updates.alertName = body.alertName.trim();
    }
    if (typeof body.enabled === 'boolean') {
      updates.enabled = body.enabled;
    }
    if (body.jobCategories === 'it' || body.jobCategories === 'non_it' || body.jobCategories === 'all') {
      updates.jobCategories = body.jobCategories as JobCategoryFilter;
    }
    if (body.roles !== undefined) updates.roles = parseStringArray(body.roles);
    if (body.keywords !== undefined) updates.keywords = parseStringArray(body.keywords);
    if (body.excludedKeywords !== undefined) updates.excludedKeywords = parseStringArray(body.excludedKeywords);
    if (body.jobTypes !== undefined) updates.jobTypes = parseStringArray(body.jobTypes);
    if (body.workModes !== undefined) updates.workModes = parseStringArray(body.workModes);
    if (body.locations !== undefined) updates.locations = parseStringArray(body.locations);
    if (body.experienceRange !== undefined) updates.experienceRange = parseStringArray(body.experienceRange);
    if (body.companyPreferences !== undefined) updates.companyPreferences = parseStringArray(body.companyPreferences);
    if (body.salaryRange !== undefined) {
      updates.salaryRange =
        typeof body.salaryRange === 'object' && body.salaryRange !== null
          ? {
              min: typeof body.salaryRange.min === 'number' ? body.salaryRange.min : undefined,
              max: typeof body.salaryRange.max === 'number' ? body.salaryRange.max : undefined,
              currency: typeof body.salaryRange.currency === 'string' ? body.salaryRange.currency : undefined,
            }
          : undefined;
    }

    const updated = await updateAlert(auth.user.id, alertId, updates);
    return NextResponse.json({ success: true, alert: updated });
  } catch (error) {
    console.error('[Job Alert PUT Error]:', error);
    return NextResponse.json(
      { error: 'Failed to update job alert.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const sessionId = extractSessionId(request);
  const auth = validateSession(sessionId);

  if (!auth.valid || !auth.user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in to delete job alerts.' },
      { status: 401 }
    );
  }

  const resolvedParams = await context.params;
  const alertId = resolvedParams.alertId;

  if (!alertId) {
    return NextResponse.json({ error: 'Missing alert ID.' }, { status: 400 });
  }

  try {
    const success = await deleteAlert(auth.user.id, alertId);
    if (!success) {
      return NextResponse.json({ error: 'Job alert not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Job Alert DELETE Error]:', error);
    return NextResponse.json(
      { error: 'Failed to delete job alert.' },
      { status: 500 }
    );
  }
}
