-- Nortivo terminal additive migrations v1 + v2. Review and run in the existing project's SQL editor.
-- Does not alter support/admin tables, policies, auth users or company report records.
BEGIN;
CREATE TABLE IF NOT EXISTS public.terminal_schema_migrations (
  version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.terminal_users (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('guest','user')),
  email text UNIQUE CHECK (email IS NULL OR (email = lower(email) AND length(email) <= 160)),
  password_hash text,
  name text NOT NULL DEFAULT '' CHECK (length(name) <= 80),
  created_at bigint NOT NULL,
  expires_at bigint,
  CHECK ((kind='guest' AND email IS NULL AND password_hash IS NULL AND expires_at IS NOT NULL)
    OR (kind='user' AND email IS NOT NULL AND password_hash IS NOT NULL AND expires_at IS NULL))
);
CREATE TABLE IF NOT EXISTS public.terminal_sessions (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid NOT NULL REFERENCES public.terminal_users(id) ON DELETE CASCADE,
  created_at bigint NOT NULL,
  expires_at bigint NOT NULL CHECK (expires_at > created_at)
);
CREATE TABLE IF NOT EXISTS public.terminal_states (
  user_id uuid PRIMARY KEY REFERENCES public.terminal_users(id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  state jsonb NOT NULL CHECK (jsonb_typeof(state)='object')
);
CREATE TABLE IF NOT EXISTS public.terminal_receipts (
  user_id uuid NOT NULL REFERENCES public.terminal_users(id) ON DELETE CASCADE,
  request_id text NOT NULL CHECK (length(request_id) BETWEEN 8 AND 128),
  digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
  result jsonb NOT NULL,
  created_at bigint NOT NULL,
  PRIMARY KEY (user_id, request_id)
);
-- v2 bounded durable receipts: never discard a financial/idempotency record to make room.
ALTER TABLE public.terminal_states ADD COLUMN IF NOT EXISTS receipt_count integer NOT NULL DEFAULT 0 CHECK(receipt_count>=0);
UPDATE public.terminal_states s SET receipt_count=(SELECT count(*) FROM public.terminal_receipts r WHERE r.user_id=s.user_id);
CREATE TABLE IF NOT EXISTS public.terminal_rate_limits (
  key text PRIMARY KEY CHECK (length(key) <= 160),
  count integer NOT NULL CHECK (count BETWEEN 0 AND 1000000),
  until bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS terminal_sessions_expiry ON public.terminal_sessions(expires_at);
CREATE INDEX IF NOT EXISTS terminal_users_expiry ON public.terminal_users(expires_at) WHERE kind='guest';
CREATE INDEX IF NOT EXISTS terminal_limits_expiry ON public.terminal_rate_limits(until);

ALTER TABLE public.terminal_schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminal_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminal_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminal_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminal_schema_migrations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.terminal_users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.terminal_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.terminal_states FORCE ROW LEVEL SECURITY;
ALTER TABLE public.terminal_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.terminal_rate_limits FORCE ROW LEVEL SECURITY;
-- No anon/authenticated policies. Only the server's service_role can bypass RLS.
REVOKE ALL ON public.terminal_schema_migrations, public.terminal_users, public.terminal_sessions,
  public.terminal_states, public.terminal_receipts, public.terminal_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.terminal_schema_migrations, public.terminal_users,
  public.terminal_sessions, public.terminal_states, public.terminal_receipts, public.terminal_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.terminal_create_user(p_user jsonb, p_state jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF jsonb_typeof(p_state) <> 'object' OR octet_length(p_state::text) > 8000000 THEN
    RAISE EXCEPTION 'Invalid workspace state';
  END IF;
  INSERT INTO public.terminal_users(id,kind,email,password_hash,name,created_at,expires_at)
  VALUES ((p_user->>'id')::uuid,p_user->>'kind',p_user->>'email',p_user->>'password_hash',
    coalesce(p_user->>'name',''),(p_user->>'created_at')::bigint,(p_user->>'expires_at')::bigint);
  INSERT INTO public.terminal_states(user_id,state) VALUES ((p_user->>'id')::uuid,p_state);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.terminal_commit_command(
  p_user_id uuid, p_revision bigint, p_state jsonb, p_request_id text,
  p_digest text, p_result jsonb, p_now bigint
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE current_revision bigint; current_count integer; owner_kind text; command_limit integer; previous_receipt public.terminal_receipts%ROWTYPE;
BEGIN
  -- Owner row lock serializes every tab/function instance, including receipt creation.
  SELECT revision,receipt_count INTO current_revision,current_count FROM public.terminal_states WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','conflict'); END IF;
  SELECT * INTO previous_receipt FROM public.terminal_receipts WHERE user_id=p_user_id AND request_id=p_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('status','duplicate','digest',previous_receipt.digest,'result',previous_receipt.result);
  END IF;
  IF current_revision <> p_revision THEN RETURN jsonb_build_object('status','conflict'); END IF;
  SELECT kind INTO owner_kind FROM public.terminal_users WHERE id=p_user_id;
  command_limit:=CASE WHEN owner_kind='guest' THEN 2000 ELSE 10000 END;
  IF current_count>=command_limit THEN RETURN jsonb_build_object('status','quota','limit',command_limit); END IF;
  IF jsonb_typeof(p_state) <> 'object' OR octet_length(p_state::text) > 8000000
    OR octet_length(p_result::text) > 500000 THEN RAISE EXCEPTION 'Invalid command result'; END IF;
  UPDATE public.terminal_states SET state=p_state,revision=revision+1,receipt_count=receipt_count+1 WHERE user_id=p_user_id;
  INSERT INTO public.terminal_receipts(user_id,request_id,digest,result,created_at)
    VALUES (p_user_id,p_request_id,p_digest,coalesce(p_result,'null'::jsonb),p_now);
  RETURN jsonb_build_object('status','applied','revision',current_revision+1);
END;
$$;

-- v2 changes the old boolean result to a bounded result carrying the actual wait.
DROP FUNCTION IF EXISTS public.terminal_consume_limit(text,integer,bigint,bigint);
CREATE OR REPLACE FUNCTION public.terminal_consume_limit(p_key text,p_limit integer,p_window_ms bigint,p_now bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE current_count integer; current_until bigint; first_until bigint;
BEGIN
  IF length(p_key)>160 OR p_limit<1 OR p_limit>10000 OR p_window_ms<1000 OR p_window_ms>86400000
    THEN RETURN jsonb_build_object('allowed',false,'retryAfterMs',1000); END IF;
  -- Existing buckets are atomic per-key row updates; no global allocation lock.
  UPDATE public.terminal_rate_limits SET
    count=CASE WHEN until<=p_now THEN 1 ELSE least(count+1,1000000) END,
    until=CASE WHEN until<=p_now THEN p_now+p_window_ms ELSE until END
    WHERE key=p_key RETURNING count,until INTO current_count,current_until;
  IF NOT FOUND THEN
    -- Only new bucket allocation/capacity accounting is serialized globally.
    PERFORM pg_advisory_xact_lock(710241777);
    -- Recheck after waiting: another instance may have inserted this key.
    UPDATE public.terminal_rate_limits SET
      count=CASE WHEN until<=p_now THEN 1 ELSE least(count+1,1000000) END,
      until=CASE WHEN until<=p_now THEN p_now+p_window_ms ELSE until END
      WHERE key=p_key RETURNING count,until INTO current_count,current_until;
    IF NOT FOUND THEN
      DELETE FROM public.terminal_rate_limits WHERE until<=p_now;
      DELETE FROM public.terminal_sessions WHERE expires_at<=p_now;
      DELETE FROM public.terminal_users WHERE kind='guest' AND expires_at<=p_now;
      IF (SELECT count(*) FROM public.terminal_rate_limits)>=10000 THEN
        SELECT min(until) INTO first_until FROM public.terminal_rate_limits;
        RETURN jsonb_build_object('allowed',false,'retryAfterMs',greatest(1,first_until-p_now));
      END IF;
      INSERT INTO public.terminal_rate_limits(key,count,until) VALUES (p_key,1,p_now+p_window_ms)
        ON CONFLICT(key) DO UPDATE SET
          count=CASE WHEN terminal_rate_limits.until<=p_now THEN 1 ELSE least(terminal_rate_limits.count+1,1000000) END,
          until=CASE WHEN terminal_rate_limits.until<=p_now THEN p_now+p_window_ms ELSE terminal_rate_limits.until END
        RETURNING count,until INTO current_count,current_until;
    END IF;
  END IF;
  RETURN jsonb_build_object('allowed',current_count<=p_limit,'retryAfterMs',CASE WHEN current_count<=p_limit THEN 0 ELSE greatest(1,current_until-p_now) END);
END;
$$;

REVOKE ALL ON FUNCTION public.terminal_create_user(jsonb,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.terminal_commit_command(uuid,bigint,jsonb,text,text,jsonb,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.terminal_consume_limit(text,integer,bigint,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.terminal_create_user(jsonb,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.terminal_commit_command(uuid,bigint,jsonb,text,text,jsonb,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.terminal_consume_limit(text,integer,bigint,bigint) TO service_role;
INSERT INTO public.terminal_schema_migrations(version) VALUES (1) ON CONFLICT DO NOTHING;
INSERT INTO public.terminal_schema_migrations(version) VALUES (2) ON CONFLICT DO NOTHING;
COMMIT;
