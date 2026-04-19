// Safety Net — re-designed per Ryan's directive:
//
// (1) SILENT monitoring. We scan her writing for concerning phrases but
//     DON'T pop up a "want to check in?" banner. Mom venting deserves to
//     vent freely. Accusing her for hyperbole would shut her down.
//
// (2) Log flagged items locally (state.safetyNet.flagged[]).
//
// (3) If Claude is connected, silently classify intent: VENTING (hyperbole,
//     exhaustion, rhetorical) vs DISTRESS (emotional pain, needs support)
//     vs CRISIS (specific plan, means, timing — real danger).
//
// (4) Only on CRISIS verdict do we back-channel alert (founder + security
//     ops + significant other with screenshot). That's backend-only —
//     spec'd in DESKTOP_HANDOFF §20. Client-side we log and wait.
//
// (5) The 988 + trusted person + Scripture overlay is STILL available —
//     via Settings "Preview the help screen" OR when she intentionally
//     chooses to open it. It's just not forced on her.
//
// This preserves her autonomy, doesn't stigmatize, doesn't accuse, but
// keeps the hooks ready for the backend to act on genuine emergencies.

import { state, save, uid } from "./store.js";
import { h } from "./util.js";

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

/**
 * Silently note that a concerning phrase was detected. Stores locally; if
 * Claude key is set, runs an intent classifier in the background that
 * labels it venting/distress/crisis. Real back-channel alerting happens
 * server-side when that's built — see DESKTOP_HANDOFF §20.
 */
export function logConcern({ source, text, level }) {
  if (!state.safetyNet) state.safetyNet = { flagged: [] };
  if (state.safetyNet.silentMonitoring === false) return; // user opted out

  const record = {
    id: uid(),
    source,              // 'brain' | 'vent' | 'overload' | other
    text: text.slice(0, 500), // cap so we don't inflate storage
    level,               // 'watch' | 'acute' — the raw regex result
    intent: null,        // filled by classifier
    confidence: null,
    reasoning: "",
    at: Date.now(),
  };
  state.safetyNet.flagged = state.safetyNet.flagged || [];
  state.safetyNet.flagged.push(record);
  // Cap at 200 flagged events
  if (state.safetyNet.flagged.length > 200) {
    state.safetyNet.flagged = state.safetyNet.flagged.slice(-200);
  }
  save();

  // Fire-and-forget classifier (silent, non-blocking)
  if (state.brain?.apiKey) {
    classifyIntent(record).catch(() => {});
  }
}

async function classifyIntent(record) {
  const body = {
    // Use Sonnet 4.6 or whatever she's on; classifier is fine on any tier
    model: state.brain?.model || "claude-opus-4-7",
    max_tokens: 400,
    system: [{ type: "text", text:
      "You are a careful, compassionate intent classifier. A mom wrote something " +
      "that triggered a keyword scan. Your job: tell the difference between " +
      "VENTING (hyperbole, exhaustion, rhetorical frustration — 'I could kill " +
      "those kids', 'I can't do this anymore', 'I want to die' said about a " +
      "bad day) vs DISTRESS (real emotional pain, needs support, but no " +
      "specific plan or means) vs CRISIS (specific plan OR specific means OR " +
      "specific timing OR clear stated intent to act).\n\n" +
      "Err on the side of VENTING unless there's clear evidence otherwise. " +
      "An exhausted mother deserves to vent without being accused.\n\n" +
      "Return ONLY valid JSON: " +
      `{"intent":"venting"|"distress"|"crisis","confidence":0-1,"reasoning":"<one short sentence>"}`,
    cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: record.text }],
  };
  if (/opus-4-7|opus-4-6|sonnet-4-6/.test(body.model)) body.thinking = { type: "adaptive" };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": state.brain.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return;
  const data = await res.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  const raw = textBlock?.text || "{}";
  const s = raw.indexOf("{"); const e = raw.lastIndexOf("}");
  try {
    const parsed = JSON.parse(s >= 0 && e > s ? raw.slice(s, e + 1) : raw);
    record.intent = parsed.intent;
    record.confidence = parsed.confidence;
    record.reasoning = parsed.reasoning || "";
    save();
    // NOTE: back-channel alerting on 'crisis' requires backend. Desktop phase.
    // When backend exists: if intent === 'crisis' AND confidence >= 0.7 →
    // POST to /api/crisis-alert with the record + user_id. Backend handles
    // notifying founder + security ops + significant other per the
    // DESKTOP_HANDOFF §20 spec.
  } catch {}
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
 * She intentionally opens the help screen (from Settings "Preview" or
 * any future in-context entry point). This is always available — just
 * not pushed on her.
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

  card.append(h("p", { class: "safety-intro" },
    "Whatever brought you here, you made a good choice. Start with whichever option feels right."));

  // 988 Crisis Lifeline
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

  card.append(h("p", { class: "safety-footer" },
    "You don't have to be okay to be loved. You are loved right now, exactly as you are."));

  overlay.append(card);
  document.body.append(overlay);
}

// NOTE: a floating always-visible SOS button was removed deliberately.
// A persistent "help" button signals fragility; it's not the vibe. Crisis
// resources are surfaced two ways instead:
//   1. The user intentionally opens Settings → Safety Net → Preview.
//   2. Backend-triggered back-channel alerting (see DESKTOP_HANDOFF §20)
//      when the intent classifier determines real CRISIS — notifies
//      founder + security ops + significant other, NOT her.
