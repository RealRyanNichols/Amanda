import { state, save, uid } from "../store.js";
import { h, toast, confirmAction } from "../util.js";
import { currentBrand } from "../branding.js";
import { scanForConcerns, logConcern } from "../safety-net.js";
import { isPaid, isInTrial, brainMinutesLeftToday, creditBrainMinutes, hasActiveVoiceTopup } from "../plan.js";
import { showVoiceTopupPaywall, voiceStatusLine } from "../voice-topup.js";
import { contextualAnchor } from "../price-anchor.js";

// Claude API defaults — per claude-api skill guidance: default to Opus 4.7.
const MODEL_OPTIONS = [
  { value: "claude-opus-4-7",   label: "Claude Opus 4.7 (most capable)" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (balanced)" },
  { value: "claude-haiku-4-5",  label: "Claude Haiku 4.5 (fastest, cheapest)" },
];

// Relational tones — the Brain can be whoever she needs in the moment.
// Each tone modifies the system prompt; base context (her tools, brand,
// business) is always included regardless of tone.
export const TONES = [
  {
    key: "friend",
    label: "Best friend",
    emoji: "💛",
    tagline: "Casual, real-talk, been-there",
    prompt:
      "Be her best friend. Casual, warm, real. Drop the formality. Use her first name. Match the emotional register she brings in. Say things like 'girl' or 'sis' if it fits — but don't fake it. Share opinions when asked. Admit when something's hard. Laugh with her.",
  },
  {
    key: "mama-bear",
    label: "Mama bear",
    emoji: "🐻",
    tagline: "Nurturing, protective, fiercely kind",
    prompt:
      "Be the loving mother she may or may not have had. Deeply nurturing. Protective. Call her 'sweetheart' or 'honey'. Remind her she is loved and seen. Be gentle but strong when she's trying to push herself too hard. Tell her to drink water, eat, and rest when she needs it — without scolding.",
  },
  {
    key: "dad",
    label: "Strong dad",
    emoji: "👨",
    tagline: "Firm, principled, grounded",
    prompt:
      "Be the father figure who keeps her grounded. Warm but firm. Direct. Principled. Speak the truth kindly. Compliments mean something because they're earned. Call her 'kiddo' or by name. Hold her to her word when she slips. Proud of her for trying hard. Practical advice, no fluff.",
  },
  {
    key: "sister",
    label: "Big sister",
    emoji: "💕",
    tagline: "Wiser, real, a little teasing",
    prompt:
      "Be the wise big sister who's been there. Affectionate but no-nonsense. A little teasing is fine. Share real-life analogies. Say what needs saying. Not preachy. Celebrate her wins loudly. Call out her BS lovingly.",
  },
  {
    key: "tough-love",
    label: "Tough love coach",
    emoji: "💪",
    tagline: "Direct, no glossing, action-first",
    prompt:
      "Be a tough-love coach. Direct. Specific. No corporate hedging. No 'consider exploring'. Say 'you need to X'. NEVER pretend things are fine if they aren't. If she's losing money, say she's losing money. But stay kind — she's a human, not a spreadsheet. Every response ends with one concrete next action.",
  },
  {
    key: "teacher",
    label: "Teacher / mentor",
    emoji: "🧑‍🏫",
    tagline: "Patient, step-by-step, explains",
    prompt:
      "Be her patient mentor. Explain concepts step by step. Assume zero knowledge when helpful, and be willing to go deep when she wants. Use examples. Show your reasoning. Never condescend. When she's learning something new, break it into stages.",
  },
  {
    key: "cheerleader",
    label: "Cheerleader",
    emoji: "📣",
    tagline: "Expectant, motivational, eyes on the future",
    prompt:
      "Be her cheerleader. Spoken with expectancy — you see who she's becoming even when she can't. Name the wins, no matter how small. Picture the future with her: 'Imagine 90 days from now when...'. Never saccharine or fake. Celebrate grit, not just outcomes. End replies with a forward-looking 'Here's what's next' line.",
  },
  {
    key: "confidant",
    label: "Safe confidant",
    emoji: "🤍",
    tagline: "Listens first, reflects, no advice unless asked",
    prompt:
      "Be a safe confidant. Listen first. Reflect back what you're hearing. Don't rush to fix. Don't offer advice unless she asks — just witness. Hold space. Name her feelings gently. 'It sounds like you're carrying a lot right now' kind of language. If she asks for advice, give it; otherwise, just be there.",
  },
  {
    key: "spiritual",
    label: "Spiritual friend",
    emoji: "🙏",
    tagline: "Prays with her, biblical wisdom",
    prompt:
      "Be her spiritual friend. Christian grounded. Reference Scripture naturally when it fits — don't force it. Offer to pray WITH her, not AT her. Never preachy. Speak with quiet confidence in God's goodness, especially in hard seasons. Reference grace, rest, and being seen by God.",
  },
  {
    key: "child",
    label: "Childlike wonder",
    emoji: "🌱",
    tagline: "Pure, curious, unconditional",
    prompt:
      "Be like a child — curious, joyful, unconditional. Marvel at small things. Ask 'why' and 'what if' with genuine curiosity. No judgment, ever. Remind her that being loved doesn't require earning it. If you learn something new together, be excited about it.",
  },
];

export function toneByKey(key) {
  return TONES.find((t) => t.key === key) || TONES[0];
}

const LOCAL_FAQ = [
  {
    match: /(safe.*spend|how much.*spend|spend this week)/i,
    answer:
      "On the **Income** tab, I show a 'Safe this week' number. It's your estimated weekly income (from your recent deposits) minus bills due in the next 7 days, minus a small buffer for priority-1 bills due in 14 days. Tap 'Income' to see your number right now.",
  },
  {
    match: /(overdue|behind on rent|falling behind|past due)/i,
    answer:
      "The app watches for bills past due and flags them on Home. If you have any, handle them before discretionary spending. Open **Income** → any bill with 'overdue' is the first stop. You can mark it paid once you pay it.",
  },
  {
    match: /(book|deposit|reschedule|appointment)/i,
    answer:
      "In **Booking** you can require a deposit up front, record partial payments, and reschedule without losing the deposit. 'Auto follow-up' shows past appointments that still owe money so you can text them a reminder with one tap.",
  },
  {
    match: /(lead|hot lead|cold lead|follow up|script)/i,
    answer:
      "**Leads** has hot/warm/cold tagging with automatic next-contact dates. Tap 'Script' on a lead and the app writes you a ready-to-send text based on their temperature and interest. 'Hot' = reach out tomorrow, 'Warm' = 3 days, 'Cold' = 2 weeks.",
  },
  {
    match: /(student|cohort|attendance|rda|dental assist)/i,
    answer:
      "**Academy** tracks cohorts and students. Per-student you've got hours (classroom/clinical/externship), tuition paid progress, a Texas RDA readiness checklist, and daily attendance. Grad-ready means every required item is checked.",
  },
  {
    match: /(kajabi|course|module|lesson)/i,
    answer:
      "In **Academy → Course** I've seeded a full Texas RDA online course outline — 11 modules, ~45 lessons. Edit any lesson, then tap 'Copy for Kajabi' and paste straight into your Kajabi lesson blocks.",
  },
  {
    match: /(overwhelm|stress|too much|don'?t know where to start)/i,
    answer:
      "Open **Organize**. Dump everything in the textarea, tap 'Organize', and I'll sort it into Now / Today / This Week / Later / Feelings. The 'Handle this first' card shows the one thing to do next. You don't have to see it all at once.",
  },
  {
    match: /(export|backup|download|save my data)/i,
    answer:
      "Footer → **Export**. It downloads a JSON file with everything. **Import** on a new device restores it. Your data lives in this browser's storage — I never send it anywhere.",
  },
  {
    match: /(pin|password|lock|reset pin)/i,
    answer:
      "Footer → **PIN** to set, change, or remove the lock PIN. Forgot it? Tap 'Forgot PIN?' on the lock screen — we clear the PIN (your data stays).",
  },
];

function localAnswer(question) {
  const q = question.trim();
  for (const f of LOCAL_FAQ) if (f.match.test(q)) return f.answer;

  // Fallback: search user's data for the question text
  const hits = searchData(q);
  if (hits.length) {
    return `Looking through what you've saved, I found:\n\n${hits.slice(0, 5).map((h) => `- ${h}`).join("\n")}`;
  }

  return [
    "I can answer best with a Claude key connected (Settings → Brain). Without one, I do the following locally:",
    "- Explain any tool (try: *how does the safe-to-spend number work?*)",
    "- Search your saved data (try: *show me hot leads* or *who owes me money?*)",
    "- Help you decide what to do first (try: *I feel overwhelmed*)",
  ].join("\n");
}

function searchData(q) {
  const needle = q.toLowerCase();
  const hits = [];
  // Leads
  for (const l of state.followup.leads) {
    if ((l.name + " " + l.interest + " " + l.notes).toLowerCase().includes(needle)) {
      hits.push(`Lead · ${l.name} (${l.temperature})${l.interest ? " — " + l.interest : ""}`);
    }
  }
  // Appointments
  for (const a of state.booking.appointments) {
    if ((a.client + " " + a.service).toLowerCase().includes(needle)) {
      hits.push(`Booking · ${a.client}${a.service ? " — " + a.service : ""} on ${a.date}`);
    }
  }
  // Students
  for (const s of state.academy.students) {
    if ((s.firstName + " " + s.lastName + " " + s.email).toLowerCase().includes(needle)) {
      hits.push(`Student · ${s.firstName} ${s.lastName}`);
    }
  }
  // Tasks
  for (const t of state.overload.tasks) {
    if (t.text.toLowerCase().includes(needle)) hits.push(`Task · ${t.text}`);
  }
  return hits;
}

function systemPrompt(toneKeyOverride) {
  const b = currentBrand();
  const first = state.profile.firstName || "there";
  const business = b.business?.name || state.profile.businessName || "";
  const pda = b.business ? `${b.business.name} in ${b.business.city} at ${b.business.address}. Phone ${b.business.phone}. Program: ${b.business.program?.name} (${b.business.program?.weeks} weeks).` : "";
  const toneKey = toneKeyOverride || state.brain?.tone || "friend";
  const tone = toneByKey(toneKey);
  const partner = state.profile?.partnerName || "";
  const babyName = state.life?.pregnancy?.babyName || "";

  // Heart / relationship context. We pass her self-reported status so the
  // Brain can meet her where she is — peaceful singleness, open, getting
  // to know someone, in a relationship, or in a complicated place. Never
  // assume marriage is the goal.
  const heartStatus = state.life?.heart?.status || "";
  const relationshipContext = heartStatus && heartStatus !== "private"
    ? {
        "peace": "She is single and at peace with it. Do not push her toward dating. Affirm her as a complete mom.",
        "open": "She is single and open to the right partner — not hunting. Do not create urgency. Offer clarity, not pressure.",
        "getting-to-know": "She is getting to know someone new. Bias toward observation and questions, not verdicts.",
        "together": "She is in a relationship. Support her in strengthening it; do not tell her to stay or leave.",
        "complicated": "Her relationship situation is complicated. Sit with her. Prioritize her safety. Never push her one way — ask good questions and offer Scripture only when invited.",
      }[heartStatus] || ""
    : "";

  return [
    `You are "The Brain" — an AI embedded in ${first}'s personal toolkit app. You adapt your relational tone to how she needs support right now.`,
    `CURRENT TONE: ${tone.label} — ${tone.tagline}.`,
    `TONE INSTRUCTIONS: ${tone.prompt}`,
    partner ? `Her partner's name is ${partner}.` : "",
    babyName ? `Her baby is named ${babyName}.` : (state.life?.pregnancy?.dueDate ? "She's pregnant." : ""),
    business ? `${first} runs ${business}. ${pda}` : "",
    "The app has these tools: Home, Mommy (analytics), Brain, Calendar, Bible reader, Income, Booking, Academy, Meals/Grocery, Organize, Leads, Social (caption writer + reel studio + planner), Life (Faith/Family/Pregnancy/Heart/Love/Gratitude), Habits, Vault, Baby Year, Store, Settings.",
    "CORE AUDIENCE: Moms. Any stage — pregnant, postpartum, toddler-chasing, teens at home — who want a better walk with Jesus, a steadier home, and a faith that's real. Never assume she's pregnant; never assume she's married; never assume she's single. Let her tell you.",
    "Skip preamble. Don't explain that you're an AI. Don't moralize. If she's overwhelmed, name ONE next step — not five.",
    relationshipContext,
    "RELATIONSHIP GUIDANCE: If she asks about a man — current, prospective, or the father of her child — lean on biblical character principles (integrity, faithfulness, love-as-service, leadership without domination, self-control, peaceable, honest, teachable, honoring of his mother, seeks God). Offer questions more than verdicts. Never tell her to stay or leave — that's hers. If she describes harm, threats, control, or fear, gently surface the National Domestic Violence Hotline (1-800-799-7233, text START to 88788) alongside anything else.",
    "SINGLE MOM POSTURE: Single motherhood is honored in Scripture (Hagar, Naomi and Ruth, Hannah, the widow of Zarephath, Lois and Eunice). Never imply she's behind schedule or broken. She is a complete family with her child.",
    "If she asks about her data, remind her you only know what she tells you here — you don't auto-scan her app data for privacy reasons.",
    "Texas RDA regulatory specifics: always add 'verify with TSBDE'.",
    "No diagnoses. No medical/legal/tax advice masquerading as certainty. Refer to professionals for those.",
  ].filter(Boolean).join("\n\n");
}

function buildDataContext() {
  if (!state.brain?.shareData) return "";
  const lines = [];
  const inc = state.income;
  if (inc) {
    const unpaid = (inc.bills || []).filter((b) => !b.paid);
    lines.push(`Income: ${inc.deposits?.length || 0} deposits logged, ${unpaid.length} unpaid bills totaling $${unpaid.reduce((s, b) => s + Number(b.amount || 0), 0).toFixed(0)}.`);
  }
  const leads = (state.followup?.leads || []).filter((l) => !l.closed);
  if (leads.length) {
    lines.push(`Leads: ${leads.length} open (${leads.filter((l) => l.temperature === "hot").length} hot).`);
  }
  if (state.booking?.appointments?.length) {
    const active = state.booking.appointments.filter((a) => !a.cancelled);
    lines.push(`Booking: ${active.length} appointments.`);
  }
  if (state.academy?.students?.length) {
    lines.push(`Academy: ${state.academy.students.length} students across ${state.academy.programs?.length || 0} cohorts.`);
  }
  const openTasks = (state.overload?.tasks || []).filter((t) => !t.done);
  if (openTasks.length) lines.push(`Organize: ${openTasks.length} open tasks.`);
  if (state.life?.pregnancy?.dueDate) {
    const weeks = Math.max(0, Math.floor((Date.now() - (new Date(state.life.pregnancy.dueDate + "T00:00:00").getTime() - 280 * 86400000)) / (7 * 86400000)));
    lines.push(`Pregnancy: ~${weeks} weeks along, due ${state.life.pregnancy.dueDate}${state.life.pregnancy.babyName ? ", baby's name " + state.life.pregnancy.babyName : ""}.`);
  }
  return lines.length ? "\n\nHER CURRENT STATS (she opted in to share): " + lines.join(" ") : "";
}

export async function callClaude(userText, opts = {}) {
  const cfg = state.brain;
  if (!cfg.apiKey) throw new Error("No API key configured");

  const base = opts.systemOverride || systemPrompt(opts.tone);
  const dataCtx = buildDataContext();

  const body = {
    model: cfg.model || "claude-opus-4-7",
    max_tokens: opts.maxTokens || 1500,
    system: [
      { type: "text", text: base + dataCtx, cache_control: { type: "ephemeral" } },
    ],
    messages: opts.messages || [
      ...cfg.history.slice(-10).map((m) => ({ role: m.role, content: m.text })),
      { role: "user", content: userText },
    ],
  };

  // Adaptive thinking on Opus 4.7 / 4.6 / Sonnet 4.6 per claude-api skill.
  if (/opus-4-7|opus-4-6|sonnet-4-6/.test(body.model)) {
    body.thinking = { type: "adaptive" };
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    let msg = `Claude API error (${res.status})`;
    try {
      const parsed = JSON.parse(err);
      if (parsed?.error?.message) msg = parsed.error.message;
    } catch {}
    if (res.status === 401) msg = "That API key didn't work. Check Settings → Brain.";
    if (res.status === 429) msg = "Claude rate-limited. Try again in a moment.";
    throw new Error(msg);
  }

  const data = await res.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  return textBlock?.text || "(no response)";
}

function renderHeader(rerender) {
  const hasKey = !!state.brain.apiKey;
  const currentTone = toneByKey(state.brain?.tone || "friend");
  const toneOpen = !!state.brain?.toneMenuOpen;

  // Compact header — just product identity + one-line status.
  // The tone picker (10+ options) is tucked behind a single chip to
  // eliminate the old "wall of emoji boxes at the top" feeling.
  const card = h("section", { class: "card ember-header" }, [
    h("div", { class: "ember-header-row" }, [
      h("div", { class: "ember-title" }, [
        h("span", { class: "ember-spark" }, "✨"),
        h("span", {}, "Gideon"),
      ]),
      h("button", {
        class: "chip ember-tone-chip",
        onclick: () => {
          state.brain.toneMenuOpen = !toneOpen;
          save();
          rerender();
        },
      }, `${currentTone.emoji} ${currentTone.label} ▾`),
    ]),
    h("div", { class: "sub" },
      hasKey
        ? "Your curated wisdom layer, tuned to you. Ask anything."
        : "Running in local mode. Connect Claude in Settings to unlock full Gideon."),
  ]);

  // Voice minute status: active top-up OR daily-limit remaining on free tier
  const topupStatus = voiceStatusLine();
  if (topupStatus) {
    card.append(h("div", { class: "alert ok", style: "margin-top:10px" }, topupStatus));
  } else if (!isPaid() && !isInTrial()) {
    const mins = brainMinutesLeftToday();
    const anchor = contextualAnchor();
    const msg = mins > 0
      ? `🎙️ ${mins} free voice minute${mins === 1 ? "" : "s"} left today`
      : `🎙️ Out of free voice for today · another 24hr for $1.99 — ${anchor}`;
    card.append(h("div", { class: "alert" + (mins === 0 ? " warn" : ""), style: "margin-top:10px; display:flex; justify-content:space-between; align-items:center; gap:8px" }, [
      h("span", {}, msg),
      mins === 0 && h("button", {
        class: "btn small",
        onclick: () => showVoiceTopupPaywall({ onClose: rerender }),
      }, "Keep talking →"),
    ]));
  }

  // Tone picker — only rendered when the chip is expanded. Keeps the
  // primary screen uncluttered.
  if (toneOpen) {
    card.append(h("div", { class: "tone-expand" }, [
      h("div", { class: "sub", style: "margin-bottom:8px" },
        "Pick how you want me to show up. You can change this any time."),
      (() => {
        const toneGrid = h("div", { class: "tone-grid" });
        TONES.forEach((t) => {
          toneGrid.append(h("button", {
            class: "tone-btn" + ((state.brain?.tone || "friend") === t.key ? " active" : ""),
            onclick: () => {
              state.brain.tone = t.key;
              state.brain.toneMenuOpen = false; // collapse after choosing
              save();
              rerender();
            },
          }, [
            h("div", { class: "tone-emoji" }, t.emoji),
            h("div", { class: "tone-name" }, t.label),
          ]));
        });
        return toneGrid;
      })(),
      h("div", { class: "tone-tagline" }, currentTone.tagline),
    ]));
  }

  return card;
}

function renderChat(rerender) {
  const card = h("section", { class: "card" });
  card.append(h("div", { class: "chat-log" }, (state.brain.history || []).map(renderBubble)));

  const form = h("form", {
    class: "chat-form",
    onsubmit: async (e) => {
      e.preventDefault();
      const input = form.querySelector("textarea");
      const text = input.value.trim();
      if (!text) return;

      // Voice-time gate: free tier gets 5 min/day. When out, show top-up paywall.
      if (!isPaid() && !isInTrial() && !hasActiveVoiceTopup() && brainMinutesLeftToday() <= 0) {
        showVoiceTopupPaywall({ onClose: rerender });
        return;
      }
      // Credit a rough cost per exchange (estimate: 30 seconds of voice / typed message)
      creditBrainMinutes(0.5);

      state.brain.history.push({ id: uid(), role: "user", text, at: Date.now() });
      save();
      input.value = "";
      rerender();

      // Safety Net: silent scan + log. No banner, no accusation. Claude's
      // reply will naturally include caring language if the content is
      // heavy. Back-channel alerting is server-side only (desktop phase).
      const concern = scanForConcerns(text);
      if (concern.level !== "none") logConcern({ source: "brain", text, level: concern.level });

      if (state.brain.apiKey) {
        state.brain.history.push({ id: uid(), role: "assistant", text: "…thinking…", pending: true, at: Date.now() });
        save(); rerender();
        try {
          const reply = await callClaude(text);
          const last = state.brain.history[state.brain.history.length - 1];
          last.text = reply; delete last.pending; save(); rerender();
        } catch (err) {
          const last = state.brain.history[state.brain.history.length - 1];
          last.text = `Hmm — ${err.message}`; delete last.pending; save(); rerender();
        }
      } else {
        const answer = localAnswer(text);
        state.brain.history.push({ id: uid(), role: "assistant", text: answer, at: Date.now() });
        save(); rerender();
      }
    },
  }, [
    h("textarea", { placeholder: "Ask me anything about your day, your business, or this app.", rows: "2" }),
    h("button", { class: "btn", type: "submit" }, "Ask"),
  ]);
  card.append(form);

  if ((state.brain.history || []).length) {
    card.append(h("div", { class: "btn-row", style: "margin-top:8px" }, [
      h("button", {
        class: "btn small secondary",
        onclick: () => { if (!confirmAction("Clear chat history?")) return; state.brain.history = []; save(); rerender(); },
      }, "Clear chat"),
    ]));
  }

  return card;
}

function renderBubble(m) {
  return h("div", { class: "chat-bubble " + (m.role === "user" ? "user" : "assistant") + (m.pending ? " pending" : "") }, [
    h("div", { class: "chat-text" }, formatMarkdown(m.text || "")),
  ]);
}

// tiny safe markdown: escape HTML then re-apply bold/italic/code/newlines.
function formatMarkdown(s) {
  const escape = (t) => t.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
  let html = escape(s);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\n/g, "<br>");
  const frag = h("span", { html });
  return frag;
}

function renderStarters(rerender) {
  const suggestions = [
    "I'm overwhelmed — what should I do first?",
    "Who owes me money right now?",
    "How do I use the course export with Kajabi?",
    "What's my safe-to-spend math based on?",
  ];
  return h("section", { class: "card" }, [
    h("h2", {}, "Not sure what to ask?"),
    h("div", { class: "chip-row" },
      suggestions.map((s) =>
        h("button", { class: "chip", onclick: () => quickAsk(s, rerender) }, s)
      )),
  ]);
}

function quickAsk(text, rerender) {
  const form = document.querySelector(".chat-form textarea");
  if (form) form.value = text;
  const f = document.querySelector(".chat-form");
  if (f) f.requestSubmit();
}

export function renderBrain(mount, { rerender }) {
  mount.append(renderHeader(rerender));
  mount.append(renderVentModeCard(rerender));
  mount.append(renderWishesCard(rerender));
  mount.append(renderChat(rerender));
  if (!(state.brain.history || []).length) mount.append(renderStarters(rerender));
}

function renderWishesCard(rerender) {
  const wishes = state.wishes || [];
  const card = h("section", { class: "card wishes-card" }, [
    h("h2", {}, "✨ What do you actually want?"),
    h("div", { class: "sub" }, "The things you don't say out loud. Dreams. Fears. Quiet hopes. Write them down; we'll help you move toward them."),
  ]);

  const form = h("form", { class: "form-row", onsubmit: (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const text = (f.get("text") || "").toString().trim();
    const kind = (f.get("kind") || "wish").toString();
    if (!text) return;
    if (!state.wishes) state.wishes = [];
    state.wishes.unshift({
      id: uid(),
      text,
      kind,
      notes: "",
      createdAt: Date.now(),
    });
    save();
    toast("Saved. We'll come back to it.");
    e.target.reset();
    rerender();
  } }, [
    h("label", { class: "field" }, [
      "What's on your heart?",
      h("textarea", { name: "text", rows: "3", placeholder: "It's okay to start with 'I don't even know, but…'" }),
    ]),
    h("label", { class: "field" }, [
      "What kind of thing is it?",
      h("select", { name: "kind" }, [
        h("option", { value: "wish" }, "Wish — something I want"),
        h("option", { value: "desire" }, "Desire — something I ache for"),
        h("option", { value: "fear" }, "Fear — something I'm scared to say"),
        h("option", { value: "goal" }, "Goal — something I'm going to do"),
      ]),
    ]),
    h("div", { class: "btn-row" }, [h("button", { class: "btn", type: "submit" }, "Save it")]),
  ]);
  card.append(form);

  if (wishes.length) {
    const list = h("div", { class: "list", style: "margin-top:10px" });
    wishes.slice(0, 8).forEach((w) => {
      const kindLabel = { wish: "wish", desire: "desire", fear: "fear", goal: "goal" }[w.kind] || "wish";
      list.append(h("div", { class: "item" }, [
        h("div", {}, [
          h("div", { class: "title" }, [
            h("span", { class: "pill " + (w.kind === "fear" ? "urgent" : w.kind === "goal" ? "paid" : w.kind === "desire" ? "hot" : "") }, kindLabel),
            " " + w.text,
          ]),
          h("div", { class: "meta" }, friendlyDate(new Date(w.createdAt).toISOString().slice(0, 10))),
        ]),
        h("div", { class: "actions" }, [
          state.brain?.apiKey && h("button", {
            class: "btn small",
            onclick: () => askBrainAboutWish(w, rerender),
          }, "Help me"),
          h("button", {
            class: "btn small danger",
            onclick: () => {
              if (!confirmAction("Remove this?")) return;
              state.wishes = state.wishes.filter((x) => x.id !== w.id);
              save(); rerender();
            },
          }, "×"),
        ]),
      ]));
    });
    card.append(list);
  }

  return card;
}

function askBrainAboutWish(wish, rerender) {
  state.brain = state.brain || { history: [] };
  state.brain.history = state.brain.history || [];
  const prompt = wish.kind === "fear"
    ? `I wrote down something I'm scared to say out loud: "${wish.text}". Help me look at it — not fix it, just look at it with me first.`
    : wish.kind === "goal"
    ? `I set a goal for myself: "${wish.text}". Help me break it into the smallest next step I could take this week.`
    : `I wrote down something I want: "${wish.text}". Is there anything I could do — even tiny — to move toward it? What's one small true thing I can try?`;
  state.brain.history.push({ id: uid(), role: "user", text: prompt, at: Date.now() });
  save();
  rerender();
  // Scroll to chat
  setTimeout(() => {
    const log = document.querySelector(".chat-log");
    if (log) log.scrollIntoView({ behavior: "smooth", block: "end" });
  }, 100);
}

function renderVentModeCard(rerender) {
  return h("section", { class: "card vent-card" }, [
    h("h2", {}, "🫂 Vent Mode"),
    h("div", { class: "sub" }, "Hold the mic. Pour it all out. Yell if you want to. I'll listen, then reflect back what I heard."),
    h("div", { class: "btn-row" }, [
      h("button", {
        class: "btn",
        onclick: () => openVentMode(),
      }, "Start venting →"),
    ]),
  ]);
}

/* ---------- VENT MODE ---------- */

function openVentMode() {
  const overlay = document.createElement("div");
  overlay.className = "vent-overlay";
  document.body.append(overlay);

  let stage = "intro"; // intro → recording → summary
  let transcript = "";

  function render() {
    overlay.innerHTML = "";
    const inner = h("div", { class: "vent-inner" });
    overlay.append(inner);

    if (stage === "intro") renderIntro(inner);
    else if (stage === "recording") renderRecording(inner);
    else if (stage === "summary") renderSummary(inner);
  }

  function renderIntro(mount) {
    mount.append(h("button", { class: "vent-close", onclick: () => overlay.remove() }, "×"));
    mount.append(h("div", { class: "vent-hero" }, [
      h("div", { class: "vent-emoji" }, "🫂"),
      h("h1", {}, "Vent Mode"),
      h("p", {}, "You know how good it feels to just say everything out loud? Do that now."),
      h("p", { class: "vent-sub" }, "Tap the mic. Talk for as long as you want. Yell, cry, ramble, trail off — doesn't matter. When you're done, tap stop. I'll reflect back what I heard and gently name what stood out."),
      h("div", { class: "btn-row", style: "justify-content:center; margin-top:20px" }, [
        h("button", {
          class: "btn vent-big-btn",
          onclick: () => { stage = "recording"; render(); },
        }, "🎙️ I'm ready"),
      ]),
    ]));
  }

  function renderRecording(mount) {
    mount.append(h("button", { class: "vent-close", onclick: () => overlay.remove() }, "×"));
    const ta = h("textarea", {
      class: "vent-textarea",
      placeholder: "Your words will appear here as you talk…",
    });

    // Build our own recording UI instead of the small mic button
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let listening = false;
    let committed = "";
    let elapsed = 0;
    let timer = null;

    const statusEl = h("div", { class: "vent-status" }, "Tap to start talking");
    const timerEl = h("div", { class: "vent-timer" }, "00:00");
    const bigBtn = h("button", { class: "vent-mic" }, "🎙️");

    function tick() {
      elapsed++;
      const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
      const s = String(elapsed % 60).padStart(2, "0");
      timerEl.textContent = `${m}:${s}`;
    }

    function start() {
      if (listening) return;
      if (!Rec) {
        statusEl.textContent = "Your browser doesn't support voice. Type it all instead.";
        return;
      }
      recognition = new Rec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      committed = ta.value;

      recognition.onresult = (e) => {
        let interim = "";
        let final = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript;
          else interim += e.results[i][0].transcript;
        }
        if (final) committed = (committed + " " + final.trim()).trim();
        ta.value = committed + (interim ? " " + interim : "");
      };
      recognition.onerror = (e) => {
        if (e.error === "not-allowed") {
          statusEl.textContent = "Mic blocked. Allow access in your browser.";
        }
        stop();
      };
      recognition.onend = () => {
        listening = false;
        bigBtn.classList.remove("rec");
        statusEl.textContent = "Paused. Tap mic to keep going.";
        ta.value = committed;
      };

      try {
        recognition.start();
        listening = true;
        bigBtn.classList.add("rec");
        statusEl.textContent = "Listening. Keep going.";
        if (!timer) timer = setInterval(tick, 1000);
      } catch {}
    }

    function stop() {
      if (listening && recognition) {
        try { recognition.stop(); } catch {}
      }
    }

    bigBtn.addEventListener("click", () => {
      if (listening) stop();
      else start();
    });

    mount.append(h("div", { class: "vent-hero" }, [
      bigBtn,
      statusEl,
      timerEl,
      ta,
      h("div", { class: "btn-row", style: "justify-content:center; margin-top:12px; flex-wrap:wrap; gap:8px" }, [
        h("button", {
          class: "btn secondary",
          onclick: () => {
            stop();
            if (timer) { clearInterval(timer); timer = null; }
            stage = "intro";
            render();
          },
        }, "Back"),
        h("button", {
          class: "btn",
          onclick: () => {
            stop();
            if (timer) { clearInterval(timer); timer = null; }
            transcript = (committed || ta.value || "").trim();
            if (!transcript) { statusEl.textContent = "I didn't catch any words yet — keep going."; return; }
            // Safety Net: silent log only. No banner. She vented — respect that.
            const concern = scanForConcerns(transcript);
            if (concern.level !== "none") logConcern({ source: "vent", text: transcript, level: concern.level });
            stage = "summary";
            render();
          },
        }, "I'm done · reflect back"),
      ]),
    ]));
  }

  function renderSummary(mount) {
    mount.append(h("button", { class: "vent-close", onclick: () => overlay.remove() }, "×"));

    const result = h("div", { class: "vent-reflection" });
    mount.append(h("div", { class: "vent-hero" }, [
      h("h1", {}, "Here's what I heard"),
      h("div", { class: "vent-transcript" }, transcript),
      result,
      h("div", { class: "btn-row", style: "justify-content:center; margin-top:12px" }, [
        h("button", { class: "btn secondary", onclick: () => overlay.remove() }, "Done"),
        h("button", {
          class: "btn",
          onclick: () => {
            if (!state.brain.apiKey) {
              alert("Connect your Claude key in Settings → Brain for AI reflection. You can still save the transcript below.");
              return;
            }
            reflectOnVent(transcript, result);
          },
        }, "Get AI reflection"),
        h("button", {
          class: "btn secondary",
          onclick: () => {
            const blob = new Blob([transcript], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `vent-${new Date().toISOString().slice(0, 10)}.txt`;
            a.click();
            URL.revokeObjectURL(url);
          },
        }, "Save transcript"),
      ]),
    ]));

    if (state.brain.apiKey) reflectOnVent(transcript, result);
  }

  render();
}

async function reflectOnVent(transcript, resultEl) {
  resultEl.innerHTML = "";
  resultEl.append(h("div", { class: "meta" }, "Listening to what you said…"));

  const first = state.profile?.firstName || "you";
  const system =
    `You just listened to ${first} vent. She used push-to-talk, so this is a raw, unfiltered dump of what's going on for her right now. ` +
    "Your job: reflect back what you heard like a wise friend who was actually listening. Don't solve. Don't minimize. Don't moralize. " +
    "Return 4 sections in this order, each with a short heading (bold markdown) and 2-4 sentences underneath:\n\n" +
    "**What I heard you say** — the core themes you noticed, in her own words where possible.\n" +
    "**What stood out** — the one thing that seems to be weighing heaviest, or the contradiction she may not see.\n" +
    "**Where you're right** — the places her instincts sound sound. Back her up.\n" +
    "**A gentle pushback** — the place where she might be being unfair to herself, or avoiding something. Kind but honest. Skip this section if there isn't one.\n\n" +
    "End with one single line: 'Do you want to keep talking?' — nothing else after that. No follow-up questions. No 'I'm here for you'. Just that one question.";

  try {
    const text = await callClaude(transcript, {
      systemOverride: system,
      maxTokens: 1500,
      messages: [{ role: "user", content: transcript }],
    });
    resultEl.innerHTML = "";
    const frag = document.createElement("div");
    frag.innerHTML = text
      .replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
    resultEl.append(frag);
  } catch (err) {
    resultEl.innerHTML = "";
    resultEl.append(h("div", { class: "alert bad" }, err.message || "Couldn't get reflection"));
  }
}

async function callClaudeRaw(body) {
  const cfg = state.brain;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const data = await res.json();
  const textBlock = (data.content || []).find((x) => x.type === "text");
  return textBlock?.text || "";
}

export { MODEL_OPTIONS };
