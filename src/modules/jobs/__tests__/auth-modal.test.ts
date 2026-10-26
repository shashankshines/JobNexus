import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  validateAndNormalizeIdentifier,
  validateAndNormalizeGmail,
  deriveDisplayName,
  getInitials,
  validatePassword,
  validatePasswordMatch,
  validateCredentialsSignIn,
  validateCredentialsSignUp,
  validatePasswordResetRequest,
  validatePasswordResetExecution,
} from '../domain/auth.validation';
import { User } from '../../../app/context/AuthContext';

describe('Universal Credentials Sign In, Sign Up & Forgot Password Validation Suite', () => {
  describe('Identifier & Email Validation: Positive Scenarios', () => {
    it('accepts standard @gmail.com addresses', () => {
      const res = validateAndNormalizeIdentifier('developer@gmail.com');
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.normalized, 'developer@gmail.com');
      assert.strictEqual(res.isEmail, true);
      assert.strictEqual(res.username, 'developer');
      assert.strictEqual(res.error, undefined);
    });

    it('accepts non-Gmail providers (Yahoo, Outlook, Hotmail, Proton, Apple, Corporate)', () => {
      const emails = [
        { raw: 'john@yahoo.com', user: 'john' },
        { raw: 'sarah@outlook.com', user: 'sarah' },
        { raw: 'dev@hotmail.com', user: 'dev' },
        { raw: 'alex@protonmail.com', user: 'alex' },
        { raw: 'engineer@icloud.com', user: 'engineer' },
        { raw: 'staff@stripe.com', user: 'staff' },
      ];

      for (const item of emails) {
        const res = validateAndNormalizeIdentifier(item.raw);
        assert.strictEqual(res.valid, true, `Expected ${item.raw} to be valid`);
        assert.strictEqual(res.normalized, item.raw);
        assert.strictEqual(res.isEmail, true);
        assert.strictEqual(res.username, item.user);
      }
    });

    it('accepts dotted email usernames and sub-addressing', () => {
      const res = validateAndNormalizeIdentifier('alex.rivera+jobnexus@domain.com');
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.normalized, 'alex.rivera+jobnexus@domain.com');
      assert.strictEqual(res.isEmail, true);
    });

    it('accepts username handles without domain', () => {
      const handles = ['sarah_connor', 'alex.rivera', 'devin99', 'tech-lead'];
      for (const handle of handles) {
        const res = validateAndNormalizeIdentifier(handle);
        assert.strictEqual(res.valid, true, `Expected handle ${handle} to be valid`);
        assert.strictEqual(res.normalized, handle);
        assert.strictEqual(res.isEmail, false);
        assert.strictEqual(res.username, handle);
      }
    });

    it('normalizes uppercase characters and trims leading/trailing whitespace', () => {
      const res = validateAndNormalizeIdentifier('   Alex.Rivera@Example.COM   ');
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.normalized, 'alex.rivera@example.com');
    });

    it('maintains backwards compatibility alias validateAndNormalizeGmail', () => {
      const res = validateAndNormalizeGmail('engineer@customdomain.io');
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.normalized, 'engineer@customdomain.io');
    });
  });

  describe('Identifier & Email Validation: Negative Scenarios & Error Resilience', () => {
    it('rejects empty and whitespace-only inputs with helpful message', () => {
      const empty = validateAndNormalizeIdentifier('');
      assert.strictEqual(empty.valid, false);
      assert.strictEqual(empty.error, 'Please enter your username or email address.');

      const spaces = validateAndNormalizeIdentifier('    ');
      assert.strictEqual(spaces.valid, false);
      assert.strictEqual(spaces.error, 'Please enter your username or email address.');
    });

    it('rejects inputs containing internal spaces', () => {
      const res = validateAndNormalizeIdentifier('alex rivera@domain.com');
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.error, 'Username or email cannot contain spaces.');
    });

    it('rejects lone domain strings without username before @', () => {
      const lone1 = validateAndNormalizeIdentifier('@domain.com');
      assert.strictEqual(lone1.valid, false);
      assert.strictEqual(lone1.error, 'Please enter a valid username before @.');
    });

    it('rejects emails without valid domain extension', () => {
      const res = validateAndNormalizeIdentifier('alex@nodomain');
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.error, 'Please enter a valid email domain (e.g. domain.com).');
    });

    it('rejects malformed multiple @ characters', () => {
      const res = validateAndNormalizeIdentifier('alex@@domain.com');
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.error, 'Please enter a valid email address with a single @ symbol.');
    });

    it('rejects emails with consecutive dots in domain or username', () => {
      const res = validateAndNormalizeIdentifier('alex..rivera@domain.com');
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.error, 'Please enter a valid email address format.');
    });

    it('rejects invalid username handles with invalid special characters', () => {
      const res = validateAndNormalizeIdentifier('user$name');
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.error, 'Please enter a valid username (letters, numbers, dots, dashes).');
    });
  });

  describe('Password Validation & Strength Engine', () => {
    it('rejects empty password', () => {
      const res = validatePassword('');
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.error, 'Please enter your password.');
      assert.strictEqual(res.strength, 'weak');
    });

    it('rejects password shorter than 6 characters', () => {
      const res = validatePassword('12345');
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.error, 'Password must be at least 6 characters long.');
      assert.strictEqual(res.strength, 'weak');
    });

    it('rejects password with internal spaces', () => {
      const res = validatePassword('pass word 123');
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.error, 'Password cannot contain spaces.');
      assert.strictEqual(res.strength, 'weak');
    });

    it('rates simple 6-7 char passwords as weak', () => {
      const res = validatePassword('simple');
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.strength, 'weak');
    });

    it('rates 8+ char alphanumeric passwords as medium', () => {
      const res = validatePassword('Pass1234');
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.strength, 'medium');
    });

    it('rates complex 8+ char passwords with symbols and mixed case as strong', () => {
      const res = validatePassword('P@ssw0rd2026!');
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.strength, 'strong');
    });
  });

  describe('Password Match Engine', () => {
    it('validates matching passwords successfully', () => {
      const res = validatePasswordMatch('SecurePass123', 'SecurePass123');
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.error, undefined);
    });

    it('rejects mismatched passwords with clear error', () => {
      const res = validatePasswordMatch('SecurePass123', 'DifferentPass456');
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.error, 'Passwords do not match.');
    });

    it('rejects empty confirm password', () => {
      const emptyConfirm = validatePasswordMatch('SecurePass123', '');
      assert.strictEqual(emptyConfirm.valid, false);
      assert.strictEqual(emptyConfirm.error, 'Please confirm your password.');
    });
  });

  describe('Credentials Sign In & Sign Up Payloads', () => {
    it('validates successful credentials sign in with username and password', () => {
      const res = validateCredentialsSignIn({
        usernameOrEmail: 'alex.rivera',
        password: 'ValidPassword123',
      });
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.normalizedIdentifier, 'alex.rivera');
      assert.strictEqual(res.error, undefined);
    });

    it('validates successful credentials sign in with standard email and password', () => {
      const res = validateCredentialsSignIn({
        usernameOrEmail: 'alex@company.com',
        password: 'ValidPassword123',
      });
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.normalizedIdentifier, 'alex@company.com');
      assert.strictEqual(res.error, undefined);
    });

    it('rejects credentials sign in with invalid password or invalid identifier', () => {
      const invalidEmail = validateCredentialsSignIn({
        usernameOrEmail: 'alex invalid @email.com',
        password: 'ValidPassword123',
      });
      assert.strictEqual(invalidEmail.valid, false);
      assert.strictEqual(invalidEmail.error, 'Username or email cannot contain spaces.');

      const shortPass = validateCredentialsSignIn({
        usernameOrEmail: 'alex@domain.com',
        password: '123',
      });
      assert.strictEqual(shortPass.valid, false);
      assert.strictEqual(shortPass.error, 'Password must be at least 6 characters long.');
    });

    it('validates successful credentials sign up with name, username, password and track', () => {
      const res = validateCredentialsSignUp({
        name: 'Alex Rivera',
        usernameOrEmail: 'alex.rivera',
        password: 'P@ssw0rd2026',
        confirmPassword: 'P@ssw0rd2026',
        role: 'Full Stack Engineer',
      });
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.sanitizedName, 'Alex Rivera');
      assert.strictEqual(res.normalizedIdentifier, 'alex.rivera');
      assert.strictEqual(res.role, 'Full Stack Engineer');
    });

    it('validates successful credentials sign up with email', () => {
      const res = validateCredentialsSignUp({
        name: 'Alex Rivera',
        usernameOrEmail: 'alex@techcorp.io',
        password: 'P@ssw0rd2026',
        confirmPassword: 'P@ssw0rd2026',
        role: 'Backend Architect',
      });
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.sanitizedName, 'Alex Rivera');
      assert.strictEqual(res.normalizedIdentifier, 'alex@techcorp.io');
      assert.strictEqual(res.role, 'Backend Architect');
    });

    it('rejects credentials sign up when passwords do not match', () => {
      const res = validateCredentialsSignUp({
        name: 'Alex Rivera',
        usernameOrEmail: 'alex@domain.com',
        password: 'PasswordOne1',
        confirmPassword: 'PasswordTwo2',
      });
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.error, 'Passwords do not match.');
    });
  });

  describe('Forgot Password Flow: Request & Execution Validation', () => {
    it('validates password reset request with valid email address or username', () => {
      const res1 = validatePasswordResetRequest('alex.rivera@custom.com');
      assert.strictEqual(res1.valid, true);
      assert.strictEqual(res1.normalizedIdentifier, 'alex.rivera@custom.com');

      const res2 = validatePasswordResetRequest('sarah_connor');
      assert.strictEqual(res2.valid, true);
      assert.strictEqual(res2.normalizedIdentifier, 'sarah_connor');
    });

    it('rejects password reset request for invalid inputs', () => {
      const empty = validatePasswordResetRequest('');
      assert.strictEqual(empty.valid, false);

      const spaces = validatePasswordResetRequest('user with spaces');
      assert.strictEqual(spaces.valid, false);
    });

    it('validates password reset execution with valid 6-digit code and matching new passwords', () => {
      const res = validatePasswordResetExecution({
        email: 'alex.rivera@domain.com',
        code: '123456',
        newPassword: 'BrandNewPassword123',
        confirmPassword: 'BrandNewPassword123',
      });
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.error, undefined);
    });

    it('rejects password reset execution if code is not 6 digits', () => {
      const resShort = validatePasswordResetExecution({
        email: 'alex.rivera@domain.com',
        code: '123',
        newPassword: 'BrandNewPassword123',
        confirmPassword: 'BrandNewPassword123',
      });
      assert.strictEqual(resShort.valid, false);
      assert.strictEqual(resShort.error, 'Recovery code must be exactly 6 numeric digits.');

      const resAlpha = validatePasswordResetExecution({
        email: 'alex.rivera@domain.com',
        code: 'abcdef',
        newPassword: 'BrandNewPassword123',
        confirmPassword: 'BrandNewPassword123',
      });
      assert.strictEqual(resAlpha.valid, false);
      assert.strictEqual(resAlpha.error, 'Recovery code must be exactly 6 numeric digits.');
    });

    it('rejects password reset execution if new passwords do not match', () => {
      const res = validatePasswordResetExecution({
        email: 'alex.rivera@domain.com',
        code: '123456',
        newPassword: 'BrandNewPassword123',
        confirmPassword: 'DifferentPassword123',
      });
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.error, 'Passwords do not match.');
    });
  });

  describe('Display Name & Avatar Initials Generation', () => {
    it('derives readable names from identifiers', () => {
      assert.strictEqual(deriveDisplayName('alex.rivera.dev@domain.com'), 'Alex Rivera Dev');
      assert.strictEqual(deriveDisplayName('sarah_connor'), 'Sarah Connor');
      assert.strictEqual(deriveDisplayName('john-doe@company.org'), 'John Doe');
    });

    it('preserves custom display names if provided', () => {
      assert.strictEqual(deriveDisplayName('test@domain.com', 'Alex Rivera'), 'Alex Rivera');
    });

    it('generates two-letter initials correctly', () => {
      assert.strictEqual(getInitials('Alex Rivera'), 'AR');
      assert.strictEqual(getInitials('Sarah Connor'), 'SC');
      assert.strictEqual(getInitials('Devin'), 'DE');
      assert.strictEqual(getInitials(''), 'U');
    });
  });

  describe('User Session Model Integrity', () => {
    it('creates compliant credentials user model', () => {
      const user: User = {
        id: 'usr_cred_1729900000',
        name: 'Alex Rivera',
        email: 'alex.rivera@company.com',
        role: 'Staff Systems Architect',
        provider: 'credentials',
        initials: 'AR',
      };

      assert.strictEqual(user.provider, 'credentials');
      assert.strictEqual(user.email, 'alex.rivera@company.com');
      assert.strictEqual(user.initials, 'AR');
    });

    it('serializes and deserializes user session for localStorage', () => {
      const user: User = {
        id: 'usr_cred_987654',
        name: 'Sarah Connor',
        email: 'sarah.connor@domain.io',
        role: 'Full Stack Engineer',
        provider: 'credentials',
        initials: 'SC',
      };

      const serialized = JSON.stringify(user);
      const parsed = JSON.parse(serialized) as User;
      assert.deepStrictEqual(parsed, user);
      assert.strictEqual(parsed.provider, 'credentials');
    });
  });
});
