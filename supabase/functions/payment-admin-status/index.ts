import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const origins = () => (Deno.env.get("CORS_ALLOWED_ORIGINS") || Deno.env.get("APP_ORIGIN") || "")
  .split(",").map(value => value.trim()).filter(Boolean);
const headers = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
});
const reply = (body: unknown, status: number, origin: string) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers(origin), "Content-Type": "application/json" } });

Deno.serve(async request => {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") {
    if (!origins().includes(origin)) return new Response("Origin not allowed", { status: 403 });
    return new Response("ok", { headers: headers(origin) });
  }
  if (request.method !== "POST" || !origins().includes(origin)) return reply({ error: "Request not allowed." }, 403, origin);
  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!url || !anon || !token) return reply({ error: "Authentication is required." }, 401, origin);

    const auth = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error: userError } = await auth.auth.getUser();
    if (userError || !userData.user) return reply({ error: "Session is invalid." }, 401, origin);
    const { data: isAdmin, error: roleError } = await auth.rpc("is_site_admin");
    if (roleError || isAdmin !== true) return reply({ error: "Administrator access is required." }, 403, origin);

    const secret = Deno.env.get("PAYSTACK_SECRET_KEY") || "";
    if (!secret) return reply({
      provider: "paystack", environment: "not_configured",
      connection_status: "not_connected", checkout_ready: false,
      payouts_ready: false, message: "Add PAYSTACK_SECRET_KEY to Supabase Edge Function secrets."
    }, 200, origin);

    const environment = secret.startsWith("sk_live_") ? "live" : secret.startsWith("sk_test_") ? "test" : "unknown";
    if (environment === "unknown") return reply({
      provider: "paystack", environment, connection_status: "error",
      checkout_ready: false, payouts_ready: false,
      message: "The configured key format is not recognised. Confirm the key in the Paystack dashboard."
    }, 200, origin);

    const check = await fetch("https://api.paystack.co/balance", {
      headers: { Authorization: `Bearer ${secret}` }
    });
    const result = await check.json().catch(() => ({}));
    if (!check.ok || result.status !== true) return reply({
      provider: "paystack", environment, connection_status: "error",
      checkout_ready: false, payouts_ready: false,
      message: "Paystack did not validate this key. Check merchant credentials and account status."
    }, 200, origin);

    return reply({
      provider: "paystack", environment, connection_status: "connected",
      checkout_ready: true, payouts_ready: false,
      message: "API key verified. Hosted checkout can be enabled after migration and webhook setup. Bank transfers and marketplace payouts still require separate provider approval and verification."
    }, 200, origin);
  } catch (error) {
    console.error("payment-admin-status failed", error);
    return reply({ error: "Provider status could not be checked." }, 500, origin);
  }
});
