/**
 * Domain Authentication & Credentials Validation Engine
 * Universal username/email validation, password strength criteria,
 * display name derivation, and Sign In / Sign Up / Forgot Password flows.
 */

export interface IdentifierValidationResult {
  valid: boolean;
  normalized?: string;
  isEmail?: boolean;
  username?: string;
  error?: string;
}

export type GmailValidationResult = IdentifierValidationResult;

export interface SignUpValidationResult {
  valid: boolean;
  sanitizedName?: string;
  normalizedEmail?: string;
  role?: string;
  error?: string;
}

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
  strength: 'weak' | 'medium' | 'strong';
}

export interface CredentialsSignInResult {
  valid: boolean;
  normalizedIdentifier?: string;
  error?: string;
}

export interface CredentialsSignUpResult {
  valid: boolean;
  sanitizedName?: string;
  normalizedIdentifier?: string;
  role?: string;
  error?: string;
}

export interface PasswordResetRequestResult {
  valid: boolean;
  normalizedIdentifier?: string;
  error?: string;
}

export interface PasswordResetExecutionResult {
  valid: boolean;
  error?: string;
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;

/**
 * Validates and normalizes any email address or username handle.
 */
export function validateAndNormalizeIdentifier(input: string): IdentifierValidationResult {
  const raw = (input || '').trim();
  if (!raw) {
    return { valid: false, error: 'Please enter your username or email address.' };
  }

  if (/\s/.test(raw)) {
    return { valid: false, error: 'Username or email cannot contain spaces.' };
  }

  const clean = raw.toLowerCase();

  // If input contains @, validate as email address
  if (clean.includes('@')) {
    const atCount = (clean.match(/@/g) || []).length;
    if (atCount > 1) {
      return { valid: false, error: 'Please enter a valid email address with a single @ symbol.' };
    }

    const [userPart, domainPart] = clean.split('@');
    if (!userPart) {
      return { valid: false, error: 'Please enter a valid username before @.' };
    }
    if (!domainPart || !domainPart.includes('.')) {
      return { valid: false, error: 'Please enter a valid email domain (e.g. domain.com).' };
    }

    if (!EMAIL_REGEX.test(clean) || clean.includes('..')) {
      return { valid: false, error: 'Please enter a valid email address format.' };
    }

    return {
      valid: true,
      normalized: clean,
      isEmail: true,
      username: userPart,
    };
  }

  // Otherwise validate as username handle
  if (!USERNAME_REGEX.test(clean) || clean.includes('..')) {
    return { valid: false, error: 'Please enter a valid username (letters, numbers, dots, dashes).' };
  }

  return {
    valid: true,
    normalized: clean,
    isEmail: false,
    username: clean,
  };
}

/**
 * Alias for backwards compatibility with existing imports.
 */
export function validateAndNormalizeGmail(input: string): IdentifierValidationResult {
  return validateAndNormalizeIdentifier(input);
}

/**
 * Validates password length, whitespace, and strength.
 */
export function validatePassword(password: string): PasswordValidationResult {
  if (!password) {
    return { valid: false, error: 'Please enter your password.', strength: 'weak' };
  }

  if (/\s/.test(password)) {
    return { valid: false, error: 'Password cannot contain spaces.', strength: 'weak' };
  }

  if (password.length < 6) {
    return {
      valid: false,
      error: 'Password must be at least 6 characters long.',
      strength: 'weak',
    };
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  let strength: 'weak' | 'medium' | 'strong' = 'weak';

  if (password.length >= 8 && hasUpper && hasLower && hasDigit && hasSpecial) {
    strength = 'strong';
  } else if (password.length >= 8 && ((hasLower && hasDigit) || (hasUpper && hasDigit) || (hasLower && hasUpper))) {
    strength = 'medium';
  } else if (password.length >= 6) {
    strength = 'weak';
  }

  return { valid: true, strength };
}

/**
 * Validates password confirmation match.
 */
export function validatePasswordMatch(password: string, confirmPassword: string): { valid: boolean; error?: string } {
  if (!confirmPassword) {
    return { valid: false, error: 'Please confirm your password.' };
  }
  if (password !== confirmPassword) {
    return { valid: false, error: 'Passwords do not match.' };
  }
  return { valid: true };
}

/**
 * Derives a clean, capitalized display name from an email, username, or custom input.
 */
export function deriveDisplayName(identifier: string, customName?: string): string {
  const name = (customName || '').trim().replace(/\s+/g, ' ');
  if (name) return name;

  const handle = identifier.includes('@') ? identifier.split('@')[0] : identifier;
  const baseHandle = handle.split('+')[0] || 'Developer';

  return (
    baseHandle
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim() || 'Developer'
  );
}

/**
 * Computes 1 or 2 letter uppercase initials for user avatar capsules.
 */
export function getInitials(name: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    const word = parts[0];
    return word.length >= 2 ? word.substring(0, 2).toUpperCase() : word.toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Validates Credentials Sign In (Username/Email + Password).
 */
export function validateCredentialsSignIn(data: {
  usernameOrEmail: string;
  password: string;
}): CredentialsSignInResult {
  const idRes = validateAndNormalizeIdentifier(data.usernameOrEmail);
  if (!idRes.valid || !idRes.normalized) {
    return { valid: false, error: idRes.error };
  }

  const passRes = validatePassword(data.password);
  if (!passRes.valid) {
    return { valid: false, error: passRes.error };
  }

  return {
    valid: true,
    normalizedIdentifier: idRes.normalized,
  };
}

/**
 * Validates Credentials Sign Up (Name + Username/Email + Password + Confirm Password + Track).
 */
export function validateCredentialsSignUp(data: {
  name?: string;
  usernameOrEmail: string;
  password: string;
  confirmPassword?: string;
  role?: string;
}): CredentialsSignUpResult {
  const rawName = (data.name || '').trim().replace(/\s+/g, ' ');
  if (rawName && !/[a-zA-Z0-9]/.test(rawName)) {
    return { valid: false, error: 'Please enter a valid full name.' };
  }

  const idRes = validateAndNormalizeIdentifier(data.usernameOrEmail);
  if (!idRes.valid || !idRes.normalized) {
    return { valid: false, error: idRes.error };
  }

  const passRes = validatePassword(data.password);
  if (!passRes.valid) {
    return { valid: false, error: passRes.error };
  }

  if (data.confirmPassword !== undefined) {
    const matchRes = validatePasswordMatch(data.password, data.confirmPassword);
    if (!matchRes.valid) {
      return { valid: false, error: matchRes.error };
    }
  }

  const sanitizedName = deriveDisplayName(idRes.normalized, rawName);

  return {
    valid: true,
    sanitizedName,
    normalizedIdentifier: idRes.normalized,
    role: data.role?.trim() || 'Software Engineer',
  };
}

/**
 * Validates complete Sign Up form submission payload (backwards compatible).
 */
export function validateSignUpInput(data: {
  name?: string;
  email: string;
  role?: string;
}): SignUpValidationResult {
  const idRes = validateAndNormalizeIdentifier(data.email);
  if (!idRes.valid || !idRes.normalized) {
    return { valid: false, error: idRes.error };
  }

  const rawName = (data.name || '').trim().replace(/\s+/g, ' ');
  if (rawName && !/[a-zA-Z0-9]/.test(rawName)) {
    return { valid: false, error: 'Please enter a valid full name.' };
  }

  const sanitizedName = deriveDisplayName(idRes.normalized, rawName);

  return {
    valid: true,
    normalizedEmail: idRes.normalized,
    sanitizedName,
    role: data.role?.trim() || 'Software Engineer',
  };
}

/**
 * Validates Password Reset request payload (Username/Email).
 */
export function validatePasswordResetRequest(input: string): PasswordResetRequestResult {
  const res = validateAndNormalizeIdentifier(input);
  if (!res.valid || !res.normalized) {
    return { valid: false, error: res.error || 'Please enter a valid username or email address.' };
  }
  return { valid: true, normalizedIdentifier: res.normalized };
}

/**
 * Validates Password Reset code verification and new password payload.
 */
export function validatePasswordResetExecution(data: {
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
}): PasswordResetExecutionResult {
  const idRes = validateAndNormalizeIdentifier(data.email);
  if (!idRes.valid) {
    return { valid: false, error: idRes.error };
  }

  const cleanCode = (data.code || '').trim();
  if (!cleanCode) {
    return { valid: false, error: 'Please enter the 6-digit recovery code.' };
  }

  if (!/^\d{6}$/.test(cleanCode)) {
    return { valid: false, error: 'Recovery code must be exactly 6 numeric digits.' };
  }

  const passRes = validatePassword(data.newPassword);
  if (!passRes.valid) {
    return { valid: false, error: passRes.error };
  }

  const matchRes = validatePasswordMatch(data.newPassword, data.confirmPassword);
  if (!matchRes.valid) {
    return { valid: false, error: matchRes.error };
  }

  return { valid: true };
}
