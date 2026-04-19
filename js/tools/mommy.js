// Mommy Analytics — the "how am I doing?" tab.
//
// This app's center of gravity is the mom. The positioning is:
//   "pregnancy is when this app starts for you; it stays with you as you
//    grow a family and invite your people in."
//
// Mommy Analytics pulls from every other tool to tell her, in a warm and
// non-judgmental way, how her week has actually been. Never scored, never
// ranked. It's a mirror, not a report card.
//
// Sections:
//   Hero          — pregnancy week / trimester / days-to-go + weekly affirmation
//   Faith         — verses read + studied, prayers, gratitude streak
//   Body + baby   — body log entries this week, latest kick session
//   Me Time       — hours this week vs her weekly goal, rewards
//   Letters       — count to baby, last written
//   Support       — partner linked? supporters? (counts only, never names)
//   What's next   — gentle prompts based on what's missing

import { state } from "../store.js";
import { h } from "../util.js";
import { VERSES, babySizeForWeek } from "./life-seeds.js";

function countThisWeek(obj) {
  const weekAgo = Date.now() - 7 * 86400000;
  return Object.values(obj || {}).filter((iso) => new Date(iso).getTime() >= weekAgo).length;
}

function countArrayThisWeek(arr, getTs) {
  const weekAgo = Date.now() - 7 * 86400000;
  return (arr || []).filter((x) => {
    const ts = getTs(x);
    return ts && new Date(ts).getTime() >= weekAgo;
  }).length;
}

function weeklyAffirmation(name) {
  const lines = [
    "You showed up this week. That's the whole win.",
    `${name ? name + ", " : ""}you are doing a harder job than most people will ever understand.`,
    "Your baby knows your voice. Your baby knows your heartbeat. You're already their favorite person.",
    "You don't have to be a different mom. You're the mom they need.",
    "Rest isn't quitting. Rest is the middle of the story.",
    "Growing a human is full-time work. Everything else is extra credit.",
  ];
  const idx = Math.floor(Date.now() / 86400000) % lines.length;
  return lines[idx];
}

function renderHero() {
  const p = state.life?.pregnancy;
  const profile = state.profile || {};
  const name = (profile.firstName || "").trim();

  const card = h("section", { class: "card mommy-hero" }, [
    h("h2", { style: "margin-bottom:4px" }, name ? `${name}, this is your week` : "Your week, mom"),
    h("div", { class: "sub" }, weeklyAffirmation(name)),
  ]);

  if (p?.dueDate) {
    const due = new Date(p.dueDate + "T00:00:00");
    const conception = new Date(due.getTime() - 280 * 86400000);
    const weeks = Math.max(0, Math.floor((Date.now() - conception) / (7 * 86400000)));
    const daysLeft = Math.round((due - Date.now()) / 86400000);
    const tri = weeks < 14 ? 1 : weeks < 28 ? 2 : 3;
    const size = babySizeForWeek(weeks);

    card.append(h("div", { class: "stat-grid", style: "margin-top:12px" }, [
      h("div", { class: "stat" }, [
        h("div", { class: "label" }, "Week"),
        h("div", { class: "value" }, weeks),
      ]),
      h("div", { class: "stat" }, [
        h("div", { class: "label" }, "Trimester"),
        h("div", { class: "value" }, tri),
      ]),
      h("div", { class: "stat ok" }, [
        h("div", { class: "label" }, "Days to go"),
        h("div", { class: "value" }, Math.max(0, daysLeft)),
      ]),
    ]));
    if (size) {
      card.append(h("div", { class: "sub", style: "margin-top:8px" },
        `Baby's about the size of a ${size.size.toLowerCase()} — ${size.note}`));
    }
  }

  return card;
}

function renderFaithRow() {
  const roles = state.profile?.roles || [];
  if (!roles.includes("faith") && roles.length > 0) return null; // skip if she opted out of faith

  const b = state.bible || {};
  const read = countThisWeek(b.readVerses);
  const studied = countThisWeek(b.studiedVerses);
  const prayers = countArrayThisWeek(state.life?.faith?.prayers, (x) => x.createdAt || x.at);
  const gratitude = countArrayThisWeek(state.life?.gratitude?.entries, (x) => x.createdAt || x.at);

  return h("section", { class: "card" }, [
    h("h2", {}, "✝️ Faith this week"),
    h("div", { class: "stat-grid" }, [
      h("div", { class: "stat" }, [h("div", { class: "label" }, "Verses read"),    h("div", { class: "value" }, read)]),
      h("div", { class: "stat" }, [h("div", { class: "label" }, "Verses studied"), h("div", { class: "value" }, studied)]),
      h("div", { class: "stat" }, [h("div", { class: "label" }, "Prayers"),        h("div", { class: "value" }, prayers)]),
      h("div", { class: "stat" }, [h("div", { class: "label" }, "Gratitude"),      h("div", { class: "value" }, gratitude)]),
    ]),
    studied > 0 && h("div", { class: "sub", style: "margin-top:8px" },
      "You didn't just read Scripture — you studied it. That's a different kind of depth."),
  ]);
}

function renderBodyRow() {
  const p = state.life?.pregnancy;
  if (!p) return null;
  const bodyCount = countArrayThisWeek(p.bodyLog, (x) => x.createdAt);
  const kicks = countArrayThisWeek(p.kickSessions, (x) => x.at);
  const appts = (p.appointments || []).filter((a) => {
    const d = new Date(a.date + "T00:00:00").getTime();
    return d >= Date.now() && d <= Date.now() + 14 * 86400000;
  }).length;

  return h("section", { class: "card" }, [
    h("h2", {}, "🤰 Body + baby"),
    h("div", { class: "stat-grid" }, [
      h("div", { class: "stat" }, [h("div", { class: "label" }, "Body log entries"), h("div", { class: "value" }, bodyCount)]),
      h("div", { class: "stat" }, [h("div", { class: "label" }, "Kick sessions"),    h("div", { class: "value" }, kicks)]),
      h("div", { class: "stat" }, [h("div", { class: "label" }, "Upcoming appts"),  h("div", { class: "value" }, appts)]),
    ]),
    bodyCount === 0 && p.dueDate && h("div", { class: "sub", style: "margin-top:8px" },
      "No body-log notes this week. When anything feels off, write it down — even one word. Your OB will want to know patterns, not just one-offs."),
  ]);
}

function renderMeTimeRow() {
  const m = state.metime || {};
  const weekAgo = Date.now() - 7 * 86400000;
  const mins = (m.sessions || [])
    .filter((s) => s.endedAt && new Date(s.endedAt).getTime() >= weekAgo)
    .reduce((sum, s) => sum + (s.minutes || 0), 0);
  const goalMin = (m.weeklyGoalHours || 2) * 60;
  const pct = Math.min(100, Math.round((mins / goalMin) * 100));

  return h("section", { class: "card" }, [
    h("h2", {}, "💖 Me Time this week"),
    h("div", { class: "progress-bar" }, [
      h("div", { class: "progress-fill", style: `width: ${pct}%` }),
    ]),
    h("div", { class: "sub", style: "margin-top:6px" },
      `${Math.round(mins)} of ${goalMin} minutes — ${pct}% of your weekly commitment.`),
    mins === 0 && h("div", { class: "sub", style: "margin-top:8px" },
      "Zero minutes this week. That's not a failure — that's a flag. You deserve an hour that's yours."),
  ]);
}

function renderHabitsRow() {
  const items = state.habits?.items || [];
  const log = state.habits?.log || {};
  const weekAgo = Date.now() - 7 * 86400000;
  const doneCount = Object.keys(log).filter((k) => {
    const [, date] = k.split(":");
    return date && new Date(date + "T00:00:00").getTime() >= weekAgo && log[k];
  }).length;

  if (items.length === 0) return null;
  return h("section", { class: "card" }, [
    h("h2", {}, "🎯 Habits"),
    h("div", { class: "stat-grid" }, [
      h("div", { class: "stat" }, [h("div", { class: "label" }, "Tracked"),         h("div", { class: "value" }, items.length)]),
      h("div", { class: "stat" }, [h("div", { class: "label" }, "Check-ins"),       h("div", { class: "value" }, doneCount)]),
    ]),
  ]);
}

function renderLettersRow() {
  const letters = state.life?.pregnancy?.letters || [];
  if (letters.length === 0) return null;
  const last = letters[0];
  const days = last?.createdAt ? Math.floor((Date.now() - last.createdAt) / 86400000) : null;
  return h("section", { class: "card" }, [
    h("h2", {}, "💌 Letters to baby"),
    h("div", { class: "stat-grid" }, [
      h("div", { class: "stat" }, [h("div", { class: "label" }, "Total"), h("div", { class: "value" }, letters.length)]),
      h("div", { class: "stat" }, [h("div", { class: "label" }, "Last written"), h("div", { class: "value" }, days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days}d ago`)]),
    ]),
  ]);
}

function renderSupportRow() {
  const supporters = state.life?.family?.supporters || [];
  const partnerLinked = !!state.profile?.partnerName;
  return h("section", { class: "card" }, [
    h("h2", {}, "🤝 Your people"),
    h("div", { class: "sub" }, partnerLinked
      ? `${state.profile.partnerName} is on your profile. Invite them to the app from Settings → Household.`
      : "You haven't listed a partner yet. That's okay — you don't need one to use this. When you're ready, add them in Settings."),
    supporters.length > 0 && h("div", { class: "meta", style: "margin-top:8px" },
      `Plus ${supporters.length} supporter${supporters.length === 1 ? "" : "s"} in your circle.`),
  ]);
}

function renderNextNudges() {
  const nudges = [];
  const p = state.life?.pregnancy;
  const b = state.bible || {};
  const m = state.metime || {};

  const read = countThisWeek(b.readVerses);
  const bodyCount = countArrayThisWeek(p?.bodyLog, (x) => x.createdAt);
  const weekAgo = Date.now() - 7 * 86400000;
  const meMins = (m.sessions || [])
    .filter((s) => s.endedAt && new Date(s.endedAt).getTime() >= weekAgo)
    .reduce((sum, s) => sum + (s.minutes || 0), 0);

  if (p?.dueDate && !p.letters?.length) {
    nudges.push({ emoji: "💌", text: "Write your first letter to your baby. Short is fine." });
  }
  if (read === 0 && (state.profile?.roles || []).includes("faith")) {
    nudges.push({ emoji: "✝️", text: "Today's verse is on your Home tab. One tap to mark it read." });
  }
  if (p?.dueDate && bodyCount === 0) {
    nudges.push({ emoji: "📝", text: "Jot down how your body's feeling, even one line. Patterns matter at your next appointment." });
  }
  if (meMins === 0) {
    nudges.push({ emoji: "💖", text: "Open Me Time and start a short session — 20 minutes is enough." });
  }

  if (!nudges.length) return null;
  return h("section", { class: "card" }, [
    h("h2", {}, "Gentle nudges"),
    h("div", { class: "sub" }, "No pressure. Just one thing, if you want to."),
    h("div", { class: "list", style: "margin-top:8px" }, nudges.map((n) =>
      h("div", { class: "item" }, [
        h("div", { style: "font-size:1.5rem" }, n.emoji),
        h("div", {}, n.text),
      ])
    )),
  ]);
}

export function renderMommy(mount) {
  mount.append(renderHero());
  const faith = renderFaithRow(); if (faith) mount.append(faith);
  const body = renderBodyRow(); if (body) mount.append(body);
  mount.append(renderMeTimeRow());
  const habits = renderHabitsRow(); if (habits) mount.append(habits);
  const letters = renderLettersRow(); if (letters) mount.append(letters);
  mount.append(renderSupportRow());
  const nudges = renderNextNudges(); if (nudges) mount.append(nudges);
}
