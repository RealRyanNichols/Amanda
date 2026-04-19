import { state } from "../store.js";
import { money, friendlyDate, daysFromNow, h } from "../util.js";
import { currentBrand } from "../branding.js";
import { TX_RDA_REQUIREMENTS } from "./rda-seed.js";
import { verseOfTheDay } from "./life-seeds.js";

function incomeSummary() {
  const { deposits, bills } = state.income;
  const cutoff = Date.now() - 28 * 86400000;
  const recent = deposits.filter((d) => new Date(d.date + "T00:00:00").getTime() >= cutoff);
  const pool = recent.length ? recent : deposits.slice(-8);
  let weekly = 0;
  if (pool.length) {
    const total = pool.reduce((s, d) => s + Number(d.amount || 0), 0);
    const spanDays = Math.max(7, (Date.now() - new Date(pool[0].date + "T00:00:00").getTime()) / 86400000);
    weekly = (total / spanDays) * 7;
  }
  const next7 = bills
    .filter((b) => !b.paid)
    .filter((b) => { const d = daysFromNow(b.due); return d !== null && d <= 7; });
  const next7Total = next7.reduce((s, b) => s + Number(b.amount || 0), 0);
  const overdue = bills.filter((b) => !b.paid && daysFromNow(b.due) < 0);
  const safe = Math.max(0, weekly - next7Total);
  return { weekly, next7Total, overdueCount: overdue.length, safe };
}

function bookingSummary() {
  const { appointments } = state.booking;
  const active = appointments.filter((a) => !a.cancelled);
  const upcoming = active
    .filter((a) => daysFromNow(a.date) >= 0)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const owed = active.reduce((s, a) => s + Math.max(0, (a.price || 0) - (a.deposit || 0) - (a.paid || 0)), 0);
  const unpaidPast = active
    .filter((a) => daysFromNow(a.date) < 0)
    .filter((a) => Math.max(0, (a.price || 0) - (a.deposit || 0) - (a.paid || 0)) > 0);
  return { upcomingCount: upcoming.length, nextAppt: upcoming[0], owed, unpaidPastCount: unpaidPast.length };
}

function leadSummary() {
  const { leads } = state.followup;
  const open = leads.filter((l) => !l.closed);
  const hot = open.filter((l) => l.temperature === "hot");
  const overdue = open.filter((l) => l.nextContact && daysFromNow(l.nextContact) <= 0);
  const nextUp = [...overdue].sort((a, b) => (a.nextContact || "").localeCompare(b.nextContact || ""))[0];
  return { openCount: open.length, hotCount: hot.length, overdueCount: overdue.length, nextUp };
}

function overloadSummary() {
  const { tasks, brainDump } = state.overload;
  const open = tasks.filter((t) => !t.done);
  const now = open.filter((t) => t.category === "now");
  const today = open.filter((t) => t.category === "today");
  const first = now[0] || today[0];
  const dumpLines = (brainDump || "").split("\n").filter((l) => l.trim()).length;
  return { openCount: open.length, urgentCount: now.length + today.length, first, dumpLines };
}

function careerSummary() {
  const key = state.career.selected;
  const completed = state.career.completedSteps[key] || {};
  const doneCount = Object.values(completed).filter(Boolean).length;
  return { selected: key, doneCount };
}

function greeting() {
  const hr = new Date().getHours();
  if (hr < 5) return "Still up";
  if (hr < 12) return "Good morning";
  if (hr < 17) return "Good afternoon";
  if (hr < 21) return "Good evening";
  return "Good night";
}

function jumpTo(tabName) {
  const btn = document.querySelector(`.tab[data-tab="${tabName}"]`);
  if (btn) btn.click();
}

function hasFaithRole() { return (state.profile?.roles || []).includes("faith"); }
function hasPregnantRole() { return (state.profile?.roles || []).includes("pregnant"); }
function lifeVisible() {
  const roles = state.profile?.roles || [];
  return roles.includes("mom") || roles.includes("pregnant") || roles.includes("faith") || roles.length === 0;
}

function renderVerseCard() {
  const v = verseOfTheDay();
  return h("section", { class: "card" }, [
    h("h2", {}, "Today's verse"),
    h("div", { class: "verse-ref" }, v.ref),
    h("div", { class: "verse-text" }, `"${v.text}"`),
    h("div", { class: "btn-row", style: "margin-top:10px" }, [
      h("button", { class: "btn small secondary", onclick: () => jumpTo("life") }, "Open Faith →"),
    ]),
  ]);
}

function renderPregnancyCard() {
  const p = state.life?.pregnancy;
  if (!p?.dueDate) return null;
  const dueDate = new Date(p.dueDate + "T00:00:00");
  const conception = new Date(dueDate.getTime() - 280 * 86400000);
  const weeks = Math.max(0, Math.floor((Date.now() - conception) / (7 * 86400000)));
  const daysLeft = daysFromNow(p.dueDate);

  return h("section", { class: "card" }, [
    h("h2", {}, "Baby countdown"),
    h("div", { class: "stat-grid" }, [
      h("div", { class: "stat" }, [h("div", { class: "label" }, "Weeks"), h("div", { class: "value" }, weeks)]),
      h("div", { class: "stat" }, [h("div", { class: "label" }, "Due"), h("div", { class: "value" }, friendlyDate(p.dueDate))]),
      h("div", { class: "stat ok" }, [h("div", { class: "label" }, "Days left"), h("div", { class: "value" }, daysLeft != null ? Math.max(0, daysLeft) : "—")]),
    ]),
    h("div", { class: "btn-row", style: "margin-top:10px" }, [
      h("button", { class: "btn small secondary", onclick: () => { state.life.activeView = "pregnancy"; jumpTo("life"); } }, "Open pregnancy →"),
    ]),
  ]);
}

function renderLoveNotePeek() {
  const notes = state.life?.loveNotes?.notes || [];
  if (!notes.length) return null;
  const unopened = notes.filter((n) => !n.opened);
  if (!unopened.length) return null;
  const n = unopened[0];
  const partner = state.profile?.partnerName || (state.brand === "pda" ? "Ryan" : "");
  return h("section", { class: "card" }, [
    h("h2", {}, partner ? `A note from ${partner}` : "A note for you"),
    h("div", { class: "sub" }, n.occasion),
    h("div", { class: "btn-row" }, [
      h("button", { class: "btn small", onclick: () => { state.life.activeView = "love"; jumpTo("life"); } }, "Open it →"),
    ]),
  ]);
}

function renderHero() {
  const b = currentBrand();
  const who = b.business?.owner || "you";
  return h("section", { class: "card" }, [
    h("h2", {}, `${greeting()}, ${who.split(" ")[0]}`),
    h("div", { class: "sub" }, b.business ? b.business.name : "Here's where everything stands right now."),
  ]);
}

function renderFocus() {
  const inc = incomeSummary();
  const lead = leadSummary();
  const over = overloadSummary();
  const bk = bookingSummary();

  const items = [];
  if (inc.overdueCount > 0) {
    items.push({ level: "bad", text: `${inc.overdueCount} bill${inc.overdueCount > 1 ? "s" : ""} overdue — handle those first`, go: "income" });
  }
  if (over.first) {
    items.push({ level: "warn", text: `Next thing: ${over.first.text}`, go: "overload" });
  }
  if (lead.overdueCount > 0) {
    items.push({ level: "warn", text: `${lead.overdueCount} lead${lead.overdueCount > 1 ? "s" : ""} need follow-up today`, go: "followup" });
  }
  if (bk.unpaidPastCount > 0) {
    items.push({ level: "warn", text: `${bk.unpaidPastCount} past appointment${bk.unpaidPastCount > 1 ? "s have" : " has"} an unpaid balance`, go: "booking" });
  }
  if (!items.length) {
    items.push({ level: "ok", text: "Nothing urgent. Use the time to move the needle.", go: null });
  }

  return h("section", { class: "card" }, [
    h("h2", {}, "Focus"),
    h("div", { class: "sub" }, "What actually matters today."),
    h("div", { class: "list" }, items.map((it) =>
      h("div", { class: `alert ${it.level}` }, [
        it.text,
        it.go && h("button", {
          class: "btn small secondary",
          style: "float:right; margin-left:8px",
          onclick: () => jumpTo(it.go),
        }, "Open"),
      ])
    )),
  ]);
}

function renderMoneyCard() {
  const inc = incomeSummary();
  const bk = bookingSummary();
  return h("section", { class: "card" }, [
    h("h2", {}, "Money"),
    h("div", { class: "sub" }, "This week at a glance."),
    h("div", { class: "stat-grid" }, [
      h("div", { class: "stat ok" }, [
        h("div", { class: "label" }, "Safe this week"),
        h("div", { class: "value" }, money(inc.safe)),
      ]),
      h("div", { class: "stat" }, [
        h("div", { class: "label" }, "Est. weekly income"),
        h("div", { class: "value" }, money(inc.weekly)),
      ]),
      h("div", { class: "stat warn" }, [
        h("div", { class: "label" }, "Bills in 7 days"),
        h("div", { class: "value" }, money(inc.next7Total)),
      ]),
      h("div", { class: "stat" }, [
        h("div", { class: "label" }, "Owed to you"),
        h("div", { class: "value" }, money(bk.owed)),
      ]),
    ]),
    h("div", { class: "btn-row", style: "margin-top:10px" }, [
      h("button", { class: "btn small secondary", onclick: () => jumpTo("income") }, "Income →"),
      h("button", { class: "btn small secondary", onclick: () => jumpTo("booking") }, "Booking →"),
    ]),
  ]);
}

function renderNextUpCard() {
  const bk = bookingSummary();
  const lead = leadSummary();
  const items = [];
  if (bk.nextAppt) {
    items.push(h("div", { class: "item" }, [
      h("div", {}, [
        h("div", { class: "title" }, `Appointment: ${bk.nextAppt.client}`),
        h("div", { class: "meta" },
          `${friendlyDate(bk.nextAppt.date)}${bk.nextAppt.time ? " · " + bk.nextAppt.time : ""}${bk.nextAppt.service ? " · " + bk.nextAppt.service : ""}`),
      ]),
      h("button", { class: "btn small secondary", onclick: () => jumpTo("booking") }, "Open"),
    ]));
  }
  if (lead.nextUp) {
    items.push(h("div", { class: "item" }, [
      h("div", {}, [
        h("div", { class: "title" }, `Follow up: ${lead.nextUp.name}`),
        h("div", { class: "meta" }, `${lead.nextUp.temperature} · ${friendlyDate(lead.nextUp.nextContact)}`),
      ]),
      h("button", { class: "btn small secondary", onclick: () => jumpTo("followup") }, "Open"),
    ]));
  }

  return h("section", { class: "card" }, [
    h("h2", {}, "Next up"),
    h("div", { class: "sub" }, "Your nearest appointment and overdue lead."),
    items.length
      ? h("div", { class: "list" }, items)
      : h("div", { class: "empty" }, "Nothing scheduled. Add a booking or a lead to see it here."),
  ]);
}

function renderPipelineCard() {
  const lead = leadSummary();
  const over = overloadSummary();
  return h("section", { class: "card" }, [
    h("h2", {}, "Pipeline & tasks"),
    h("div", { class: "stat-grid" }, [
      h("div", { class: "stat bad" }, [
        h("div", { class: "label" }, "Hot leads"),
        h("div", { class: "value" }, lead.hotCount),
      ]),
      h("div", { class: "stat warn" }, [
        h("div", { class: "label" }, "Leads overdue"),
        h("div", { class: "value" }, lead.overdueCount),
      ]),
      h("div", { class: "stat" }, [
        h("div", { class: "label" }, "Open tasks"),
        h("div", { class: "value" }, over.openCount),
      ]),
    ]),
    h("div", { class: "btn-row", style: "margin-top:10px" }, [
      h("button", { class: "btn small secondary", onclick: () => jumpTo("followup") }, "Leads →"),
      h("button", { class: "btn small secondary", onclick: () => jumpTo("overload") }, "Organize →"),
    ]),
  ]);
}

function renderCareerCard() {
  const c = careerSummary();
  const b = currentBrand();
  return h("section", { class: "card" }, [
    h("h2", {}, "Career pathway"),
    h("div", { class: "sub" }, `Tracking: ${c.selected.replace(/-/g, " ")} · ${c.doneCount} step${c.doneCount === 1 ? "" : "s"} done`),
    b.business && h("div", { class: "pda-contact" }, [
      `Local program spotlight: ${b.business.name} · ${b.business.city}.`,
    ]),
    h("div", { class: "btn-row", style: "margin-top:10px" }, [
      h("button", { class: "btn small secondary", onclick: () => jumpTo("career") }, "Open career →"),
    ]),
  ]);
}

function academySummary() {
  const { programs, students } = state.academy;
  const active = students.filter((s) => s.status !== "withdrawn");
  const reqKeys = TX_RDA_REQUIREMENTS.filter((r) => !r.optional).map((r) => r.key);
  const gradReady = active.filter((s) => {
    const req = s.requirements || {};
    return reqKeys.every((k) => req[k]?.done);
  }).length;
  const tuitionOutstanding = active.reduce((sum, s) => {
    const prog = programs.find((p) => p.id === s.programId);
    const owed = Math.max(0, (prog?.tuition || 0) - (s.tuitionPaid || 0));
    return sum + owed;
  }, 0);
  return { totalStudents: active.length, gradReady, tuitionOutstanding, programCount: programs.length };
}

function renderAcademyCard() {
  const a = academySummary();
  return h("section", { class: "card" }, [
    h("h2", {}, "Academy"),
    h("div", { class: "sub" }, "Students, cohorts, and your online course."),
    h("div", { class: "stat-grid" }, [
      h("div", { class: "stat" }, [
        h("div", { class: "label" }, "Students"),
        h("div", { class: "value" }, a.totalStudents),
      ]),
      h("div", { class: "stat ok" }, [
        h("div", { class: "label" }, "Grad-ready"),
        h("div", { class: "value" }, a.gradReady),
      ]),
      h("div", { class: "stat warn" }, [
        h("div", { class: "label" }, "Tuition owed"),
        h("div", { class: "value" }, money(a.tuitionOutstanding)),
      ]),
    ]),
    h("div", { class: "btn-row", style: "margin-top:10px" }, [
      h("button", { class: "btn small secondary", onclick: () => jumpTo("academy") }, "Open academy →"),
    ]),
  ]);
}

export function renderDashboard(mount) {
  const isPda = state.brand === "pda";
  mount.append(renderHero());
  mount.append(renderFocus());

  // Life-ish cards surface near the top so the day starts warm, not transactional
  if (lifeVisible()) {
    const love = renderLoveNotePeek();
    if (love) mount.append(love);
  }
  if (hasFaithRole() || (state.profile?.roles || []).length === 0) {
    mount.append(renderVerseCard());
  }
  if (hasPregnantRole()) {
    const pg = renderPregnancyCard();
    if (pg) mount.append(pg);
  }

  mount.append(renderMoneyCard());
  mount.append(renderNextUpCard());
  mount.append(renderPipelineCard());
  if (isPda) mount.append(renderAcademyCard());
  else mount.append(renderCareerCard());
}
