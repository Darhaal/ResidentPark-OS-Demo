-- 20261126000000_demo_readonly_accounts.sql
-- Read-only demo accounts, enforced by the database.
--
-- WHY
--   The public demo offers one-click sign-in as a resident and as an admin. Anyone can
--   use those sessions, so they must be able to browse everything but change nothing.
--   UI and Server Action checks are not a security boundary (PostgREST and the tx_*
--   RPCs can be called directly with the session token), so the rule lives here.
--
-- DESIGN
--   * public.demo_readonly_accounts lists the read-only user ids. It is empty by
--     default, so the mechanism is dormant outside the demo deployment.
--   * public.is_demo_readonly() reports whether the current JWT user is listed.
--   * public.enforce_demo_readonly() is a statement-level BEFORE INSERT/UPDATE/DELETE
--     trigger on every public table. auth.uid() still resolves to the caller inside
--     SECURITY DEFINER RPCs, so RPC writes are blocked as well as direct ones.
--     Service-role and direct database sessions have no listed auth.uid() and are
--     unaffected (seed scripts, maintenance).
--   * rate_limit_events is exempt: read paths such as global search record rate-limit
--     hits, and that bookkeeping is not demo data.
--   * Tables created by later migrations need the trigger attached explicitly
--     (see the DO block below for the pattern).
--
-- Grants are explicit because newer platform images grant new objects to anon /
-- authenticated by default (see 20261116000000).
--
-- VERIFY AFTER APPLYING:  node scripts/verify-security.mjs

BEGIN;

CREATE TABLE IF NOT EXISTS public.demo_readonly_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.demo_readonly_accounts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.demo_readonly_accounts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.demo_readonly_accounts TO authenticated;
-- The list is managed server-side only (seed scripts / SQL), never by clients.
GRANT ALL ON public.demo_readonly_accounts TO service_role;

DROP POLICY IF EXISTS demo_readonly_accounts_self_read ON public.demo_readonly_accounts;
CREATE POLICY demo_readonly_accounts_self_read ON public.demo_readonly_accounts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_demo_readonly()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.demo_readonly_accounts d WHERE d.user_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_demo_readonly() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_demo_readonly() TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_demo_readonly()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND public.is_demo_readonly() THEN
    -- The message is shown verbatim by clients that surface raw PostgREST errors and is
    -- the marker the app uses to map this error (src/lib/errors.ts).
    RAISE EXCEPTION 'Demo mode: changes are disabled.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_demo_readonly() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t regclass;
BEGIN
  FOR t IN
    SELECT c.oid::regclass FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relkind IN ('r', 'p')
      AND c.relname NOT IN ('rate_limit_events', 'demo_readonly_accounts')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS enforce_demo_readonly ON %s', t);
    EXECUTE format(
      'CREATE TRIGGER enforce_demo_readonly BEFORE INSERT OR UPDATE OR DELETE ON %s '
      'FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_demo_readonly()', t);
  END LOOP;
END $$;

COMMIT;
