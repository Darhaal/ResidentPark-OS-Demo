// Title: Demo Config Tests
// Path: src/config/demo.test.ts
// Functionality: Verifies the demo flag, role guard and email-to-role mapping.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_ACCOUNTS, demoRoleForEmail, isDemoMode, isDemoRole } from './demo';

describe('demo config', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is on only when the flag is exactly "true"', () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true');
    expect(isDemoMode()).toBe(true);
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', '1');
    expect(isDemoMode()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', '');
    expect(isDemoMode()).toBe(false);
  });

  it('accepts only the demo roles', () => {
    expect(isDemoRole('resident')).toBe(true);
    expect(isDemoRole('admin')).toBe(true);
    expect(isDemoRole('superadmin')).toBe(false);
    expect(isDemoRole(undefined)).toBe(false);
  });

  it('maps demo emails to their role, ignoring case and spaces', () => {
    expect(demoRoleForEmail(DEMO_ACCOUNTS.admin.email)).toBe('admin');
    expect(demoRoleForEmail(` ${DEMO_ACCOUNTS.resident.email.toUpperCase()} `)).toBe('resident');
    expect(demoRoleForEmail('someone@example.com')).toBeNull();
    expect(demoRoleForEmail(null)).toBeNull();
  });
});
