// Voice top-up paywall — shown at the friction point (she hits the free
// 5-min/day Brain voice cap). One-tap Apple Pay / Stripe Checkout buys
// more voice time. Designed for impulse purchase, not friction.

import { h, toast } from "./util.js";
import { getPaymentLink, STRIPE_LINKS } from "./stripe-config.js";
import { hasActiveVoiceTopup, voiceTopupExpiresAt } from "./plan.js";
import { contextualAnchor, pickBenefits, paywallHeadline } from "./price-anchor.js";

export function showVoiceTopupPaywall({ onClose } = {}) {
  const existing = document.querySelector(".voice-topup-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "voice-topup-overlay";

  const anchor = contextualAnchor();
  const headline = paywallHeadline();
  const benefits = pickBenefits(3);

  const options = [
    { id: "voice-1day",  label: "24 hours", price: "$1.99", perDay: "$1.99/day", sub: `${anchor}` },
    { id: "voice-3day",  label: "3 days",   price: "$3",    perDay: "$1.00/day", sub: "Popular pick" },
    { id: "voice-week",  label: "7 days",   price: "$5",    perDay: "$0.71/day", sub: "Best value" },
    { id: "voice-month", label: "30 days",  price: "$20",   perDay: "$0.67/day", sub: "Power user" },
  ];

  const cards = options.map((opt) => {
    const link = getPaymentLink(opt.id);
    return h("button", {
      class: "voice-topup-opt" + (opt.id === "voice-month" ? " voice-topup-opt-anchor" : ""),
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
      h("div", { style: "flex: 1; min-width: 0" }, [
        h("div", { class: "voice-topup-opt-label" }, opt.label + " unlimited voice"),
        h("div", { class: "voice-topup-opt-sub" }, `${opt.perDay} · ${opt.sub}`),
      ]),
    ]);
  });

  const card = h("div", { class: "voice-topup-card" }, [
    h("div", { style: "font-size:2.5rem; text-align:center; margin-bottom:6px" }, "🎙️"),
    h("h2", { style: "text-align:center; margin:0" }, headline),
    h("p", { style: "text-align:center; color:var(--text-dim); margin:8px 0 10px" },
      `$2.99 — ${anchor}. One tap · Face ID · you're back talking.`),
    // Benefit bullets — what the extra time actually lets her DO
    h("ul", { class: "voice-topup-benefits" },
      benefits.map((b) => h("li", {}, b))),
    h("div", { class: "voice-topup-options" }, cards),
    h("div", { style: "margin:16px 0 0; text-align:center" }, [
      h("button", { class: "btn secondary", onclick: () => { overlay.remove(); onClose?.(); } }, "Maybe tomorrow"),
    ]),
    h("div", { class: "voice-topup-footer" },
      "Psst: $19/mo in the Store gets you unlimited voice AND the whole app — actually cheaper than the 30-day voice-only option above."),
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
