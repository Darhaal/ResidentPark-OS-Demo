// Title: Demo Configuration
// Path: src/config/demo.ts
// Functionality: Public demo switch and the seeded accounts behind one-click demo sign-in.

// The demo deployment sets NEXT_PUBLIC_DEMO_MODE=true. Everywhere else the flag is
// unset and every demo surface (sign-in buttons, banner, demo action) is disabled.
// Read at call time so tests can stub it; Next inlines the value at build time.
export const isDemoMode = (): boolean => process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const DEMO_ROLES = ['resident', 'admin'] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

// Seeded demo accounts. Their writes are blocked in the database by
// public.demo_readonly_accounts (migration 20261126000000).
export const DEMO_ACCOUNTS: Record<DemoRole, { email: string }> = {
  resident: { email: 'demo.alice@qa.local' },
  admin: { email: 'tester.admin@qa.local' },
};

export const isDemoRole = (value: unknown): value is DemoRole =>
  typeof value === 'string' && (DEMO_ROLES as readonly string[]).includes(value);

export const demoRoleForEmail = (email: string | null | undefined): DemoRole | null => {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return DEMO_ROLES.find((role) => DEMO_ACCOUNTS[role].email === normalized) ?? null;
};
