import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/modules/auth/server/admin.auth';
import {
  approvePaymentSubmissionInTransaction,
  SubmissionNotFoundError,
  InvalidSubmissionStateError,
  OrderValidationError,
} from '@/modules/storage/firestore/admin-billing.store';

/**
 * POST /api/admin/billing/submissions/approve
 * Approves a pending payment submission after the administrator has independently
 * verified bank/UPI credit.
 *
 * Invariants:
 * 1. Strict Google OAuth Admin Allowlist check.
 * 2. Mandatory confirmationChecked flag required to certify manual bank statement verification.
 * 3. Exactly-once execution via Firestore transaction.
 * 4. Extends/activates subscription with newPeriodEnd = max(now, currentPeriodEnd) + 30 days.
 * 5. Consumes UTR reservation and appends immutable audit log.
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
  const confirmationChecked = body.confirmationChecked === true;
  const verificationNotes =
    typeof body.verificationNotes === 'string' ? body.verificationNotes.trim() : undefined;

  if (!submissionId) {
    return NextResponse.json(
      { success: false, error: 'Missing required field: submissionId.' },
      { status: 400 }
    );
  }

  if (!confirmationChecked) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Independent verification confirmation required. You must certify that the ₹499 credit was independently verified in the bank / UPI statement.',
      },
      { status: 400 }
    );
  }

  try {
    const result = await approvePaymentSubmissionInTransaction({
      submissionId,
      adminEmail: auth.adminEmail,
      adminUserId: auth.adminUserId,
      verificationNotes,
    });

    return NextResponse.json({
      success: true,
      idempotent: result.idempotent,
      submission: result.submission,
      subscription: result.subscription,
      message: result.idempotent
        ? 'Payment submission was already approved.'
        : 'Payment successfully approved and Premium access activated.',
    });
  } catch (err) {
    if (err instanceof SubmissionNotFoundError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 404 });
    }
    if (err instanceof InvalidSubmissionStateError || err instanceof OrderValidationError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 400 });
    }

    console.error('[Admin Approve Error]:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to approve payment submission.',
      },
      { status: 500 }
    );
  }
}

