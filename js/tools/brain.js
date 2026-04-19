import { state, save, uid } from "../store.js";
import { h, toast, confirmAction } from "../util.js";
import { currentBrand } from "../branding.js";

// Claude API defaults — per claude-api skill guidance: default to Opus 4.7.
const MODEL_OPTIONS = [
  { value: "claude-opus-4-7",   label: "Claude Opus 4.7 (most capable)" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (balanced)" },
  { value: "claude-haiku-4-5",  label: "Claude Haiku 4.5 (fastest, cheapest)" },
];

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

function systemPrompt() {
  const b = currentBrand();
  const first = state.profile.firstName || "there";
  const business = b.business?.name || state.profile.businessName || "";
  const pda = b.business ? `${b.business.name} in ${b.business.city} at ${b.business.address}. Phone ${b.business.phone}. Program: ${b.business.program?.name} (${b.business.program?.weeks} weeks).` : "";

  return [
    `You are "The Brain" — a warm, practical assistant embedded inside ${first}'s personal toolkit app.`,
    business ? `${first} runs ${business}. ${pda}` : "",
    "The app has these tools: Home (overview), Income (deposits + bills + safe-to-spend), Booking (appointments with deposits), Academy (students, cohorts, Texas RDA readiness, online course authoring), Career (trade pathways), Organize (brain-dump + triage), Leads (hot/warm/cold CRM), Life (faith, family, pregnancy, love notes, gratitude).",
    "Style: tight, kind, concrete. Skip preamble. If she's overwhelmed, name one next step — don't list five.",
    "If she asks about her data (leads, bills, students), remind her that you only know what she tells you in this chat unless she pastes it in — you do not have direct access to her app data for privacy reasons.",
    "If she asks for Texas dental-assisting regulatory specifics, always add 'verify with the Texas State Board of Dental Examiners' — rules change.",
    "No diagnoses. No medical, legal, or tax advice masquerading as certainty. Refer her to a professional for those.",
  ].filter(Boolean).join("\n\n");
}

async function callClaude(userText) {
  const cfg = state.brain;
  if (!cfg.apiKey) throw new Error("No API key configured");

  const body = {
    model: cfg.model || "claude-opus-4-7",
    max_tokens: 1500,
    system: [
      { type: "text", text: systemPrompt(), cache_control: { type: "ephemeral" } },
    ],
    messages: [
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

function renderHeader() {
  const hasKey = !!state.brain.apiKey;
  return h("section", { class: "card" }, [
    h("h2", {}, "The Brain"),
    h("div", { class: "sub" },
      hasKey
        ? `Claude-powered. Model: ${state.brain.model}. Messages are sent directly from your phone to Anthropic.`
        : "Running in local mode — answers come from your app. Connect a Claude key in Settings for a full assistant."),
  ]);
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

      state.brain.history.push({ id: uid(), role: "user", text, at: Date.now() });
      save();
      input.value = "";
      rerender();

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
  mount.append(renderHeader());
  mount.append(renderChat(rerender));
  if (!(state.brain.history || []).length) mount.append(renderStarters(rerender));
}

export { MODEL_OPTIONS };
