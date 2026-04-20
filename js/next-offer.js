// "What next" suggestion prompter — the depth-layer pattern.
// After any primary action, show her 2-4 relevant next actions so every door
// opens more doors. Called like:
//
//   offerNext({
//     title: `You added ${lead.name}. What next?`,
//     options: [
//       { label: "Draft a follow-up text", onPick: () => ... },
//       { label: "Add to calendar in 24 hrs", onPick: () => ... },
//       ...
//     ]
//   });
//
// Renders as a toast-sized overlay bottom of screen, dismissible, non-blocking.

import { h } from "./util.js";

export function offerNext({ title, options, subtitle = "" }) {
  // Close any existing offer
  document.querySelector(".next-offer")?.remove();

  const card = document.createElement("div");
  card.className = "next-offer";
  card.append(h("div", { class: "next-offer-header" }, [
    h("div", { class: "next-offer-title" }, title),
    h("button", { class: "next-offer-close", onclick: () => card.remove() }, "×"),
  ]));
  if (subtitle) card.append(h("div", { class: "next-offer-subtitle" }, subtitle));

  const list = h("div", { class: "next-offer-options" });
  options.forEach((opt) => {
    if (!opt) return;
    list.append(h("button", {
      class: "next-offer-btn",
      onclick: async () => {
        try { await opt.onPick?.(); } catch {}
        card.remove();
      },
    }, [
      opt.emoji && h("span", { class: "next-offer-emoji" }, opt.emoji),
      h("span", {}, opt.label),
    ]));
  });
  card.append(list);

  document.body.append(card);

  // Auto-dismiss after 60s if she doesn't engage
  setTimeout(() => card.remove(), 60000);
}
