import { NextRequest, NextResponse } from 'next/server';
import { validateSession, extractSessionId } from '@/modules/auth/server/session.store';
import {
  createPaymentSubmission,
  getPaymentSubmissionById,
  getSubmissionsByUserId,
  OrderNotFoundError,
  OrderOwnershipError,
  OrderExpiredError,
  OrderAlreadySubmittedError,
  InvalidPaymentDateError,
} from '@/modules/storage/firestore/order.store';
import {
  UtrCollisionError,
  UtrFormatError,
} from '@/modules/storage/firestore/utr-reservation';
import { sendSubmissionAcknowledgement } from '@/modules/email/email.service';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const sessionId = extractSessionId(request);
  const auth = validateSession(sessionId);

  if (!auth.valid || !auth.user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in to submit a payment reference.' },
      { status: 401 }
    );
  }

  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload.' }, { status: 400 });
    }

    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
    const utr = typeof body.utr === 'string' ? body.utr.trim() : '';
    const declaredAmount =
      typeof body.declaredAmount === 'number'
        ? body.declaredAmount
        : Number(body.declaredAmount);
    const paymentDate =
      typeof body.paymentDate === 'string' ? body.paymentDate.trim() : '';
    const receiptPath =
      typeof body.receiptPath === 'string' ? body.receiptPath.trim() : undefined;
    const verificationNotes =
      typeof body.verificationNotes === 'string'
        ? body.verificationNotes.trim()
        : undefined;

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing required field: orderId.', code: 'MISSING_ORDER_ID' },
        { status: 400 }
      );
    }
    if (!utr) {
      return NextResponse.json(
        { error: 'Missing required field: utr (UPI transaction reference).', code: 'MISSING_UTR' },
        { status: 400 }
      );
    }
    if (isNaN(declaredAmount) || declaredAmount <= 0) {
      return NextResponse.json(
        { error: 'declaredAmount must be a positive number.', code: 'INVALID_AMOUNT' },
        { status: 400 }
      );
    }
    if (!paymentDate) {
      return NextResponse.json(
        { error: 'Missing required field: paymentDate (YYYY-MM-DD).', code: 'MISSING_PAYMENT_DATE' },
        { status: 400 }
      );
    }

    try {
      const submission = await createPaymentSubmission({
        orderId,
        userId: auth.user.id,
        userEmail: auth.user.email,
        utr,
        declaredAmount,
        paymentDate,
        receiptPath,
        verificationNotes,
      });

      // Transactional acknowledgement email (Event A)
      let emailStatus: 'sent' | 'pending' | 'failed' | 'retryable_failure' | 'skipped_missing_email' = 'pending';
      try {
        const emailResult = await sendSubmissionAcknowledgement({
          userId: auth.user.id,
          orderId: submission.orderId,
          submissionId: submission.submissionId,
          userEmail: auth.user.email,
          utrNumber: submission.utrNumber,
          declaredAmount: submission.declaredAmount,
          currency: 'INR',
          paymentDate: submission.paymentDate,
          submittedAt: submission.submittedAt,
          slaDeadlineAt: submission.slaDeadlineAt,
        });
        emailStatus = emailResult.status;
      } catch (emailErr) {
        console.error('[BillingSubmit] Acknowledgement email error:', emailErr);
        emailStatus = 'failed';
      }

      return NextResponse.json(
        {
          success: true,
          submission: {
            submissionId: submission.submissionId,
            orderId: submission.orderId,
            utrNumber: submission.utrNumber,
            declaredAmount: submission.declaredAmount,
            paymentDate: submission.paymentDate,
            submittedAt: submission.submittedAt,
            slaDeadlineAt: submission.slaDeadlineAt,
            status: submission.status,
          },
          emailStatus,
          message:
            'Payment reference submitted successfully. Our team will verify and activate your Premium membership within 12 hours.',
        },
        { status: 201 }
      );
    } catch (err) {
      if (err instanceof UtrCollisionError) {
        return NextResponse.json(
          {
            error: `This UPI transaction reference (${err.utr}) has already been submitted or verified.`,
            code: 'UTR_COLLISION',
            conflictReason: err.conflictReason,
          },
          { status: 409 }
        );
      }

      if (err instanceof UtrFormatError) {
        return NextResponse.json(
          {
            error: `Invalid UPI transaction reference format: "${err.utr}". Must be 10-22 alphanumeric characters.`,
            code: 'INVALID_UTR',
          },
          { status: 400 }
        );
      }

      if (err instanceof OrderNotFoundError) {
        return NextResponse.json(
          { error: err.message, code: 'ORDER_NOT_FOUND' },
          { status: 404 }
        );
      }

      if (err instanceof OrderOwnershipError) {
        return NextResponse.json(
          { error: 'Forbidden. You do not have permission to submit payment for this order.', code: 'FORBIDDEN' },
          { status: 403 }
        );
      }

      if (err instanceof OrderExpiredError) {
        return NextResponse.json(
          { error: err.message, code: 'ORDER_EXPIRED' },
          { status: 400 }
        );
      }

      if (err instanceof OrderAlreadySubmittedError) {
        return NextResponse.json(
          { error: err.message, code: 'ORDER_ALREADY_SUBMITTED' },
          { status: 409 }
        );
      }

      if (err instanceof InvalidPaymentDateError) {
        return NextResponse.json(
          { error: err.message, code: 'INVALID_PAYMENT_DATE' },
          { status: 400 }
        );
      }

      console.error('[Billing Submit POST Error]: Unhandled storage or transaction failure:', err);
      return NextResponse.json(
        { error: 'Payment submission temporarily unavailable. Please retry shortly.', code: 'SERVICE_UNAVAILABLE' },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('[Billing Submit POST Top-Level Error]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal submission error.' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionId = extractSessionId(request);
  const auth = validateSession(sessionId);

  if (!auth.valid || !auth.user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in to view payment submissions.' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const submissionId = searchParams.get('submissionId');

  try {
    if (submissionId) {
      const submission = await getPaymentSubmissionById(submissionId);
      if (!submission) {
        return NextResponse.json(
          { error: `Payment submission "${submissionId}" not found.` },
          { status: 404 }
        );
      }

      // Enforce user isolation
      if (submission.userId !== auth.user.id) {
        return NextResponse.json(
          { error: 'Forbidden. You do not have permission to view this submission.' },
          { status: 403 }
        );
      }

      return NextResponse.json({ success: true, submission });
    }

    // List all submissions for the authenticated user
    const submissions = await getSubmissionsByUserId(auth.user.id);
    return NextResponse.json({ success: true, submissions });
  } catch (err) {
    console.error('[Billing Submit GET Error]:', err);
    return NextResponse.json(
      { error: 'Storage service temporarily unavailable. Please try again shortly.' },
      { status: 503 }
    );
  }
}

