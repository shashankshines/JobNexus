/**
 * JobNexus Firestore Email Outbox Store (Phase 2B.4)
 * Durable persistence, idempotency lookup, and status tracking for transactional emails.
 */

import crypto from 'node:crypto';
import {
  getEmailOutboxCollection,
  EmailOutboxDocument,
} from './collections';
import { getFirestoreDb } from './client';

export interface CreateOutboxParams {
  idempotencyKey: string;
  userId: string;
  orderId: string;
  submissionId: string;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  templateType: EmailOutboxDocument['templateType'];
  payload: Record<string, unknown>;
  maxAttempts?: number;
}

/**
 * Creates a durable outbox record if one does not already exist for this idempotency key.
 * Strictly idempotent: if a record exists for the given idempotencyKey, returns existing record.
 */
export async function createOutboxRecord(params: CreateOutboxParams): Promise<{
  created: boolean;
  record: EmailOutboxDocument;
}> {
  const { idempotencyKey, userId, orderId, submissionId, recipientEmail, recipientName, subject, templateType, payload, maxAttempts = 3 } = params;

  // 1. Check if record already exists by idempotencyKey
  const existing = await getOutboxRecordByIdempotencyKey(idempotencyKey);
  if (existing) {
    return { created: false, record: existing };
  }

  const id = `notif_${crypto.randomBytes(8).toString('hex')}`;
  const nowIso = new Date().toISOString();

  const doc: EmailOutboxDocument = {
    id,
    idempotencyKey,
    userId,
    orderId,
    submissionId,
    recipientEmail: recipientEmail.trim().toLowerCase(),
    ...(recipientName ? { recipientName: recipientName.trim() } : {}),
    subject,
    templateType,
    payload,
    status: 'pending',
    attempts: 0,
    maxAttempts,
    createdAt: nowIso,
  };

  const col = getEmailOutboxCollection();
  await col.doc(id).set(doc);

  return { created: true, record: doc };
}

/**
 * Retrieves an outbox record by its document ID.
 */
export async function getOutboxRecordById(id: string): Promise<EmailOutboxDocument | null> {
  const col = getEmailOutboxCollection();
  const snap = await col.doc(id).get();
  if (!snap.exists) return null;
  return snap.data() as EmailOutboxDocument;
}

/**
 * Retrieves an outbox record by its unique idempotencyKey.
 */
export async function getOutboxRecordByIdempotencyKey(
  idempotencyKey: string
): Promise<EmailOutboxDocument | null> {
  const col = getEmailOutboxCollection();
  const snap = await col.where('idempotencyKey', '==', idempotencyKey).limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0].data() as EmailOutboxDocument;
}

/**
 * Retrieves all outbox records for a given user ID.
 */
export async function getOutboxRecordsByUserId(userId: string): Promise<EmailOutboxDocument[]> {
  const col = getEmailOutboxCollection();
  const snap = await col.where('userId', '==', userId).get();
  return snap.docs.map((d) => d.data() as EmailOutboxDocument);
}

/**
 * Retrieves all outbox records for a given submission ID.
 */
export async function getOutboxRecordsBySubmissionId(submissionId: string): Promise<EmailOutboxDocument[]> {
  const col = getEmailOutboxCollection();
  const snap = await col.where('submissionId', '==', submissionId).get();
  return snap.docs.map((d) => d.data() as EmailOutboxDocument);
}

/**
 * Updates delivery status and attempt tracking on an outbox record.
 */
export async function updateOutboxDeliveryStatus(params: {
  id: string;
  status: EmailOutboxDocument['status'];
  providerMessageId?: string;
  error?: string;
}): Promise<EmailOutboxDocument | null> {
  const col = getEmailOutboxCollection();
  const ref = col.doc(params.id);

  const snap = await ref.get();
  if (!snap.exists) return null;

  const current = snap.data() as EmailOutboxDocument;
  const nowIso = new Date().toISOString();

  const updates: Partial<EmailOutboxDocument> = {
    status: params.status,
    lastAttemptAt: nowIso,
    attempts: (current.attempts || 0) + 1,
    ...(params.providerMessageId ? { providerMessageId: params.providerMessageId } : {}),
    ...(params.error ? { error: params.error } : {}),
    ...(params.status === 'sent' ? { sentAt: nowIso } : {}),
  };

  await ref.update(updates);

  return {
    ...current,
    ...updates,
  };
}

/**
 * Retrieves recent outbox records for administrative inspection.
 */
export async function getRecentOutboxRecords(options: {
  limit?: number;
  status?: string;
} = {}): Promise<EmailOutboxDocument[]> {
  const col = getEmailOutboxCollection();
  const snap = await col.get();

  let records = snap.docs.map((d) => d.data() as EmailOutboxDocument);

  if (options.status && options.status !== 'all') {
    records = records.filter((r) => r.status === options.status);
  }

  // Sort descending by createdAt
  records.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));

  if (options.limit && options.limit > 0) {
    records = records.slice(0, options.limit);
  }

  return records;
}

