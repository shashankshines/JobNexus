import { EmailSendOptions, EmailSendResult } from '../email.types';

export interface EmailProviderAdapter {
  readonly providerName: string;
  readonly isConfigured: boolean;
  send(options: EmailSendOptions): Promise<EmailSendResult>;
}

