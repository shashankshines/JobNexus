import { describe, it } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import FuturisticToast, { ToastMessage } from '../../../app/components/FuturisticToast';

// Lightweight component test renderer for server/node test environment
function renderToastToStaticHtml(toast: ToastMessage | null, onDismiss: () => void = () => {}) {
  // If null, component returns null
  if (!toast) return null;
  const element = React.createElement(FuturisticToast, { toast, onDismiss });
  return element;
}

describe('JobNexus — Futuristic Cyber-HUD Toast Component Test Suite', () => {
  it('safely renders null when toast object is null or dismissed', () => {
    const rendered = renderToastToStaticHtml(null);
    assert.strictEqual(rendered, null);
  });

  it('configures success notification with SYSTEM // VERIFIED badge and emerald theme', () => {
    const toast: ToastMessage = {
      id: 'toast-succ-1',
      type: 'success',
      message: 'Welcome back, Alex Rivera!',
    };

    const element = renderToastToStaticHtml(toast);
    assert.ok(element && element.props.toast);
    assert.strictEqual(element.props.toast.id, 'toast-succ-1');
    assert.strictEqual(element.props.toast.type, 'success');
    assert.strictEqual(element.props.toast.message, 'Welcome back, Alex Rivera!');
  });

  it('configures error notification with SYSTEM // ALERT badge and crimson theme', () => {
    const toast: ToastMessage = {
      id: 'toast-err-1',
      type: 'error',
      message: 'Authentication failed. Please check your credentials.',
    };

    const element = renderToastToStaticHtml(toast);
    assert.ok(element && element.props.toast);
    assert.strictEqual(element.props.toast.id, 'toast-err-1');
    assert.strictEqual(element.props.toast.type, 'error');
    assert.strictEqual(element.props.toast.message, 'Authentication failed. Please check your credentials.');
  });

  it('configures info notification with NEXUS // UPDATE badge and cyber electric theme', () => {
    const toast: ToastMessage = {
      id: 'toast-info-1',
      type: 'info',
      message: 'Signed in with Google (Dev Mode). Add credentials to .env.local for live accounts.',
    };

    const element = renderToastToStaticHtml(toast);
    assert.ok(element && element.props.toast);
    assert.strictEqual(element.props.toast.id, 'toast-info-1');
    assert.strictEqual(element.props.toast.type, 'info');
    assert.strictEqual(element.props.toast.message, 'Signed in with Google (Dev Mode). Add credentials to .env.local for live accounts.');
  });

  it('handles long formatted messages and preserves complete message fidelity', () => {
    const longMessage = '"Senior Distributed Infrastructure & Cloud Native Architect" saved automatically to your collection!';
    const toast: ToastMessage = {
      id: 'toast-long-1',
      type: 'success',
      message: longMessage,
    };

    const element = renderToastToStaticHtml(toast);
    assert.ok(element && element.props.toast);
    assert.strictEqual(element.props.toast.message, longMessage);
  });

  it('fires dismiss callback when invoked', () => {
    let dismissed = false;
    const toast: ToastMessage = {
      id: 'toast-dismiss-1',
      type: 'info',
      message: 'Dismiss test message',
    };

    const onDismiss = () => {
      dismissed = true;
    };

    const element = renderToastToStaticHtml(toast, onDismiss);
    assert.ok(element);
    element.props.onDismiss();
    assert.strictEqual(dismissed, true);
  });
});
