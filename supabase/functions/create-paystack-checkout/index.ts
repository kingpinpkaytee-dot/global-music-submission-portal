import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = () => (Deno.env.get("CORS_ALLOWED_ORIGINS") || Deno.env.get("APP_ORIGIN") || "")
  .split(",").map(value => value.trim()).filter(Boolean);
const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin"
});
const reply = (body: unknown, status: number, origin: string) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") {
    if (!allowedOrigins().includes(origin)) return new Response("Origin not allowed", { status: 403 });
    return new Response("ok", { headers: cors(origin) });
  }
  if (request.method !== "POST" || !allowedOrigins().includes(origin)) return reply({ error: "Request not allowed." }, 403, origin);

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY") || "";
    const callbackUrl = Deno.env.get("PAYMENT_RETURN_URL") || "";
    if (!url || !anonKey || !serviceKey || !paystackSecret || !callbackUrl) {
      return reply({ error: "Payments are not configured yet. Please contact the platform administrator." }, 503, origin);
    }
    if (!/^https:\/\//i.test(callbackUrl)) return reply({ error: "The payment return URL is not configured securely." }, 503, origin);

    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return reply({ error: "Sign in is required." }, 401, origin);
    const authClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) return reply({ error: "Your sign-in session is invalid or expired." }, 401, origin);

    const body = await request.json().catch(() => ({}));
    const invoiceId = String(body?.invoice_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(invoiceId)) return reply({ error: "A valid invoice is required." }, 400, origin);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: invoice, error: invoiceError } = await admin.from("artist_invoices")
      .select("id,invoice_number,artist_id,currency,total_minor,status")
      .eq("id", invoiceId).eq("artist_id", authData.user.id).maybeSingle();
    if (invoiceError) throw invoiceError;
    if (!invoice) return reply({ error: "Invoice not found." }, 404, origin);
    if (!["open", "pending_payment"].includes(invoice.status)) return reply({ error: "This invoice is not available for payment." }, 409, origin);
    if (invoice.currency !== "ZAR" || !Number.isSafeInteger(Number(invoice.total_minor)) || Number(invoice.total_minor) < 100) {
      return reply({ error: "This invoice amount is not eligible for online checkout." }, 400, origin);
    }

    const { data: existing } = await admin.from("payment_transactions")
      .select("id,status,checkout_url,created_at")
      .eq("invoice_id", invoice.id).eq("artist_id", authData.user.id)
      .eq("provider", "paystack").in("status", ["initiated", "pending"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing?.checkout_url && existing.status === "pending") {
      return reply({ checkout_url: existing.checkout_url, reused: true }, 200, origin);
    }

    const reference = `AF_${crypto.randomUUID().replaceAll("-", "")}`;
    const amount = Number(invoice.total_minor);
    const { data: payment, error: paymentError } = await admin.from("payment_transactions").insert({
      invoice_id: invoice.id, artist_id: authData.user.id, provider: "paystack",
      provider_reference: reference, amount_minor: amount, currency: "ZAR",
      status: "initiated", raw_event_summary: { invoice_number: invoice.invoice_number }
    }).select("id").single();
    if (paymentError?.code === "23505") {
      const { data: activePayment } = await admin.from("payment_transactions")
        .select("status,checkout_url").eq("invoice_id", invoice.id)
        .eq("provider", "paystack").in("status", ["initiated", "pending"]).maybeSingle();
      if (activePayment?.checkout_url) return reply({ checkout_url: activePayment.checkout_url, reused: true }, 200, origin);
      return reply({ error: "A checkout attempt is already being prepared. Please retry in a moment." }, 409, origin);
    }
    if (paymentError) throw paymentError;

    const providerResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${paystackSecret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: authData.user.email, amount, currency: "ZAR", reference,
        callback_url: callbackUrl,
        metadata: {
          invoice_id: invoice.id, invoice_number: invoice.invoice_number,
          artist_id: authData.user.id, payment_transaction_id: payment.id
        }
      })
    });
    const providerResult = await providerResponse.json().catch(() => ({}));
    if (!providerResponse.ok || providerResult.status !== true || !providerResult.data?.authorization_url) {
      await admin.from("payment_transactions").update({ status: "failed" }).eq("id", payment.id);
      return reply({ error: providerResult.message || "The payment provider could not start checkout. No payment was taken." }, 502, origin);
    }
    const { error: updateError } = await admin.from("payment_transactions")
      .update({ status: "pending", checkout_url: providerResult.data.authorization_url }).eq("id", payment.id);
    if (updateError) throw updateError;
    await admin.from("artist_invoices").update({ status: "pending_payment" }).eq("id", invoice.id);
    return reply({ checkout_url: providerResult.data.authorization_url, reference }, 200, origin);
  } catch (error) {
    console.error("create-paystack-checkout failed", error);
    return reply({ error: "Checkout could not be created. Please try again or contact support." }, 500, origin);
  }
});
