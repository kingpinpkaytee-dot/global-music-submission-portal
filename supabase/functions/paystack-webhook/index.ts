import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes)).map(value => value.toString(16).padStart(2, "0")).join("");
async function validSignature(raw: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const digest = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  if (digest.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < digest.length; i++) diff |= digest.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async request => {
  if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);
  const secret = Deno.env.get("PAYSTACK_SECRET_KEY") || "";
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!secret || !url || !serviceKey) return response({ error: "Webhook is not configured" }, 503);

  const raw = await request.text();
  const signature = request.headers.get("x-paystack-signature") || "";
  if (!signature || !await validSignature(raw, signature, secret)) return response({ error: "Invalid signature" }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let event: any;
  try { event = JSON.parse(raw); } catch { return response({ error: "Invalid JSON" }, 400); }
  const providerEventId = `paystack:${String(event?.data?.id ?? "none")}:${String(event?.event ?? "unknown")}`;
  const { data: inserted, error: insertError } = await admin.from("payment_webhook_events").insert({
    provider: "paystack", provider_event_id: providerEventId,
    event_type: String(event?.event || "unknown"), processing_status: "received"
  }).select("id").maybeSingle();

  let eventId = inserted?.id as string | undefined;
  if (insertError?.code === "23505") {
    const { data: previous, error: lookupError } = await admin.from("payment_webhook_events")
      .select("id,processing_status").eq("provider", "paystack")
      .eq("provider_event_id", providerEventId).maybeSingle();
    if (lookupError) return response({ error: "Could not inspect duplicate webhook state" }, 500);
    if (previous?.processing_status === "processed" || previous?.processing_status === "ignored") {
      return response({ received: true, duplicate: true });
    }
    eventId = previous?.id;
    if (eventId) await admin.from("payment_webhook_events")
      .update({ processing_status: "received", failure_code: null }).eq("id", eventId);
  } else if (insertError) {
    console.error("Could not record webhook event", insertError);
    return response({ error: "Event could not be recorded" }, 500);
  }

  if (event?.event === "charge.failed" && event?.data?.reference) {
    try {
      const { data: failedPayment, error: failedError } = await admin.from("payment_transactions")
        .update({ status: "failed" }).eq("provider", "paystack")
        .eq("provider_reference", String(event.data.reference))
        .in("status", ["initiated", "pending"]).select("invoice_id").maybeSingle();
      if (failedError) throw failedError;
      if (failedPayment?.invoice_id) {
        const { count, error: remainingError } = await admin.from("payment_transactions")
          .select("id", { count: "exact", head: true }).eq("invoice_id", failedPayment.invoice_id)
          .in("status", ["initiated", "pending", "succeeded"]);
        if (!remainingError && count === 0) {
          await admin.from("artist_invoices").update({ status: "open" })
            .eq("id", failedPayment.invoice_id).eq("status", "pending_payment");
        }
      }
      if (eventId) await admin.from("payment_webhook_events").update({
        processing_status: "processed", processed_at: new Date().toISOString()
      }).eq("id", eventId);
      return response({ received: true, failed: true });
    } catch (error) {
      console.error("Paystack failed-charge webhook processing failed", error);
      if (eventId) await admin.from("payment_webhook_events").update({
        processing_status: "failed", failure_code: "failed_charge_update_error"
      }).eq("id", eventId);
      return response({ received: true, processed: false }, 500);
    }
  }
  if (event?.event !== "charge.success" || !event?.data?.reference) {
    if (eventId) await admin.from("payment_webhook_events")
      .update({ processing_status: "ignored", processed_at: new Date().toISOString() }).eq("id", eventId);
    return response({ received: true, ignored: true });
  }

  try {
    const reference = String(event.data.reference);
    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` }
    });
    const verifyResult = await verifyResponse.json().catch(() => ({}));
    const verified = verifyResult?.data;
    if (!verifyResponse.ok || verifyResult.status !== true || verified?.status !== "success" || String(verified.reference) !== reference) {
      throw new Error("Provider verification did not confirm a successful transaction.");
    }

    const { data: payment, error: paymentError } = await admin.from("payment_transactions")
      .select("id,amount_minor,currency,invoice_id,artist_id,status")
      .eq("provider", "paystack").eq("provider_reference", reference).maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment) throw new Error("Payment reference is not associated with an Artist Frequency invoice.");
    if (Number(verified.amount) !== Number(payment.amount_minor) || verified.currency !== payment.currency) {
      throw new Error("Verified amount or currency does not match the invoice payment.");
    }

    const { error: settleError } = await admin.rpc("settle_artist_invoice_payment", {
      p_provider_reference: reference,
      p_provider_transaction_id: String(verified.id),
      p_amount_minor: Number(verified.amount),
      p_currency: String(verified.currency),
      p_paid_at: verified.paid_at || new Date().toISOString()
    });
    if (settleError) throw settleError;
    await admin.from("payment_transactions").update({
      provider_transaction_id: String(verified.id),
      raw_event_summary: { event: "charge.success", verified_status: verified.status, channel: verified.channel || null }
    }).eq("id", payment.id);
    if (eventId) await admin.from("payment_webhook_events").update({
      processing_status: "processed", processed_at: new Date().toISOString(), failure_code: null
    }).eq("id", eventId);
    return response({ received: true, processed: true });
  } catch (error) {
    console.error("Paystack webhook processing failed", error);
    if (eventId) await admin.from("payment_webhook_events").update({
      processing_status: "failed",
      failure_code: String(error instanceof Error ? error.message : "processing_error").slice(0, 120)
    }).eq("id", eventId);
    return response({ received: true, processed: false }, 500);
  }
});
