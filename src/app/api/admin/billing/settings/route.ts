import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/modules/auth/server/admin.auth';
import {
  getPaymentSettings,
  updatePaymentSettingsInTransaction,
  validatePaymentSettingsInput,
  PaymentSettingsValidationError,
} from '@/modules/storage/firestore/settings.store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/admin/billing/settings
 * Retrieves active payment configuration and metadata for authorized administrators.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: auth.error },
      {
        status: auth.statusCode,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
        },
      }
    );
  }

  try {
    const settings = await getPaymentSettings();
    return NextResponse.json(
      {
        success: true,
        settings,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
        },
      }
    );
  } catch (err) {
    console.error('[Admin Settings GET Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to retrieve payment configuration.',
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
        },
      }
    );
  }
}

/**
 * Handler for PUT /api/admin/billing/settings
 * Updates receiving UPI configuration transactionally and appends an immutable audit log.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.statusCode }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON request payload.' },
      { status: 400 }
    );
  }

  const validation = validatePaymentSettingsInput(body);
  if (!validation.valid || !validation.normalized) {
    return NextResponse.json(
      {
        success: false,
        error: 'Validation failed for payment settings.',
        fieldErrors: validation.errors,
      },
      { status: 400 }
    );
  }

  try {
    const updatedSettings = await updatePaymentSettingsInTransaction({
      ...validation.normalized,
      adminEmail: auth.adminEmail,
      adminUserId: auth.adminUserId,
      reason: typeof body.reason === 'string' ? body.reason : undefined,
    });

    return NextResponse.json({
      success: true,
      settings: updatedSettings,
    });
  } catch (err) {
    if (err instanceof PaymentSettingsValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: err.message,
          fieldErrors: err.fieldErrors,
        },
        { status: 400 }
      );
    }

    console.error('[Admin Settings PUT Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update payment settings.',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/billing/settings
 * Alias for PUT to maximize compatibility across clients.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return PUT(request);
}

