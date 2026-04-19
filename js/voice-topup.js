// Voice top-up paywall — shown at the friction point (she hits the free
// 5-min/day Brain voice cap). One-tap Apple Pay / Stripe Checkout buys
// more voice time. Designed for impulse purchase, not friction.

import { h, toast } from "./util.js";
import { getPaymentLink, STRIPE_LINKS } from "./stripe-config.js";
import { hasActiveVoiceTopup, voiceTopupExpiresAt } from "./plan.js";

export function showVoiceTopupPaywall({ onClose } = {}) {
  const existing = document.querySelector(".voice-topup-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "voice-topup-overlay";

  const options = [
    { id: "voice-1day", label: "24 hours", price: "$2.99", sub: "For a long car ride or a venting evening" },
    { id: "voice-3day", label: "3 days",   price: "$4.99", sub: "Our most popular" },
    { id: "voice-week", label: "7 days",   price: "$9.99", sub: "Best value · save 33%" },
  ];

  const cards = options.map((opt) => {
    const link = getPaymentLink(opt.id);
    return h("button", {
      class: "voice-topup-opt",
      onclick: () => {
        if (!link) {
          toast("Stripe Payment Link not configured for " + opt.id);
          return;
        }
        // Direct to Stripe — Apple Pay auto-fills on iOS, Google Pay on Android
        window.location.href = link;
      },
    }, [
      h("div", { class: "voice-topup-opt-price" }, opt.price),
      h("div", { class: "voice-topup-opt-label" }, opt.label + " unlimited"),
      h("div", { class: "voice-topup-opt-sub" }, opt.sub),
    ]);
  });

  const card = h("div", { class: "voice-topup-card" }, [
    h("div", { style: "font-size:2.5rem; text-align:center; margin-bottom:6px" }, "🎙️"),
    h("h2", { style: "text-align:center; margin:0" }, "Keep talking"),
    h("p", { style: "text-align:center; color:var(--text-dim); margin:8px 0 16px" },
      "You hit your free 5 minutes. Tap once — pay with Face ID / Apple Pay — and keep going."),
    h("div", { class: "voice-topup-options" }, cards),
    h("div", { style: "margin:16px 0 0; text-align:center" }, [
      h("button", { class: "btn secondary", onclick: () => { overlay.remove(); onClose?.(); } }, "Maybe tomorrow"),
    ]),
    h("div", { class: "voice-topup-footer" },
      "Want it unlimited every day? Upgrade to $19/mo in the Store tab — includes everything."),
  ]);
  overlay.append(card);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) { overlay.remove(); onClose?.(); }
  });
  document.body.append(overlay);
}

// Human-friendly "unlimited until X" label for UI
export function voiceStatusLine() {
  if (!hasActiveVoiceTopup()) return null;
  const until = voiceTopupExpiresAt();
  const now = Date.now();
  const mins = Math.round((until - now) / 60000);
  const hours = Math.round(mins / 60);
  if (hours >= 24) return `🎙️ Unlimited voice for ${Math.round(hours / 24)} more day${Math.round(hours / 24) === 1 ? "" : "s"}`;
  if (hours >= 1) return `🎙️ Unlimited voice for ${hours} more hour${hours === 1 ? "" : "s"}`;
  return `🎙️ Unlimited voice for ${mins} more minute${mins === 1 ? "" : "s"}`;
}
