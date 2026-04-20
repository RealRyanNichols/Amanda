// "How I'm feeling" journal — lives inside the Pregnancy sub-view of Life.
//
// Design principles (per Ryan's directive):
// - Voice-first. The mic is the primary way to log, because women talk what
//   they wouldn't type.
// - We pattern-match HER OWN words over time. We don't diagnose. We don't
//   name conditions. We just tell her "you've mentioned this a lot — your
//   OB would want to know."
// - When a pattern crosses a threshold, we surface a gentle card with push
//   options: add to visit notes, schedule a reminder, call her doctor, or
//   dismiss ("I already told her").
// - AI weekly review is optional and runs under a strict non-diagnostic
//   system prompt (see askClaudeForReview below).

import { state, save, uid } from "../store.js";
import { h, toast, confirmAction, todayISO, friendlyDate } from "../util.js";
import { micButton } from "../voice.js";

// Common symptoms worth having as quick tags — not a diagnostic list, just
// categories that make pattern-matching work. Pregnancy-adjacent.
export const SYMPTOM_TAGS = [
  { key: "headache",      label: "Headache" },
  { key: "swelling",      label: "Swelling (hands/face/feet)" },
  { key: "vision",        label: "Vision changes (blurry/spots)" },
  { key: "pressure",      label: "Pelvic / abdominal pressure" },
  { key: "upperRightPain", label: "Upper-right belly pain" },
  { key: "contractions",  label: "Contractions / tightening" },
  { key: "bleeding",      label: "Bleeding / spotting" },
  { key: "fluid",         label: "Fluid leak" },
  { key: "reducedMove",   label: "Less baby movement" },
  { key: "nausea",        label: "Nausea / throwing up" },
  { key: "heartburn",     label: "Heartburn" },
  { key: "backPain",      label: "Back pain" },
  { key: "fatigue",       label: "Exhaustion / can't stay awake" },
  { key: "mood",          label: "Low mood / overwhelm" },
  { key: "dizzy",         label: "Dizzy / lightheaded" },
  { key: "sleep",         label: "Can't sleep" },
  { key: "breathless",    label: "Shortness of breath" },
  { key: "heartRacing",   label: "Heart racing" },
  { key: "other",         label: "Something else" },
];

const PATTERN_THRESHOLD = 3;   // X times within PATTERN_WINDOW_DAYS triggers a card
const PATTERN_WINDOW_DAYS = 7;
const DISMISS_COOLDOWN_DAYS = 3; // after she dismisses, don't re-surface for 3 days

/**
 * Analyze her journal entries and return any patterns currently crossing
 * the threshold (and NOT recently dismissed). Pure local logic, no AI.
 */
export function detectPatterns() {
  const log = state.life?.pregnancy?.bodyLog || [];
  const dismissed = state.life?.pregnancy?.dismissedPatterns || {};
  const cutoff = Date.now() - PATTERN_WINDOW_DAYS * 86400000;
  const counts = {}; // { tagKey: [{date, note}] }

  for (const entry of log) {
    if ((entry.createdAt || 0) < cutoff) continue;
    for (const tag of entry.tags || []) {
      counts[tag] = counts[tag] || [];
      counts[tag].push(entry);
    }
  }

  const patterns = [];
  for (const [tag, entries] of Object.entries(counts)) {
    if (entries.length < PATTERN_THRESHOLD) continue;
    const lastDismissed = dismissed[tag] || 0;
    if (Date.now() - lastDismissed < DISMISS_COOLDOWN_DAYS * 86400000) continue;
    const meta = SYMPTOM_TAGS.find((s) => s.key === tag);
    patterns.push({
      tag,
      label: meta?.label || tag,
      count: entries.length,
      windowDays: PATTERN_WINDOW_DAYS,
      lastMentioned: Math.max(...entries.map((e) => e.createdAt || 0)),
    });
  }
  return patterns.sort((a, b) => b.count - a.count);
}

function dismissPattern(tagKey) {
  const p = state.life.pregnancy;
  if (!p.dismissedPatterns) p.dismissedPatterns = {};
  p.dismissedPatterns[tagKey] = Date.now();
  save();
}

function addToNextVisitNotes(tagKey, label, count, windowDays) {
  const p = state.life.pregnancy;
  const line = `[From my journal] ${label} — mentioned ${count} times in the last ${windowDays} days.`;
  // Store in a pre-visit-notes bucket the visit form can pull from
  if (!p.preVisitNotes) p.preVisitNotes = [];
  p.preVisitNotes.push({ id: uid(), line, addedAt: Date.now() });
  save();
  toast("Saved. It'll appear when you add your next visit.");
}

function scheduleReminder(tagKey, label) {
  // Create a task in Organize so it surfaces on Home
  if (!state.overload) state.overload = { brainDump: "", tasks: [] };
  state.overload.tasks.push({
    id: uid(),
    text: `Ask OB about ${label}`,
    category: "today",
    due: "",
    done: false,
    createdAt: todayISO(),
  });
  save();
  toast("Added to Organize as a task for today");
}

function callDoctor() {
  const phone = state.life?.pregnancy?.obPhone;
  if (!phone) {
    toast("Add your OB's number in the Pregnancy section first.");
    return;
  }
  window.location.href = `tel:${phone}`;
}

/* ---------- Body Journal UI ---------- */

export function renderBodyJournal(rerender) {
  const p = state.life.pregnancy;
  const log = p.bodyLog || [];

  const card = h("section", { class: "card body-journal" }, [
    h("h2", {}, "How I'm feeling"),
    h("div", { class: "sub" },
      "Tap the mic and say anything — physical, emotional, whatever you noticed today. Even the smallest thing is worth writing down. Patterns show up over time."),
  ]);

  // Pattern alerts (silent unless threshold hit)
  const patterns = detectPatterns();
  patterns.forEach((pat) => {
    card.append(renderPatternCard(pat, rerender));
  });

  // Quick-entry form
  const textarea = h("textarea", {
    placeholder: "e.g. 'headache again today, third one this week. Right side.'",
    rows: "3",
  });

  let selectedTags = new Set();
  let severity = 2; // 1-5

  // Symptom quick-tag pills
  const tagRow = h("div", { class: "chip-row", style: "margin-top:8px" });
  SYMPTOM_TAGS.forEach((s) => {
    const chip = h("button", {
      class: "chip",
      type: "button",
      onclick: () => {
        if (selectedTags.has(s.key)) { selectedTags.delete(s.key); chip.classList.remove("active"); }
        else { selectedTags.add(s.key); chip.classList.add("active"); }
      },
    }, s.label);
    tagRow.append(chip);
  });

  // Severity 1-5 stars
  const severityRow = h("div", { class: "btn-row", style: "align-items:center; gap:6px; margin-top:8px" });
  severityRow.append(h("span", { class: "sub" }, "How strong? "));
  for (let i = 1; i <= 5; i++) {
    const btn = h("button", {
      class: "chip severity" + (i <= severity ? " active" : ""),
      type: "button",
      onclick: () => {
        severity = i;
        severityRow.querySelectorAll(".severity").forEach((c, idx) => {
          c.classList.toggle("active", idx < i);
        });
      },
    }, i === 1 ? "mild" : i === 2 ? "noticeable" : i === 3 ? "bothers me" : i === 4 ? "bad" : "can't ignore");
    severityRow.append(btn);
  }

  const form = h("form", { class: "form-row", onsubmit: (e) => {
    e.preventDefault();
    const text = textarea.value.trim();
    if (!text && !selectedTags.size) { toast("Add a note or pick a tag"); return; }
    if (!p.bodyLog) p.bodyLog = [];
    p.bodyLog.push({
      id: uid(),
      date: todayISO(),
      text,
      tags: [...selectedTags],
      severity,
      askedDoctor: false,
      createdAt: Date.now(),
    });
    save();
    toast("Logged");
    textarea.value = "";
    selectedTags.clear();
    severity = 2;
    rerender();
  } }, [
    h("label", { class: "field" }, [
      h("div", { style: "display:flex; gap:6px; align-items:flex-end" }, [
        textarea,
      ]),
    ]),
    h("div", { class: "btn-row" }, [micButton(textarea)]),
    h("div", { class: "sub" }, "Tap any tags that fit (optional, helps pattern detection)"),
    tagRow,
    severityRow,
    h("div", { class: "btn-row", style: "margin-top:10px" }, [
      h("button", { class: "btn", type: "submit" }, "Log it"),
    ]),
  ]);
  card.append(form);

  // AI weekly review
  if (state.brain?.apiKey && log.length >= 3) {
    card.append(h("div", { class: "btn-row", style: "margin-top:14px" }, [
      h("button", {
        class: "btn secondary",
        onclick: () => askClaudeForReview(rerender),
      }, "Show me what stood out this week"),
    ]));
  }

  // Recent entries
  if (log.length) {
    card.append(h("h3", { style: "margin:16px 0 6px; font-size:13px; color:var(--text-dim); text-transform:uppercase; letter-spacing:.8px" }, "Recent entries"));
    const list = h("div", { class: "list" });
    [...log].reverse().slice(0, 10).forEach((e) => {
      const tagLabels = (e.tags || []).map((k) => SYMPTOM_TAGS.find((s) => s.key === k)?.label || k).join(" · ");
      list.append(h("div", { class: "item" }, [
        h("div", {}, [
          h("div", { class: "title" }, e.text || "(tags only)"),
          h("div", { class: "meta" }, [friendlyDate(e.date), tagLabels, `severity ${e.severity || "?"}/5`].filter(Boolean).join(" · ")),
        ]),
        h("div", { class: "actions" }, [
          h("button", {
            class: "btn small danger",
            onclick: () => {
              if (!confirmAction("Remove this entry?")) return;
              p.bodyLog = p.bodyLog.filter((x) => x.id !== e.id);
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

function renderPatternCard(pat, rerender) {
  return h("div", { class: "body-pattern" }, [
    h("div", { class: "body-pattern-emoji" }, "👀"),
    h("div", { style: "flex:1; min-width:0" }, [
      h("div", { class: "title" }, `${pat.label} — ${pat.count} times in ${pat.windowDays} days`),
      h("div", { class: "meta" },
        "Not trying to diagnose anything — just flagging. Your OB would probably want to hear this."),
      h("div", { class: "btn-row", style: "margin-top:10px; flex-wrap:wrap" }, [
        h("button", {
          class: "btn small",
          onclick: () => { addToNextVisitNotes(pat.tag, pat.label, pat.count, pat.windowDays); dismissPattern(pat.tag); rerender(); },
        }, "Add to my next visit notes"),
        h("button", {
          class: "btn small secondary",
          onclick: () => { scheduleReminder(pat.tag, pat.label); dismissPattern(pat.tag); rerender(); },
        }, "Remind me today"),
        state.life?.pregnancy?.obPhone && h("button", {
          class: "btn small secondary",
          onclick: () => callDoctor(),
        }, "Call my OB now"),
        h("button", {
          class: "btn small secondary",
          onclick: () => { dismissPattern(pat.tag); rerender(); },
        }, "I already told her"),
      ]),
    ]),
  ]);
}

async function askClaudeForReview(rerender) {
  const p = state.life?.pregnancy;
  if (!state.brain?.apiKey) { toast("Connect Claude in Settings first"); return; }
  const log = p.bodyLog || [];
  const cutoff = Date.now() - 7 * 86400000;
  const recent = log.filter((e) => (e.createdAt || 0) >= cutoff);
  if (recent.length < 3) { toast("Log a few more entries first"); return; }

  const loading = h("div", { class: "alert" }, "Reading through your week…");
  document.body.append(loading);

  const body = {
    model: state.brain.model || "claude-opus-4-7",
    max_tokens: 1200,
    system: [{ type: "text", text:
      "You are a careful, practical friend who happens to know a lot about what women feel during pregnancy and motherhood. " +
      "She wrote a week of entries about how she's been feeling. Your job: read them and tell her what an OB would want to know about, in plain language.\n\n" +
      "HARD RULES:\n" +
      "1. NEVER name a specific medical condition (no 'preeclampsia', no 'gestational diabetes', no 'depression'). If you notice a cluster, describe what SHE wrote, not what it might be.\n" +
      "2. Don't say 'I'm not a doctor' more than once. She knows. Saying it repeatedly is annoying and condescending.\n" +
      "3. Use phrases like 'you mentioned [X] a few times this week', 'this is the kind of thing your OB would want to hear', 'worth bringing up at your next visit'.\n" +
      "4. Be warm. Be direct. Don't hedge everything.\n" +
      "5. End with a short list of what she might bring up at her next visit — in HER words.",
    cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content:
      `Here are my last 7 days of body-journal entries (newest first):\n\n` +
      recent.reverse().map((e) => {
        const tagLabels = (e.tags || []).map((k) => SYMPTOM_TAGS.find((s) => s.key === k)?.label || k).join(", ");
        return `${friendlyDate(e.date)} — severity ${e.severity}/5${tagLabels ? " — " + tagLabels : ""}\n${e.text || "(no note)"}`;
      }).join("\n\n"),
    }],
  };
  if (/opus-4-7|opus-4-6|sonnet-4-6/.test(body.model)) body.thinking = { type: "adaptive" };

  try {
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
    loading.remove();
    if (!res.ok) throw new Error(`Claude ${res.status}`);
    const data = await res.json();
    const textBlock = (data.content || []).find((b) => b.type === "text");
    const reply = textBlock?.text || "(no response)";

    // Show the review in an overlay with push options
    const overlay = h("div", { class: "note-overlay", onclick: (e) => { if (e.target.classList.contains("note-overlay")) overlay.remove(); } }, [
      h("div", { class: "card", style: "max-width:520px; width:100%; cursor:auto; max-height:85vh; overflow:auto" }, [
        h("h2", {}, "What stood out this week"),
        h("div", { class: "script-box" }, reply),
        h("div", { class: "btn-row", style: "margin-top:14px; flex-wrap:wrap" }, [
          h("button", {
            class: "btn",
            onclick: () => {
              if (!p.preVisitNotes) p.preVisitNotes = [];
              p.preVisitNotes.push({ id: uid(), line: `[AI week review]\n${reply}`, addedAt: Date.now() });
              save();
              toast("Saved — will appear in your next visit notes");
              overlay.remove();
            },
          }, "Save for my next visit"),
          state.life?.pregnancy?.obPhone && h("a", {
            class: "btn secondary",
            href: `tel:${state.life.pregnancy.obPhone}`,
          }, "Call my OB"),
          h("button", { class: "btn secondary", onclick: () => overlay.remove() }, "Close"),
        ]),
      ]),
    ]);
    document.body.append(overlay);
  } catch (err) {
    loading.remove();
    toast(err.message || "Couldn't load review");
  }
}
