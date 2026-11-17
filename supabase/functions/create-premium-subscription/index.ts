import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const productionOrigin = "https://global-music-submission-portal.pages.dev";
const previewOriginPattern = /^https:\/\/artist-frequency-preview-[a-z0-9-]+\.vercel\.app$/i;
const configuredOrigins = () => (Deno.env.get("CORS_ALLOWED_ORIGINS") || Deno.env.get("APP_ORIGIN") || "")
  .split(",")
  .map(value => value.trim())
  .filter(value => value === productionOrigin || previewOriginPattern.test(value));
const isAllowedOrigin = (origin: string) =>
  origin === productionOrigin ||
  previewOriginPattern.test(origin) ||
  configuredOrigins().includes(origin);
const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
});
const reply = (body: unknown, status: number, origin: string) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });

Deno.serve(async request => {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") {
    if (!isAllowedOrigin(origin)) return new Response("Origin not allowed", { status: 403 });
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (request.method !== "POST" || !isAllowedOrigin(origin)) return reply({ error: "Request not allowed." }, 403, origin);

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const secret = Deno.env.get("PAYSTACK_PREMIUM_TEST_SECRET_KEY") || Deno.env.get("PAYSTACK_PREMIUM_TEST_SECRETE_KEY") || "";
    if (!url || !anonKey || !serviceKey || !secret) {
      return reply({ error: "Premium checkout is not configured. Ask the administrator to verify Paystack in the Payment Centre." }, 503, origin);
    }
    if (!secret.startsWith("sk_test_")) {
      return reply({ error: "Premium sandbox key is missing. Configure PAYSTACK_PREMIUM_TEST_SECRET_KEY with the Paystack Test Mode secret. The existing invoice key is not changed." }, 423, origin);
    }

    const bearer = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!bearer) return reply({ error: "Sign in before subscribing." }, 401, origin);
    const auth = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${bearer}` } } });
    const { data: authData, error: authError } = await auth.auth.getUser();
    if (authError || !authData.user?.email) return reply({ error: "Your sign-in session is invalid or expired." }, 401, origin);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const environment = "test";
    const { data: account, error: accountError } = await admin.from("payment_provider_accounts")
      .select("capabilities").eq("provider", "paystack").eq("environment", environment).maybeSingle();
    if (accountError) throw accountError;
    const planCode = String(account?.capabilities?.premium_plan_code || "");
    if (!/^PLN_[A-Za-z0-9]+$/.test(planCode)) {
      return reply({ error: "The R99/month Paystack plan has not been provisioned. The administrator must run Check Paystack connection first." }, 503, origin);
    }

    const { data: existing, error: existingError } = await admin.from("artist_subscriptions")
      .select("id,status,provider_reference")
      .eq("artist_id", authData.user.id)
      .in("status", ["pending_payment","active","non_renewing","attention"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existingError) throw existingError;
    if (existing) return reply({
      error: existing.status === "pending_payment"
        ? "A Premium checkout is already pending. Complete the existing checkout or contact support."
        : "Your account already has a Premium membership. Manage its renewal from this page.",
      current_status: existing.status
    }, 409, origin);

    const reference = `AF_PREMIUM_${crypto.randomUUID().replaceAll("-", "")}`;
    const { data: subscription, error: insertError } = await admin.from("artist_subscriptions").insert({
      artist_id: authData.user.id,
      provider: "paystack",
      provider_environment: environment,
      tier: "premium",
      customer_email: authData.user.email.toLowerCase(),
      provider_plan_code: planCode,
      provider_reference: reference,
      status: "pending_payment",
      amount_minor: 9900,
      currency: "ZAR"
    }).select("id").single();
    if (insertError?.code === "23505") {
      return reply({ error: "A Premium membership attempt already exists for this account. Refresh your membership status before retrying." }, 409, origin);
    }
    if (insertError) throw insertError;

    const callback = new URL("/?view=premium&payment=return", origin).toString();
    const providerResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: authData.user.email,
        amount: 9900,
        currency: "ZAR",
        plan: planCode,
        reference,
        callback_url: callback,
        metadata: {
          artist_frequency_subscription_id: subscription.id,
          artist_id: authData.user.id,
          product: "artist_frequency_premium_monthly",
          amount_minor: 9900,
          currency: "ZAR"
        }
      })
    });
    const providerResult = await providerResponse.json().catch(() => ({}));
    const checkoutUrl = providerResult?.data?.authorization_url;
    if (!providerResponse.ok || providerResult.status !== true ||
        !checkoutUrl || new URL(checkoutUrl).hostname !== "checkout.paystack.com") {
      await admin.from("artist_subscriptions").update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", subscription.id).eq("status", "pending_payment");
      return reply({ error: providerResult.message || "Paystack could not initialise the subscription checkout. No payment was taken." }, 502, origin);
    }
    return reply({
      checkout_url: checkoutUrl,
      reference,
      amount_minor: 9900,
      currency: "ZAR",
      interval: "monthly",
      environment
    }, 200, origin);
  } catch (error) {
    console.error("create-premium-subscription failed", error);
    return reply({ error: "Premium checkout could not be started. Please try again or contact support." }, 500, origin);
  }
});
