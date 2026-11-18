-- Additive Nortivo product migration. Apply AFTER terminal.sql. Existing UUIDs, states, receipts remain untouched.
-- No Supabase Auth dependency. Service-role server access only. Review/backup before applying.
BEGIN;
CREATE TABLE IF NOT EXISTS public.product_records (
 ns text NOT NULL CHECK(ns IN ('accounts','portfolios','receipts','tokens','billing_customers','billing_events','billing_checkout','billing_previews','ai_usage','ai_requests','broker_connections','broker_states','order_intents','broker_events','strategies','jobs','worker_health','worker_leases','mfa','mfa_sessions','audit','mail_outbox','provider_health','provider_meter','provider_cache')),
 key text NOT NULL CHECK(length(key) BETWEEN 1 AND 256 AND key !~ '[[:cntrl:]]'),
 owner_id text NOT NULL CHECK(owner_id ~ '^([a-f0-9-]{36}|system)$'),
 value jsonb NOT NULL CHECK(jsonb_typeof(value) IN ('object','null')),
 version bigint NOT NULL DEFAULT 1 CHECK(version>0),expires_at bigint,
 PRIMARY KEY(ns,key),CHECK(octet_length(value::text)<=2000000)
);
CREATE INDEX IF NOT EXISTS product_records_owner ON public.product_records(owner_id,ns,key);
ALTER TABLE public.product_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_records FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_records FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.product_records TO service_role;
CREATE OR REPLACE FUNCTION public.product_record_json(r public.product_records) RETURNS jsonb LANGUAGE sql IMMUTABLE STRICT AS $$
 SELECT jsonb_build_object('key',r.key,'value',r.value,'version',r.version,'ownerId',r.owner_id,'expiresAt',r.expires_at);
$$;
CREATE OR REPLACE FUNCTION public.product_get(p_ns text,p_key text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT public.product_record_json(r) FROM public.product_records r WHERE ns=p_ns AND key=p_key AND value<>'null'::jsonb;
$$;
CREATE OR REPLACE FUNCTION public.product_list(p_ns text,p_owner text DEFAULT NULL,p_prefix text DEFAULT '',p_limit integer DEFAULT 100) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_limit NOT BETWEEN 1 AND 1000 OR length(p_prefix)>256 THEN RAISE EXCEPTION 'Invalid product list'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(public.product_record_json(r)),'[]'::jsonb) FROM (SELECT * FROM public.product_records WHERE ns=p_ns AND (p_owner IS NULL OR owner_id=p_owner) AND left(key,length(p_prefix))=p_prefix AND value<>'null'::jsonb ORDER BY key LIMIT p_limit) r);
END;
$$;
CREATE OR REPLACE FUNCTION public.product_list_page(p_ns text,p_owner text,p_prefix text,p_limit integer,p_after text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_limit NOT BETWEEN 1 AND 1000 OR length(p_prefix)>256 OR length(p_after)>256 THEN RAISE EXCEPTION 'Invalid product page'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(public.product_record_json(r)),'[]'::jsonb) FROM (SELECT * FROM public.product_records WHERE ns=p_ns AND (p_owner IS NULL OR owner_id=p_owner) AND left(key,length(p_prefix))=p_prefix AND value<>'null'::jsonb AND (p_after IS NULL OR key>p_after) ORDER BY key LIMIT p_limit) r);
END;
$$;
REVOKE ALL ON FUNCTION public.product_list_page(text,text,text,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.product_list_page(text,text,text,integer,text) TO service_role;
CREATE OR REPLACE FUNCTION public.product_transact(p_changes jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE c jsonb;r public.product_records%ROWTYPE;owner text;stored_count bigint;stored_bytes bigint;delta_count bigint;delta_bytes bigint;existing_version bigint;
BEGIN
 IF jsonb_typeof(p_changes)<>'array' OR jsonb_array_length(p_changes) NOT BETWEEN 1 AND 32 OR octet_length(p_changes::text)>4000000 THEN RAISE EXCEPTION 'Invalid product transaction'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(p_changes))<>(SELECT count(DISTINCT (v->>'ns',v->>'key')) FROM jsonb_array_elements(p_changes) v) THEN RAISE EXCEPTION 'Duplicate product records'; END IF;
 -- Owner locks bound resource quotas; sorted record locks also serialize create-if-absent.
 FOR owner IN SELECT DISTINCT v->>'ownerId' FROM jsonb_array_elements(p_changes) v ORDER BY 1 LOOP
  IF owner IS NULL OR owner !~ '^([a-f0-9-]{36}|system)$' THEN RAISE EXCEPTION 'Invalid owner'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('product-owner:'||owner,0));
 END LOOP;
 FOR c IN SELECT v FROM jsonb_array_elements(p_changes) v ORDER BY v->>'ns',v->>'key' LOOP
  IF c->>'ns' IS NULL OR c->>'key' IS NULL OR length(c->>'key') NOT BETWEEN 1 AND 256 OR (c->>'key') ~ '[[:cntrl:]]' OR jsonb_typeof(c->'value') NOT IN ('object','null') OR (c->'value') IS NULL OR ((c->'expectedVersion') IS NULL) OR (c->'expectedVersion'<>'null'::jsonb AND ((c->>'expectedVersion')::bigint<=0)) OR octet_length((c->'value')::text)>(CASE WHEN c->>'ns'='portfolios' THEN 2000000 ELSE 250000 END) THEN RAISE EXCEPTION 'Invalid product record'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('product-key:'||(c->>'ns')||':'||(c->>'key'),0));
  SELECT * INTO r FROM public.product_records WHERE ns=c->>'ns' AND key=c->>'key' FOR UPDATE;
  IF FOUND AND r.owner_id<>c->>'ownerId' THEN RAISE EXCEPTION 'Product owner mismatch'; END IF;
  existing_version:=CASE WHEN r.value IS NULL OR r.value='null'::jsonb THEN NULL ELSE r.version END;
  IF existing_version IS DISTINCT FROM (c->>'expectedVersion')::bigint THEN RETURN jsonb_build_object('status','conflict'); END IF;
 END LOOP;
 FOR owner IN SELECT DISTINCT v->>'ownerId' FROM jsonb_array_elements(p_changes) v ORDER BY 1 LOOP
  SELECT count(*),coalesce(sum(octet_length(value::text)),0) INTO stored_count,stored_bytes FROM public.product_records WHERE owner_id=owner;
  delta_count:=0;delta_bytes:=0;
  FOR c IN SELECT v FROM jsonb_array_elements(p_changes) v WHERE v->>'ownerId'=owner LOOP
   SELECT * INTO r FROM public.product_records WHERE ns=c->>'ns' AND key=c->>'key';
   IF NOT FOUND THEN delta_count:=delta_count+1;END IF;
   delta_bytes:=delta_bytes+octet_length((c->'value')::text)-coalesce(octet_length(r.value::text),0);
  END LOOP;
  IF stored_count+delta_count>50000 OR stored_bytes+delta_bytes>100000000 THEN RAISE EXCEPTION 'Account product resource limit'; END IF;
 END LOOP;
 FOR c IN SELECT v FROM jsonb_array_elements(p_changes) v ORDER BY v->>'ns',v->>'key' LOOP
  INSERT INTO public.product_records(ns,key,owner_id,value,version,expires_at) VALUES(c->>'ns',c->>'key',c->>'ownerId',c->'value',1,(c->>'expiresAt')::bigint)
  ON CONFLICT(ns,key) DO UPDATE SET value=excluded.value,version=product_records.version+1,expires_at=excluded.expires_at;
 END LOOP;
 RETURN jsonb_build_object('status','applied');
END;
$$;
CREATE OR REPLACE FUNCTION public.product_identity(p_input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;u jsonb;updated integer;
BEGIN
 IF p_input->>'operation'='create' THEN
  u:=p_input->'user';PERFORM public.terminal_create_user(u,p_input->'state');
 ELSIF p_input->>'operation'='password' THEN
  PERFORM 1 FROM public.terminal_users WHERE id=(p_input->>'userId')::uuid AND password_hash=p_input->>'expectedPasswordHash' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Identity conflict';END IF;
 ELSIF p_input->>'operation'<>'update' THEN RAISE EXCEPTION 'Invalid identity operation';END IF;
 result:=public.product_transact(p_input->'changes');
 IF result->>'status'<>'applied' THEN RAISE EXCEPTION 'Identity conflict';END IF;
 IF p_input->>'operation'='password' THEN
  UPDATE public.terminal_users SET password_hash=p_input->>'passwordHash' WHERE id=(p_input->>'userId')::uuid AND password_hash=p_input->>'expectedPasswordHash';
  GET DIAGNOSTICS updated=ROW_COUNT;IF updated<>1 THEN RAISE EXCEPTION 'Identity conflict';END IF;
  DELETE FROM public.terminal_sessions WHERE user_id=(p_input->>'userId')::uuid;
  UPDATE public.product_records SET value='null'::jsonb,version=version+1 WHERE ns='mfa_sessions' AND owner_id=p_input->>'userId';
 END IF;
 RETURN result;
END;
$$;
CREATE OR REPLACE FUNCTION public.product_create_session(p_session jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM 1 FROM public.terminal_users WHERE id=(p_session->>'user_id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Identity unavailable';END IF;
 DELETE FROM public.terminal_sessions WHERE user_id=(p_session->>'user_id')::uuid AND expires_at<=(p_session->>'created_at')::bigint;
 DELETE FROM public.terminal_sessions WHERE user_id=(p_session->>'user_id')::uuid AND token_hash IN (SELECT token_hash FROM public.terminal_sessions WHERE user_id=(p_session->>'user_id')::uuid ORDER BY created_at DESC OFFSET 49);
 INSERT INTO public.terminal_sessions(token_hash,user_id,created_at,expires_at) VALUES(p_session->>'token_hash',(p_session->>'user_id')::uuid,(p_session->>'created_at')::bigint,(p_session->>'expires_at')::bigint);
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.product_create_session(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.product_create_session(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.product_record_json(public.product_records),public.product_get(text,text),public.product_list(text,text,text,integer),public.product_transact(jsonb),public.product_identity(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.product_record_json(public.product_records),public.product_get(text,text),public.product_list(text,text,text,integer),public.product_transact(jsonb),public.product_identity(jsonb) TO service_role;
INSERT INTO public.terminal_schema_migrations(version) VALUES(3) ON CONFLICT DO NOTHING;
COMMIT;
