-- Artist Frequency payment foundation.
-- Provider credentials are intentionally NOT stored in PostgreSQL.
-- Apply only after review; this migration is not applied to production by this file write.
BEGIN;

ALTER TABLE public.credit_ledger
  DROP CONSTRAINT IF EXISTS credit_ledger_entry_type_check;
ALTER TABLE public.credit_ledger
  ADD CONSTRAINT credit_ledger_entry_type_check
  CHECK (entry_type IN (
    'starter_grant','monthly_grant','submission_spend','refund',
    'admin_adjustment','purchase_grant'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_purchase_grant_once_idx
  ON public.credit_ledger(artist_id, reference_id)
  WHERE entry_type = 'purchase_grant' AND reference_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.artist_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  artist_id uuid NOT NULL REFERENCES public.artist_profiles(id) ON DELETE RESTRICT,
  currency text NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
  subtotal_minor bigint NOT NULL CHECK (subtotal_minor >= 0),
  tax_minor bigint NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  total_minor bigint NOT NULL CHECK (total_minor >= 0),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('draft','open','pending_payment','paid','void','refunded','expired')),
  notes text NOT NULL DEFAULT '',
  due_at timestamptz,
  issued_by uuid REFERENCES public.artist_profiles(id) ON DELETE SET NULL,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (total_minor = subtotal_minor + tax_minor),
  CHECK (char_length(invoice_number) BETWEEN 4 AND 64),
  CHECK (char_length(notes) <= 2000)
);

CREATE INDEX IF NOT EXISTS artist_invoices_artist_created_idx
  ON public.artist_invoices(artist_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.artist_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.artist_invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 1000),
  unit_amount_minor bigint NOT NULL CHECK (unit_amount_minor >= 0),
  line_total_minor bigint NOT NULL CHECK (line_total_minor = quantity * unit_amount_minor),
  credit_quantity integer NOT NULL DEFAULT 0 CHECK (credit_quantity >= 0),
  service_period text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(description) BETWEEN 1 AND 240)
);

CREATE TABLE IF NOT EXISTS public.payment_provider_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('paystack','peach_payments','yoco')),
  environment text NOT NULL CHECK (environment IN ('test','live')),
  connection_status text NOT NULL DEFAULT 'not_connected'
    CHECK (connection_status IN ('not_connected','pending_verification','connected','disabled','error')),
  account_label text,
  external_account_id text,
  capabilities jsonb NOT NULL DEFAULT '{"checkout":false,"payouts":false,"splits":false}'::jsonb,
  last_verified_at timestamptz,
  last_error_code text,
  updated_by uuid REFERENCES public.artist_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, environment),
  CHECK (jsonb_typeof(capabilities) = 'object'),
  CHECK (account_label IS NULL OR char_length(account_label) <= 120),
  CHECK (external_account_id IS NULL OR char_length(external_account_id) <= 160)
);

COMMENT ON TABLE public.payment_provider_accounts IS
  'Non-secret provider connection metadata only. API keys, webhook secrets and bank details must remain in Supabase Edge Function secrets/provider vaults.';

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.artist_invoices(id) ON DELETE RESTRICT,
  artist_id uuid NOT NULL REFERENCES public.artist_profiles(id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (provider IN ('paystack','peach_payments','yoco')),
  provider_reference text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
  status text NOT NULL DEFAULT 'initiated'
    CHECK (status IN ('initiated','pending','succeeded','failed','cancelled','refunded')),
  checkout_url text,
  provider_transaction_id text,
  paid_at timestamptz,
  raw_event_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_reference),
  CHECK (checkout_url IS NULL OR checkout_url ~* '^https://'),
  CHECK (jsonb_typeof(raw_event_summary) = 'object')
);

CREATE INDEX IF NOT EXISTS payment_transactions_invoice_idx
  ON public.payment_transactions(invoice_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('paystack','peach_payments','yoco')),
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  processing_status text NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received','processed','ignored','failed')),
  processed_at timestamptz,
  failure_code text,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS public.payout_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('paystack','peach_payments')),
  beneficiary_artist_id uuid REFERENCES public.artist_profiles(id) ON DELETE RESTRICT,
  purpose text NOT NULL CHECK (purpose IN ('artist_refund','artist_earning','vendor_payment','operational')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
  provider_transfer_reference text UNIQUE,
  provider_recipient_reference text,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','processing','succeeded','failed','reversed','cancelled')),
  description text NOT NULL DEFAULT '',
  initiated_by uuid REFERENCES public.artist_profiles(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(description) <= 500)
);

ALTER TABLE public.artist_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_provider_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Artists read own invoices"
  ON public.artist_invoices FOR SELECT TO authenticated
  USING (auth.uid() = artist_id);
CREATE POLICY "Admins read all invoices"
  ON public.artist_invoices FOR SELECT TO authenticated
  USING (public.is_site_admin());

CREATE POLICY "Artists read own invoice items"
  ON public.artist_invoice_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.artist_invoices i
    WHERE i.id = invoice_id AND i.artist_id = auth.uid()
  ));
CREATE POLICY "Admins read all invoice items"
  ON public.artist_invoice_items FOR SELECT TO authenticated
  USING (public.is_site_admin());

CREATE POLICY "Admins read provider connection metadata"
  ON public.payment_provider_accounts FOR SELECT TO authenticated
  USING (public.is_site_admin());
CREATE POLICY "Artists read own payment transactions"
  ON public.payment_transactions FOR SELECT TO authenticated
  USING (auth.uid() = artist_id);
CREATE POLICY "Admins read all payment transactions"
  ON public.payment_transactions FOR SELECT TO authenticated
  USING (public.is_site_admin());
CREATE POLICY "Admins read webhook event status"
  ON public.payment_webhook_events FOR SELECT TO authenticated
  USING (public.is_site_admin());
CREATE POLICY "Admins read payout transactions"
  ON public.payout_transactions FOR SELECT TO authenticated
  USING (public.is_site_admin());

REVOKE ALL ON TABLE
  public.artist_invoices, public.artist_invoice_items,
  public.payment_provider_accounts, public.payment_transactions,
  public.payment_webhook_events, public.payout_transactions
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
  public.artist_invoices, public.artist_invoice_items,
  public.payment_transactions
TO authenticated;
GRANT SELECT ON TABLE
  public.payment_provider_accounts, public.payment_webhook_events,
  public.payout_transactions
TO authenticated;

GRANT ALL PRIVILEGES ON TABLE
  public.artist_invoices, public.artist_invoice_items,
  public.payment_provider_accounts, public.payment_transactions,
  public.payment_webhook_events, public.payout_transactions
TO service_role;

-- Invoice creation is an administrator-only snapshot operation.
-- All monetary inputs are integer cents (ZAR cents); browser clients cannot write invoices.
CREATE OR REPLACE FUNCTION public.admin_create_artist_invoice(
  p_artist_id uuid,
  p_items jsonb,
  p_tax_minor bigint DEFAULT 0,
  p_notes text DEFAULT '',
  p_due_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invoice_id uuid;
  v_subtotal bigint;
  v_invoice_number text;
  v_item jsonb;
  v_quantity integer;
  v_unit bigint;
  v_credits integer;
  v_description text;
BEGIN
  IF NOT public.is_site_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.artist_profiles WHERE id = p_artist_id) THEN
    RAISE EXCEPTION 'Artist account not found';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invoice items must be a JSON array';
  END IF;
  IF jsonb_array_length(p_items) NOT BETWEEN 1 AND 30
     OR coalesce(p_tax_minor,0) < 0
     OR coalesce(char_length(p_notes),0) > 2000 THEN
    RAISE EXCEPTION 'Invoice details are invalid';
  END IF;

  v_subtotal := 0;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := (v_item->>'quantity')::integer;
    v_unit := (v_item->>'unit_amount_minor')::bigint;
    v_credits := coalesce((v_item->>'credit_quantity')::integer,0);
    v_description := btrim(v_item->>'description');
    IF v_quantity NOT BETWEEN 1 AND 1000 OR v_unit < 0
       OR v_credits < 0 OR char_length(v_description) NOT BETWEEN 1 AND 240 THEN
      RAISE EXCEPTION 'An invoice line item is invalid';
    END IF;
    v_subtotal := v_subtotal + (v_quantity::bigint * v_unit);
  END LOOP;

  v_invoice_number := 'AF-' || to_char(now() AT TIME ZONE 'UTC','YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));

  INSERT INTO public.artist_invoices(
    invoice_number,artist_id,subtotal_minor,tax_minor,total_minor,
    status,notes,due_at,issued_by
  ) VALUES (
    v_invoice_number,p_artist_id,v_subtotal,coalesce(p_tax_minor,0),
    v_subtotal + coalesce(p_tax_minor,0),'open',coalesce(p_notes,''),p_due_at,auth.uid()
  ) RETURNING id INTO v_invoice_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := (v_item->>'quantity')::integer;
    v_unit := (v_item->>'unit_amount_minor')::bigint;
    INSERT INTO public.artist_invoice_items(
      invoice_id,description,quantity,unit_amount_minor,line_total_minor,
      credit_quantity,service_period
    ) VALUES (
      v_invoice_id,btrim(v_item->>'description'),v_quantity,v_unit,
      v_quantity::bigint * v_unit,
      coalesce((v_item->>'credit_quantity')::integer,0),
      nullif(v_item->>'service_period','')
    );
  END LOOP;

  RETURN v_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_artist_invoice(uuid,jsonb,bigint,text,timestamptz)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_artist_invoice(uuid,jsonb,bigint,text,timestamptz)
TO authenticated;

COMMIT;
