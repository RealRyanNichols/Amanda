// Bible reading plans — local-only, zero AI cost, high retention.
// Renders inside the Bible tab's Browse view (below the translation picker).
//
// Plans shipped:
//   - Bible in a Year (chronological Genesis → Revelation, split across 365 days)
//   - Proverbs a Day (31 chapters — one per calendar day, loops)
//   - Psalms a Day (150 chapters — ~5-month cycle)
//   - New Testament in 90 Days
//
// State: state.bible.plan = { id, startedAt, completedDays: ["YYYY-MM-DD", ...] }

import { state, save } from "../store.js";
import { h, toast, friendlyDate, todayISO } from "../util.js";

const BOOKS_OT = ["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi"];
const BOOKS_NT = ["Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"];

// Chapter counts for each book (parallel index with the arrays above)
const CHAPTERS_OT = [50,40,27,36,34,24,21,4,31,24,22,25,29,36,10,13,10,42,150,31,12,8,66,52,5,48,12,14,3,9,1,4,7,3,3,3,2,14,4];
const CHAPTERS_NT = [28,16,24,21,28,16,16,13,6,6,4,4,5,3,6,4,3,1,13,5,5,3,5,1,1,1,22];

// Expand every book into a flat list of "Book N" references in order
function flattenReferences(books, chapters) {
  const out = [];
  for (let i = 0; i < books.length; i++) {
    for (let c = 1; c <= chapters[i]; c++) {
      out.push(`${books[i]} ${c}`);
    }
  }
  return out;
}

// Build balanced daily allocations — split the full list into N equal days
function splitIntoDays(references, days) {
  const perDay = Math.ceil(references.length / days);
  const out = [];
  for (let i = 0; i < references.length; i += perDay) {
    out.push(references.slice(i, i + perDay));
  }
  return out;
}

export const PLANS = {
  "bible-year": {
    id: "bible-year",
    name: "Bible in a Year",
    subtitle: "Genesis → Revelation, 3-4 chapters a day",
    days: 365,
    buildSchedule() {
      const all = flattenReferences(BOOKS_OT, CHAPTERS_OT).concat(flattenReferences(BOOKS_NT, CHAPTERS_NT));
      return splitIntoDays(all, 365);
    },
  },
  "new-testament-90": {
    id: "new-testament-90",
    name: "New Testament in 90 Days",
    subtitle: "Matthew → Revelation, 3 chapters a day",
    days: 90,
    buildSchedule() {
      const nt = flattenReferences(BOOKS_NT, CHAPTERS_NT);
      return splitIntoDays(nt, 90);
    },
  },
  "proverbs-daily": {
    id: "proverbs-daily",
    name: "Proverbs a Day",
    subtitle: "One chapter every day of the month — loops forever",
    days: 31,
    buildSchedule() {
      return Array.from({ length: 31 }, (_, i) => [`Proverbs ${i + 1}`]);
    },
  },
  "psalms-daily": {
    id: "psalms-daily",
    name: "Psalms a Day",
    subtitle: "One psalm a day — full cycle in 5 months",
    days: 150,
    buildSchedule() {
      return Array.from({ length: 150 }, (_, i) => [`Psalm ${i + 1}`]);
    },
  },
};

function planState() {
  if (!state.bible) state.bible = {};
  if (!state.bible.plan) state.bible.plan = { id: "", startedAt: null, completedDays: [] };
  return state.bible.plan;
}

export function activePlan() {
  const p = planState();
  if (!p.id) return null;
  return PLANS[p.id] || null;
}

export function dayNumber() {
  const p = planState();
  if (!p.startedAt) return 0;
  const ms = Date.now() - p.startedAt;
  return Math.floor(ms / 86400000) + 1;
}

export function todayReadings() {
  const plan = activePlan();
  if (!plan) return null;
  const schedule = plan.buildSchedule();
  const n = dayNumber();
  if (n < 1 || n > plan.days) return null;
  return schedule[(n - 1) % schedule.length];
}

function startPlan(id) {
  const p = planState();
  p.id = id;
  p.startedAt = Date.now();
  p.completedDays = [];
  save();
  toast("Plan started — today's reading is ready");
}

function markTodayDone() {
  const p = planState();
  const today = todayISO();
  if (!p.completedDays) p.completedDays = [];
  if (!p.completedDays.includes(today)) p.completedDays.push(today);
  save();
  toast("Great. See you tomorrow.");
}

function isTodayDone() {
  return (planState().completedDays || []).includes(todayISO());
}

export function renderPlanCard(rerender) {
  const plan = activePlan();
  if (!plan) {
    return h("section", { class: "card" }, [
      h("h2", {}, "Reading plan"),
      h("div", { class: "sub" }, "Pick one. A little every day beats all-at-once."),
      h("div", { class: "list" },
        Object.values(PLANS).map((p) => h("div", { class: "item" }, [
          h("div", {}, [
            h("div", { class: "title" }, p.name),
            h("div", { class: "meta" }, p.subtitle + " · " + p.days + " days"),
          ]),
          h("div", { class: "actions" }, [
            h("button", { class: "btn small", onclick: () => { startPlan(p.id); rerender(); } }, "Start"),
          ]),
        ]))),
    ]);
  }

  const n = dayNumber();
  const readings = todayReadings();
  const done = isTodayDone();
  const completed = (planState().completedDays || []).length;
  const progressPct = Math.min(100, Math.round((completed / plan.days) * 100));

  return h("section", { class: "card bible-continue" }, [
    h("div", { class: "sub" }, `${plan.name} · day ${Math.min(n, plan.days)} of ${plan.days}`),
    h("h2", {}, done ? "Today's reading — done ✓" : "Today's reading"),
    readings && readings.length ? h("ul", { class: "reading-list" },
      readings.map((ref) => h("li", {}, ref))
    ) : h("div", { class: "empty" }, "Plan finished — start another."),
    h("div", { class: "progress", style: "margin-top:12px" }, [
      h("span", { style: `width:${progressPct}%` }),
    ]),
    h("div", { class: "meta", style: "margin-top:6px" }, `${completed} days read · ${progressPct}%`),
    h("div", { class: "btn-row", style: "margin-top:10px" }, [
      !done && h("button", { class: "btn", onclick: () => { markTodayDone(); rerender(); } }, "I read it today"),
      h("button", {
        class: "btn secondary",
        onclick: () => {
          if (!confirm(`Stop "${plan.name}"? Your progress stays saved in case you want to come back.`)) return;
          planState().id = "";
          save(); rerender();
        },
      }, "Pick a different plan"),
    ]),
  ]);
}
