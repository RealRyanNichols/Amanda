// Upgrade wall — shown when a free-tier user opens a locked tab.
// Preview copy per tab so she sees what she'd get if she upgrades.

import { state } from "../store.js";
import { h } from "../util.js";
import { getPaymentLink } from "../stripe-config.js";
import { tier, trialDaysLeft, upgradeMessage } from "../plan.js";

const TAB_PREVIEWS = {
  capture: {
    emoji: "📸",
    title: "Capture",
    blurb: "Snap a photo — receipt, bill, business card, sonogram. AI reads it and files it. Meal photos can double-dip into a draft Instagram post with auto-caption.",
    bullets: [
      "Auto-files to the right tab in 3 seconds",
      "Double-dip: meal photo → meal log + IG draft",
      "Claude vision — works offline after load",
    ],
  },
  calendar: {
    emoji: "🗓️",
    title: "Calendar",
    blurb: "Every bill, booking, doctor visit, scheduled post, and lead follow-up in one month grid + upcoming list. One-tap to add any event to your iPhone/Google Calendar.",
    bullets: [
      "Pulls from every tab automatically",
      "Color-coded by event type",
      "iCal (.ics) export per event",
    ],
  },
  search: {
    emoji: "🔎",
    title: "Search everything",
    blurb: "Voice-powered search across leads, students, letters, recipes, posts, receipts — everything. Find 'Jessica' in one tap.",
    bullets: [
      "Indexes leads, bookings, students, letters, recipes, posts",
      "Push-to-talk search",
      "Scored by relevance",
    ],
  },
  vault: {
    emoji: "🔐",
    title: "Brain Wallet",
    blurb: "Your private document vault. Insurance cards, ID, tax docs, baby records — all on-device, categorized.",
    bullets: [
      "8 categories",
      "Camera capture with auto-compress",
      "Private — protected by your app PIN",
    ],
  },
  income: {
    emoji: "💵",
    title: "Income Stabilizer",
    blurb: "Log deposits + priority-tagged bills. Get an honest 'safe to spend this week' number from your real deposit history. Optional AI tough-love financial read.",
    bullets: [
      "Safe-to-spend math from your data",
      "Overdue bill alerts",
      "AI revenue trend analysis",
    ],
  },
  booking: {
    emoji: "📅",
    title: "Smart Booking + Payment",
    blurb: "Bookings with required deposits, balance tracking, reschedule-without-losing-deposit, automatic follow-up for unpaid balances.",
    bullets: [
      "Deposit-required scheduling",
      "Auto follow-up on unpaid balances",
      "One-tap text/call clients",
    ],
  },
  academy: {
    emoji: "🎓",
    title: "Academy (school owner)",
    blurb: "Students, cohorts, Texas RDA readiness checklist, hours tracking, tuition, attendance — plus an 11-module online course authoring tool with Kajabi export.",
    bullets: [
      "Per-student grad-readiness checklist",
      "Texas RDA compliance tracking",
      "Full online course authoring",
    ],
  },
  career: {
    emoji: "🧭",
    title: "Career Pathway",
    blurb: "Step-by-step paths for dental assisting, CDL, cosmetology, medical assisting, welding. Enroll → train → certify → hired.",
    bullets: [
      "5 trade pathways pre-seeded",
      "Progress tracking per step",
      "Cost + time estimates",
    ],
  },
  meals: {
    emoji: "🍽️",
    title: "Meals + Grocery",
    blurb: "Weekly meal plan, grocery list grouped by category, saved family recipes that push to grocery with one tap.",
    bullets: [
      "Mon-Sun meal planner",
      "Grocery grouped by aisle",
      "Recipe → grocery in one tap",
    ],
  },
  overload: {
    emoji: "🗂",
    title: "Organize (brain dump)",
    blurb: "Dump everything on your mind. The app auto-triages into Now / Today / This Week / Later / Feelings. 'Handle this first' card when things feel heavy.",
    bullets: [
      "Voice-dictate the whole dump",
      "Auto-categorized triage",
      "Emergency 'do this first' surfacing",
    ],
  },
  followup: {
    emoji: "📲",
    title: "Leads",
    blurb: "Hot/warm/cold CRM with automatic next-contact dates, one-tap text/call, AI-written follow-up scripts, overdue alerts.",
    bullets: [
      "Auto-schedule by temperature",
      "AI writes scripts per lead",
      "Overdue-lead alerts",
    ],
  },
  social: {
    emoji: "📣",
    title: "Social",
    blurb: "Profile handles, content planner with scheduling, AI caption writer (3 variants per photo), hashtag sets.",
    bullets: [
      "Drafts for FB / IG / TikTok",
      "Claude-written captions",
      "Saved hashtag bundles",
    ],
  },
  babyyear: {
    emoji: "🍼",
    title: "Baby's First Year",
    blurb: "Forward-looking milestone tracker. 24 pre-seeded milestones across 6 age brackets. Photos, growth log, well-baby visit schedule.",
    bullets: [
      "First smile, first word, first step — logged",
      "Camera capture per milestone",
      "Pediatrician visit schedule auto-dated",
    ],
  },
};

export function renderUpgradeWall(mount, tabKey) {
  const preview = TAB_PREVIEWS[tabKey] || {
    emoji: "✨",
    title: "Premium feature",
    blurb: "Upgrade to unlock.",
    bullets: [],
  };

  const coreLink = getPaymentLink("core-monthly");
  const annualLink = getPaymentLink("core-annual");
  const msg = upgradeMessage();

  const card = h("section", { class: "card upgrade-wall" }, [
    h("div", { class: "upgrade-emoji" }, preview.emoji),
    h("h2", {}, preview.title),
    h("div", { class: "sub" }, preview.blurb),
    h("ul", { class: "upgrade-bullets" },
      (preview.bullets || []).map((b) => h("li", {}, b))),

    h("div", { class: "upgrade-price-box" }, [
      h("div", { class: "upgrade-price" }, "$19/mo"),
      h("div", { class: "upgrade-annual" }, "or $190/year — save 2 months"),
      h("div", { class: "upgrade-includes" }, "Includes every tab. 7-day trial. Cancel anytime."),
    ]),

    h("div", { class: "btn-row" }, [
      coreLink
        ? h("a", { class: "btn upgrade-btn-main", href: coreLink }, "Start trial / Subscribe monthly")
        : h("button", {
            class: "btn upgrade-btn-main",
            onclick: () => alert("Stripe Payment Link not configured yet. Paste the URL for 'core-monthly' into js/stripe-config.js."),
          }, "Subscribe monthly"),
      annualLink && h("a", { class: "btn secondary", href: annualLink }, "Save with annual"),
    ]),

    msg && h("div", { class: "upgrade-status" }, msg),
  ]);

  mount.append(card);
}
