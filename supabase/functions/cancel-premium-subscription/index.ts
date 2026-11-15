import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const configuredOrigins = () => (Deno.env.get("CORS_ALLOWED_ORIGINS") || Deno.env.get("APP_ORIGIN") || "")
  .split(",").map(value => value.trim()).filter(Boolean);
const isAllowedOrigin = (origin: string) =>
  origin === "https://globalmusicsubmissionportal.org" ||
  origin === "https://www.globalmusicsubmissionportal.org" ||
  /^https:\/\/artist-frequency-preview-[a-z0-9-]+\.vercel\.app$/i.test(origin) ||
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
    const secret = Deno.env.get("PAYSTACK_PREMIUM_TEST_SECRET_KEY") || "";
    if (!url || !anonKey || !serviceKey || !secret.startsWith("sk_test_")) return reply({ error: "Premium Test Mode subscription management is not configured. Check PAYSTACK_PREMIUM_TEST_SECRET_KEY." }, 503, origin);

    const bearer = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!bearer) return reply({ error: "Sign in is required." }, 401, origin);
    const auth = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${bearer}` } } });
    const { data: authData, error: authError } = await auth.auth.getUser();
    if (authError || !authData.user) return reply({ error: "Your sign-in session is invalid or expired." }, 401, origin);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: subscription, error: subscriptionError } = await admin.from("artist_subscriptions")
      .select("id,provider_subscription_code,provider_email_token,status,next_payment_date,paid_through_at")
      .eq("artist_id", authData.user.id)
      .eq("provider_environment", "test")
      .in("status", ["active","non_renewing","attention"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (subscriptionError) throw subscriptionError;
    if (!subscription) return reply({ error: "No active Premium subscription was found." }, 404, origin);
    if (subscription.status === "non_renewing") return reply({ ok: true, status: "non_renewing", paid_through_at: subscription.paid_through_at }, 200, origin);
    if (!subscription.provider_subscription_code || !subscription.provider_email_token) {
      return reply({ error: "Paystack is still confirming your subscription. Refresh this page after the first payment webhook arrives." }, 409, origin);
    }

    const response = await fetch("https://api.paystack.co/subscription/disable", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        code: subscription.provider_subscription_code,
        token: subscription.provider_email_token
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.status !== true) {
      return reply({ error: result.message || "Paystack could not schedule cancellation. No local status was changed." }, 502, origin);
    }
    const { error: updateError } = await admin.from("artist_subscriptions").update({
      status: "non_renewing",
      cancel_at_period_end: true,
      cancellation_requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq("id", subscription.id);
    if (updateError) throw updateError;
    return reply({
      ok: true,
      status: "non_renewing",
      paid_through_at: subscription.paid_through_at || subscription.next_payment_date || null,
      message: "Renewal cancelled. Premium remains available until the paid period ends."
    }, 200, origin);
  } catch (error) {
    console.error("cancel-premium-subscription failed", error);
    return reply({ error: "Premium cancellation could not be completed. Please contact support." }, 500, origin);
  }
});
