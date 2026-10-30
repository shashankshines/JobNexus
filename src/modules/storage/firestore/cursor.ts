/**
 * JobNexus Opaque Pagination Cursor Engine
 *
 * Implements tamper-evident, opaque, URL-safe base64url cursor encoding/decoding.
 * Compatible with multi-field Firestore ordering (e.g. primary sort timestamp + secondary unique ID).
 */

export interface CursorPayload {
  primary: string | number;
  secondary: string;
}

/**
 * Encodes primary order value (e.g. ISO timestamp or number) and secondary unique document ID
 * into an opaque, URL-safe base64url string.
 */
export function encodeCursor(primary: string | number, secondary: string): string {
  const payload: CursorPayload = { primary, secondary };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/**
 * Validates and decodes an opaque cursor string back into its constituent sort keys.
 * Returns null if the cursor is invalid, malformed, or tampered with.
 */
export function decodeCursor(cursorStr?: string | null): CursorPayload | null {
  if (!cursorStr || typeof cursorStr !== 'string') return null;
  const trimmed = cursorStr.trim();
  if (!trimmed) return null;

  try {
    const json = Buffer.from(trimmed, 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    if (
      parsed &&
      typeof parsed === 'object' &&
      (typeof parsed.primary === 'string' || typeof parsed.primary === 'number') &&
      typeof parsed.secondary === 'string' &&
      parsed.secondary.length > 0
    ) {
      return {
        primary: parsed.primary,
        secondary: parsed.secondary,
      };
    }
  } catch {
    return null;
  }
  return null;
}
