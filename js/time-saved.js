// Time Saved — tiny credit system. Each action she takes in the app gets
// a rough "minutes saved vs doing it the old way" credit. Shown on Home
// so she feels the ROI of using the app — and it ties into Me Time:
// "You saved 3 hours this week. Go spend it on you."

import { state, save } from "./store.js";
import { toast } from "./util.js";

function mondayOf() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const shift = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + shift);
  return d.toISOString().slice(0, 10);
}

function ensureWeek() {
  const ws = mondayOf();
  if (!state.timeSaved) state.timeSaved = { totalMinutes: 0, weekMinutes: 0, weekStart: ws };
  if (state.timeSaved.weekStart !== ws) {
    state.timeSaved.weekStart = ws;
    state.timeSaved.weekMinutes = 0;
  }
}

// Call this anywhere in the app when a "shortcut" happens.
// Rough heuristic: typing something manually into a spreadsheet/notes/email
// takes ~2-10 min. Our in-app form takes ~30 seconds. Credit the difference.
export function creditTimeSaved(minutes, action = "") {
  ensureWeek();
  state.timeSaved.totalMinutes += minutes;
  state.timeSaved.weekMinutes += minutes;
  save();
  // Silent by default — only toast on big chunks so she doesn't get spammed
  if (minutes >= 10) toast(`+${minutes} min saved · ${action}`);
}

export function getSaved() {
  ensureWeek();
  return {
    week: state.timeSaved.weekMinutes,
    total: state.timeSaved.totalMinutes,
  };
}

export function savedHoursThisWeek() {
  return Math.round((state.timeSaved?.weekMinutes || 0) / 60 * 10) / 10;
}
