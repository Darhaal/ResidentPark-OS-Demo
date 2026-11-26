// Title: Demo Actions
// Path: src/actions/demo.ts
// Functionality: One-click sign-in to the seeded read-only demo accounts.

// Only active when NEXT_PUBLIC_DEMO_MODE=true. The session is minted server-side from a
// one-time magic-link token (no password is stored or sent), and it is handed out only
// when the database confirms the account is read-only. A misconfigured deployment
// therefore fails closed instead of publishing a writable admin session.

'use server';

import { createClient as createStatelessClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { DEMO_ACCOUNTS, isDemoMode, isDemoRole } from '@/config/demo';
import { AppError, toActionError } from '@/lib/errors';
import { logActionError } from '@/lib/action-logger';

export async function demoSignInAction(role: unknown) {
  try {
    if (!isDemoMode()) throw new AppError('FORBIDDEN', 'Demo sign-in is disabled.');
    if (!isDemoRole(role)) throw new AppError('VALIDATION_ERROR', 'Unknown demo role.');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !secretKey) {
      throw new AppError('INTERNAL_ERROR', 'Demo sign-in is not configured on this server.');
    }

    const adminClient = createStatelessClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: link, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: DEMO_ACCOUNTS[role].email,
    });
    const tokenHash = link?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      throw new AppError('INTERNAL_ERROR', 'Demo sign-in link could not be created.', linkError);
    }

    const supabase = await createClient();
    // End this browser's previous session (e.g. when switching roles) so abandoned demo
    // sessions do not pile up. Local scope: other visitors share the same demo accounts.
    await supabase.auth.signOut({ scope: 'local' });
    const { error: verifyError } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
    if (verifyError) {
      throw new AppError('INTERNAL_ERROR', 'Demo session could not be started.', verifyError);
    }

    const { data: isReadOnly, error: readOnlyError } = await supabase.rpc('is_demo_readonly');
    if (readOnlyError || isReadOnly !== true) {
      await supabase.auth.signOut({ scope: 'local' });
      throw new AppError('FORBIDDEN', 'Demo account is not read-only; sign-in refused.', readOnlyError);
    }

    return { success: true as const };
  } catch (error) {
    await logActionError('Action: demoSignInAction failed', error, { role: typeof role === 'string' ? role : null });
    return toActionError(error);
  }
}
