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
import {
  getBillingSyncVersion,
  bumpBillingSyncVersion,
} from './billing-sync.store';
import { encodeCursor, decodeCursor } from './cursor';

let cachedAuditLogs: { logs: AdminAuditLogDocument[]; timestamp: number; version: number } | null = null;
const AUDIT_CACHE_TTL_MS = 20 * 1000; // 20-second snapshot cache

export function invalidateAuditLogsCache(): void {
  cachedAuditLogs = null;
}

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
  invalidateAuditLogsCache();
  try {
    await bumpBillingSyncVersion({
      mutationType: 'audit_log',
      targetUserId: params.targetUserId,
      targetEntityId: auditId,
    });
  } catch {
    // ignore
  }
  return auditEntry;
}

/**
 * Retrieves audit logs with optional filtering by action, actor, target, and dates.
 * Enforces cross-instance cache consistency using billing sync versioning.
 */
export async function getAdminAuditLogs(
  params?: {
    limit?: number;
    offset?: number;
    cursor?: string;
    action?: string;
    adminEmail?: string;
    targetUserId?: string;
    dateFrom?: string;
    dateTo?: string;
  },
  options?: { bypassCache?: boolean; forceCache?: boolean }
): Promise<AdminAuditLogDocument[] & { total: number; nextCursor?: string | null; hasMore?: boolean }> {
  const now = Date.now();
  const isTestEnv = process.env.NODE_ENV === 'test' && !options?.forceCache;
  let logs: AdminAuditLogDocument[];

  const currentVersion = await getBillingSyncVersion();

  if (
    !isTestEnv &&
    !options?.bypassCache &&
    cachedAuditLogs &&
    cachedAuditLogs.version === currentVersion &&
    now - cachedAuditLogs.timestamp < AUDIT_CACHE_TTL_MS
  ) {
    logs = [...cachedAuditLogs.logs];
  } else {
    const auditLogsCol = getAuditLogsCollection();
    const snap = await auditLogsCol.get();
    logs = snap.docs.map((d) => d.data());
    cachedAuditLogs = { logs, timestamp: now, version: currentVersion };
  }

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
  const total = enriched.length;
  const offset = params?.offset || 0;
  const limit = Math.min(Math.max(params?.limit || 5, 1), 200);

  let startIndex = offset;
  if (params?.cursor) {
    const decoded = decodeCursor(params.cursor);
    if (decoded) {
      const foundIdx = enriched.findIndex(
        (l) => l.id === decoded.secondary || l.timestamp === decoded.primary
      );
      if (foundIdx !== -1) {
        startIndex = foundIdx + 1;
      }
    }
  }

  const paged = enriched.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < total;
  const nextCursor =
    paged.length > 0 && hasMore
      ? encodeCursor(paged[paged.length - 1].timestamp, paged[paged.length - 1].id)
      : null;

  return Object.assign(paged, { total, nextCursor, hasMore });
}

