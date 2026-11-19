-- 20261116000000_revoke_platform_default_client_grants.sql
-- Make the client-role privilege model explicit instead of relying on the
-- platform's default privileges.
--
-- WHY
--   Earlier migrations removed EXECUTE from PUBLIC (0007), removed direct table
--   writes from `authenticated` on selected tables (0001, 0003, 0008), and revoked
--   per-function grants as new RPCs were added. None of them revoke privileges
--   granted *directly* to `anon` / `authenticated` by default privileges, so the
--   chain silently depended on the platform not issuing such grants.
--
--   Newer Supabase Postgres images do issue them: replaying this chain on
--   supabase/postgres 17.12.0.000 left `anon` with INSERT/UPDATE/DELETE on every
--   operational table and EXECUTE on privileged SECURITY DEFINER functions, and
--   `authenticated` with direct writes on building_settings, notices and
--   parking_issues (scripts/verify-security.mjs: 18 passed, 3 failed). The same
--   chain on 17.6.1.159 passed, and the live database passes all checks.
--
-- EFFECT
--   Brings any freshly built database to the state the live database already has.
--   On the live database every statement below is a no-op.
--
-- SCOPE & SAFETY
--   * All writes go through the transactional tx_* RPCs, which run as the function
--     owner and are unaffected by these revokes. SELECT (RLS-gated) is untouched.
--   * `profiles` is skipped for `authenticated`: a table-level REVOKE would also drop
--     its column-level UPDATE grant on the user's own safe columns.
--   * The boolean RLS predicate helpers (is_admin, is_superadmin, is_approved,
--     get_auth_role) stay executable by `anon` so policy evaluation keeps working.
--
-- VERIFY AFTER APPLYING:  node scripts/verify-security.mjs

BEGIN;

-- 1) No direct table writes for the anonymous role.
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;

-- 2) No table-level writes for signed-in users (writes are RPC-only).
DO $$
DECLARE t regclass;
BEGIN
  FOR t IN
    SELECT c.oid::regclass FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relkind IN ('r', 'p')
      AND c.relname <> 'profiles'
  LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON %s FROM authenticated', t);
  END LOOP;
END $$;

-- 3) No anonymous EXECUTE on privileged SECURITY DEFINER functions, whether granted
--    directly or inherited through PUBLIC.
DO $$
DECLARE fn regprocedure;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prosecdef
      AND p.proname NOT IN ('is_admin', 'is_superadmin', 'is_approved', 'get_auth_role')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
  END LOOP;
END $$;

COMMIT;
