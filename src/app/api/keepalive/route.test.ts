// Title: Keep-Alive Route Tests
// Path: src/app/api/keepalive/route.test.ts
// Functionality: Verifies the cron bearer check and the Supabase ping outcome mapping.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn() },
}));

import { GET } from './route';

const request = (authorization?: string) =>
  new NextRequest('https://example.test/api/keepalive', {
    headers: authorization ? { authorization } : {},
  });

describe('GET /api/keepalive', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    vi.stubEnv('CRON_SECRET', '');
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    mocks.createClient.mockReturnValue({ rpc: mocks.rpc });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('pings Supabase through the anon-safe is_admin helper', async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledWith('is_admin');
  });

  it('rejects callers without the cron secret when one is configured', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret');
    const response = await GET(request('Bearer wrong'));
    expect(response.status).toBe(401);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('accepts the cron secret as a bearer token', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret');
    const response = await GET(request('Bearer cron-secret'));
    expect(response.status).toBe(200);
  });

  it('reports a failed ping without leaking details', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST000', message: 'down' } });
    const response = await GET(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ ok: false });
  });
});
