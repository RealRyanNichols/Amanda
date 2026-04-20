// Price-anchor helpers — reframe the voice top-up charge against things she
// already spends money on. Ryan's insight: "$2.99 is worth a lot more than
// a coffee. Mom pays $5 for a coffee."
//
// Strategy:
//   1. Time-of-day anchor (morning = coffee, lunch = Chipotle, afternoon =
//      Target run, evening = takeout, late night = wine/snack).
//   2. If her Bills / Income data shows a relevant recurring expense
//      (Netflix, Amazon Prime, Starbucks subscription), reference it.
//   3. Rotate benefit bullets so the paywall doesn't look static.

import { state } from "./store.js";

const TIME_ANCHORS = [
  { hours: [5, 6, 7, 8, 9, 10],        text: "less than your morning coffee" },
  { hours: [11, 12, 13],               text: "about half a Chipotle bowl" },
  { hours: [14, 15, 16],               text: "cheaper than the snack in the Target checkout" },
  { hours: [17, 18, 19],               text: "less than the kids' cupcakes you keep buying" },
  { hours: [20, 21, 22],               text: "less than that takeout you were about to order" },
  { hours: [23, 0, 1, 2, 3, 4],        text: "less than one glass of wine" },
];

const WEEKDAY_ANCHORS = [
  { days: [5, 6], text: "cheaper than one trip through the drive-thru this weekend" },
  { days: [0],    text: "less than the Sunday Starbucks you buy after church" },
];

const GENERIC_ANCHORS = [
  "less than a Happy Meal",
  "cheaper than a bottle of shampoo",
  "less than the Amazon delivery tip",
  "about the price of a candle at Target",
  "less than an hour of parking downtown",
  "cheaper than the snack machine in the hospital lobby",
];

export function contextualAnchor() {
  // Check user's bills first — if she's tracking a relevant subscription,
  // use that as the comparison (feels personal, data-informed).
  const bills = state.income?.bills || [];
  for (const b of bills) {
    const name = (b.name || "").toLowerCase();
    if (!b.paid && b.amount >= 10 && b.amount <= 25) {
      if (/netflix|hulu|disney|spotify|apple\s*tv|paramount|hbo/.test(name)) {
        return `less than your ${b.name} bill this month`;
      }
    }
  }

  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sunday

  // Weekday check first (more specific than hour-based)
  for (const a of WEEKDAY_ANCHORS) {
    if (a.days.includes(day)) {
      // 50% chance of using weekday anchor when applicable
      if (Math.random() < 0.5) return a.text;
    }
  }

  const match = TIME_ANCHORS.find((a) => a.hours.includes(hour));
  if (match) return match.text;

  return GENERIC_ANCHORS[Math.floor(Math.random() * GENERIC_ANCHORS.length)];
}

// Benefit copy — what extra voice time actually lets her DO. Rotates so the
// paywall feels different every time she sees it.
const BENEFIT_LINES = [
  "Vent about the hard morning",
  "Talk through the decision you've been avoiding",
  "Write a long letter to your baby by voice",
  "Pray out loud without editing yourself",
  "Brain-dump what's on your mind before sleep",
  "Journal the week you've been through",
  "Think out loud about your business",
  "Get a gentle check-in from someone who listens",
];

export function pickBenefits(n = 3) {
  // Shuffle + take first n
  const arr = [...BENEFIT_LINES];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

// Short headline for the paywall — cycles based on what she's done in the app
// recently.
export function paywallHeadline() {
  const brainMsgs = (state.brain?.history || []).length;
  const letters = (state.life?.pregnancy?.letters || []).length;
  const vented = brainMsgs > 10;

  if (vented) return "You've been leaning on me today — I loved it. Let's keep going.";
  if (letters >= 1) return "Keep talking to your baby. Keep talking to me.";
  return "You've used your free 5 minutes. It's a good kind of used.";
}
