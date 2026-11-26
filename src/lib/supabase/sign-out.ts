// Title: Sign-Out Helper
// Path: src/lib/supabase/sign-out.ts
// Functionality: Ends the current session; shared demo accounts end only this browser's session.

import type { SupabaseClient } from '@supabase/supabase-js';
import { demoRoleForEmail, isDemoMode } from '@/config/demo';

// supabase-js signs out globally by default (every session of the user). Many visitors
// share each demo account at once, so a global sign-out by one visitor would end everyone
// else's demo session. Demo accounts therefore sign out locally; real accounts keep the
// default.
export async function signOutCurrentUser(supabase: SupabaseClient): Promise<void> {
  if (isDemoMode()) {
    const { data } = await supabase.auth.getSession();
    if (demoRoleForEmail(data.session?.user.email) !== null) {
      await supabase.auth.signOut({ scope: 'local' });
      return;
    }
  }
  await supabase.auth.signOut();
}
