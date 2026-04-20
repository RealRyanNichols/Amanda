// Floating Brain bubble — a persistent chat button + drawer that lives on
// every page. Gives her the Brain without needing to open the Brain tab.
// Context-aware: knows which tab she's currently on.

import { state, save, uid } from "./store.js";
import { h, toast } from "./util.js";
import { TONES, toneByKey, callClaude } from "./tools/brain.js";
import { micButton } from "./voice.js";
import { currentBrand } from "./branding.js";

let mounted = false;
let drawerOpen = false;

export function mountFloatingBrain() {
  if (mounted) return;
  mounted = true;

  const btn = document.createElement("button");
  btn.className = "fab-brain";
  btn.setAttribute("aria-label", "Open Brain");
  btn.innerHTML = "✨";
  btn.addEventListener("click", toggleDrawer);
  document.body.append(btn);

  // Hide the bubble when she's already on the Brain tab (redundant there)
  const updateVisibility = () => {
    const activeTab = document.querySelector('.tab[aria-selected="true"]')?.dataset?.tab;
    btn.style.display = activeTab === "brain" ? "none" : "";
    // Also close drawer if it's open when jumping to Brain tab
    if (activeTab === "brain" && drawerOpen) closeDrawer();
  };
  // Run on any tab click
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => setTimeout(updateVisibility, 10)));
  updateVisibility();

  // Keyboard shortcut: press "/" anywhere (when not typing in a field) to open
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) {
      e.preventDefault();
      toggleDrawer();
    }
  });
}

function currentTabName() {
  const active = document.querySelector('.tab[aria-selected="true"]');
  return active?.querySelector(".tab-label")?.textContent || "Home";
}

function toggleDrawer() {
  if (drawerOpen) closeDrawer();
  else openDrawer();
}

function openDrawer() {
  const existing = document.querySelector(".fab-drawer");
  if (existing) { existing.remove(); drawerOpen = false; return; }

  drawerOpen = true;
  const drawer = document.createElement("div");
  drawer.className = "fab-drawer";

  const tabName = currentTabName();
  const tone = toneByKey(state.brain?.tone || "friend");

  drawer.append(h("div", { class: "fab-header" }, [
    h("div", {}, [
      h("div", { class: "fab-title" }, "✨ Gideon"),
      h("div", { class: "fab-sub" }, `On ${tabName} · ${tone.emoji} ${tone.label}`),
    ]),
    h("button", { class: "fab-close", onclick: closeDrawer }, "×"),
  ]));

  // Quick tone switcher
  const toneRow = h("div", { class: "fab-tones" });
  TONES.slice(0, 6).forEach((t) => {
    toneRow.append(h("button", {
      class: "fab-tone" + ((state.brain?.tone || "friend") === t.key ? " active" : ""),
      title: t.label,
      onclick: () => {
        state.brain.tone = t.key;
        save();
        drawer.remove();
        drawerOpen = false;
        openDrawer();
      },
    }, t.emoji));
  });
  drawer.append(toneRow);

  // Chat area
  const log = h("div", { class: "fab-log" });
  drawer.append(log);

  // Render existing history (last 8 messages for compact view)
  const recent = (state.brain?.history || []).slice(-8);
  if (!recent.length) {
    log.append(h("div", { class: "fab-empty" }, "Hey. What's on your mind?"));
  } else {
    recent.forEach((m) => log.append(renderBubble(m)));
  }
  // Scroll to bottom after render
  setTimeout(() => { log.scrollTop = log.scrollHeight; }, 0);

  // Input
  const textarea = h("textarea", {
    class: "fab-input",
    placeholder: "Ask me anything. Hold the mic and talk.",
    rows: "2",
  });
  const mic = micButton(textarea);

  const sendBtn = h("button", {
    class: "btn fab-send",
    onclick: async () => { await sendMessage(textarea.value, textarea, log, sendBtn); },
  }, "Send");

  textarea.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await sendMessage(textarea.value, textarea, log, sendBtn);
    }
  });

  drawer.append(h("div", { class: "fab-input-row" }, [
    textarea,
    h("div", { class: "fab-input-btns" }, [mic, sendBtn]),
  ]));

  // Expose a way for "Or tell me what you need…" escape-hatch inputs
  // inside a reply bubble to feed back through the normal send pipeline.
  window.__fabApi = {
    sendFromOther: (val) => sendMessage(val, textarea, log, sendBtn),
  };

  // Quick actions
  drawer.append(h("div", { class: "fab-quick" }, [
    h("button", {
      class: "chip",
      onclick: () => { textarea.value = "I feel overwhelmed. What should I do first?"; textarea.focus(); },
    }, "I'm overwhelmed"),
    h("button", {
      class: "chip",
      onclick: () => { textarea.value = `What's most important for me to focus on about ${currentTabName()} right now?`; textarea.focus(); },
    }, "Focus me"),
    h("button", {
      class: "chip",
      onclick: () => {
        const btn = document.querySelector('.tab[data-tab="brain"]');
        if (btn) btn.click();
        closeDrawer();
      },
    }, "Open Gideon →"),
  ]));

  document.body.append(drawer);
  setTimeout(() => textarea.focus(), 50);

  // Close on escape
  const onKey = (e) => { if (e.key === "Escape") closeDrawer(); };
  document.addEventListener("keydown", onKey);
  drawer.dataset.onKey = "bound";
  drawer._onKey = onKey;
}

function closeDrawer() {
  const drawer = document.querySelector(".fab-drawer");
  if (drawer) {
    if (drawer._onKey) document.removeEventListener("keydown", drawer._onKey);
    drawer.remove();
  }
  drawerOpen = false;
}

function renderBubble(m) {
  const wrap = h("div", { class: "fab-bubble " + (m.role === "user" ? "user" : "assistant") + (m.pending ? " pending" : "") });
  const safe = (m.text || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const formatted = safe
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
  const body = document.createElement("div");
  body.innerHTML = formatted;
  wrap.append(body);

  // Stacked recommendation list — modeled after AskUserQuestion. 3–4
  // ranked options, top-to-bottom, with a free-text "something else"
  // escape hatch at the bottom so she's never boxed in by our guesses.
  if (m.options && Array.isArray(m.options) && m.options.length) {
    const stack = h("div", { class: "fab-options" });
    m.options.forEach((opt, i) => {
      const row = h("button", {
        class: "fab-option" + (i === 0 ? " recommended" : ""),
        onclick: () => runBubbleAction(opt.action),
      }, [
        h("div", { class: "fab-option-main" }, [
          h("span", { class: "fab-option-label" }, opt.label),
          i === 0 && h("span", { class: "fab-option-badge" }, "recommended"),
        ]),
        opt.description && h("div", { class: "fab-option-desc" }, opt.description),
      ]);
      stack.append(row);
    });

    // Free-text escape — she types whatever if none of the options fit.
    const other = h("form", {
      class: "fab-option-other",
      onsubmit: (e) => {
        e.preventDefault();
        const input = e.target.querySelector("input");
        const val = (input.value || "").trim();
        if (!val) return;
        // Feed it back through the normal send path — keeps the
        // conversation continuous.
        const { sendFromOther } = window.__fabApi || {};
        if (sendFromOther) sendFromOther(val);
        input.value = "";
      },
    }, [
      h("input", {
        type: "text",
        placeholder: "Or tell me what you need…",
        enterkeyhint: "send",
      }),
      h("button", { class: "btn small", type: "submit" }, "→"),
    ]);
    stack.append(other);

    wrap.append(stack);
  }
  return wrap;
}

// Execute a structured action attached to a Brain reply. Supported kinds:
//   { kind: "tab", tab: "settings" }            → switches to a top-level tab
//   { kind: "subview", tab: "social", view: "reels" } → tab + sub-view
//   { kind: "open", url: "https://..." }        → opens in new tab
// The Brain's localReply() and (eventually) Claude tool calls produce these.
function runBubbleAction(a) {
  if (!a) return;
  if (a.kind === "tab") {
    const btn = document.querySelector(`.tab[data-tab="${a.tab}"]`);
    if (btn) btn.click();
    // close the floating chat so she sees the destination
    document.querySelector(".fab-sheet")?.classList.remove("open");
    return;
  }
  if (a.kind === "subview") {
    // Stash the target sub-view so the tool picks it up on render.
    if (a.tab === "social" && a.view) {
      if (!state.social) state.social = {};
      state.social.activeView = a.view;
      save();
    }
    if (a.tab === "life" && a.view) {
      if (!state.life) state.life = {};
      state.life.activeView = a.view;
      save();
    }
    const btn = document.querySelector(`.tab[data-tab="${a.tab}"]`);
    if (btn) btn.click();
    document.querySelector(".fab-sheet")?.classList.remove("open");
    return;
  }
  if (a.kind === "open" && a.url) {
    window.open(a.url, "_blank", "noopener");
    return;
  }
}

async function sendMessage(text, textarea, logEl, sendBtn) {
  const msg = text.trim();
  if (!msg) return;

  // Add user message
  if (!state.brain) state.brain = { history: [] };
  if (!state.brain.history) state.brain.history = [];
  state.brain.history.push({ id: uid(), role: "user", text: msg, at: Date.now() });
  save();
  logEl.append(renderBubble(state.brain.history[state.brain.history.length - 1]));
  textarea.value = "";
  logEl.scrollTop = logEl.scrollHeight;

  if (!state.brain.apiKey) {
    // Local fallback — short helpful response + ranked options
    const { text: replyText, options } = localReply(msg);
    state.brain.history.push({
      id: uid(), role: "assistant", text: replyText, options, at: Date.now(),
    });
    save();
    logEl.append(renderBubble(state.brain.history[state.brain.history.length - 1]));
    logEl.scrollTop = logEl.scrollHeight;
    return;
  }

  // Send to Claude
  const pending = { id: uid(), role: "assistant", text: "…thinking…", pending: true, at: Date.now() };
  state.brain.history.push(pending);
  save();
  const pendingEl = renderBubble(pending);
  logEl.append(pendingEl);
  logEl.scrollTop = logEl.scrollHeight;
  sendBtn.disabled = true;

  try {
    const reply = await callClaude(msg);
    const last = state.brain.history[state.brain.history.length - 1];
    last.text = reply;
    delete last.pending;
    save();
    pendingEl.replaceWith(renderBubble(last));
    logEl.scrollTop = logEl.scrollHeight;
  } catch (err) {
    const last = state.brain.history[state.brain.history.length - 1];
    last.text = `Hmm — ${err.message}`;
    delete last.pending;
    save();
    pendingEl.replaceWith(renderBubble(last));
  } finally {
    sendBtn.disabled = false;
  }
}

// Router — returns a short reply + 3-4 ranked options. The #1 option is
// tagged "recommended" in the UI. Every reply includes an escape-hatch
// text input so she's never stuck with our guesses.
function localReply(q) {
  const lower = q.toLowerCase();

  // Schedule / calendar
  if (/schedul|calendar|remind|appointment|book/.test(lower)) {
    return {
      text: "Got it. Here's where you can put that:",
      options: [
        { label: "📅 Add to Calendar",   description: "Exact date + time, with a reminder ping",
          action: { kind: "tab", tab: "calendar" } },
        { label: "🗂 Drop in Organize",  description: "No date yet — just don't want to forget",
          action: { kind: "tab", tab: "overload" } },
        { label: "📲 Set up text reminders", description: "We'll text you when it's due",
          action: { kind: "tab", tab: "settings" } },
      ],
    };
  }
  if (/to.?do|task|need to|must do/.test(lower)) {
    return {
      text: "Let's land that somewhere real:",
      options: [
        { label: "🗂 Dump it in Organize", description: "We'll triage it — Now, Today, Later",
          action: { kind: "tab", tab: "overload" } },
        { label: "📅 Schedule it instead",  description: "If it has a specific time",
          action: { kind: "tab", tab: "calendar" } },
        { label: "🎯 Make it a habit",      description: "If it's something you want to do regularly",
          action: { kind: "tab", tab: "habits" } },
      ],
    };
  }
  if (/bill|pay|deposit|money|income|budget/.test(lower)) {
    return {
      text: "Where do you want to go in your money?",
      options: [
        { label: "💵 Open Income",      description: "Deposits, bills, safe-to-spend",
          action: { kind: "tab", tab: "income" } },
        { label: "📅 Booking + payments", description: "Appointments you're owed for",
          action: { kind: "tab", tab: "booking" } },
        { label: "📸 Snap a bill with the camera", description: "We'll read it and log it",
          action: { kind: "tab", tab: "capture" } },
      ],
    };
  }
  if (/verse|scripture|bible|read the bible|god/.test(lower)) {
    return {
      text: "Scripture time. Pick a door:",
      options: [
        { label: "✝️ Open Bible reader",    description: "Pick any book, any chapter, any translation",
          action: { kind: "tab", tab: "bible" } },
        { label: "🏠 Today's verse on Home", description: "One verse, one tap to mark read or studied",
          action: { kind: "tab", tab: "dashboard" } },
        { label: "🙏 Faith + prayer journal", description: "Life → Faith",
          action: { kind: "subview", tab: "life", view: "faith" } },
      ],
    };
  }
  if (/pregnan|kick|contraction|due date|trimester|week/.test(lower)) {
    return {
      text: "Pregnancy tools:",
      options: [
        { label: "🤰 Open Pregnancy",     description: "Weeks, size, kicks, body log",
          action: { kind: "subview", tab: "life", view: "pregnancy" } },
        { label: "👶 Mommy this week",    description: "Your stats across every tool",
          action: { kind: "tab", tab: "mommy" } },
        { label: "💌 Write a letter to baby", description: "Voice or type",
          action: { kind: "subview", tab: "life", view: "pregnancy" } },
      ],
    };
  }
  if (/reel|video|collage|post|photo|content|social/.test(lower)) {
    return {
      text: "Make something to share:",
      options: [
        { label: "🎬 Reel Studio",   description: "Photos → collage in 30 seconds",
          action: { kind: "subview", tab: "social", view: "reels" } },
        { label: "✍️ Caption writer", description: "Claude drafts 3 captions for any photo",
          action: { kind: "subview", tab: "social", view: "caption" } },
        { label: "📣 Planner",        description: "Draft + schedule posts",
          action: { kind: "subview", tab: "social", view: "planner" } },
      ],
    };
  }
  if (/meal|grocery|food|eat|plan dinner|cook/.test(lower)) {
    return {
      text: "Food plan options:",
      options: [
        { label: "🍽️ Meals + grocery",  description: "Week's menu + auto-built shopping list",
          action: { kind: "tab", tab: "meals" } },
        { label: "📸 Snap what you ate", description: "Photo → logged to your day",
          action: { kind: "tab", tab: "capture" } },
      ],
    };
  }
  if (/lead|follow.?up|client|student/.test(lower)) {
    return {
      text: "Business outreach:",
      options: [
        { label: "📲 Leads + follow-ups", description: "Hot/warm/cold, next contact dates",
          action: { kind: "tab", tab: "followup" } },
        { label: "📅 Bookings",            description: "Appointments + balances owed",
          action: { kind: "tab", tab: "booking" } },
      ],
    };
  }
  if (/habit|streak|track|daily/.test(lower)) {
    return {
      text: "Habits & tracking:",
      options: [
        { label: "🎯 Habits",         description: "Log today's check-ins",
          action: { kind: "tab", tab: "habits" } },
        { label: "👶 Mommy stats",    description: "This week, at a glance",
          action: { kind: "tab", tab: "mommy" } },
      ],
    };
  }
  if (/me.?time|rest|break|self.?care|alone/.test(lower)) {
    return {
      text: "You deserve the minute. Pick one:",
      options: [
        { label: "💖 Start Me Time",    description: "Start the timer — 20 min, no guilt",
          action: { kind: "tab", tab: "metime" } },
        { label: "🙏 Prayer journal",   description: "A quieter kind of recharge",
          action: { kind: "subview", tab: "life", view: "faith" } },
        { label: "🌿 Gratitude",        description: "Write down three things",
          action: { kind: "subview", tab: "life", view: "gratitude" } },
      ],
    };
  }
  if (/partner|husband|man|boyfriend|relationship|single|dating|marriage/.test(lower)) {
    return {
      text: "Heart is where that lives. Pick what you need:",
      options: [
        { label: "❤️ Open Heart",        description: "Status-aware companion — no judgment",
          action: { kind: "subview", tab: "life", view: "heart" } },
        { label: "🙏 Pray about it",    description: "Prayer journal under Faith",
          action: { kind: "subview", tab: "life", view: "faith" } },
        { label: "🤝 Invite him here",   description: "Household invite in Settings",
          action: { kind: "tab", tab: "settings" } },
      ],
    };
  }
  if (/letter.*baby|write.*baby|to my baby/.test(lower)) {
    return {
      text: "Letters to your baby:",
      options: [
        { label: "💌 Write a letter",      description: "Voice or type — stays forever",
          action: { kind: "subview", tab: "life", view: "pregnancy" } },
        { label: "📚 See past letters",    description: "Your letter archive",
          action: { kind: "subview", tab: "life", view: "pregnancy" } },
      ],
    };
  }

  // Emotional / overwhelm
  if (/overwhelm|too much|can't even|drowning|stressed/.test(lower)) {
    return {
      text: "Breathe. One thing at a time. Pick the softest landing:",
      options: [
        { label: "🗂 Brain-dump it",    description: "Everything out of your head, we'll sort it",
          action: { kind: "tab", tab: "overload" } },
        { label: "💖 Start Me Time",    description: "Walk away for 20 min — it'll all still be here",
          action: { kind: "tab", tab: "metime" } },
        { label: "🙏 Pray through it",  description: "Write it to God under Faith",
          action: { kind: "subview", tab: "life", view: "faith" } },
      ],
    };
  }
  if (/tired|exhausted|burnt/.test(lower)) {
    return {
      text: "That's real. Rest is work too. Pick your reset:",
      options: [
        { label: "💖 Start Me Time",   description: "Timer on. Eyes closed. No guilt.",
          action: { kind: "tab", tab: "metime" } },
        { label: "✝️ Verse for tired",  description: "Matthew 11:28 — 'come unto me'",
          action: { kind: "tab", tab: "bible" } },
      ],
    };
  }
  if (/sad|lonely|crying|depressed|hopeless/.test(lower)) {
    return {
      text: "I'm here with you. You're not alone. Next step?",
      options: [
        { label: "❤️ Heart journal",     description: "Private reflections — stays on your device",
          action: { kind: "subview", tab: "life", view: "heart" } },
        { label: "🙏 Pray it out",       description: "Prayer journal under Faith",
          action: { kind: "subview", tab: "life", view: "faith" } },
        { label: "💛 Open Gratitude",    description: "One thing that didn't burn down today",
          action: { kind: "subview", tab: "life", view: "gratitude" } },
      ],
    };
  }
  if (/what should i do|where do i start|help me|don't know/.test(lower)) {
    return {
      text: "Start small. Pick one:",
      options: [
        { label: "🗂 Brain-dump first",   description: "Get everything out so you can see it",
          action: { kind: "tab", tab: "overload" } },
        { label: "👶 See this week",     description: "Mommy tab — your stats, one glance",
          action: { kind: "tab", tab: "mommy" } },
        { label: "💖 Take a breath",      description: "Me Time — 20 minutes for you",
          action: { kind: "tab", tab: "metime" } },
      ],
    };
  }

  // Fallback — connect Claude + show the most common destinations
  return {
    text: "I can do way more once Claude's connected. For now, here's where most people want to go:",
    options: [
      { label: "🔌 Connect Claude",     description: "Settings → Brain. One-time, ~30 sec.",
        action: { kind: "tab", tab: "settings" } },
      { label: "👶 See my week",        description: "Mommy tab — your stats this week",
        action: { kind: "tab", tab: "mommy" } },
      { label: "🗂 Brain-dump",          description: "Drop everything on your mind",
        action: { kind: "tab", tab: "overload" } },
      { label: "✝️ Today's verse",       description: "Home tab",
        action: { kind: "tab", tab: "dashboard" } },
    ],
  };
}
