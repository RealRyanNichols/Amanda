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
      h("div", { class: "fab-title" }, "✨ The Brain"),
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
    }, "Full Brain →"),
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
  wrap.innerHTML = formatted;
  return wrap;
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
    // Local fallback — short helpful response
    const reply = localReply(msg);
    state.brain.history.push({ id: uid(), role: "assistant", text: reply, at: Date.now() });
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

function localReply(q) {
  const lower = q.toLowerCase();
  const tabName = currentTabName();
  if (/overwhelm|too much|can't even|drowning/.test(lower)) {
    return "Breathe for one second. You don't have to fix it all. Name one thing — the smallest one — and do that. Come back when it's done.";
  }
  if (/tired|exhausted|burnt/.test(lower)) {
    return "That's real. Rest is work too. Give yourself 20 minutes of nothing. Close this app.";
  }
  if (/what should i do|where do i start/.test(lower)) {
    return `You're on ${tabName}. Start with whatever's already open in front of you. Small step, done, counts.`;
  }
  return `I can help more when you connect Claude in Settings → Brain. For now: I heard you. You're on the ${tabName} tab if that helps.`;
}
