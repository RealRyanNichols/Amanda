// Smart in-app reminders — scans her data when she opens the app and surfaces
// things that genuinely need her attention. Shown at the top of the Home
// dashboard. No push notifications yet (that needs a backend + VAPID);
// this is the "Hey Amanda, here are the things I noticed" passive version.

import { state } from "../store.js";
import { daysFromNow } from "../util.js";
import { detectPatterns } from "./body-journal.js";

export function scanForReminders() {
  const out = [];
  const today = new Date().toISOString().slice(0, 10);
  const first = state.profile?.firstName || "you";

  // Overdue bills — highest priority
  for (const b of state.income?.bills || []) {
    if (b.paid) continue;
    const d = daysFromNow(b.due);
    if (d == null) continue;
    if (d < 0) {
      out.push({
        priority: 1,
        icon: "⚠️",
        level: "bad",
        text: `${b.name} is ${Math.abs(d)} days overdue ($${Number(b.amount || 0).toFixed(2)}). Handle this first.`,
        go: "income",
      });
    } else if (d <= 2) {
      out.push({
        priority: 2,
        icon: "⏰",
        level: "warn",
        text: `${b.name} due in ${d === 0 ? "today" : d + " day" + (d === 1 ? "" : "s")} · $${Number(b.amount || 0).toFixed(2)}`,
        go: "income",
      });
    }
  }

  // Past-due lead follow-ups
  const leadsOverdue = (state.followup?.leads || [])
    .filter((l) => !l.closed && l.nextContact && daysFromNow(l.nextContact) <= 0);
  if (leadsOverdue.length) {
    const hotCount = leadsOverdue.filter((l) => l.temperature === "hot").length;
    out.push({
      priority: hotCount ? 2 : 3,
      icon: "📲",
      level: hotCount ? "warn" : "",
      text: `${leadsOverdue.length} lead${leadsOverdue.length > 1 ? "s" : ""} ready for follow-up${hotCount ? ` (${hotCount} hot!)` : ""}.`,
      go: "followup",
    });
  }

  // Bookings coming up today or tomorrow
  const upcomingBookings = (state.booking?.appointments || [])
    .filter((a) => !a.cancelled)
    .filter((a) => {
      const d = daysFromNow(a.date);
      return d != null && d >= 0 && d <= 1;
    });
  if (upcomingBookings.length) {
    const next = upcomingBookings[0];
    const when = daysFromNow(next.date) === 0 ? "today" : "tomorrow";
    out.push({
      priority: 3,
      icon: "📅",
      level: "",
      text: `${next.client} ${when}${next.time ? " at " + next.time : ""}.`,
      go: "booking",
    });
  }

  // Unpaid balances on past appointments
  const owedPast = (state.booking?.appointments || [])
    .filter((a) => !a.cancelled && daysFromNow(a.date) < 0)
    .filter((a) => Math.max(0, (a.price || 0) - (a.deposit || 0) - (a.paid || 0)) > 0);
  if (owedPast.length) {
    out.push({
      priority: 3,
      icon: "💰",
      level: "warn",
      text: `${owedPast.length} past appointment${owedPast.length > 1 ? "s have" : " has"} an unpaid balance.`,
      go: "booking",
    });
  }

  // Scheduled social posts due now
  const duePosts = (state.social?.posts || [])
    .filter((p) => p.status === "scheduled" && p.scheduledFor)
    .filter((p) => new Date(p.scheduledFor) <= new Date());
  if (duePosts.length) {
    out.push({
      priority: 3,
      icon: "📣",
      level: "warn",
      text: `${duePosts.length} social post${duePosts.length > 1 ? "s are" : " is"} ready to post now.`,
      go: "social",
    });
  }

  // Doctor visit today or tomorrow
  for (const v of state.life?.pregnancy?.appointments || []) {
    const d = daysFromNow(v.date);
    if (d != null && d >= 0 && d <= 1) {
      out.push({
        priority: 2,
        icon: "👶",
        level: "warn",
        text: `Doctor visit ${d === 0 ? "today" : "tomorrow"}${v.provider ? " · " + v.provider : ""}.`,
        go: "life",
      });
    }
  }

  // Haven't written a letter to baby in a while (if pregnant)
  if (state.life?.pregnancy?.dueDate) {
    const letters = state.life.pregnancy.letters || [];
    if (letters.length) {
      const lastLetter = Math.max(...letters.map((l) => l.createdAt || 0));
      const daysSince = (Date.now() - lastLetter) / 86400000;
      if (daysSince > 14) {
        const babyName = state.life.pregnancy.babyName || "baby";
        out.push({
          priority: 5,
          icon: "💌",
          level: "",
          text: `It's been ${Math.floor(daysSince)} days since you wrote to ${babyName}. Want to say hi?`,
          go: "life",
        });
      }
    }
  }

  // Haven't done any gratitude in 3+ days
  const gratitudeEntries = state.life?.gratitude?.entries || [];
  if (gratitudeEntries.length) {
    const lastDate = Math.max(...gratitudeEntries.map((e) => new Date(e.date + "T00:00:00").getTime()));
    const daysSince = (Date.now() - lastDate) / 86400000;
    if (daysSince > 3) {
      out.push({
        priority: 5,
        icon: "✨",
        level: "",
        text: "Three days since you jotted down what you're grateful for. Even 3 small things counts.",
        go: "life",
      });
    }
  }

  // Today's habits — nudge if nothing checked off by mid-afternoon
  const now = new Date();
  if (now.getHours() >= 14) {
    const todayISO = now.toISOString().slice(0, 10);
    const habitsDone = (state.habits?.items || []).filter((h) => state.habits?.log?.[`${h.id}:${todayISO}`]).length;
    if ((state.habits?.items || []).length && habitsDone === 0) {
      out.push({
        priority: 4,
        icon: "🎯",
        level: "",
        text: "Haven't checked off any habits yet today. Even one counts — the prenatal, the water, the walk.",
        go: "habits",
      });
    }
  }

  // Unpaid tuition students (Academy)
  const students = state.academy?.students || [];
  const programs = state.academy?.programs || [];
  const behindOnTuition = students.filter((s) => {
    const prog = programs.find((p) => p.id === s.programId);
    if (!prog?.tuition) return false;
    return Math.max(0, prog.tuition - (s.tuitionPaid || 0)) > 0;
  });
  if (behindOnTuition.length) {
    const totalOwed = behindOnTuition.reduce((sum, s) => {
      const prog = programs.find((p) => p.id === s.programId);
      return sum + Math.max(0, prog.tuition - (s.tuitionPaid || 0));
    }, 0);
    out.push({
      priority: 3,
      icon: "🎓",
      level: "warn",
      text: `${behindOnTuition.length} student${behindOnTuition.length > 1 ? "s owe" : " owes"} tuition · $${totalOwed.toFixed(0)} outstanding.`,
      go: "academy",
    });
  }

  // Body-journal patterns: silent most of the time, surfaces once the threshold
  // is hit and she hasn't dismissed recently. Never names a condition.
  const patterns = detectPatterns();
  patterns.slice(0, 2).forEach((pat) => {
    out.push({
      priority: 2,
      icon: "👀",
      level: "warn",
      text: `You've mentioned ${pat.label.toLowerCase()} ${pat.count} times in the last ${pat.windowDays} days. Worth telling your OB.`,
      go: "life",
    });
  });

  out.sort((a, b) => a.priority - b.priority);
  return out.slice(0, 5); // cap at 5 so Home doesn't get overwhelming
}
