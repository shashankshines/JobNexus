'use client';

import React from 'react';
import Image from 'next/image';

export interface JobNexusLogoProps {
  /**
   * 'mark': 3D 'jN' ribbon emblem only (ideal for header capsules, buttons, avatars)
   * 'inline': 3D 'jN' mark + 'JobNexus' styled text
   * 'full': 3D 'jN' mark + 'JobNexus' + 'Discover | Apply | Grow' tagline
   * 'banner': Pre-composed horizontal brand lockup image
   */
  variant?: 'mark' | 'inline' | 'full' | 'banner';
  size?: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  glow?: boolean;
  priority?: boolean;
  className?: string;
  style?: React.CSSProperties;
  showTagline?: boolean;
  useImageLockup?: boolean;
  onClick?: () => void;
}

const SIZE_MAP: Record<string, number> = {
  xs: 22,
  sm: 28,
  md: 36,
  lg: 48,
  xl: 64,
};

export default function JobNexusLogo({
  variant = 'mark',
  size = 'md',
  priority = false,
  className = '',
  style,
  showTagline = false,
  useImageLockup = false,
  onClick,
}: JobNexusLogoProps) {
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] || 36;
  const isClickable = Boolean(onClick);

  // Aspect ratio of the master 3D 'jN' mark is 936:776 ≈ 1.206:1
  const markWidth = Math.round(pixelSize * 1.206);
  const markHeight = pixelSize;

  // Full / Banner image lockup variant: renders the canonical master horizontal lockup
  if (variant === 'banner' || (variant === 'full' && useImageLockup)) {
    const bannerHeight = typeof size === 'number' ? size : 40;
    // Aspect ratio of master horizontal lockup (1150:232 ≈ 4.96:1)
    const bannerWidth = Math.round(bannerHeight * 4.96);

    return (
      <div
        className={`jobnexus-logo-banner ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          position: 'relative',
          cursor: isClickable ? 'pointer' : 'default',
          filter: 'none',
          boxShadow: 'none',
          ...style,
        }}
        onClick={onClick}
      >
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Image
            src="/brand/jobnexus-logo.png"
            alt="JobNexus — Discover | Apply | Grow"
            width={bannerWidth}
            height={bannerHeight}
            priority={priority}
            className="jobnexus-logo-img"
            style={{
              width: 'auto',
              height: bannerHeight,
              objectFit: 'contain',
              display: 'block',
              filter: 'none',
            }}
          />
        </div>
      </div>
    );
  }

  // Mark only variant: 3D 'jN' ribbon emblem
  if (variant === 'mark') {
    return (
      <div
        className={`jobnexus-logo-mark-wrap ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          width: markWidth,
          height: markHeight,
          cursor: isClickable ? 'pointer' : 'default',
          flexShrink: 0,
          filter: 'none',
          boxShadow: 'none',
          ...style,
        }}
        onClick={onClick}
      >
        <Image
          src="/brand/jobnexus-mark.png"
          alt="JobNexus"
          width={markWidth * 2} // 2x for crisp high-DPI retina rendering
          height={markHeight * 2}
          priority={priority}
          style={{
            width: markWidth,
            height: markHeight,
            objectFit: 'contain',
            position: 'relative',
            zIndex: 1,
            filter: 'none',
            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="jobnexus-mark-img"
        />
      </div>
    );
  }

  // Inline & Full variants: Mark + Scalable typography + optional tagline
  const fontSize = Math.max(16, Math.round(pixelSize * 0.65));
  const taglineSize = Math.max(10, Math.round(fontSize * 0.42));

  return (
    <div
      className={`jobnexus-logo-lockup ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: Math.round(pixelSize * 0.26),
        cursor: isClickable ? 'pointer' : 'default',
        userSelect: 'none',
        position: 'relative',
        filter: 'none',
        boxShadow: 'none',
        ...style,
      }}
      onClick={onClick}
    >
      {/* 3D 'jN' Emblem */}
      <div
        style={{
          position: 'relative',
          width: markWidth,
          height: markHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          filter: 'none',
        }}
      >
        <Image
          src="/brand/jobnexus-mark.png"
          alt="JobNexus Emblem"
          width={markWidth * 2}
          height={markHeight * 2}
          priority={priority}
          style={{
            width: markWidth,
            height: markHeight,
            objectFit: 'contain',
            position: 'relative',
            zIndex: 1,
            filter: 'none',
          }}
          className="jobnexus-mark-img"
        />
      </div>

      {/* Typography Lockup */}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
        <div
          style={{
            fontSize,
            fontWeight: 800,
            letterSpacing: '-0.025em',
            fontFamily: 'inherit',
          }}
          className="jobnexus-brand-text"
        >
          <span style={{ color: 'var(--text-primary)' }}>Job</span>
          <span
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #38bdf8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: 'inline-block',
            }}
          >
            Nexus
          </span>
        </div>

        {(variant === 'full' || showTagline) && (
          <span
            style={{
              fontSize: taglineSize,
              fontWeight: 600,
              color: 'var(--text-muted)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginTop: 2,
            }}
            className="jobnexus-tagline"
          >
            Discover • Apply • Grow
          </span>
        )}
      </div>
    </div>
  );
}

export { JobNexusLogo };
