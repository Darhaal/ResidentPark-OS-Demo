// Title: Keep-Alive Route
// Path: src/app/api/keepalive/route.ts
// Functionality: Vercel Cron target that sends one harmless request to Supabase so the
// free-tier project is not paused for inactivity.

// The ping calls `is_admin()`, a boolean RLS predicate helper that is executable by
// `anon` by design and returns false without a session. It reads no rows and the
// response carries no data, so the route exposes nothing the public publishable key
// cannot already reach. When CRON_SECRET is set, Vercel Cron sends it as a bearer
// token and other callers are rejected.

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !publicKey) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await supabase.rpc('is_admin');
  if (error) {
    logger.warn('Keep-alive ping failed', { code: error.code });
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
