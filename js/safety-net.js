// Safety Net — the "I'm not okay right now" button + concerning-phrase
// detection + crisis resources.
//
// Design principles:
// - 988 (US Suicide & Crisis Lifeline) is ALWAYS surfaced first for US users.
//   Trained responders, 24/7, free. No app can replace this.
// - The trusted person (partner, parent, friend, pastor) is surfaced SECOND,
//   as an additional option, not a replacement.
// - No auto-dial. No hidden alerts. She chooses what to do.
// - Concerning phrases trigger gentle surfacing — never alarm, never lock
//   her out of the app. Respect her autonomy while offering help.

import { state, save } from "./store.js";
import { h, toast } from "./util.js";

// Keywords flagged as concerning. Conservative — better to surface resources
// once too often than once too few. Matching is case-insensitive + word-boundary.
const CONCERNING_PATTERNS = [
  /\b(kill|hurt|harm)\s+(myself|me)\b/i,
  /\bend\s+(it|my\s+life|myself)\b/i,
  /\b(want|wish|going)\s+to\s+die\b/i,
  /\b(no\s+point|nothing\s+matters|can'?t\s+go\s+on|can'?t\s+do\s+this\s+anymore)\b/i,
  /\b(better\s+off\s+(without|dead))\b/i,
  /\bsuicid/i,
  /\b(give\s+up\s+on\s+life|done\s+with\s+living)\b/i,
];

const GENTLE_BUT_WATCHFUL = [
  /\b(hopeless|worthless|numb|empty|exhausted\s+in\s+my\s+soul)\b/i,
  /\b(can'?t\s+feel\s+anything|can'?t\s+sleep\s+for\s+days)\b/i,
  /\b(nobody\s+(cares|would\s+miss\s+me))\b/i,
];

export function scanForConcerns(text) {
  if (!text || typeof text !== "string") return { level: "none" };
  for (const p of CONCERNING_PATTERNS) if (p.test(text)) return { level: "acute" };
  for (const p of GENTLE_BUT_WATCHFUL) if (p.test(text)) return { level: "watch" };
  return { level: "none" };
}

const COMFORT_VERSES = [
  { ref: "Psalm 34:18",  text: "The LORD is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit." },
  { ref: "Psalm 46:1",   text: "God is our refuge and strength, a very present help in trouble." },
  { ref: "Isaiah 41:10", text: "Fear thou not; for I am with thee: be not dismayed; for I am thy God." },
  { ref: "Matthew 11:28", text: "Come unto me, all ye that labour and are heavy laden, and I will give you rest." },
  { ref: "Psalm 23:4",   text: "Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me." },
  { ref: "Psalm 147:3",  text: "He healeth the broken in heart, and bindeth up their wounds." },
  { ref: "2 Corinthians 1:3-4", text: "Blessed be God, even the Father of our Lord Jesus Christ, the Father of mercies, and the God of all comfort; Who comforteth us in all our tribulation." },
];

function pickComfortVerse() {
  return COMFORT_VERSES[Math.floor(Math.random() * COMFORT_VERSES.length)];
}

/**
 * Show the full safety-net overlay. The user's explicit choice — NEVER
 * auto-triggered without her opening the "I need help" button, or a
 * concerning phrase being detected AND her not dismissing the gentle prompt.
 */
export function showSafetyNet({ reason = "open" } = {}) {
  const existing = document.querySelector(".safety-overlay");
  if (existing) existing.remove();

  const net = state.safetyNet || {};
  const hasTrusted = !!net.trustedPhone;
  const verse = pickComfortVerse();

  const overlay = document.createElement("div");
  overlay.className = "safety-overlay";

  const card = document.createElement("div");
  card.className = "safety-card";

  card.append(
    h("div", { class: "safety-header" }, [
      h("div", { class: "safety-heart" }, "🤍"),
      h("h2", {}, "You are not alone"),
      h("button", { class: "safety-close", onclick: () => overlay.remove() }, "Close"),
    ])
  );

  if (reason === "auto-watch") {
    card.append(h("p", { class: "safety-intro" },
      "Some of what you wrote sounds heavy. I'm not going anywhere. Here's help, right now — on your terms."));
  } else if (reason === "auto-acute") {
    card.append(h("p", { class: "safety-intro" },
      "What you just wrote is making me pause. You matter. Please reach for help — you don't have to do this alone."));
  } else {
    card.append(h("p", { class: "safety-intro" },
      "Whatever brought you here, you made a good choice. Start with whichever option feels right."));
  }

  // 988 Crisis Lifeline — US first, 24/7, trained. ALWAYS visible.
  card.append(h("div", { class: "safety-primary" }, [
    h("div", { class: "safety-label" }, "Trained humans, 24/7, free"),
    h("h3", {}, "988 — Suicide & Crisis Lifeline"),
    h("p", {}, "Call or text 988. Someone trained to listen picks up. They will not send police unless you're in immediate physical danger and they can't reach you otherwise."),
    h("div", { class: "btn-row" }, [
      h("a", { class: "btn safety-primary-btn", href: "tel:988" }, "📞 Call 988"),
      h("a", { class: "btn safety-primary-btn", href: "sms:988" }, "💬 Text 988"),
      h("a", { class: "btn secondary", href: "https://988lifeline.org/chat/", target: "_blank", rel: "noopener" }, "Chat online"),
    ]),
  ]));

  // Crisis Text Line
  card.append(h("div", { class: "safety-secondary" }, [
    h("h3", {}, "Crisis Text Line"),
    h("p", {}, "Text HOME to 741741. Free. 24/7. Also trained."),
    h("div", { class: "btn-row" }, [
      h("a", { class: "btn secondary", href: "sms:741741?&body=HOME" }, "💬 Text HOME to 741741"),
    ]),
  ]));

  // Trusted person (if configured)
  if (hasTrusted) {
    card.append(h("div", { class: "safety-secondary" }, [
      h("h3", {}, `${net.trustedName || "Your person"}${net.trustedRelation ? " · " + net.trustedRelation : ""}`),
      h("p", {}, "Someone you chose to reach in a hard moment."),
      h("div", { class: "btn-row" }, [
        h("a", { class: "btn", href: `tel:${net.trustedPhone}` }, `📞 Call ${net.trustedName || "them"}`),
        h("a", { class: "btn secondary", href: `sms:${net.trustedPhone}?&body=${encodeURIComponent("Hey — I'm having a hard moment and I needed to reach out. Can you talk?")}` }, "💬 Text them"),
      ]),
    ]));
  } else {
    card.append(h("div", { class: "safety-secondary" }, [
      h("h3", {}, "Who can you call right now?"),
      h("p", {}, "Add a trusted person in Settings → Safety Net so they're one tap away next time."),
    ]));
  }

  // Scripture comfort
  card.append(h("div", { class: "safety-scripture" }, [
    h("div", { class: "safety-label" }, "From Scripture"),
    h("div", { class: "verse-ref" }, verse.ref),
    h("div", { class: "verse-text" }, `"${verse.text}"`),
  ]));

  // Gentle close
  card.append(h("p", { class: "safety-footer" },
    "You don't have to be okay to be loved. You are loved right now, exactly as you are."));

  overlay.append(card);
  document.body.append(overlay);
}

// Gentle, subtle banner that surfaces if a concerning phrase is detected
// WITHOUT being a full overlay. She can tap it to open the overlay, or
// dismiss it. Never blocks her from what she's doing.
export function showGentleCheckIn(level = "watch") {
  if (document.querySelector(".safety-checkin")) return;
  const banner = document.createElement("div");
  banner.className = "safety-checkin " + (level === "acute" ? "acute" : "");
  banner.innerHTML = `
    <div class="safety-checkin-text">
      ${level === "acute"
        ? "What you wrote sounded heavy. You're not alone — help is one tap away."
        : "Want me to check in with you? No pressure."}
    </div>
  `;
  const openBtn = h("button", { class: "btn small", onclick: () => { banner.remove(); showSafetyNet({ reason: "auto-" + level }); } }, "Yes");
  const dismissBtn = h("button", { class: "btn small secondary", onclick: () => banner.remove() }, "Not now");
  banner.append(openBtn, dismissBtn);
  document.body.append(banner);
  if (level !== "acute") setTimeout(() => banner.remove(), 30000);
}

// NOTE: a floating always-visible SOS button was removed deliberately.
// A persistent "help" button signals fragility; it's not the vibe. Crisis
// resources are surfaced two ways instead:
//   1. Auto: scanForConcerns() detects concerning phrases in her writing
//      and shows a dismissable gentle check-in banner (never intrusive,
//      never blocks her).
//   2. Intentional: she taps "Preview the help screen" from
//      Settings → Safety Net, OR any future in-context entry point.
// The crisis resources are THERE when she needs them — just not worn
// on the outside of the app.
