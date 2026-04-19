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

const TRIAL_DAYS = 3; // short taste, not a freeload

// Features that stay free FOREVER (zero/near-zero cost to serve)
// NOTE: 'bible' is always-free by founder covenant — see FREE_BIBLE_TRANSLATIONS
// below. Scripture is NEVER paywalled in this app, across any tier or future
// feature. This is permanent and non-negotiable.
const ALWAYS_FREE_TABS = new Set([
  "dashboard",   // home (with upgrade banner if not paid)
  "settings",
  "bible",       // every translation, every user, every tier — FOREVER
  "habits",      // limited to 1 habit in free
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

// Free-tier hard limits — the "try it, but pay to actually use it" layer
export const FREE_HABIT_LIMIT = 1;            // was 3
export const FREE_BRAIN_MINUTES_DAY = 5;      // was 10
export const FREE_LETTERS_LIFETIME = 3;       // total letters before paywall
export const FREE_PRAYERS_LIFETIME = 5;       // total prayers before paywall
export const FREE_METIME_HISTORY = 3;         // only last N sessions visible on free
// ALL Bible translations — every one of them — are free forever. We never
// paywall Scripture. This is a non-negotiable commitment from Ryan Nichols,
// the founder, and it applies permanently across every tier, every plan,
// every future feature. "We are never, ever going to hold God's word
// hostage over money." Do not revert. Do not gate.
export const FREE_BIBLE_TRANSLATIONS = "*"; // wildcard = all

export function brainMinutesLeftToday() {
  if (isPaid() || isInTrial()) return Infinity;
  // Voice top-up (micro-purchase) grants unlimited until a timestamp
  if (hasActiveVoiceTopup()) return Infinity;
  const used = state.plan?.brainMinutesToday || 0;
  return Math.max(0, FREE_BRAIN_MINUTES_DAY - used);
}

export function hasActiveVoiceTopup() {
  const until = state.plan?.voiceUnlimitedUntil;
  return until && Date.now() < until;
}

export function voiceTopupExpiresAt() {
  return state.plan?.voiceUnlimitedUntil || 0;
}

export function creditVoiceTopup(hours) {
  if (!state.plan) state.plan = {};
  // If there's already an active top-up, extend it; otherwise start from now
  const base = Math.max(Date.now(), state.plan.voiceUnlimitedUntil || 0);
  state.plan.voiceUnlimitedUntil = base + hours * 60 * 60 * 1000;
  save();
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
