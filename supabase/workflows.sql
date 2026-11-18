-- Prepared only. Review the current constraint and compare the allowlist before release.
-- Run after terminal.sql and product.sql. No data migration, new grants or RLS changes.
BEGIN;
DO $$
DECLARE existing text; allowed text;
  new_names text[] := ARRAY['workflow_threads','workflow_requests','workflow_index','workflow_receipts',
    'korvnt_threads','korvnt_requests','korvnt_index','korvnt_receipts'];
BEGIN
  SELECT pg_get_expr(conbin,conrelid) INTO STRICT existing FROM pg_constraint
  WHERE conrelid='public.product_records'::regclass AND conname='product_records_ns_check' AND contype='c';
  IF existing IS NULL THEN RAISE EXCEPTION 'Review the installed namespace constraint before proceeding'; END IF;
  -- Add only missing names on either the original or an already-upgraded installation.
  -- Existing workflow_* rows remain exclusively Nortivo, with their original key and AAD.
  SELECT string_agg(quote_literal(n), ',') INTO allowed FROM unnest(new_names) n
  WHERE strpos(existing,quote_literal(n))=0;
  IF allowed IS NOT NULL THEN
    ALTER TABLE public.product_records DROP CONSTRAINT product_records_ns_check;
    EXECUTE format('ALTER TABLE public.product_records ADD CONSTRAINT product_records_ns_check CHECK ((%s) OR ns IN (%s)) NOT VALID',existing,allowed);
    ALTER TABLE public.product_records VALIDATE CONSTRAINT product_records_ns_check;
  END IF;
END $$;
COMMIT;
