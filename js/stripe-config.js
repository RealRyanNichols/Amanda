// Stripe integration config.
//
// Ryan has Stripe live. To wire real payments, create Products + Payment Links
// in the Stripe Dashboard (one per Store item below), then paste the Payment
// Link URL into the `paymentLink` field.
//
// Payment Links need ZERO code — Stripe hosts the checkout page. No backend
// required. No publishable key needed (the link itself is public). After
// successful payment, Stripe redirects to the success URL with query params
// we catch in app.js to unlock the feature locally.
//
// Longer-term (desktop phase): wire a proper Supabase Edge Function webhook
// for subscription lifecycle events — see DESKTOP_HANDOFF §3.
//
// HOW TO CREATE A PAYMENT LINK (60 seconds per item):
// 1. Stripe Dashboard → Products → Add product (name, price, recurring/once)
// 2. On the product page, click "Create payment link"
// 3. Under "After payment", pick "Don't show confirmation page" and set
//    success URL to:  https://YOUR-APP.vercel.app/?stripe_success=1&item=<ITEM_ID>
//    (Replace <ITEM_ID> with the id below, e.g. brain-pro)
// 4. Copy the Payment Link URL (looks like https://buy.stripe.com/abc123)
// 5. Paste below into the `paymentLink` field for that item
// 6. Commit. Vercel redeploys. Real payments go live.

export const STRIPE_LINKS = {
  // Subscription: Brain Pro — $10/mo, unlimited Sonnet 4.6
  "brain-pro":      { paymentLink: "" },

  // Subscription: Brain Ultra — $20/mo, unlimited Opus 4.7
  "brain-ultra":    { paymentLink: "" },

  // Subscription: Vault 5GB — $5/mo cloud storage
  "vault-5gb":      { paymentLink: "" },

  // Subscription: Family Plan — $10/mo, 4 seats
  "family-4":       { paymentLink: "" },

  // One-time: Caption Pack — $5, 50 generations
  "caption-pack-50": { paymentLink: "" },

  // One-time: Letter Tidy Pack — $3, 20 cleanups
  "tidy-pack-20":   { paymentLink: "" },

  // One-time: Theme Pack — $4, 6 themes
  "theme-pack":     { paymentLink: "" },

  // Core subscription ($19/mo) — primary SaaS subscription
  "core-monthly":   { paymentLink: "" },
  "core-annual":    { paymentLink: "" },

  // VOICE TIME TOP-UPS — the high-converting friction-point purchases.
  // When a free user hits the 5-min/day voice cap in Brain or elsewhere,
  // we offer these as one-tap Apple Pay purchases. Credits hit state.plan
  // after Stripe redirects back.
  //
  // Pricing model (Ryan's call): roughly $1/day of unlimited voice.
  // One-time charges. No recurring.
  "voice-1day":     { paymentLink: "", hours: 24,  label: "24 hours unlimited voice",    price: "$1" },
  "voice-3day":     { paymentLink: "", hours: 72,  label: "3 days unlimited voice",      price: "$3" },
  "voice-week":     { paymentLink: "", hours: 168, label: "7 days unlimited voice",      price: "$5" },
};

// Helper: given an item id, return the hours of voice unlimited access it unlocks
export function voiceTopupHours(itemId) {
  return STRIPE_LINKS[itemId]?.hours || 0;
}

export function getPaymentLink(itemId) {
  return STRIPE_LINKS[itemId]?.paymentLink || "";
}

export function hasStripeLive(itemId) {
  return !!getPaymentLink(itemId);
}
