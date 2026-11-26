// Title: Demo Banner
// Path: src/components/demo/DemoBanner.tsx
// Functionality: Thin top bar for demo sessions with a one-click switch between the demo roles.

'use client';

import { useEffect, useState } from 'react';
import { ArrowLeftRight, Eye } from 'lucide-react';
import { demoSignInAction } from '@/actions/demo';
import { Spinner } from '@/components/ui/spinner';
import { demoRoleForEmail, type DemoRole } from '@/config/demo';
import { ROUTES } from '@/config/routes';
import { createClient } from '@/lib/supabase/client';
import { en } from '@/localization/en';

const messages = en.demo;

export function DemoBanner() {
  const [role, setRole] = useState<DemoRole | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    // UI only: the session cookie tells us which demo account is signed in.
    // Read-only enforcement lives in the database, not here.
    let active = true;
    createClient().auth.getSession().then(({ data }) => {
      if (active) setRole(demoRoleForEmail(data.session?.user.email));
    });
    return () => { active = false; };
  }, []);

  if (!role) return null;

  const otherRole: DemoRole = role === 'admin' ? 'resident' : 'admin';

  const switchRole = async () => {
    setIsSwitching(true);
    const result = await demoSignInAction(otherRole);
    if (result.success) {
      window.location.assign(ROUTES.home);
      return;
    }
    setIsSwitching(false);
  };

  // Fixed above the fixed TopNav, with an in-flow spacer of the same height (the TopNav
  // pattern). data-demo-banner switches --demo-bar-h in globals.css, which offsets the
  // other fixed chrome (TopNav, AdminSidePanel, toasts) below this bar.
  return (
    <>
    <div
      role="region"
      aria-label={messages.banner.label}
      data-demo-banner
      className="fixed inset-x-0 top-0 z-[60] bg-zinc-900 text-zinc-100"
    >
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-center gap-3 px-4 text-xs sm:text-sm">
        <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
          {messages.banner.label}
        </span>
        <span className="flex items-center gap-1.5 text-zinc-300">
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          {messages.banner.viewingAs(messages.roles[role])}
        </span>
        <button
          type="button"
          onClick={switchRole}
          disabled={isSwitching}
          className="flex items-center gap-1.5 rounded-md border border-white/20 px-2 py-0.5 font-medium text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-60"
        >
          {isSwitching
            ? <Spinner className="size-3.5 text-current" />
            : <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />}
          {isSwitching ? messages.banner.switching : messages.banner.switchTo(messages.roles[otherRole])}
        </button>
      </div>
    </div>
    <div aria-hidden className="h-9 shrink-0" />
    </>
  );
}
