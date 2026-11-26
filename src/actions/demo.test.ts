// Title: Demo Action Tests
// Path: src/actions/demo.test.ts
// Functionality: Verifies the demo flag gate, role validation, and the fail-closed read-only check.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createStatelessClient: vi.fn(),
  createServerClient: vi.fn(),
  generateLink: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
  rpc: vi.fn(),
  logActionError: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createStatelessClient }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createServerClient }));
vi.mock('@/lib/action-logger', () => ({ logActionError: mocks.logActionError }));

import { demoSignInAction } from './demo';

describe('demoSignInAction', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test');
    mocks.createStatelessClient.mockReturnValue({ auth: { admin: { generateLink: mocks.generateLink } } });
    mocks.createServerClient.mockResolvedValue({
      auth: { verifyOtp: mocks.verifyOtp, signOut: mocks.signOut },
      rpc: mocks.rpc,
    });
    mocks.generateLink.mockResolvedValue({ data: { properties: { hashed_token: 'hash-1' } }, error: null });
    mocks.verifyOtp.mockResolvedValue({ error: null });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.logActionError.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('is disabled unless the deployment is in demo mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', '');
    const result = await demoSignInAction('admin');
    expect(result).toMatchObject({ success: false, code: 'FORBIDDEN' });
    expect(mocks.generateLink).not.toHaveBeenCalled();
  });

  it('rejects roles that are not demo roles', async () => {
    const result = await demoSignInAction('superadmin');
    expect(result).toMatchObject({ success: false, code: 'VALIDATION_ERROR' });
    expect(mocks.generateLink).not.toHaveBeenCalled();
  });

  it('starts a session for the seeded account of the chosen role', async () => {
    const result = await demoSignInAction('admin');
    expect(result).toEqual({ success: true });
    expect(mocks.generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'tester.admin@qa.local' });
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ type: 'magiclink', token_hash: 'hash-1' });
    expect(mocks.rpc).toHaveBeenCalledWith('is_demo_readonly');
    // Only the previous session of this browser is ended, never other visitors' sessions.
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('signs out locally and refuses when the account is not read-only', async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    const result = await demoSignInAction('resident');
    expect(result).toMatchObject({ success: false, code: 'FORBIDDEN' });
    expect(mocks.signOut).toHaveBeenCalledTimes(2);
    expect(mocks.signOut).toHaveBeenLastCalledWith({ scope: 'local' });
  });

  it('signs out locally and refuses when the read-only check fails', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'missing' } });
    const result = await demoSignInAction('resident');
    expect(result).toMatchObject({ success: false, code: 'FORBIDDEN' });
    expect(mocks.signOut).toHaveBeenLastCalledWith({ scope: 'local' });
  });
});
