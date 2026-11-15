import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes)).map(value => value.toString(16).padStart(2, "0")).join("");
function constantTimeHexEqual(expected: string, supplied: string) {
  if (!/^[0-9a-f]{128}$/i.test(supplied) || expected.length !== supplied.length) return false;
  const lower = supplied.toLowerCase();
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ lower.charCodeAt(i);
  return diff === 0;
}
async function hmacSha512Hex(secret: string, payload: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, payload));
}
async function validPaystackSignature(rawBody: Uint8Array, headers: Headers, webhookSecret: string, apiSecret: string) {
  // Current Paystack signature: HMAC-SHA512(timestamp + "." + raw body), keyed by whsec_.
  const modernHeader = headers.get("paystack-signature") || "";
  if (modernHeader && webhookSecret) {
    let timestamp = "";
    const signatures: string[] = [];
    let malformed = false;
    for (const part of modernHeader.split(",")) {
      const separator = part.indexOf("=");
      if (separator < 0) continue;
      const key = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      if (key === "t") {
        if (timestamp || !/^[0-9]+$/.test(value)) malformed = true;
        else timestamp = value;
      } else if (key === "v1") {
        const keySeparator = value.indexOf(":");
        if (keySeparator > 0) signatures.push(value.slice(keySeparator + 1));
      }
    }
    const signedAt = Number(timestamp);
    const now = Math.floor(Date.now() / 1000);
    if (!malformed && timestamp && Number.isSafeInteger(signedAt) && Math.abs(now - signedAt) <= 300 && signatures.length) {
      const prefix = new TextEncoder().encode(timestamp + ".");
      const payload = new Uint8Array(prefix.length + rawBody.length);
      payload.set(prefix, 0);
      payload.set(rawBody, prefix.length);
      const expected = await hmacSha512Hex(webhookSecret, payload);
      if (signatures.some(signature => constantTimeHexEqual(expected, signature))) return true;
    }
  }

  // Legacy x-paystack-signature: raw-body HMAC using the API secret during migration.
  const legacyHeader = headers.get("x-paystack-signature") || "";
  if (!legacyHeader || !apiSecret) return false;
  const expected = await hmacSha512Hex(apiSecret, rawBody);
  return constantTimeHexEqual(expected, legacyHeader);
}
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const providerJson = async (result: Response) => result.json().catch(() => ({}));

Deno.serve(async request => {
  if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);
  const secret = Deno.env.get("PAYSTACK_SECRET_KEY") || "";
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!secret || !url || !serviceKey) return response({ error: "Webhook is not configured" }, 503);

  const rawBody = new Uint8Array(await request.arrayBuffer());
  if (!await validPaystackSignature(rawBody, request.headers, Deno.env.get("PAYSTACK_WEBHOOK_SECRET") || "", secret)) {
    return response({ error: "Invalid signature" }, 401);
  }
  const raw = new TextDecoder().decode(rawBody);
  let event: any;
  try { event = JSON.parse(raw); } catch { return response({ error: "Invalid JSON" }, 400); }
  const data = event?.data || {};
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const providerEventId = `paystack:${String(data.id ?? data.reference ?? data.subscription_code ?? "none")}:${String(event?.event ?? "unknown")}`;
  const { data: inserted, error: insertError } = await admin.from("payment_webhook_events").insert({
    provider: "paystack",
    provider_event_id: providerEventId,
    event_type: String(event?.event || "unknown"),
    processing_status: "received"
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

  const finish = async (status: "processed" | "ignored" | "failed", failureCode?: string) => {
    if (!eventId) return;
    await admin.from("payment_webhook_events").update({
      processing_status: status,
      processed_at: status === "received" ? null : new Date().toISOString(),
      failure_code: failureCode || null
    }).eq("id", eventId);
  };

  const subscriptionCode = String(
    data.subscription?.subscription_code || data.subscription_code || data.subscription?.code || ""
  );
  const subscription = data.subscription || data;
  const planCode = String(data.plan?.plan_code || subscription?.plan?.plan_code || "");
  const customerEmail = String(data.customer?.email || data.customer_email || "").toLowerCase();
  const emailToken = String(subscription?.email_token || data.email_token || "");
  const customerCode = String(data.customer?.customer_code || "");

  const findSubscription = async (reference = "") => {
    if (reference) {
      const byReference = await admin.from("artist_subscriptions")
        .select("id,artist_id,provider_reference,status,provider_subscription_code")
        .eq("provider_reference", reference).maybeSingle();
      if (byReference.error) throw byReference.error;
      if (byReference.data) return byReference.data;
    }
    if (subscriptionCode) {
      const byCode = await admin.from("artist_subscriptions")
        .select("id,artist_id,provider_reference,status,provider_subscription_code")
        .eq("provider_subscription_code", subscriptionCode).maybeSingle();
      if (byCode.error) throw byCode.error;
      if (byCode.data) return byCode.data;
    }
    if (customerEmail && planCode) {
      const pending = await admin.from("artist_subscriptions")
        .select("id,artist_id,provider_reference,status,provider_subscription_code")
        .eq("customer_email", customerEmail).eq("provider_plan_code", planCode)
        .in("status", ["pending_payment","active","non_renewing","attention"])
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (pending.error) throw pending.error;
      return pending.data;
    }
    return null;
  };

  const attachSubscriptionDetails = async (target: any, status?: string) => {
    if (!target) return;
    const providerStatus = String(status || subscription?.status || "").toLowerCase();
    const patch: Record<string, unknown> = {
      last_provider_event_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if (subscriptionCode) patch.provider_subscription_code = subscriptionCode;
    if (emailToken) patch.provider_email_token = emailToken;
    if (customerCode) patch.provider_customer_code = customerCode;
    const nextDate = subscription?.next_payment_date || data.next_payment_date;
    if (nextDate && !Number.isNaN(Date.parse(nextDate))) patch.next_payment_date = new Date(nextDate).toISOString();
    if (event.event === "subscription.not_renew") {
      patch.status = "non_renewing";
      patch.cancel_at_period_end = true;
    } else if (event.event === "subscription.disable") {
      patch.status = providerStatus === "complete" || providerStatus === "completed" ? "completed" : "cancelled";
      patch.cancel_at_period_end = true;
    } else if (event.event === "invoice.payment_failed" || providerStatus === "attention") {
      patch.status = "attention";
    }
    const { error } = await admin.from("artist_subscriptions").update(patch).eq("id", target.id);
    if (error) throw error;
  };

  const verifyPremiumCharge = async (reference: string, code: string, paidAt: string | null, nextDate: string | null) => {
    const verifiedResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` }
    });
    const verifiedResult = await providerJson(verifiedResponse);
    const verified = verifiedResult?.data;
    if (!verifiedResponse.ok || verifiedResult.status !== true || verified?.status !== "success" ||
        String(verified.reference) !== reference || Number(verified.amount) !== 9900 || verified.currency !== "ZAR") {
      throw new Error("Paystack verification did not confirm the R99 ZAR Premium payment.");
    }
    const { error } = await admin.rpc("settle_artist_premium_subscription_payment", {
      p_provider_reference: reference,
      p_subscription_code: code || null,
      p_amount_minor: Number(verified.amount),
      p_currency: String(verified.currency),
      p_paid_at: paidAt || verified.paid_at || new Date().toISOString(),
      p_next_payment_date: nextDate && !Number.isNaN(Date.parse(nextDate)) ? new Date(nextDate).toISOString() : null
    });
    if (error) throw error;
  };

  try {
    if (event.event === "subscription.create") {
      const target = await findSubscription();
      if (!target) throw new Error("Premium subscription creation did not match a pending Artist Frequency subscription.");
      await attachSubscriptionDetails(target);
      await finish("processed");
      return response({ received: true, subscription_linked: true });
    }

    if (event.event === "subscription.not_renew" || event.event === "subscription.disable" ||
        event.event === "invoice.payment_failed") {
      const target = await findSubscription();
      if (!target) throw new Error("Paystack subscription event did not match an Artist Frequency membership.");
      await attachSubscriptionDetails(target);
      await finish("processed");
      return response({ received: true, subscription_updated: true });
    }

    if (event.event === "invoice.update") {
      const target = await findSubscription();
      if (!target) throw new Error("Paystack invoice event did not match an Artist Frequency membership.");
      const transaction = data.transaction || {};
      const reference = String(transaction.reference || data.reference || "");
      const status = String(data.status || transaction.status || "").toLowerCase();
      if (status === "success" || data.paid === true || data.paid === 1) {
        if (!reference) throw new Error("Successful subscription invoice did not include a transaction reference.");
        const nextDate = subscription?.next_payment_date || data.next_payment_date || data.period_end || null;
        await verifyPremiumCharge(reference, subscriptionCode || target.provider_subscription_code || "", data.paid_at || null, nextDate);
        await attachSubscriptionDetails(target);
      } else {
        await admin.from("artist_subscriptions").update({
          status: "attention",
          last_provider_event_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq("id", target.id);
      }
      await finish("processed");
      return response({ received: true, subscription_invoice_updated: true });
    }

    if (event.event === "charge.success" && data.reference) {
      const reference = String(data.reference);
      const premium = await findSubscription(reference);
      if (premium) {
        const nextDate = subscription?.next_payment_date || data.subscription?.next_payment_date || null;
        await verifyPremiumCharge(reference, subscriptionCode || premium.provider_subscription_code || "", data.paid_at || null, nextDate);
        await attachSubscriptionDetails(premium);
        await finish("processed");
        return response({ received: true, premium_activated: true });
      }

      const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${secret}` }
      });
      const verifyResult = await providerJson(verifyResponse);
      const verified = verifyResult?.data;
      if (!verifyResponse.ok || verifyResult.status !== true || verified?.status !== "success" || String(verified.reference) !== reference) {
        throw new Error("Provider verification did not confirm a successful transaction.");
      }

      const { data: payment, error: paymentError } = await admin.from("payment_transactions")
        .select("id,amount_minor,currency,invoice_id,artist_id,status")
        .eq("provider", "paystack").eq("provider_reference", reference).maybeSingle();
      if (paymentError) throw paymentError;
      if (!payment) {
        await finish("ignored");
        return response({ received: true, ignored: true });
      }
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
      await finish("processed");
      return response({ received: true, processed: true });
    }

    if (event.event === "charge.failed" && data.reference) {
      const reference = String(data.reference);
      const premium = await findSubscription(reference);
      if (premium) {
        await admin.from("artist_subscriptions").update({
          status: "attention",
          last_provider_event_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq("id", premium.id);
        await finish("processed");
        return response({ received: true, premium_payment_failed: true });
      }
      const { data: failedPayment, error: failedError } = await admin.from("payment_transactions")
        .update({ status: "failed" }).eq("provider", "paystack")
        .eq("provider_reference", reference)
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
      await finish("processed");
      return response({ received: true, failed: true });
    }

    await finish("ignored");
    return response({ received: true, ignored: true });
  } catch (error) {
    console.error("Paystack webhook processing failed", error);
    await finish("failed", String(error instanceof Error ? error.message : "processing_error").slice(0, 120));
    return response({ received: true, processed: false }, 500);
  }
});
