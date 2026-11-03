import { NextRequest, NextResponse } from 'next/server';
import { authorizeAdminRequest } from '@/modules/auth/server/admin.auth';
import { getUserById, getUserByEmail } from '@/modules/auth/server/session.store';
import { getUser360Profile } from '@/modules/storage/firestore/admin-billing.store';
import { recordAdminAuditLog } from '@/modules/storage/firestore/audit.store';

/**
 * GET /api/admin/users/[userId]/export
 * Generates an authorized export of user data (JSON or CSV).
 * Scrubs all passwords, session tokens, and credentials.
 * Records an immutable audit log entry.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
): Promise<NextResponse> {
  const auth = await authorizeAdminRequest(request);
  if (!auth.authorized) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.statusCode }
    );
  }

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'User ID is required.' },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get('format') || 'json').toLowerCase();

  try {
    let user = getUserById(userId);
    if (!user && userId.includes('@')) {
      user = getUserByEmail(userId);
    }
    if (!user) {
      return NextResponse.json(
        { success: false, error: `User "${userId}" was not found.` },
        { status: 404 }
      );
    }

    const dossier = await getUser360Profile(user.id);

    // Scrub any sensitive data
    const safeIdentity = {
      userId: dossier.identity.userId,
      email: dossier.identity.email,
      name: dossier.identity.name,
      avatar: dossier.identity.avatar,
      role: dossier.identity.role,
      provider: dossier.identity.provider,
      createdAt: dossier.identity.createdAt,
      accountStatus: dossier.identity.accountStatus,
      accountStatusReason: dossier.identity.accountStatusReason,
      accountStatusUpdatedAt: dossier.identity.accountStatusUpdatedAt,
      accountStatusUpdatedBy: dossier.identity.accountStatusUpdatedBy,
      deactivatedAt: dossier.identity.deactivatedAt,
      deletionRequestedAt: dossier.identity.deletionRequestedAt,
      deletionScheduledFor: dossier.identity.deletionScheduledFor,
      lastActiveAt: dossier.identity.lastActiveAt,
    };

    const exportPayload = {
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: auth.user.email,
        format,
        system: 'JobNexus Admin Console',
      },
      identity: safeIdentity,
      subscription: dossier.subscription,
      savedJobs: dossier.savedJobs,
      orders: dossier.orders,
      submissions: dossier.submissions,
      auditLogs: dossier.auditLogs,
    };

    // Record audit event
    await recordAdminAuditLog({
      actorId: auth.user.id || auth.user.email,
      actorEmail: auth.user.email,
      action: 'user_data_exported',
      targetUserId: user.id,
      targetUserEmail: user.email,
      targetEntityId: user.id,
      newState: {
        exportFormat: format,
        timestamp: new Date().toISOString(),
      },
      reason: `Authorized administrative export (${format.toUpperCase()})`,
    });

    if (format === 'csv') {
      // Flatten into CSV lines
      const csvLines: string[] = [];
      csvLines.push('Section,Field,Value');
      csvLines.push(`Identity,User ID,"${safeIdentity.userId}"`);
      csvLines.push(`Identity,Email,"${safeIdentity.email || ''}"`);
      csvLines.push(`Identity,Name,"${(safeIdentity.name || '').replace(/"/g, '""')}"`);
      csvLines.push(`Identity,Provider,"${safeIdentity.provider || ''}"`);
      csvLines.push(`Identity,Account Status,"${safeIdentity.accountStatus || 'active'}"`);
      csvLines.push(`Identity,Created At,"${safeIdentity.createdAt || ''}"`);
      csvLines.push(`Identity,Last Active,"${safeIdentity.lastActiveAt || 'N/A'}"`);

      if (dossier.subscription) {
        csvLines.push(`Subscription,Plan,"${dossier.subscription.planId}"`);
        csvLines.push(`Subscription,Status,"${dossier.subscription.status}"`);
        csvLines.push(`Subscription,Is Premium,"${dossier.subscription.isPremium}"`);
        csvLines.push(`Subscription,Period End,"${dossier.subscription.currentPeriodEnd || ''}"`);
      } else {
        csvLines.push('Subscription,Plan,"free"');
        csvLines.push('Subscription,Status,"none"');
        csvLines.push('Subscription,Is Premium,"false"');
      }

      csvLines.push(`Saved Jobs,Total Count,"${dossier.savedJobs.length}"`);
      dossier.savedJobs.forEach((job, idx) => {
        csvLines.push(
          `Saved Job ${idx + 1},Title,"${(job.title || '').replace(/"/g, '""')}"`
        );
        csvLines.push(
          `Saved Job ${idx + 1},Company,"${(job.company || '').replace(/"/g, '""')}"`
        );
        csvLines.push(`Saved Job ${idx + 1},Saved At,"${job.date || ''}"`);
      });

      csvLines.push(`Orders,Total Count,"${dossier.orders.length}"`);
      dossier.orders.forEach((ord, idx) => {
        csvLines.push(`Order ${idx + 1},Order ID,"${ord.orderId}"`);
        csvLines.push(`Order ${idx + 1},Amount INR,"${ord.amountInr}"`);
        csvLines.push(`Order ${idx + 1},Status,"${ord.status}"`);
        csvLines.push(`Order ${idx + 1},Created At,"${ord.createdAt}"`);
      });

      csvLines.push(`Submissions,Total Count,"${dossier.submissions.length}"`);
      dossier.submissions.forEach((sub, idx) => {
        csvLines.push(`Submission ${idx + 1},Submission ID,"${sub.submissionId}"`);
        csvLines.push(`Submission ${idx + 1},UTR,"${sub.utrNumber}"`);
        csvLines.push(`Submission ${idx + 1},Status,"${sub.status}"`);
        csvLines.push(`Submission ${idx + 1},Submitted At,"${sub.submittedAt}"`);
      });

      const csvContent = csvLines.join('\n');
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="user_export_${user.id}.csv"`,
        },
      });
    }

    // Default JSON export
    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="user_export_${user.id}.json"`,
      },
    });
  } catch (err) {
    console.error(`[Admin User Export Error for "${userId}"]:`, err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to export user data.',
      },
      { status: 500 }
    );
  }
}
