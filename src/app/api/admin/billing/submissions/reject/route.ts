import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/modules/auth/server/admin.auth';
import {
  rejectPaymentSubmissionInTransaction,
  SubmissionNotFoundError,
  InvalidSubmissionStateError,
  MandatoryReasonMissingError,
} from '@/modules/storage/firestore/admin-billing.store';

/**
 * POST /api/admin/billing/submissions/reject
 * Rejects a pending payment submission with a mandatory decision reason.
 *
 * Invariants:
 * 1. Strict Google OAuth Admin Allowlist check.
 * 2. Mandatory decision reason required.
 * 3. Releases the reserved UTR so it is freed for corrections.
 * 4. Appends immutable audit log in admin_audit_logs.
 * 5. Does not grant or alter user subscription records.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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
      { success: false, error: 'Malformed JSON payload.' },
      { status: 400 }
    );
  }

  const submissionId = typeof body.submissionId === 'string' ? body.submissionId.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

  if (!submissionId) {
    return NextResponse.json(
      { success: false, error: 'Missing required field: submissionId.' },
      { status: 400 }
    );
  }

  if (!reason) {
    return NextResponse.json(
      { success: false, error: 'A mandatory rejection reason is required.' },
      { status: 400 }
    );
  }

  try {
    const result = await rejectPaymentSubmissionInTransaction({
      submissionId,
      adminEmail: auth.adminEmail,
      adminUserId: auth.adminUserId,
      reason,
    });

    return NextResponse.json({
      success: true,
      idempotent: result.idempotent,
      submission: result.submission,
      message: result.idempotent
        ? 'Payment submission was already rejected.'
        : 'Payment submission rejected and UTR reservation released.',
    });
  } catch (err) {
    if (err instanceof SubmissionNotFoundError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 404 });
    }
    if (err instanceof InvalidSubmissionStateError || err instanceof MandatoryReasonMissingError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }

    console.error('[Admin Reject Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to reject payment submission.',
      },
      { status: 500 }
    );
  }
}

