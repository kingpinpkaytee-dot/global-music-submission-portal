-- Artist Frequency Premium monthly subscriptions (Paystack).
-- Secrets, authorization tokens and payment methods are never exposed to browser clients.
BEGIN;

CREATE TABLE IF NOT EXISTS public.artist_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES public.artist_profiles(id) ON DELETE RESTRICT,
  provider text NOT NULL DEFAULT 'paystack' CHECK (provider = 'paystack'),
  provider_environment text NOT NULL CHECK (provider_environment IN ('test','live')),
  tier text NOT NULL DEFAULT 'premium' CHECK (tier = 'premium'),
  customer_email text NOT NULL,
  provider_customer_code text,
  provider_plan_code text NOT NULL,
  provider_reference text NOT NULL UNIQUE,
  provider_subscription_code text UNIQUE,
  provider_email_token text,
  status text NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment','active','non_renewing','attention','cancelled','completed','failed')),
  amount_minor bigint NOT NULL DEFAULT 9900 CHECK (amount_minor = 9900),
  currency text NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
  next_payment_date timestamptz,
  paid_through_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancellation_requested_at timestamptz,
  last_payment_at timestamptz,
  last_payment_reference text,
  last_provider_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (customer_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  CHECK (provider_email_token IS NULL OR char_length(provider_email_token) <= 200),
  CHECK (provider_subscription_code IS NULL OR char_length(provider_subscription_code) <= 120)
);

CREATE INDEX IF NOT EXISTS artist_subscriptions_artist_created_idx
  ON public.artist_subscriptions(artist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS artist_subscriptions_provider_code_idx
  ON public.artist_subscriptions(provider_subscription_code)
  WHERE provider_subscription_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS artist_subscriptions_one_current_per_artist_idx
  ON public.artist_subscriptions(artist_id)
  WHERE status IN ('pending_payment','active','non_renewing','attention');

-- A single ledger row is awarded for each distinct successful monthly Paystack payment.
-- This allows 10 credits on the first charge and 10 on each genuine renewal without duplication.
CREATE TABLE IF NOT EXISTS public.artist_subscription_credit_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.artist_subscriptions(id) ON DELETE RESTRICT,
  artist_id uuid NOT NULL REFERENCES public.artist_profiles(id) ON DELETE RESTRICT,
  provider_payment_reference text NOT NULL UNIQUE,
  credit_ledger_reference uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  credit_quantity integer NOT NULL DEFAULT 10 CHECK (credit_quantity = 10),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.artist_subscription_credit_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.artist_subscription_credit_grants FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.artist_subscription_credit_grants TO service_role;

ALTER TABLE public.artist_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Artists read own subscription status" ON public.artist_subscriptions;
CREATE POLICY "Artists read own subscription status"
  ON public.artist_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = artist_id OR public.is_site_admin());

REVOKE ALL ON TABLE public.artist_subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, artist_id, provider, tier, status, amount_minor, currency,
  next_payment_date, paid_through_at, cancel_at_period_end, created_at
) ON TABLE public.artist_subscriptions TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.artist_subscriptions TO service_role;

CREATE OR REPLACE FUNCTION public.settle_artist_premium_subscription_payment(
  p_provider_reference text,
  p_subscription_code text,
  p_amount_minor bigint,
  p_currency text,
  p_paid_at timestamptz,
  p_next_payment_date timestamptz DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_subscription public.artist_subscriptions%ROWTYPE;
  v_paid_at timestamptz := coalesce(p_paid_at, now());
  v_until timestamptz := coalesce(p_next_payment_date, coalesce(p_paid_at, now()) + interval '1 month');
  v_credit_reference uuid;
BEGIN
  IF p_amount_minor <> 9900 OR p_currency <> 'ZAR'
     OR nullif(p_provider_reference, '') IS NULL THEN
    RAISE EXCEPTION 'Verified Premium payment details are invalid';
  END IF;

  SELECT * INTO v_subscription
  FROM public.artist_subscriptions s
  WHERE s.provider = 'paystack'
    AND (
      (p_provider_reference IS NOT NULL AND s.provider_reference = p_provider_reference)
      OR (p_subscription_code IS NOT NULL AND s.provider_subscription_code = p_subscription_code)
    )
  ORDER BY CASE WHEN s.provider_reference = p_provider_reference THEN 0 ELSE 1 END
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Premium subscription reference was not found';
  END IF;

  IF v_subscription.amount_minor <> p_amount_minor OR v_subscription.currency <> p_currency THEN
    RAISE EXCEPTION 'Verified amount or currency does not match Premium plan';
  END IF;

  UPDATE public.artist_subscriptions
  SET provider_subscription_code = coalesce(nullif(p_subscription_code, ''), provider_subscription_code),
      status = CASE WHEN cancel_at_period_end THEN 'non_renewing' ELSE 'active' END,
      last_payment_at = v_paid_at,
      last_payment_reference = coalesce(nullif(p_provider_reference, ''), last_payment_reference),
      paid_through_at = greatest(coalesce(paid_through_at, v_until), v_until),
      next_payment_date = coalesce(p_next_payment_date, next_payment_date, v_until),
      last_provider_event_at = now(),
      updated_at = now()
  WHERE id = v_subscription.id;

  INSERT INTO public.artist_subscription_credit_grants (
    subscription_id, artist_id, provider_payment_reference
  ) VALUES (
    v_subscription.id, v_subscription.artist_id, p_provider_reference
  )
  ON CONFLICT (provider_payment_reference) DO NOTHING
  RETURNING credit_ledger_reference INTO v_credit_reference;

  IF v_credit_reference IS NOT NULL THEN
    INSERT INTO public.credit_ledger (
      artist_id, amount, entry_type, reference_id, description
    ) VALUES (
      v_subscription.artist_id,
      10,
      'purchase_grant',
      v_credit_reference,
      '10 Premium membership credits for verified Paystack payment ' || p_provider_reference
    );
  END IF;

  RETURN true;
END;
$;

REVOKE ALL ON FUNCTION public.settle_artist_premium_subscription_payment(text,text,bigint,text,timestamptz,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_artist_premium_subscription_payment(text,text,bigint,text,timestamptz,timestamptz)
  TO service_role;

COMMIT;
