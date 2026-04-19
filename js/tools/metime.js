// Me Time — the self-care tab. Ryan's vision: every mom needs at least 1-2
// hours a week to herself. Not optional. The app helps her commit, track,
// gamify (gently, not kiddy), and when she's missing, tells her WHY she
// deserves it.

import { state, save, uid } from "../store.js";
import { h, toast, confirmAction, todayISO, friendlyDate, daysFromNow } from "../util.js";
import { micButton } from "../voice.js";

const WHY_SHE_DESERVES_IT = [
  "The world will not end if you take an hour. It won't even notice. But you will.",
  "Your kids learn how to love themselves by watching how you love yourself.",
  "You cannot pour from an empty cup. Fill yours first — always.",
  "Your rest isn't a reward you earn after finishing everything. It's part of the everything.",
  "Being a mom doesn't mean you stop being a person. The person is still there. Go meet her.",
  "Your body has been working for other people for years. It deserves one hour.",
  "An hour alone today is not selfish. Burnout in six months will cost everyone more.",
  "Your husband / partner / kids love YOU — not just what you do for them. Let them see YOU.",
  "Taking time for yourself models to your daughter what self-worth looks like.",
  "Jesus took time alone. If it was good for Him, it's good for you.",
  "The woman you were before motherhood is not gone. She's just tired. Let her come out.",
  "The laundry will wait. The dishes will wait. Your soul has been waiting longer.",
];

const REWARDS = [
  { atStreak: 1, key: "first-session",  label: "First Me Time session — celebrate 🎉" },
  { atStreak: 2, key: "week-1",         label: "Week 1 complete — you're starting a habit" },
  { atStreak: 4, key: "week-4",         label: "Four weeks straight — this is you now" },
  { atStreak: 8, key: "week-8",         label: "Two months. Research says habit formed." },
  { atStreak: 12, key: "week-12",       label: "Quarter-year of honoring yourself" },
  { atStreak: 26, key: "week-26",       label: "Half a year. You've changed your life." },
  { atStreak: 52, key: "week-52",       label: "A full year. Full circle. Full you." },
];

const ACTIVITIES = [
  { key: "bath",     emoji: "🛁", label: "Long bath" },
  { key: "walk",     emoji: "🚶", label: "Walk alone" },
  { key: "coffee",   emoji: "☕", label: "Coffee + silence" },
  { key: "book",     emoji: "📖", label: "Read" },
  { key: "nap",      emoji: "😴", label: "Nap" },
  { key: "friend",   emoji: "💬", label: "Friend time" },
  { key: "workout",  emoji: "💪", label: "Move your body" },
  { key: "pray",     emoji: "🙏", label: "Prayer / quiet" },
  { key: "nails",    emoji: "💅", label: "Nails / hair / beauty" },
  { key: "creative", emoji: "🎨", label: "Something creative" },
  { key: "other",    emoji: "✨", label: "Other" },
];

function mondayOf(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const shift = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + shift);
  return d.toISOString().slice(0, 10);
}

function minutesThisWeek() {
  const ws = mondayOf();
  return (state.metime.sessions || [])
    .filter((s) => s.endedAt && s.startedAt >= new Date(ws + "T00:00:00").getTime())
    .reduce((sum, s) => sum + (s.minutes || 0), 0);
}

function weeksMetGoal() {
  // Walk backward from most recent Monday, counting weeks where minutes >= goal
  const goal = (state.metime.weeklyGoalHours || 2) * 60;
  const sessions = state.metime.sessions || [];
  let streak = 0;
  let week = new Date(mondayOf() + "T00:00:00");
  // Include current week in streak only if she's met the goal; otherwise
  // look at previous weeks
  const thisWeek = minutesThisWeek();
  const metThis = thisWeek >= goal;
  if (!metThis) week.setDate(week.getDate() - 7);

  for (let i = 0; i < 104; i++) { // up to 2 years
    const start = new Date(week);
    const end = new Date(week); end.setDate(end.getDate() + 7);
    const mins = sessions
      .filter((s) => s.endedAt && s.startedAt >= start.getTime() && s.startedAt < end.getTime())
      .reduce((sum, s) => sum + (s.minutes || 0), 0);
    if (mins >= goal) streak++;
    else if (i > 0) break;
    week.setDate(week.getDate() - 7);
  }
  return streak + (metThis ? 1 : 0) - (metThis ? 1 : 0); // keep simple
}

function currentStreak() {
  // Simpler implementation: count consecutive weeks (backward from most recent) where goal was met
  const goal = (state.metime.weeklyGoalHours || 2) * 60;
  const sessions = state.metime.sessions || [];
  let streak = 0;
  let week = new Date(mondayOf() + "T00:00:00");

  while (true) {
    const start = new Date(week);
    const end = new Date(week); end.setDate(end.getDate() + 7);
    const mins = sessions
      .filter((s) => s.endedAt && s.startedAt >= start.getTime() && s.startedAt < end.getTime())
      .reduce((sum, s) => sum + (s.minutes || 0), 0);
    if (mins >= goal) streak++;
    else break;
    week.setDate(week.getDate() - 7);
    if (streak > 104) break;
  }
  return streak;
}

function earnedRewards() {
  const s = currentStreak();
  return REWARDS.filter((r) => s >= r.atStreak).map((r) => r.key);
}

function dueAffirmation() {
  // Rotate by day-of-year so it's consistent for the day but changes.
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((d - start) / 86400000);
  return WHY_SHE_DESERVES_IT[dayOfYear % WHY_SHE_DESERVES_IT.length];
}

function renderGoalCard(rerender) {
  const mt = state.metime;
  const goal = mt.weeklyGoalHours || 2;
  const thisWeekMins = minutesThisWeek();
  const pct = Math.min(100, Math.round((thisWeekMins / (goal * 60)) * 100));
  const metThisWeek = thisWeekMins >= goal * 60;
  const streak = currentStreak();

  const card = h("section", { class: "card metime-hero" }, [
    h("h2", {}, "You, this week"),
    metThisWeek
      ? h("div", { class: "sub ok-text" }, `✨ You hit your goal. ${Math.round(thisWeekMins / 60 * 10) / 10} hours. Proud of you.`)
      : h("div", { class: "sub" }, `${Math.round(thisWeekMins / 60 * 10) / 10} of ${goal} hours so far. Non-negotiable.`),

    h("div", { class: "progress", style: "margin-top:10px; height:12px" }, [
      h("span", { style: `width:${pct}%` }),
    ]),

    h("div", { class: "stat-grid", style: "margin-top:14px" }, [
      h("div", { class: "stat " + (metThisWeek ? "ok" : "") }, [
        h("div", { class: "label" }, "This week"),
        h("div", { class: "value" }, `${(thisWeekMins / 60).toFixed(1)}h`),
      ]),
      h("div", { class: "stat" }, [
        h("div", { class: "label" }, "Goal"),
        h("div", { class: "value" }, `${goal}h`),
      ]),
      h("div", { class: "stat " + (streak > 0 ? "ok" : "") }, [
        h("div", { class: "label" }, "Streak"),
        h("div", { class: "value" }, `🔥 ${streak}`),
      ]),
    ]),

    h("label", { class: "field", style: "margin-top:14px" }, [
      "My weekly goal",
      h("select", {
        onchange: (e) => { mt.weeklyGoalHours = Number(e.target.value); save(); rerender(); },
      }, [1, 2, 3, 5, 7, 10].map((n) =>
        h("option", { value: n, selected: goal === n }, `${n} hour${n > 1 ? "s" : ""} per week`)
      )),
    ]),
  ]);

  return card;
}

function renderSessionCard(rerender) {
  const mt = state.metime;
  const live = mt.currentSessionStart;
  const card = h("section", { class: "card" });

  if (!live) {
    card.append(h("h2", {}, "Start Me Time"));
    card.append(h("div", { class: "sub" }, "Tap an activity. Or just tap Start. I'll watch the clock so you can stop watching it."));

    const grid = h("div", { class: "metime-activities" });
    ACTIVITIES.forEach((a) => {
      grid.append(h("button", {
        class: "metime-activity",
        onclick: () => startSession(a, rerender),
      }, [
        h("div", { class: "metime-activity-emoji" }, a.emoji),
        h("div", { class: "metime-activity-label" }, a.label),
      ]));
    });
    card.append(grid);

    card.append(h("button", {
      class: "btn secondary",
      style: "width:100%; margin-top:8px",
      onclick: () => startSession({ key: "unspecified", label: "Me time", emoji: "💛" }, rerender),
    }, "Just start the clock"));

    return card;
  }

  // Live session
  const elapsedMin = Math.round((Date.now() - live.startedAt) / 60000);
  card.append(h("h2", {}, `In session · ${live.activity.emoji} ${live.activity.label}`));
  card.append(h("div", { class: "metime-live-timer" }, `${elapsedMin} min`));
  card.append(h("div", { class: "sub" }, "Whenever you're ready — no rush. Come back and stop the clock."));

  const refInput = h("textarea", {
    placeholder: "Optional: what did it feel like? (one line)",
    rows: "2",
    id: "metime-reflection",
  });

  card.append(refInput);
  card.append(h("div", { class: "btn-row" }, [
    micButton(refInput),
    h("button", {
      class: "btn",
      onclick: () => endSession(refInput.value, rerender),
    }, "I'm done"),
    h("button", {
      class: "btn secondary",
      onclick: () => {
        if (!confirmAction("Cancel this session (not count it)?")) return;
        mt.currentSessionStart = null; save(); rerender();
      },
    }, "Cancel"),
  ]));

  return card;
}

function startSession(activity, rerender) {
  state.metime.currentSessionStart = {
    startedAt: Date.now(),
    activity,
  };
  save();
  toast(`${activity.emoji} Clock started. Go. Be.`);
  rerender();
}

function endSession(reflection, rerender) {
  const mt = state.metime;
  const live = mt.currentSessionStart;
  if (!live) return;
  const minutes = Math.max(1, Math.round((Date.now() - live.startedAt) / 60000));
  mt.sessions.push({
    id: uid(),
    startedAt: live.startedAt,
    endedAt: Date.now(),
    minutes,
    activity: live.activity.key,
    activityLabel: live.activity.label,
    reflection: (reflection || "").trim(),
  });
  mt.currentSessionStart = null;
  save();

  // Check for reward unlocks
  const earned = earnedRewards();
  const prevRewards = new Set(mt.rewards || []);
  const newReward = earned.find((k) => !prevRewards.has(k));
  mt.rewards = earned;
  save();

  if (newReward) {
    const r = REWARDS.find((x) => x.key === newReward);
    celebrateReward(r, minutes);
  } else {
    toast(`${minutes} min logged. Proud of you.`);
  }
  rerender();
}

function celebrateReward(reward, sessionMinutes) {
  const overlay = document.createElement("div");
  overlay.className = "metime-celebration";
  overlay.innerHTML = `
    <div class="metime-celebration-card">
      <div class="metime-celebration-emoji">🎉</div>
      <h2>${reward.label}</h2>
      <p>You just logged ${sessionMinutes} minutes of you-time.</p>
      <p>This is the kind of thing that builds the woman your kids get to watch.</p>
      <button class="btn">Thank you</button>
    </div>`;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.tagName === "BUTTON") overlay.remove();
  });
  document.body.append(overlay);
}

function renderAffirmationCard() {
  const thisWeekMins = minutesThisWeek();
  const goal = (state.metime.weeklyGoalHours || 2) * 60;
  if (thisWeekMins >= goal) return h("span"); // she's already doing it

  const text = dueAffirmation();

  return h("section", { class: "card metime-affirmation" }, [
    h("div", { class: "metime-aff-label" }, "Why you deserve this"),
    h("div", { class: "metime-aff-text" }, text),
  ]);
}

function renderMissLog(rerender) {
  // If she didn't hit last week's goal, ask her gently what got in the way.
  const mt = state.metime;
  const lastMonday = new Date(mondayOf() + "T00:00:00");
  lastMonday.setDate(lastMonday.getDate() - 7);
  const start = lastMonday.getTime();
  const end = start + 7 * 86400000;
  const lastWeekMins = (mt.sessions || [])
    .filter((s) => s.endedAt && s.startedAt >= start && s.startedAt < end)
    .reduce((sum, s) => sum + (s.minutes || 0), 0);

  const goalMins = (mt.weeklyGoalHours || 2) * 60;
  if (lastWeekMins >= goalMins) return null;

  const lastMondayISO = lastMonday.toISOString().slice(0, 10);
  const alreadyLogged = (mt.missReasons || []).find((r) => r.weekStart === lastMondayISO);
  if (alreadyLogged) return null;

  const card = h("section", { class: "card metime-miss" }, [
    h("h2", {}, "Last week"),
    h("div", { class: "sub" },
      `You got ${(lastWeekMins / 60).toFixed(1)} of your ${mt.weeklyGoalHours} hours. No shame — but let's name what got in the way. Sometimes naming it is the first step.`),
  ]);

  const ta = h("textarea", {
    placeholder: "What took the hours? (Not looking for excuses — just truth.)",
    rows: "3",
    id: "metime-miss-input",
  });
  card.append(ta);
  card.append(h("div", { class: "btn-row" }, [
    micButton(ta),
    h("button", {
      class: "btn",
      onclick: () => {
        mt.missReasons.push({
          id: uid(),
          weekStart: lastMondayISO,
          reason: ta.value.trim() || "Didn't say",
          loggedAt: Date.now(),
        });
        save();
        toast("Heard. New week, fresh start.");
        rerender();
      },
    }, "Log it + move on"),
  ]));

  return card;
}

function renderHistory() {
  const mt = state.metime;
  if (!mt.sessions.length) return h("span");
  const recent = [...mt.sessions].sort((a, b) => b.endedAt - a.endedAt).slice(0, 10);

  const card = h("section", { class: "card" }, [
    h("h2", {}, "Recent sessions"),
    h("div", { class: "sub" }, "Proof that you do this."),
  ]);
  const list = h("div", { class: "list" });
  recent.forEach((s) => {
    const when = friendlyDate(new Date(s.startedAt).toISOString().slice(0, 10));
    list.append(h("div", { class: "item" }, [
      h("div", {}, [
        h("div", { class: "title" }, `${s.activityLabel || "Me time"} · ${s.minutes} min`),
        h("div", { class: "meta" }, when),
        s.reflection && h("div", { class: "meta", style: "color:var(--accent); margin-top:4px" }, "→ " + s.reflection),
      ]),
    ]));
  });
  card.append(list);
  return card;
}

function renderRewards() {
  const earned = new Set(state.metime.rewards || []);
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Milestones"),
    h("div", { class: "sub" }, "What the streak unlocks."),
  ]);
  const list = h("div", { class: "list" });
  REWARDS.forEach((r) => {
    const unlocked = earned.has(r.key);
    list.append(h("div", { class: "item", style: unlocked ? "" : "opacity:.45" }, [
      h("div", {}, [
        h("div", { class: "title" }, `${unlocked ? "🎉" : "🔒"} ${r.label}`),
        h("div", { class: "meta" }, `${r.atStreak}-week streak`),
      ]),
    ]));
  });
  card.append(list);
  return card;
}

export function renderMeTime(mount, { rerender }) {
  mount.append(renderGoalCard(rerender));
  const aff = renderAffirmationCard();
  if (aff && aff.tagName) mount.append(aff);
  const miss = renderMissLog(rerender);
  if (miss) mount.append(miss);
  mount.append(renderSessionCard(rerender));
  mount.append(renderHistory());
  mount.append(renderRewards());
}
