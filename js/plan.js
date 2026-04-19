// Plan gates — free tier vs trial vs paid.
//
// Structure (recap):
//   ALWAYS FREE: bible, gratitude, prayers, me-time-basic, 3 habits,
//     letters (write-only), kids roster, settings.
//   14-DAY TRIAL: everything unlocked.
//   POST-TRIAL FREE: warmth tier stays + Brain capped at 10 min/day.
//   PAID: unlimited.
//
// Client-side gating only. Server-side enforcement happens when Supabase
// auth is live (desktop phase). For now, the tier is stored locally in
// state.plan and can be bypassed — acceptable for MVP until we have
// accounts.

import { state, save } from "./store.js";

const TRIAL_DAYS = 14;

// Features that stay free FOREVER (zero/near-zero cost to serve)
const ALWAYS_FREE_TABS = new Set([
  "dashboard",   // home (with upgrade banner if not paid)
  "settings",
  "bible",
  "habits",      // limited to 3 habits in free
  "metime",      // basic only in free
]);

// Features that unlock during trial and require paid after
const PAID_ONLY_TABS = new Set([
  "capture",
  "calendar",
  "search",
  "vault",
  "income",
  "booking",
  "career",
  "academy",
  "meals",
  "overload",
  "followup",
  "social",
  "babyyear",
]);

// Life + Brain are free-tier-accessible but with restrictions inside
const FREE_WITH_LIMITS = new Set([
  "life",   // faith + family + gratitude free; pregnancy + love notes + letter AI gated
  "brain",  // 10 min/day Haiku on free; everything else gated
  "store",  // always accessible — it's the upgrade surface
]);

export function initPlan() {
  if (!state.plan) state.plan = { tier: "trial", trialStartedAt: null, brainMinutesToday: 0, brainMinutesDate: "" };
  // Auto-start trial the first time a user who has no tier reaches this code
  if (state.plan.tier === "trial" && !state.plan.trialStartedAt) {
    state.plan.trialStartedAt = Date.now();
    save();
  }
  // Reset daily minutes at midnight local
  const today = new Date().toISOString().slice(0, 10);
  if (state.plan.brainMinutesDate !== today) {
    state.plan.brainMinutesDate = today;
    state.plan.brainMinutesToday = 0;
    save();
  }
  // Auto-transition trial → free when expired
  if (state.plan.tier === "trial" && trialDaysLeft() <= 0) {
    state.plan.tier = "free";
    save();
  }
}

export function tier() {
  return state.plan?.tier || "trial";
}

export function trialDaysLeft() {
  const started = state.plan?.trialStartedAt;
  if (!started) return TRIAL_DAYS;
  const elapsed = (Date.now() - started) / 86400000;
  return Math.max(0, Math.ceil(TRIAL_DAYS - elapsed));
}

export function isPaid() {
  const t = tier();
  return t === "core" || t === "ultra" || t === "core_annual" || t === "ultra_annual";
}

export function isInTrial() {
  return tier() === "trial" && trialDaysLeft() > 0;
}

export function isFree() {
  return !isPaid() && !isInTrial();
}

// Does the user have unrestricted access to a given tab right now?
export function canAccessTab(tabKey) {
  if (isPaid() || isInTrial()) return true;
  if (ALWAYS_FREE_TABS.has(tabKey)) return true;
  if (FREE_WITH_LIMITS.has(tabKey)) return true; // UI shows limits
  return false;
}

// Per-feature gates inside a tab — use these for fine-grained locking
export function canUseFeature(feature) {
  if (isPaid() || isInTrial()) return true;
  const freeFeatures = new Set([
    "bible-read",
    "gratitude-log",
    "prayer-write",        // free: write; gated: AI scripture suggestions
    "letter-write",        // free: write + save; gated: voice, AI tidy, templates
    "me-time-session",     // free: start/stop + log; gated: affirmations, rewards
    "habit-track",         // free: track; gated: more than 3 habits
    "kids-roster",
    "data-export",
    "daily-verse",
  ]);
  return freeFeatures.has(feature);
}

// How many habits she can add on free tier
export const FREE_HABIT_LIMIT = 3;

// Brain: free-tier voice minute budget per day
export const FREE_BRAIN_MINUTES_DAY = 10;

export function brainMinutesLeftToday() {
  if (isPaid() || isInTrial()) return Infinity;
  const used = state.plan?.brainMinutesToday || 0;
  return Math.max(0, FREE_BRAIN_MINUTES_DAY - used);
}

export function creditBrainMinutes(minutes) {
  if (!state.plan) state.plan = {};
  state.plan.brainMinutesToday = (state.plan.brainMinutesToday || 0) + minutes;
  save();
}

// For the big upgrade card
export function upgradeMessage() {
  if (isPaid()) return null;
  if (isInTrial()) {
    const d = trialDaysLeft();
    return `Trial · ${d} day${d === 1 ? "" : "s"} left of full access`;
  }
  return "Free · unlock everything for $19/mo";
}
