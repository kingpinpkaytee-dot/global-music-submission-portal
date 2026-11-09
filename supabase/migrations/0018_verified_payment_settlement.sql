-- Atomic invoice settlement for verified Paystack charge.success webhooks.
-- Callable only by service_role after server-side provider signature and transaction verification.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_one_open_attempt_per_invoice_idx
  ON public.payment_transactions(invoice_id)
  WHERE status IN ('initiated','pending');
CREATE OR REPLACE FUNCTION public.settle_artist_invoice_payment(
  p_provider_reference text,
  p_provider_transaction_id text,
  p_amount_minor bigint,
  p_currency text,
  p_paid_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment public.payment_transactions%ROWTYPE;
  v_credits bigint;
BEGIN
  IF p_provider_reference IS NULL OR p_provider_reference = ''
     OR p_provider_transaction_id IS NULL OR p_provider_transaction_id = ''
     OR p_amount_minor <= 0 OR p_currency <> 'ZAR' THEN
    RAISE EXCEPTION 'Verified payment details are invalid';
  END IF;

  SELECT * INTO v_payment
  FROM public.payment_transactions
  WHERE provider = 'paystack'
    AND provider_reference = p_provider_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment reference was not found';
  END IF;

  IF v_payment.amount_minor <> p_amount_minor
     OR v_payment.currency <> p_currency THEN
    RAISE EXCEPTION 'Verified amount or currency does not match payment';
  END IF;

  IF v_payment.status = 'succeeded' THEN
    RETURN false;
  END IF;

  IF v_payment.status NOT IN ('initiated','pending') THEN
    RAISE EXCEPTION 'Payment is not eligible for settlement';
  END IF;

  UPDATE public.payment_transactions
  SET status = 'succeeded',
      provider_transaction_id = p_provider_transaction_id,
      paid_at = coalesce(p_paid_at, now()),
      updated_at = now()
  WHERE id = v_payment.id;

  UPDATE public.artist_invoices
  SET status = 'paid',
      paid_at = coalesce(p_paid_at, now()),
      updated_at = now()
  WHERE id = v_payment.invoice_id
    AND artist_id = v_payment.artist_id
    AND status IN ('open','pending_payment');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice is not eligible for settlement';
  END IF;

  SELECT coalesce(sum(credit_quantity),0)::bigint
  INTO v_credits
  FROM public.artist_invoice_items
  WHERE invoice_id = v_payment.invoice_id;

  IF v_credits > 0 THEN
    INSERT INTO public.credit_ledger(
      artist_id, amount, entry_type, reference_id, description
    ) VALUES (
      v_payment.artist_id,
      v_credits::integer,
      'purchase_grant',
      v_payment.invoice_id,
      'Purchased credits for invoice ' || v_payment.invoice_id::text
    )
    ON CONFLICT (artist_id, reference_id)
      WHERE entry_type = 'purchase_grant' AND reference_id IS NOT NULL
    DO NOTHING;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_artist_invoice_payment(text,text,bigint,text,timestamptz)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_artist_invoice_payment(text,text,bigint,text,timestamptz)
TO service_role;

CREATE OR REPLACE FUNCTION public.admin_list_invoice_artists()
RETURNS TABLE(id uuid, artist_name text, country text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_site_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  RETURN QUERY
    SELECT p.id, p.artist_name, p.country
    FROM public.artist_profiles p
    ORDER BY lower(p.artist_name), p.created_at;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_invoice_artists() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_invoice_artists() TO authenticated;
COMMIT;
