import { state, save, uid } from "../store.js";
import { h, toast, confirmAction, todayISO, friendlyDate } from "../util.js";

const DEFAULT_HABITS = [
  { label: "Prenatal vitamin",      emoji: "💊", category: "health" },
  { label: "Drink water (8 cups)",  emoji: "💧", category: "health" },
  { label: "Bible reading",         emoji: "📖", category: "faith" },
  { label: "Pray",                  emoji: "🙏", category: "faith" },
  { label: "Walk / move",           emoji: "🚶", category: "health" },
  { label: "Gratitude (3 things)",  emoji: "✨", category: "mind" },
  { label: "Sleep 7+ hours",        emoji: "😴", category: "health" },
];

function seedIfNeeded() {
  if (state.habits.seeded) return;
  state.habits.items = DEFAULT_HABITS.map((d) => ({
    id: uid(),
    label: d.label,
    emoji: d.emoji,
    category: d.category,
    schedule: "daily",
    createdAt: Date.now(),
  }));
  state.habits.seeded = true;
  save();
}

function key(habitId, dateISO) { return `${habitId}:${dateISO}`; }

function isDone(habitId, dateISO) {
  return !!state.habits.log[key(habitId, dateISO)];
}

function toggle(habitId, dateISO) {
  const k = key(habitId, dateISO);
  if (state.habits.log[k]) delete state.habits.log[k];
  else state.habits.log[k] = true;
  save();
}

function streakFor(habitId) {
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (isDone(habitId, d.toISOString().slice(0, 10))) streak++;
    else if (i > 0) break;  // today not yet done is OK — don't break streak on day 0
  }
  return streak;
}

function completionRate30d(habitId) {
  const today = new Date();
  let done = 0, total = 30;
  for (let i = 0; i < total; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (isDone(habitId, d.toISOString().slice(0, 10))) done++;
  }
  return Math.round((done / total) * 100);
}

function renderTodayCard(rerender) {
  const today = todayISO();
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Today"),
    h("div", { class: "sub" }, friendlyDate(today) + " · tap to check off"),
  ]);

  if (!state.habits.items.length) {
    card.append(h("div", { class: "empty" }, "No habits yet. Add your first below."));
    return card;
  }

  const list = h("div", { class: "habit-today" });
  state.habits.items.forEach((hb) => {
    const done = isDone(hb.id, today);
    const streak = streakFor(hb.id);
    list.append(h("button", {
      class: "habit-tile" + (done ? " done" : ""),
      onclick: () => { toggle(hb.id, today); rerender(); },
    }, [
      h("div", { class: "habit-emoji" }, hb.emoji),
      h("div", { class: "habit-label" }, hb.label),
      streak > 0 && h("div", { class: "habit-streak" }, `🔥 ${streak}`),
    ]));
  });
  card.append(list);

  const doneCount = state.habits.items.filter((hb) => isDone(hb.id, today)).length;
  const total = state.habits.items.length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;
  card.append(h("div", { class: "sub", style: "margin-top:12px; text-align:center" },
    `${doneCount} of ${total} done · ${pct}%`));
  card.append(h("div", { class: "progress", style: "margin-top:6px" }, [
    h("span", { style: `width:${pct}%` }),
  ]));

  return card;
}

function renderWeekGrid() {
  const card = h("section", { class: "card" }, [
    h("h2", {}, "This week"),
    h("div", { class: "sub" }, "Green means done. Scan for patterns."),
  ]);

  const today = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const table = h("div", { class: "habit-week" });
  const header = h("div", { class: "habit-week-row header" }, [
    h("div", { class: "habit-week-label" }, "Habit"),
    ...days.map((d) => {
      const dd = new Date(d + "T00:00:00");
      return h("div", { class: "habit-week-day" },
        dd.toLocaleDateString(undefined, { weekday: "narrow" }) + " " + dd.getDate()
      );
    }),
  ]);
  table.append(header);

  state.habits.items.forEach((hb) => {
    const row = h("div", { class: "habit-week-row" }, [
      h("div", { class: "habit-week-label" }, [hb.emoji, " ", hb.label]),
      ...days.map((d) => h("div", {
        class: "habit-week-cell" + (isDone(hb.id, d) ? " done" : ""),
      }, isDone(hb.id, d) ? "✓" : "")),
    ]);
    table.append(row);
  });

  card.append(table);
  return card;
}

function renderManageCard(rerender) {
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Manage habits"),
    h("div", { class: "sub" }, "Add your own. Remove anything that doesn't fit right now."),
  ]);

  const form = h("form", { class: "form-row three", onsubmit: (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const label = (f.get("label") || "").toString().trim();
    if (!label) return;
    state.habits.items.push({
      id: uid(),
      label,
      emoji: (f.get("emoji") || "✨").toString().trim() || "✨",
      category: "custom",
      schedule: "daily",
      createdAt: Date.now(),
    });
    save(); e.target.reset(); rerender();
  } }, [
    h("label", { class: "field" }, ["Emoji", h("input", { type: "text", name: "emoji", maxlength: "3", placeholder: "✨" })]),
    h("label", { class: "field", style: "grid-column: span 2" }, ["Habit", h("input", { type: "text", name: "label", required: true, placeholder: "e.g. Stretch 10 min" })]),
    h("div", { class: "btn-row", style: "grid-column: 1 / -1" }, [h("button", { class: "btn", type: "submit" }, "+ Add habit")]),
  ]);
  card.append(form);

  const list = h("div", { class: "list", style: "margin-top:10px" });
  state.habits.items.forEach((hb) => {
    const rate = completionRate30d(hb.id);
    list.append(h("div", { class: "item" }, [
      h("div", {}, [
        h("div", { class: "title" }, `${hb.emoji} ${hb.label}`),
        h("div", { class: "meta" }, `Last 30 days: ${rate}%`),
      ]),
      h("div", { class: "actions" }, [
        h("button", {
          class: "btn small danger",
          onclick: () => {
            if (!confirmAction(`Remove "${hb.label}"?`)) return;
            state.habits.items = state.habits.items.filter((x) => x.id !== hb.id);
            save(); rerender();
          },
        }, "×"),
      ]),
    ]));
  });
  card.append(list);

  return card;
}

export function renderHabits(mount, { rerender }) {
  seedIfNeeded();
  mount.append(renderTodayCard(rerender));
  mount.append(renderWeekGrid());
  mount.append(renderManageCard(rerender));
}
