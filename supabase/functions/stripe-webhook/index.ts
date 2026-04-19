// Supabase Edge Function: Stripe webhook handler
//
// Deploy via: supabase functions deploy stripe-webhook --no-verify-jwt
//
// Env vars (set via: supabase secrets set STRIPE_WEBHOOK_SECRET=... etc.):
//   STRIPE_SECRET_KEY    — sk_live_... from Stripe Dashboard
//   STRIPE_WEBHOOK_SECRET — whsec_... from the webhook endpoint you create
//   SUPABASE_URL         — auto-injected by Supabase runtime
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase runtime
//
// Stripe dashboard setup:
//   1. Stripe → Developers → Webhooks → Add endpoint
//   2. Endpoint URL: https://mccjgijnbstduhyuvwwo.supabase.co/functions/v1/stripe-webhook
//   3. Events to listen for:
//        - checkout.session.completed
//        - customer.subscription.created
//        - customer.subscription.updated
//        - customer.subscription.deleted
//   4. Copy the signing secret (whsec_...) and set it as STRIPE_WEBHOOK_SECRET
//
// What this does:
//   - Verifies every webhook is genuinely from Stripe (via signature)
//   - For subscriptions: updates profiles.tier + voice_unlimited_until
//   - For one-time purchases (voice top-ups, caption packs, etc.):
//     inserts into purchases table, also extends voice_unlimited_until
//     on the profile for voice-* items
//
// The client's success-URL redirect still works for the "immediate unlock"
// UX. This webhook is the source of truth — it ensures the unlock is real
// and survives a user clearing their browser storage.

import { serve } from "https://deno.land/std@0.207.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-11-20.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // service role bypasses RLS
  { auth: { persistSession: false } },
);

// Map Stripe Price IDs (or metadata labels) → voice top-up hours
const VOICE_TOPUP_HOURS: Record<string, number> = {
  "voice-1day":  24,
  "voice-3day":  72,
  "voice-week":  168,
  "voice-month": 720,
};

// Subscription tier mapping by item_id / product metadata
function tierFromItemId(itemId: string): string | null {
  if (itemId === "core-monthly") return "core";
  if (itemId === "core-annual")  return "core_annual";
  if (itemId === "brain-pro")    return null; // doesn't change core tier
  if (itemId === "brain-ultra")  return null;
  return null;
}

async function extendVoiceUnlimited(userId: string, hours: number) {
  // Fetch current value, extend by `hours`, upsert.
  const { data } = await supabase.from("profiles").select("voice_unlimited_until").eq("id", userId).maybeSingle();
  const now = Date.now();
  const current = data?.voice_unlimited_until ? new Date(data.voice_unlimited_until).getTime() : now;
  const base = Math.max(now, current);
  const next = new Date(base + hours * 60 * 60 * 1000).toISOString();
  await supabase.from("profiles").update({ voice_unlimited_until: next }).eq("id", userId);
}

async function recordPurchase(userId: string, itemId: string, sessionId: string) {
  await supabase.from("purchases").upsert(
    { user_id: userId, item_id: itemId, stripe_session_id: sessionId, source: "stripe" },
    { onConflict: "user_id,item_id" },
  );
}

async function setTier(userId: string, tier: string) {
  await supabase.from("profiles").update({ tier }).eq("id", userId);
}

async function setBrainTier(userId: string, brainTier: string) {
  await supabase.from("profiles").update({ brain_tier: brainTier }).eq("id", userId);
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing stripe-signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error("Signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // user_id must be stuffed into client_reference_id OR metadata.user_id
        // when creating the Payment Link — the client sets it on redirect.
        const userId = (session.client_reference_id || session.metadata?.user_id) as string | undefined;
        const itemId = (session.metadata?.item_id || "") as string;
        if (!userId || !itemId) {
          console.warn("Missing user_id or item_id on session", session.id);
          break;
        }

        await recordPurchase(userId, itemId, session.id);

        // Voice top-ups
        if (VOICE_TOPUP_HOURS[itemId]) {
          await extendVoiceUnlimited(userId, VOICE_TOPUP_HOURS[itemId]);
        }
        // Core subscription
        const tier = tierFromItemId(itemId);
        if (tier) await setTier(userId, tier);
        // Brain tier add-ons
        if (itemId === "brain-pro")   await setBrainTier(userId, "pro");
        if (itemId === "brain-ultra") await setBrainTier(userId, "ultra");
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        // Identify the user by stripe_customer_id on profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", sub.customer as string)
          .maybeSingle();
        if (profile?.id) {
          await setTier(profile.id, "free");
          await setBrainTier(profile.id, "haiku");
        }
        break;
      }

      case "customer.subscription.updated": {
        // Could handle pause/reactivation here. For now, no-op unless
        // status === 'past_due' or 'canceled'.
        const sub = event.data.object as Stripe.Subscription;
        if (sub.status === "canceled" || sub.status === "unpaid") {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("stripe_customer_id", sub.customer as string)
            .maybeSingle();
          if (profile?.id) await setTier(profile.id, "free");
        }
        break;
      }

      default:
        console.log("Unhandled event:", event.type);
    }
  } catch (err) {
    console.error("Handler error:", err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
