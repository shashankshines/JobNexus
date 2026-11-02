/**
 * Zero-Dependency SMTPS (Implicit TLS) Email Provider Adapter
 * Supports Gmail App Passwords (smtp.gmail.com:465) and standard SMTPS servers
 * without requiring third-party packages.
 */

import tls from 'node:tls';
import crypto from 'node:crypto';
import { EmailSendOptions, EmailSendResult } from '../email.types';
import { EmailProviderAdapter } from './email-provider.interface';

export interface SmtpAdapterConfig {
  host?: string;
  port?: number;
  user: string;
  pass: string;
  defaultFrom?: string;
}

function encodeMimeHeader(text: string): string {
  // Encode non-ASCII subjects (e.g., ₹ symbol) using RFC 2047 UTF-8 Base64
  if (/^[\x20-\x7E]*$/.test(text)) {
    return text;
  }
  return `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
}

function wrapBase64Lines(b64: string): string {
  return b64.replace(/(.{76})/g, '$1\r\n');
}

function extractEmailAddress(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return (match ? match[1] : fromHeader).trim();
}

export class SmtpEmailAdapter implements EmailProviderAdapter {
  public readonly providerName = 'smtp';
  private host: string;
  private port: number;
  private user: string;
  private pass: string;
  private defaultFrom: string;

  constructor(config: SmtpAdapterConfig) {
    this.host = (config.host || 'smtp.gmail.com').trim();
    this.port = config.port || 465;
    this.user = config.user.trim();
    // Strip spaces from Google 16-character App Passwords (e.g. "abcd efgh ijkl mnop")
    this.pass = config.pass.replace(/\s+/g, '');
    this.defaultFrom =
      config.defaultFrom?.trim() || `JobNexus Billing <${this.user}>`;
  }

  public get isConfigured(): boolean {
    return Boolean(this.user && this.user.includes('@') && this.pass.length >= 8);
  }

  public async send(options: EmailSendOptions): Promise<EmailSendResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        provider: this.providerName,
        error: 'SMTP credentials (GMAIL_USER / GMAIL_APP_PASSWORD) are incomplete.',
        retryable: false,
      };
    }

    const fromHeader = options.from?.trim() || this.defaultFrom;
    const envelopeFrom = extractEmailAddress(fromHeader);
    const envelopeTo = extractEmailAddress(options.to);
    const boundary = `jn_mime_${crypto.randomBytes(12).toString('hex')}`;
    const messageId = `<${crypto.randomUUID()}@jobnexus.local>`;
    const dateHeader = new Date().toUTCString();

    const plainBase64 = wrapBase64Lines(Buffer.from(options.text, 'utf8').toString('base64'));
    const htmlBase64 = wrapBase64Lines(Buffer.from(options.html, 'utf8').toString('base64'));

    const mimeLines = [
      `From: ${fromHeader}`,
      `To: ${envelopeTo}`,
      `Subject: ${encodeMimeHeader(options.subject)}`,
      `Date: ${dateHeader}`,
      `Message-ID: ${messageId}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      plainBase64,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      htmlBase64,
      '',
      `--${boundary}--`,
      '',
    ];

    // Dot-stuffing per RFC 5321 Section 4.5.2
    const dataPayload = mimeLines
      .join('\r\n')
      .replace(/\r\n\./g, '\r\n..');

    return new Promise<EmailSendResult>((resolve) => {
      let settled = false;
      const finish = (result: EmailSendResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        try {
          socket.destroy();
        } catch {
          // ignore socket cleanup errors
        }
        resolve(result);
      };

      const socket = tls.connect({
        host: this.host,
        port: this.port,
        servername: this.host,
        rejectUnauthorized: true,
      });

      const timeoutId = setTimeout(() => {
        finish({
          success: false,
          provider: this.providerName,
          error: `SMTP connection to ${this.host}:${this.port} timed out after 12000ms.`,
          retryable: true,
        });
      }, 12000);

      let buffer = '';
      let step = 0;

      const sendLine = (line: string) => {
        socket.write(`${line}\r\n`);
      };

      const handleResponse = (code: number, fullText: string) => {
        if (step === 0) {
          if (code !== 220) {
            return finish({
              success: false,
              provider: this.providerName,
              error: `[SMTP ${code}] Greeting failed: ${fullText}`,
              retryable: code >= 400 && code < 500,
            });
          }
          step = 1;
          sendLine('EHLO jobnexus.local');
        } else if (step === 1) {
          if (code !== 250) {
            return finish({
              success: false,
              provider: this.providerName,
              error: `[SMTP ${code}] EHLO failed: ${fullText}`,
              retryable: code >= 400 && code < 500,
            });
          }
          step = 2;
          sendLine('AUTH LOGIN');
        } else if (step === 2) {
          if (code !== 334) {
            return finish({
              success: false,
              provider: this.providerName,
              error: `[SMTP ${code}] AUTH LOGIN not accepted: ${fullText}`,
              retryable: false,
            });
          }
          step = 3;
          sendLine(Buffer.from(this.user, 'utf8').toString('base64'));
        } else if (step === 3) {
          if (code !== 334) {
            return finish({
              success: false,
              provider: this.providerName,
              error: `[SMTP ${code}] Username rejected: ${fullText}`,
              retryable: false,
            });
          }
          step = 4;
          sendLine(Buffer.from(this.pass, 'utf8').toString('base64'));
        } else if (step === 4) {
          if (code !== 235) {
            return finish({
              success: false,
              provider: this.providerName,
              error: `[SMTP ${code}] Authentication failed (check GMAIL_USER / GMAIL_APP_PASSWORD): ${fullText}`,
              retryable: false,
            });
          }
          step = 5;
          sendLine(`MAIL FROM:<${envelopeFrom}>`);
        } else if (step === 5) {
          if (code !== 250) {
            return finish({
              success: false,
              provider: this.providerName,
              error: `[SMTP ${code}] MAIL FROM rejected: ${fullText}`,
              retryable: code >= 400 && code < 500,
            });
          }
          step = 6;
          sendLine(`RCPT TO:<${envelopeTo}>`);
        } else if (step === 6) {
          if (code !== 250 && code !== 251) {
            return finish({
              success: false,
              provider: this.providerName,
              error: `[SMTP ${code}] RCPT TO rejected for ${envelopeTo}: ${fullText}`,
              retryable: code >= 400 && code < 500,
            });
          }
          step = 7;
          sendLine('DATA');
        } else if (step === 7) {
          if (code !== 354) {
            return finish({
              success: false,
              provider: this.providerName,
              error: `[SMTP ${code}] DATA command failed: ${fullText}`,
              retryable: code >= 400 && code < 500,
            });
          }
          step = 8;
          sendLine(`${dataPayload}\r\n.`);
        } else if (step === 8) {
          if (code !== 250) {
            return finish({
              success: false,
              provider: this.providerName,
              error: `[SMTP ${code}] Message body rejected: ${fullText}`,
              retryable: code >= 400 && code < 500,
            });
          }
          step = 9;
          sendLine('QUIT');
          finish({
            success: true,
            provider: this.providerName,
            providerMessageId: `smtp_${messageId.replace(/[<>]/g, '')}`,
          });
        }
      };

      socket.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\r\n');
        buffer = lines.pop() || '';

        let multiLineText: string[] = [];
        for (const line of lines) {
          if (!line) continue;
          multiLineText.push(line);
          // RFC 5321: final line of a reply has a space after the 3-digit code (e.g., "250 OK", not "250-PIPELINING")
          if (/^\d{3} /.test(line) || /^\d{3}$/.test(line)) {
            const code = parseInt(line.slice(0, 3), 10);
            const fullText = multiLineText.join(' | ');
            multiLineText = [];
            handleResponse(code, fullText);
          }
        }
      });

      socket.on('error', (err: Error) => {
        finish({
          success: false,
          provider: this.providerName,
          error: `SMTP network error: ${err.message}`,
          retryable: true,
        });
      });

      socket.on('close', () => {
        if (!settled) {
          finish({
            success: false,
            provider: this.providerName,
            error: 'SMTP connection closed unexpectedly before completion.',
            retryable: true,
          });
        }
      });
    });
  }
}

