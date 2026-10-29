/**
 * Resend Email Provider Adapter (Phase 2B.4)
 * Uses native fetch with strict timeout, idempotency key support, and error classification.
 */

import { EmailSendOptions, EmailSendResult } from '../email.types';
import { EmailProviderAdapter } from './email-provider.interface';

export class ResendEmailAdapter implements EmailProviderAdapter {
  public readonly providerName = 'resend';
  private apiKey: string;
  private defaultFrom: string;

  constructor(apiKey: string, defaultFrom?: string) {
    this.apiKey = apiKey.trim();
    this.defaultFrom = defaultFrom?.trim() || 'JobNexus Billing <billing@jobnexus.dev>';
  }

  public get isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  public async send(options: EmailSendOptions): Promise<EmailSendResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        provider: this.providerName,
        error: 'Resend API key is not configured in environment variables (RESEND_API_KEY).',
        retryable: false,
      };
    }

    const fromAddress = options.from || this.defaultFrom;

    try {
      // 10-second bounded timeout prevents hanging customer HTTP requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      };

      if (options.idempotencyKey) {
        headers['Idempotency-Key'] = options.idempotencyKey;
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          from: fromAddress,
          to: [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const statusCode = response.status;
        const errorMessage =
          (data && (data.message || data.error)) || `HTTP ${statusCode} error from Resend API`;

        // 429 Rate Limit or 5xx Server Errors are retryable; 4xx Client Errors are permanent
        const isRetryable = statusCode === 429 || statusCode >= 500;

        return {
          success: false,
          provider: this.providerName,
          error: `[Resend ${statusCode}] ${errorMessage}`,
          retryable: isRetryable,
        };
      }

      return {
        success: true,
        provider: this.providerName,
        providerMessageId: data?.id || `resend_${Date.now()}`,
      };
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const errorMessage = isAbort
        ? 'Request to Resend API timed out after 10000ms.'
        : err instanceof Error
        ? err.message
        : 'Unknown network error connecting to Resend API';

      return {
        success: false,
        provider: this.providerName,
        error: errorMessage,
        retryable: true, // Network timeouts and transient disconnects are retryable
      };
    }
  }
}

