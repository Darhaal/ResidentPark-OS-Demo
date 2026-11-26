// Title: Demo Localization
// Path: src/localization/en/demo.ts
// Functionality: English copy for the public demo deployment (one-click sign-in, banner, read-only notices).

export const demo = {
  // Must match the exception text raised by public.enforce_demo_readonly().
  readOnly: 'Demo mode: changes are disabled.',
  access: {
    title: 'Demo access',
    description: 'Explore the product with seeded demo data. Demo accounts are read-only.',
    signInAs: (role: string) => `Sign in as ${role}`,
    signingIn: 'Signing in…',
    failed: 'Demo sign-in is unavailable right now. Please try again.',
    orUseAccount: 'or sign in with an account',
  },
  roles: {
    resident: 'Resident',
    admin: 'Admin',
  },
  roleHints: {
    resident: 'Unit, parking spot, vehicles, notices',
    admin: 'Approvals, parking map, issues, disruptions',
  },
  banner: {
    label: 'Demo',
    viewingAs: (role: string) => `Viewing as ${role} · read-only`,
    switchTo: (role: string) => `Switch to ${role}`,
    switching: 'Switching…',
  },
  accountLocked: 'Account settings cannot be changed on demo accounts.',
} as const;
