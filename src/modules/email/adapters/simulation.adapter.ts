/**
 * Simulation / In-Memory Email Provider Adapter (Phase 2B.4)
 * Active in development, test environments, or when no external credentials are configured.
 * Supports failure simulation for hermetic test coverage.
 */

import crypto from 'node:crypto';
import { EmailSendOptions, EmailSendResult } from '../email.types';
import { EmailProviderAdapter } from './email-provider.interface';

export interface SimulatedEmailRecord {
  id: string;
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
  sentAt: string;
}

export class SimulationEmailAdapter implements EmailProviderAdapter {
  public readonly providerName = 'simulation';
  public readonly isConfigured = true;

  private sentEmails: SimulatedEmailRecord[] = [];
  private failureQueue: { error: string; retryable: boolean }[] = [];

  public async send(options: EmailSendOptions): Promise<EmailSendResult> {
    // If a simulated failure was queued (for tests)
    if (this.failureQueue.length > 0) {
      const nextFailure = this.failureQueue.shift()!;
      return {
        success: false,
        provider: this.providerName,
        error: nextFailure.error,
        retryable: nextFailure.retryable,
      };
    }

    const messageId = `sim_msg_${crypto.randomBytes(8).toString('hex')}`;
    const record: SimulatedEmailRecord = {
      id: messageId,
      to: options.to,
      from: options.from || 'JobNexus Billing <billing@jobnexus.dev>',
      subject: options.subject,
      html: options.html,
      text: options.text,
      idempotencyKey: options.idempotencyKey,
      sentAt: new Date().toISOString(),
    };

    this.sentEmails.push(record);

    return {
      success: true,
      provider: this.providerName,
      providerMessageId: messageId,
    };
  }

  // Test helpers
  public queueFailure(error: string, retryable: boolean = true): void {
    this.failureQueue.push({ error, retryable });
  }

  public getSentEmails(): SimulatedEmailRecord[] {
    return [...this.sentEmails];
  }

  public getLastSentEmail(): SimulatedEmailRecord | null {
    return this.sentEmails.length > 0 ? this.sentEmails[this.sentEmails.length - 1] : null;
  }

  public clear(): void {
    this.sentEmails = [];
    this.failureQueue = [];
  }
}

