'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { AlertCircle, QrCode as QrIcon } from 'lucide-react';

interface UpiQrCodeProps {
  upiUri: string;
  size?: number;
  altText?: string;
  upiId?: string;
}

export function UpiQrCode({
  upiUri,
  size = 200,
  altText = 'UPI Payment QR Code for JobNexus Premium',
  upiId,
}: UpiQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function generateQr() {
      if (!upiUri) {
        setIsLoading(false);
        setError('Payment URI missing');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const url = await QRCode.toDataURL(upiUri, {
          width: size * 2, // High DPI scaling
          margin: 2, // Official QR Quiet Zone
          color: {
            dark: '#0f172a', // Deep slate for crisp scanning contrast
            light: '#ffffff', // Pure white background
          },
          errorCorrectionLevel: 'M',
        });

        if (isMounted) {
          setDataUrl(url);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error('[UpiQrCode] QR generation error:', err);
          setError('Failed to render QR Code locally');
          setIsLoading(false);
        }
      }
    }

    generateQr();

    return () => {
      isMounted = false;
    };
  }, [upiUri, size]);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Generating UPI QR Code..."
        style={{
          width: size,
          height: size,
          borderRadius: 16,
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          color: '#94a3b8',
        }}
      >
        <QrIcon size={32} className="animate-pulse" style={{ color: '#818cf8' }} />
        <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>Generating QR...</span>
      </div>
    );
  }

  if (error || !dataUrl) {
    return (
      <div
        role="alert"
        style={{
          width: size,
          minHeight: size,
          borderRadius: 16,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: '0.5rem',
          color: '#fca5a5',
        }}
      >
        <AlertCircle size={28} />
        <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>QR Display Unavailable</span>
        {upiId && (
          <p style={{ fontSize: '0.72rem', color: '#cbd5e1', margin: 0 }}>
            Please pay directly to UPI ID: <strong>{upiId}</strong>
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0.75rem',
        borderRadius: 20,
        background: '#ffffff',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.15)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt={altText}
        width={size}
        height={size}
        style={{
          display: 'block',
          borderRadius: 8,
          width: size,
          height: size,
          objectFit: 'contain',
        }}
      />
    </div>
  );
}
