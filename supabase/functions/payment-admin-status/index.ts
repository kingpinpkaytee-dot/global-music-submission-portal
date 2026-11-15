import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const configuredOrigins = () => (Deno.env.get("CORS_ALLOWED_ORIGINS") || Deno.env.get("APP_ORIGIN") || "")
  .split(",").map(value => value.trim()).filter(Boolean);
const isAllowedOrigin = (origin: string) =>
  origin === "https://globalmusicsubmissionportal.org" ||
  origin === "https://www.globalmusicsubmissionportal.org" ||
  /^https:\/\/artist-frequency-preview-[a-z0-9-]+\.vercel\.app$/i.test(origin) ||
  configuredOrigins().includes(origin);
const headers = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
});
const reply = (body: unknown, status: number, origin: string) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers(origin), "Content-Type": "application/json" } });
const providerJson = async (response: Response) => response.json().catch(() => ({}));

Deno.serve(async request => {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") {
    if (!isAllowedOrigin(origin)) return new Response("Origin not allowed", { status: 403 });
    return new Response("ok", { headers: headers(origin) });
  }
  if (request.method !== "POST" || !isAllowedOrigin(origin)) return reply({ error: "Request not allowed." }, 403, origin);

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\\s+/i, "");
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
      premium_plan_ready: false, payouts_ready: false,
      message: "Add PAYSTACK_SECRET_KEY to Supabase Edge Function secrets. Use an sk_test_ key for sandbox testing."
    }, 200, origin);

    const environment = secret.startsWith("sk_live_") ? "live" : secret.startsWith("sk_test_") ? "test" : "unknown";
    if (environment === "unknown") return reply({
      provider: "paystack", environment, connection_status: "error",
      checkout_ready: false, premium_plan_ready: false, payouts_ready: false,
      message: "The configured key format is not recognised. Confirm the key in the Paystack dashboard."
    }, 200, origin);

    const check = await fetch("https://api.paystack.co/balance", {
      headers: { Authorization: `Bearer ${secret}` }
    });
    const balanceResult = await providerJson(check);
    if (!check.ok || balanceResult.status !== true) return reply({
      provider: "paystack", environment, connection_status: "error",
      checkout_ready: false, premium_plan_ready: false, payouts_ready: false,
      message: "Paystack did not validate this key. Check merchant credentials and account status."
    }, 200, origin);

    if (!serviceKey) return reply({
      provider: "paystack", environment, connection_status: "connected",
      checkout_ready: true, premium_plan_ready: false, payouts_ready: false,
      message: "Paystack API key verified, but the server-side database key is unavailable to provision the Premium plan."
    }, 200, origin);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: account, error: accountError } = await admin.from("payment_provider_accounts")
      .select("capabilities").eq("provider", "paystack").eq("environment", environment).maybeSingle();
    if (accountError) throw new Error("Payment database migration 0017 must be applied before the Premium plan can be stored.");

    let planCode = String(Deno.env.get("PAYSTACK_PREMIUM_PLAN_CODE") || account?.capabilities?.premium_plan_code || "");
    const planName = "Artist Frequency Premium — R99 Monthly";
    let plan = null;

    if (planCode) {
      const planResponse = await fetch(`https://api.paystack.co/plan/${encodeURIComponent(planCode)}`, {
        headers: { Authorization: `Bearer ${secret}` }
      });
      const planResult = await providerJson(planResponse);
      if (planResponse.ok && planResult.status === true) plan = planResult.data;
      if (plan && (Number(plan.amount) !== 9900 || plan.currency !== "ZAR" || plan.interval !== "monthly")) {
        return reply({
          provider: "paystack", environment, connection_status: "connected",
          checkout_ready: true, premium_plan_ready: false, payouts_ready: false,
          message: "The configured Premium plan does not match R99 ZAR monthly. Correct the plan before testing."
        }, 200, origin);
      }
    }

    if (!plan && environment === "test") {
      const listResponse = await fetch("https://api.paystack.co/plan?perPage=100&page=1&interval=monthly&amount=9900", {
        headers: { Authorization: `Bearer ${secret}` }
      });
      const listResult = await providerJson(listResponse);
      if (listResponse.ok && listResult.status === true) {
        plan = (listResult.data || []).find((item: any) =>
          item.name === planName && Number(item.amount) === 9900 &&
          item.currency === "ZAR" && item.interval === "monthly"
        ) || null;
      }
      if (!plan) {
        const createResponse = await fetch("https://api.paystack.co/plan", {
          method: "POST",
          headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: planName,
            description: "Artist Frequency Premium membership, billed monthly.",
            amount: 9900,
            currency: "ZAR",
            interval: "monthly",
            send_invoices: true,
            send_sms: false
          })
        });
        const createResult = await providerJson(createResponse);
        if (!createResponse.ok || createResult.status !== true || !createResult.data?.plan_code) {
          return reply({
            provider: "paystack", environment, connection_status: "connected",
            checkout_ready: true, premium_plan_ready: false, payouts_ready: false,
            message: createResult.message || "Paystack verified the key but could not create the R99 ZAR monthly plan. Confirm that Subscriptions are enabled for the merchant account."
          }, 200, origin);
        }
        plan = createResult.data;
      }
      planCode = String(plan.plan_code || "");
    }

    if (!plan && environment === "live") {
      return reply({
        provider: "paystack", environment, connection_status: "connected",
        checkout_ready: true, premium_plan_ready: false, payouts_ready: false,
        message: "Live Paystack key verified. Live plan creation is deliberately disabled during sandbox testing; create/confirm the R99 ZAR monthly plan in Paystack and set PAYSTACK_PREMIUM_PLAN_CODE."
      }, 200, origin);
    }

    if (planCode && plan) {
      const capabilities = {
        ...(account?.capabilities || {}),
        checkout: true,
        premium_plan_code: planCode,
        premium_amount_minor: 9900,
        premium_currency: "ZAR",
        premium_interval: "monthly"
      };
      const { error: saveError } = await admin.from("payment_provider_accounts").upsert({
        provider: "paystack",
        environment,
        connection_status: "connected",
        capabilities,
        last_verified_at: new Date().toISOString(),
        last_error_code: null
      }, { onConflict: "provider,environment" });
      if (saveError) throw new Error("Paystack is connected, but the Premium plan code could not be stored. Confirm migration 0017 and retry.");
    }

    return reply({
      provider: "paystack",
      environment,
      connection_status: "connected",
      checkout_ready: true,
      premium_plan_ready: Boolean(planCode),
      premium_plan: planCode ? { amount_minor: 9900, currency: "ZAR", interval: "monthly" } : null,
      payouts_ready: false,
      webhook_url: `${url.replace(/\\/$/, "")}/functions/v1/paystack-webhook`,
      webhook_events_required: ["charge.success", "charge.failed", "subscription.create", "subscription.not_renew", "subscription.disable", "invoice.payment_failed", "invoice.update"],
      message: planCode
        ? "Paystack API key verified and the R99 ZAR monthly Premium plan is ready in " + environment.toUpperCase() + " mode. Register the webhook URL and complete a test card checkout. Payouts remain disabled."
        : "Paystack API key verified. Premium plan is not ready yet."
    }, 200, origin);
  } catch (error) {
    console.error("payment-admin-status failed", error);
    return reply({ error: error instanceof Error ? error.message : "Provider status could not be checked." }, 500, origin);
  }
});
