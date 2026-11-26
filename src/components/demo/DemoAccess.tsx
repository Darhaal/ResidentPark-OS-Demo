// Title: Demo Access Panel
// Path: src/components/demo/DemoAccess.tsx
// Functionality: One-click sign-in buttons for the read-only demo accounts on the login page.

'use client';

import { useState } from 'react';
import { Home, LayoutDashboard, Sparkles } from 'lucide-react';
import { demoSignInAction } from '@/actions/demo';
import { Spinner } from '@/components/ui/spinner';
import { DEMO_ACCOUNTS, DEMO_ROLES, type DemoRole } from '@/config/demo';
import { getSafeRedirectPath } from '@/config/routes';
import { en } from '@/localization/en';

const messages = en.demo;
const ROLE_ICONS: Record<DemoRole, typeof Home> = { resident: Home, admin: LayoutDashboard };

export function DemoAccess() {
  const [pendingRole, setPendingRole] = useState<DemoRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (role: DemoRole) => {
    setPendingRole(role);
    setError(null);
    const result = await demoSignInAction(role);
    if (result.success) {
      // Full reload so the new session starts from a clean client router cache.
      window.location.assign(getSafeRedirectPath(new URLSearchParams(window.location.search).get('next')));
      return;
    }
    setError(messages.access.failed);
    setPendingRole(null);
  };

  return (
    <section
      aria-labelledby="demo-access-title"
      className="mb-4 rounded-xl border border-border/60 bg-card/80 p-5 shadow-xl backdrop-blur-xl"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <h2 id="demo-access-title" className="text-base font-semibold tracking-tight text-foreground">
          {messages.access.title}
        </h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{messages.access.description}</p>

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {DEMO_ROLES.map((role) => {
          const Icon = ROLE_ICONS[role];
          const isPending = pendingRole === role;
          return (
            <button
              key={role}
              type="button"
              onClick={() => signIn(role)}
              disabled={pendingRole !== null}
              aria-busy={isPending}
              className="group flex flex-col items-start rounded-lg border border-border bg-background px-4 py-3 text-left transition-colors hover:border-foreground/30 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {isPending ? <Spinner className="size-4 text-current" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
                {isPending ? messages.access.signingIn : messages.access.signInAs(messages.roles[role])}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">{messages.roleHints[role]}</span>
              <span className="mt-1.5 font-mono text-[11px] text-muted-foreground/80">{DEMO_ACCOUNTS[role].email}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
