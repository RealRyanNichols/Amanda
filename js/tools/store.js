import { state, save } from "../store.js";
import { h, toast } from "../util.js";

// Store — displays the micro-purchase catalog. Actual Stripe wiring happens
// on desktop phase; for now, tapping "Unlock" flips a local flag so the
// feature works. When Stripe is in place, replace handlePurchase() with a
// Stripe Checkout redirect.

const CATALOG = [
  {
    id: "brain-pro",
    type: "subscription",
    title: "Brain Pro — Unlimited Claude Sonnet 4.6",
    price: "$10/mo",
    emoji: "🧠",
    blurb:
      "Upgrades every Brain chat from Haiku to Claude Sonnet 4.6 — Anthropic's balanced flagship — with NO usage limits. The sweet spot: smart enough for almost anything, fast, all day every day.",
    perks: [
      "Unlimited Brain chat on Sonnet 4.6",
      "Unlimited caption writer generations",
      "Unlimited letter tidy-ups",
      "Unlimited Vent Mode reflections",
      "Faster than Opus, still very sharp",
    ],
  },
  {
    id: "brain-ultra",
    type: "subscription",
    title: "Brain Ultra — Unlimited Claude Opus 4.7",
    price: "$20/mo",
    emoji: "🧠✨",
    blurb:
      "The top shelf. Claude Opus 4.7 is Anthropic's most capable model — deeper reasoning, better judgment, extended thinking on every reply. For power users who lean hard on the Brain.",
    perks: [
      "Everything in Brain Pro, PLUS:",
      "Unlimited Brain chat on Opus 4.7",
      "Extended adaptive thinking on every reply",
      "Best for revenue analysis, business strategy",
      "Best for long letter/journal reflection",
    ],
  },
  {
    id: "caption-pack-50",
    type: "one-time",
    price: "$5",
    emoji: "✍️",
    title: "Caption Pack — 50 generations",
    blurb: "50 Claude-powered caption-writer runs on the base tier. Good for a month of heavy posting without needing Brain Pro.",
    perks: ["50 three-variant caption generations", "Platform-tuned suggestions", "Hashtag auto-pack"],
  },
  {
    id: "tidy-pack-20",
    type: "one-time",
    price: "$3",
    emoji: "🪶",
    title: "Letter Tidy Pack — 20 cleanups",
    blurb: "20 voice-dictated letter clean-ups on the base tier. Keeps your voice, removes ums.",
    perks: ["20 'Tidy it up' calls on letters", "Preserves your voice", "Works on all letter-style textareas"],
  },
  {
    id: "vault-5gb",
    type: "subscription",
    price: "$5/mo",
    emoji: "💾",
    title: "Vault 5GB",
    blurb:
      "Cloud-backed encrypted storage for your Brain Wallet — 5GB of document photos. Stays in sync across your devices.",
    perks: ["5GB encrypted cloud storage", "Syncs across your phone + computer", "Per-document password (coming)"],
  },
  {
    id: "family-4",
    type: "subscription",
    price: "$10/mo",
    emoji: "👨‍👩‍👧",
    title: "Family Plan — 4 seats",
    blurb:
      "Invite your partner, parents, or trusted family. Each person gets their own login, shared family space for your baby + calendar + letters.",
    perks: ["4 additional seats", "Shared calendar with your partner", "Shared love notes + letters to baby"],
  },
  {
    id: "theme-pack",
    type: "one-time",
    price: "$4",
    emoji: "🎨",
    title: "Theme Pack — 6 custom themes",
    blurb: "Soft pastels, rose-gold, forest, ocean, monochrome, and warm-nursery themes for the whole app.",
    perks: ["6 hand-picked themes", "Switch anytime in Settings", "Applies everywhere"],
  },
];

function isOwned(id) {
  return !!state.purchases?.[id];
}

function handlePurchase(item) {
  if (!state.purchases) state.purchases = {};
  if (state.purchases[item.id]) {
    if (!confirm(`You already have "${item.title}". Remove it?`)) return;
    delete state.purchases[item.id];
    save();
    toast("Removed");
    return true;
  }
  // Stripe placeholder — shows the checkout modal mockup.
  showCheckoutMock(item);
  return false;
}

function showCheckoutMock(item) {
  const overlay = h("div", { class: "photo-overlay", onclick: (e) => { if (e.target.classList.contains("photo-overlay")) overlay.remove(); } }, [
    h("div", { class: "card", style: "max-width:400px; width:100%; cursor:auto" }, [
      h("h2", {}, "Checkout preview"),
      h("div", { class: "sub" }, "Real Stripe checkout launches after the desktop upgrade."),
      h("div", { class: "store-checkout-row" }, [
        h("span", { class: "store-emoji-big" }, item.emoji),
        h("div", {}, [
          h("div", { class: "title" }, item.title),
          h("div", { class: "meta" }, item.price),
        ]),
      ]),
      h("div", { class: "alert ok", style: "margin-top:10px" },
        "For the preview, we'll unlock this locally so you can try the feature. Real payment gets wired up on desktop."),
      h("div", { class: "btn-row", style: "margin-top:12px; justify-content:flex-end" }, [
        h("button", { class: "btn secondary", onclick: () => overlay.remove() }, "Cancel"),
        h("button", {
          class: "btn",
          onclick: () => {
            if (!state.purchases) state.purchases = {};
            state.purchases[item.id] = { unlockedAt: Date.now() };
            save();
            toast(`${item.title} unlocked`);
            overlay.remove();
            document.dispatchEvent(new CustomEvent("store:rerender"));
          },
        }, "Unlock (preview)"),
      ]),
    ]),
  ]);
  document.body.append(overlay);
}

function renderHero() {
  return h("section", { class: "card store-hero" }, [
    h("h2", {}, "Store"),
    h("div", { class: "sub" },
      "Your $19/mo subscription covers the whole app. These are little extras that make certain parts even better. Skip them if you want — base covers everything you need."),
  ]);
}

function renderItem(item, rerender) {
  const owned = isOwned(item.id);
  return h("section", { class: "card store-item" + (owned ? " owned" : "") }, [
    h("div", { class: "store-header" }, [
      h("div", { class: "store-emoji-big" }, item.emoji),
      h("div", { style: "flex:1; min-width:0" }, [
        h("h2", { style: "margin:0" }, item.title),
        h("div", { class: "store-price" }, item.price + (item.type === "subscription" ? "" : " · one-time")),
      ]),
      owned && h("span", { class: "pill paid" }, "active"),
    ]),
    h("div", { class: "store-blurb" }, item.blurb),
    h("ul", { class: "store-perks" }, (item.perks || []).map((p) => h("li", {}, p))),
    h("div", { class: "btn-row" }, [
      h("button", {
        class: owned ? "btn secondary" : "btn",
        onclick: () => { handlePurchase(item); rerender(); },
      }, owned ? "Manage / remove" : item.type === "subscription" ? "Subscribe" : "Buy"),
    ]),
  ]);
}

export function renderStore(mount, { rerender }) {
  document.removeEventListener("store:rerender", rerender);
  document.addEventListener("store:rerender", rerender);

  mount.append(renderHero());
  CATALOG.forEach((item) => mount.append(renderItem(item, rerender)));

  mount.append(h("div", { class: "alert", style: "margin-top:10px" },
    "Privacy note: we'll use Stripe for real payments. Nothing passes through servers we control. Cancel any subscription from your Stripe Customer Portal (link appears here after desktop phase ships)."));
}
