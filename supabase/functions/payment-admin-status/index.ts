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
const headers = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
});
const reply = (body: unknown, status: number, origin: string) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers(origin), "Content-Type": "application/json" } });
const providerJson = async (response: Response) => response.json().catch(() => ({}));

async function verifyPaystackKey(secret: string) {
  const response = await fetch("https://api.paystack.co/balance", {
    headers: { Authorization: `Bearer ${secret}` }
  });
  const result = await providerJson(response);
  return response.ok && result.status === true;
}

async function ensureTestPremiumPlan(admin: any, secret: string) {
  const { data: account, error: accountError } = await admin.from("payment_provider_accounts")
    .select("capabilities").eq("provider", "paystack").eq("environment", "test").maybeSingle();
  if (accountError) throw new Error("Payment migration 0017 must be applied before the Premium test plan can be stored.");

  let planCode = String(account?.capabilities?.premium_plan_code || "");
  let plan: any = null;
  const expectedName = "Artist Frequency Premium — R99 Monthly";

  if (planCode) {
    const response = await fetch(`https://api.paystack.co/plan/${encodeURIComponent(planCode)}`, {
      headers: { Authorization: `Bearer ${secret}` }
    });
    const result = await providerJson(response);
    if (response.ok && result.status === true) plan = result.data;
  }

  if (plan && (Number(plan.amount) !== 9900 || plan.currency !== "ZAR" || plan.interval !== "monthly")) {
    throw new Error("The saved Premium Test plan does not match R99 ZAR monthly. Correct it before testing.");
  }

  if (!plan) {
    const listResponse = await fetch("https://api.paystack.co/plan?perPage=100&page=1&interval=monthly&amount=9900", {
      headers: { Authorization: `Bearer ${secret}` }
    });
    const listResult = await providerJson(listResponse);
    if (listResponse.ok && listResult.status === true) {
      plan = (listResult.data || []).find((item: any) =>
        item.name === expectedName && Number(item.amount) === 9900 &&
        item.currency === "ZAR" && item.interval === "monthly"
      ) || null;
    }
  }

  if (!plan) {
    const createResponse = await fetch("https://api.paystack.co/plan", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: expectedName,
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
      throw new Error(createResult.message || "Paystack could not provision the R99 ZAR monthly Test plan. Confirm subscriptions are enabled.");
    }
    plan = createResult.data;
  }

  planCode = String(plan.plan_code || "");
  if (!/^PLN_[A-Za-z0-9]+$/.test(planCode)) throw new Error("Paystack returned an invalid monthly plan code.");

  const capabilities = {
    ...(account?.capabilities || {}),
    premium_plan_code: planCode,
    premium_amount_minor: 9900,
    premium_currency: "ZAR",
    premium_interval: "monthly"
  };
  const { error: saveError } = await admin.from("payment_provider_accounts").upsert({
    provider: "paystack",
    environment: "test",
    connection_status: "connected",
    capabilities,
    last_verified_at: new Date().toISOString(),
    last_error_code: null
  }, { onConflict: "provider,environment" });
  if (saveError) throw new Error("The Test plan was created, but its plan code could not be stored. Confirm migration 0017 and retry.");
  return planCode;
}

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
    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!url || !anon || !serviceKey || !token) return reply({ error: "Authentication is required." }, 401, origin);

    const auth = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error: userError } = await auth.auth.getUser();
    if (userError || !userData.user) return reply({ error: "Session is invalid." }, 401, origin);
    const { data: isAdmin, error: roleError } = await auth.rpc("is_site_admin");
    if (roleError || isAdmin !== true) return reply({ error: "Administrator access is required." }, 403, origin);

    const invoiceSecret = Deno.env.get("PAYSTACK_SECRET_KEY") || "";
    const premiumTestSecret = Deno.env.get("PAYSTACK_PREMIUM_TEST_SECRET_KEY") || Deno.env.get("PAYSTACK_PREMIUM_TEST_SECRETE_KEY") || "";
    const invoiceEnvironment = invoiceSecret.startsWith("sk_live_") ? "live"
      : invoiceSecret.startsWith("sk_test_") ? "test" : "not_configured";
    const invoiceConnected = ["live", "test"].includes(invoiceEnvironment)
      ? await verifyPaystackKey(invoiceSecret) : false;

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    let premiumPlanReady = false;
    let premiumPlanMessage = "Add PAYSTACK_PREMIUM_TEST_SECRET_KEY with an sk_test_ value. Do not overwrite PAYSTACK_SECRET_KEY; that key remains reserved for existing invoice checkout.";
    if (premiumTestSecret) {
      if (!premiumTestSecret.startsWith("sk_test_")) {
        premiumPlanMessage = "PAYSTACK_PREMIUM_TEST_SECRET_KEY must be a Paystack Test Mode key beginning sk_test_. Existing invoice credentials were not changed.";
      } else if (!await verifyPaystackKey(premiumTestSecret)) {
        premiumPlanMessage = "Paystack did not validate PAYSTACK_PREMIUM_TEST_SECRET_KEY. Check the Test Mode merchant key.";
      } else {
        const planCode = await ensureTestPremiumPlan(admin, premiumTestSecret);
        premiumPlanReady = true;
        premiumPlanMessage = "R99 ZAR monthly Premium plan is ready in Test Mode (" + planCode + ").";
      }
    }

    return reply({
      provider: "paystack",
      environment: invoiceEnvironment,
      connection_status: invoiceConnected ? "connected" : "not_connected",
      checkout_ready: invoiceConnected,
      invoice_environment: invoiceEnvironment,
      premium_environment: "test",
      premium_plan_ready: premiumPlanReady,
      premium_plan: premiumPlanReady ? { amount_minor: 9900, currency: "ZAR", interval: "monthly" } : null,
      payouts_ready: false,
      webhook_url: `${url.replace(/\/$/, "")}/functions/v1/paystack-webhook`,
      webhook_events_required: ["charge.success", "charge.failed", "subscription.create", "subscription.not_renew", "subscription.disable", "invoice.payment_failed", "invoice.update"],
      message: (invoiceConnected
        ? "Existing invoice Paystack connection verified (" + invoiceEnvironment.toUpperCase() + "). "
        : "Existing invoice Paystack connection is not configured or could not be verified. ")
        + premiumPlanMessage + " Test subscriptions use a separate Test Mode key; invoice/live credentials remain untouched. Payouts remain disabled."
    }, 200, origin);
  } catch (error) {
    console.error("payment-admin-status failed", error);
    return reply({ error: error instanceof Error ? error.message : "Provider status could not be checked." }, 500, origin);
  }
});
