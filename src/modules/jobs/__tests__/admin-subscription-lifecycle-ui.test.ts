import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const adminPage = fs.readFileSync(
  path.resolve(process.cwd(), 'src/app/admin/page.tsx'),
  'utf8'
);
const globalStyles = fs.readFileSync(
  path.resolve(process.cwd(), 'src/app/globals.css'),
  'utf8'
);

describe('Admin subscription lifecycle action UX', () => {
  it('lists every lifecycle action with a plain-English description', () => {
    const expectedOptions = [
      ['grant', 'Grant Premium', 'Give 30 days of complimentary access.'],
      ['extend', 'Extend Premium', 'Add days to the existing subscription.'],
      ['suspend', 'Temporarily Suspend', 'Block access while keeping remaining days.'],
      ['reinstate', 'Reinstate Premium', 'Restore eligible suspended or terminated access.'],
      ['terminate', 'Terminate Premium', 'Stop access now; allow restoration later.'],
      ['revoke', 'Permanently Revoke', 'Stop access permanently; cannot be restored.'],
    ];

    for (const [value, label, description] of expectedOptions) {
      assert.ok(adminPage.includes(`value: '${value}'`), `Missing action value ${value}`);
      assert.ok(adminPage.includes(`label: '${label}'`), `Missing action label ${label}`);
      assert.ok(adminPage.includes(`description: '${description}'`), `Missing description for ${label}`);
    }
  });

  it('updates contextual guidance and requires explicit confirmation for termination and revocation', () => {
    assert.ok(adminPage.includes('className="admin-action-context" aria-live="polite"'));
    assert.ok(adminPage.includes('controlAction === \'terminate\' || controlAction === \'revoke\''));
    assert.ok(adminPage.includes('I understand Premium access stops immediately'));
    assert.ok(adminPage.includes('cannot be undone through reinstatement'));
    for (const label of [
      'Grant Premium',
      'Extend Subscription',
      'Suspend Access',
      'Reinstate Premium',
      'Terminate Premium',
      'Permanently Revoke',
    ]) {
      assert.ok(adminPage.includes(`'${label}'`), `Missing action-specific confirmation label: ${label}`);
    }
  });

  it('provides accessible keyboard operation and readable light/dark option styles', () => {
    assert.ok(adminPage.includes('role="listbox"'));
    assert.ok(adminPage.includes('role="option"'));
    assert.ok(adminPage.includes('aria-selected={controlAction === option.value}'));
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape']) {
      assert.ok(adminPage.includes(`event.key === '${key}'`), `Missing keyboard support for ${key}`);
    }
    assert.ok(globalStyles.includes('.admin-action-option-list'));
    assert.ok(globalStyles.includes(':root[data-theme="light"] .admin-action-option-list'));
  });
});
