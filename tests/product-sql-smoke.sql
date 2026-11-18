-- Execute only in the reviewed migration validation transaction, then ROLLBACK.
-- If including product.sql in that same transaction, remove its BEGIN/COMMIT wrapper.
-- This file contains synthetic records only and deliberately never commits.
BEGIN;
DO $$
DECLARE a text := 'f1111111-1111-4111-8111-111111111111';
        b text := 'f2222222-2222-4222-8222-222222222222';
        result jsonb; denied boolean := false;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.product_records'::regclass AND relrowsecurity AND relforcerowsecurity) THEN RAISE EXCEPTION 'RLS missing'; END IF;
  IF has_table_privilege('anon','public.product_records','SELECT') OR has_table_privilege('authenticated','public.product_records','SELECT') THEN RAISE EXCEPTION 'Public table access'; END IF;
  IF has_function_privilege('anon','public.product_transact(jsonb)','EXECUTE') OR has_function_privilege('authenticated','public.product_identity(jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Public RPC access'; END IF;
  result := public.product_transact(jsonb_build_array(jsonb_build_object('ns','ai_usage','key','qa-cas-rollback','ownerId',a,'expectedVersion',NULL,'value',jsonb_build_object('requests',0))));
  IF result->>'status'<>'applied' THEN RAISE EXCEPTION 'Create CAS failed'; END IF;
  result := public.product_transact(jsonb_build_array(jsonb_build_object('ns','ai_usage','key','qa-cas-rollback','ownerId',a,'expectedVersion',1,'value',jsonb_build_object('requests',1)),jsonb_build_object('ns','ai_requests','key','qa-request-rollback','ownerId',a,'expectedVersion',NULL,'value',jsonb_build_object('reserved',true))));
  IF result->>'status'<>'applied' THEN RAISE EXCEPTION 'Atomic CAS failed'; END IF;
  result := public.product_transact(jsonb_build_array(jsonb_build_object('ns','ai_usage','key','qa-cas-rollback','ownerId',a,'expectedVersion',1,'value',jsonb_build_object('requests',99)),jsonb_build_object('ns','ai_requests','key','qa-uncommitted-rollback','ownerId',a,'expectedVersion',NULL,'value',jsonb_build_object('reserved',true))));
  IF result->>'status'<>'conflict' OR public.product_get('ai_requests','qa-uncommitted-rollback') IS NOT NULL THEN RAISE EXCEPTION 'Partial commit'; END IF;
  IF (public.product_get('ai_usage','qa-cas-rollback')->'value'->>'requests')::integer<>1 THEN RAISE EXCEPTION 'Stale overwrite'; END IF;
  BEGIN
    PERFORM public.product_transact(jsonb_build_array(jsonb_build_object('ns','ai_usage','key','qa-cas-rollback','ownerId',b,'expectedVersion',2,'value',jsonb_build_object('requests',99))));
  EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Owner reassignment'; END IF;
  PERFORM public.product_transact(jsonb_build_array(jsonb_build_object('ns','ai_usage','key','qa-cas-rollback','ownerId',a,'expectedVersion',2,'value',NULL)));
  IF public.product_get('ai_usage','qa-cas-rollback') IS NOT NULL THEN RAISE EXCEPTION 'Delete not hidden'; END IF;
  PERFORM public.product_transact(jsonb_build_array(jsonb_build_object('ns','ai_usage','key','qa-cas-rollback','ownerId',a,'expectedVersion',NULL,'value',jsonb_build_object('requests',2))));
  IF (public.product_get('ai_usage','qa-cas-rollback')->>'version')::integer<>4 THEN RAISE EXCEPTION 'Version ABA'; END IF;
  IF jsonb_array_length(public.product_list('ai_requests',b,'qa-',100))<>0 THEN RAISE EXCEPTION 'Owner list isolation'; END IF;
  IF jsonb_array_length(public.product_list_page('ai_requests',a,'qa-',100,'qa-request-rollback'))<>0 THEN RAISE EXCEPTION 'Cursor did not advance'; END IF;
  IF jsonb_array_length(public.product_list_page('ai_requests',a,'qa-',100,'qa-'))<>1 THEN RAISE EXCEPTION 'Cursor omitted owned records'; END IF;
  denied:=false;
  BEGIN
    PERFORM public.product_transact(jsonb_build_array(jsonb_build_object('ns','ai_requests','key','qa-oversized-rollback','ownerId',a,'expectedVersion',NULL,'value',jsonb_build_object('text',repeat('x',250001)))));
  EXCEPTION WHEN OTHERS THEN denied:=true; END;
  IF NOT denied OR public.product_get('ai_requests','qa-oversized-rollback') IS NOT NULL THEN RAISE EXCEPTION 'Quota partial write'; END IF;
END;
$$;
ROLLBACK;
