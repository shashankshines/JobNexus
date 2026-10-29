/**
 * JobNexus Firestore Audit Store
 * Authoritative immutable audit logging for administrative actions.
 */

import crypto from 'node:crypto';
import {
  getAuditLogsCollection,
  AdminAuditLogDocument,
} from './collections';
import { getUserById } from '@/modules/auth/server/session.store';

/**
 * Records an immutable administrative audit log entry.
 */
export async function recordAdminAuditLog(params: {
  actorId?: string;
  actorEmail: string;
  action: AdminAuditLogDocument['action'];
  targetUserId: string;
  targetUserEmail?: string;
  targetEntityId: string;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown>;
  reason?: string;
}): Promise<AdminAuditLogDocument> {
  const auditLogsCol = getAuditLogsCollection();
  const auditId = `audit_${crypto.randomBytes(8).toString('hex')}`;
  const nowIso = new Date().toISOString();

  const auditEntry: AdminAuditLogDocument = {
    id: auditId,
    actorId: params.actorId || params.actorEmail,
    actorEmail: params.actorEmail,
    action: params.action,
    targetUserId: params.targetUserId,
    ...(params.targetUserEmail ? { targetUserEmail: params.targetUserEmail } : {}),
    targetEntityId: params.targetEntityId,
    previousState: params.previousState,
    newState: params.newState,
    reason: params.reason,
    timestamp: nowIso,
  };

  await auditLogsCol.doc(auditId).set(auditEntry);
  return auditEntry;
}

/**
 * Retrieves audit logs with optional filtering by action, actor, target, and dates.
 */
export async function getAdminAuditLogs(params?: {
  limit?: number;
  offset?: number;
  action?: string;
  adminEmail?: string;
  targetUserId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<AdminAuditLogDocument[]> {
  const auditLogsCol = getAuditLogsCollection();
  const snap = await auditLogsCol.get();
  let logs: AdminAuditLogDocument[] = snap.docs.map((d) => d.data());

  if (params?.action && params.action !== 'all') {
    logs = logs.filter((l) => l.action === params.action);
  }
  if (params?.adminEmail) {
    const qEmail = params.adminEmail.trim().toLowerCase();
    logs = logs.filter((l) => l.actorEmail.toLowerCase().includes(qEmail));
  }
  if (params?.targetUserId) {
    const qUser = params.targetUserId.trim().toLowerCase();
    logs = logs.filter((l) => l.targetUserId.toLowerCase().includes(qUser));
  }

  if (params?.dateFrom) {
    const fromTime = new Date(params.dateFrom).getTime();
    if (!isNaN(fromTime)) {
      logs = logs.filter((l) => new Date(l.timestamp).getTime() >= fromTime);
    }
  }

  if (params?.dateTo) {
    const toTime = new Date(params.dateTo).getTime();
    if (!isNaN(toTime)) {
      logs = logs.filter((l) => new Date(l.timestamp).getTime() <= toTime + 86400000);
    }
  }

  const enriched = logs.map((log) => {
    const localUser = getUserById(log.targetUserId);
    const targetUserEmail = log.targetUserEmail || localUser?.email || undefined;
    return {
      ...log,
      targetUserEmail,
    };
  });

  enriched.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));
  const offset = params?.offset || 0;
  const limit = Math.min(Math.max(params?.limit || 50, 1), 200);
  return enriched.slice(offset, offset + limit);
}

