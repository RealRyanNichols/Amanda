import { state, save, uid } from "../store.js";
import { money, todayISO, friendlyDate, daysFromNow, h, toast, confirmAction } from "../util.js";
import { currentBrand } from "../branding.js";
import { offerNext } from "../next-offer.js";
import { creditTimeSaved } from "../time-saved.js";

const PRIORITIES = [
  { value: 1, label: "Must pay (rent, utilities, car)" },
  { value: 2, label: "Important (insurance, phone)" },
  { value: 3, label: "Flexible (subscriptions, extras)" },
];

function weeklyIncomeEstimate(deposits) {
  if (!deposits.length) return 0;
  const cutoff = Date.now() - 28 * 86400000;
  const recent = deposits.filter((d) => new Date(d.date + "T00:00:00").getTime() >= cutoff);
  const pool = recent.length ? recent : deposits.slice(-8);
  if (!pool.length) return 0;
  const total = pool.reduce((s, d) => s + Number(d.amount || 0), 0);
  const spanDays = Math.max(
    7,
    (Date.now() - new Date(pool[0].date + "T00:00:00").getTime()) / 86400000
  );
  return (total / spanDays) * 7;
}

function billsDueWithin(bills, days) {
  return bills
    .filter((b) => !b.paid)
    .filter((b) => {
      const d = daysFromNow(b.due);
      return d !== null && d <= days;
    });
}

function render(mount, { rerender }) {
  const { deposits, bills } = state.income;
  const weekly = weeklyIncomeEstimate(deposits);
  const next7 = billsDueWithin(bills, 7);
  const next7Total = next7.reduce((s, b) => s + Number(b.amount || 0), 0);
  const critical14 = billsDueWithin(bills, 14).filter((b) => b.priority === 1);
  const critical14Total = critical14.reduce((s, b) => s + Number(b.amount || 0), 0);
  const buffer = Math.max(0, critical14Total - next7Total) / 2;
  const safe = Math.max(0, weekly - next7Total - buffer);

  const overdue = bills.filter((b) => !b.paid && daysFromNow(b.due) < 0);
  const behindAlert = overdue.length > 0;
  const tightAlert = !behindAlert && safe < 0.1 * weekly && weekly > 0;

  mount.append(
    h("section", { class: "card" }, [
      h("h2", {}, "Safe to spend this week"),
      h("div", { class: "sub" }, "Estimated from your recent deposits minus what's due."),
      h("div", { class: "stat-grid" }, [
        h("div", { class: "stat ok" }, [
          h("div", { class: "label" }, "Safe this week"),
          h("div", { class: "value" }, money(safe)),
        ]),
        h("div", { class: "stat" }, [
          h("div", { class: "label" }, "Est. weekly income"),
          h("div", { class: "value" }, money(weekly)),
        ]),
        h("div", { class: "stat warn" }, [
          h("div", { class: "label" }, "Bills in 7 days"),
          h("div", { class: "value" }, money(next7Total)),
        ]),
      ]),
      behindAlert && h("div", { class: "alert bad", style: "margin-top:10px" },
        `You're behind on ${overdue.length} bill${overdue.length > 1 ? "s" : ""}. Handle those first.`),
      tightAlert && h("div", { class: "alert warn", style: "margin-top:10px" },
        "It's tight this week. Hold discretionary spending."),
      !behindAlert && !tightAlert && weekly > 0 &&
        h("div", { class: "alert ok", style: "margin-top:10px" }, "You're in the clear — stay consistent."),
    ])
  );

  mount.append(renderTrendsCard(rerender));
  mount.append(renderDepositsCard(rerender));
  mount.append(renderBillsCard(rerender));
}

function renderTrendsCard(rerender) {
  const { deposits, bills } = state.income;
  if (deposits.length < 4) return h("span"); // need history

  // Last 30 vs previous 30 days
  const now = Date.now();
  const DAY = 86400000;
  const last30 = deposits.filter((d) => new Date(d.date + "T00:00:00").getTime() > now - 30 * DAY)
    .reduce((s, d) => s + Number(d.amount || 0), 0);
  const prev30 = deposits.filter((d) => {
    const t = new Date(d.date + "T00:00:00").getTime();
    return t <= now - 30 * DAY && t > now - 60 * DAY;
  }).reduce((s, d) => s + Number(d.amount || 0), 0);

  const delta = prev30 > 0 ? Math.round(((last30 - prev30) / prev30) * 100) : null;
  const trendClass = delta == null ? "" : (delta >= 10 ? "ok" : delta <= -10 ? "bad" : "warn");
  const upcomingBillsTotal = bills.filter((b) => !b.paid).reduce((s, b) => s + Number(b.amount || 0), 0);

  const card = h("section", { class: "card" }, [
    h("h2", {}, "Revenue trends"),
    h("div", { class: "sub" }, "Last 30 days vs the 30 before. Real talk — no glossing over."),
    h("div", { class: "stat-grid" }, [
      h("div", { class: "stat" }, [
        h("div", { class: "label" }, "Last 30 days"),
        h("div", { class: "value" }, money(last30)),
      ]),
      h("div", { class: "stat" }, [
        h("div", { class: "label" }, "30 days before"),
        h("div", { class: "value" }, money(prev30)),
      ]),
      h("div", { class: `stat ${trendClass}` }, [
        h("div", { class: "label" }, "Change"),
        h("div", { class: "value" }, delta == null ? "—" : `${delta >= 0 ? "+" : ""}${delta}%`),
      ]),
    ]),
  ]);

  // Built-in honest read even without Claude
  card.append(renderBuiltInAssessment(last30, prev30, delta, upcomingBillsTotal));

  // Claude analysis button
  if (state.brain?.apiKey) {
    const result = h("div", { class: "trend-ai", style: "margin-top:10px" });
    card.append(h("div", { class: "btn-row", style: "margin-top:10px" }, [
      h("button", {
        class: "btn",
        onclick: () => runClaudeAnalysis(result),
      }, "Ask the Brain for an honest read"),
    ]));
    card.append(result);
  } else {
    card.append(h("div", { class: "alert", style: "margin-top:10px" },
      "Connect your Claude key in Settings → Brain to get an AI-powered honest read of your finances."));
  }

  return card;
}

function offerNextForBill(bill, rerender) {
  const options = [
    {
      emoji: "🔁",
      label: "Is this monthly? Make it recurring",
      onPick: () => {
        bill.recurring = true;
        save();
        toast("Marked recurring — I'll auto-add next month");
      },
    },
    {
      emoji: "✅",
      label: "Mark it paid now",
      onPick: () => {
        bill.paid = true;
        save();
        toast("Marked paid");
        rerender();
      },
    },
    {
      emoji: "📅",
      label: "Add to my calendar (.ics)",
      onPick: () => {
        const ics = buildBillIcs(bill);
        const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${bill.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-due.ics`;
        a.click();
        URL.revokeObjectURL(url);
        toast("Opened in Calendar");
      },
    },
    bill.priority === 1 && {
      emoji: "🧠",
      label: "Ask the Brain how to cover this",
      onPick: () => {
        state.brain = state.brain || {};
        state.brain.history = state.brain.history || [];
        state.brain.history.push({
          id: uid(), role: "user", at: Date.now(),
          text: `I have a priority-1 bill for ${bill.name} ($${bill.amount}) due ${bill.due}. What's my best plan to cover it?`,
        });
        save();
        const brainTab = document.querySelector('.tab[data-tab="brain"]');
        if (brainTab) brainTab.click();
      },
    },
  ].filter(Boolean);

  offerNext({
    title: `${bill.name} · $${bill.amount.toFixed(2)} saved. What now?`,
    subtitle: `Due ${friendlyDate(bill.due)}`,
    options,
  });
}

function buildBillIcs(bill) {
  const start = new Date(bill.due + "T09:00:00");
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const uidStr = Math.random().toString(36).slice(2) + "@amanda-toolkit";
  const esc = (s) => (s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Amanda's Toolkit//EN","CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uidStr}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(`Bill due: ${bill.name} ($${bill.amount})`)}`,
    `DESCRIPTION:${esc("Due date reminder from Amanda's Toolkit")}`,
    "BEGIN:VALARM","ACTION:DISPLAY","TRIGGER:-P1D","DESCRIPTION:Bill due tomorrow","END:VALARM",
    "END:VEVENT","END:VCALENDAR",
  ].join("\r\n");
}

function renderBuiltInAssessment(last30, prev30, delta, upcomingBills) {
  let level = "ok";
  let msg = "You're holding steady. Keep the consistency going.";
  if (prev30 === 0 && last30 > 0) { level = "ok"; msg = "You're off the ground this month — protect that momentum."; }
  else if (last30 === 0) { level = "bad"; msg = "No income recorded in the last 30 days. That's not sustainable. What's one client or bill you can close this week?"; }
  else if (delta <= -25) { level = "bad"; msg = `Income is down ${Math.abs(delta)}% vs last month. That's a real dip — not a hiccup. Look at what changed and what you can reactivate this week.`; }
  else if (delta <= -10) { level = "warn"; msg = `You're down ${Math.abs(delta)}% month-over-month. Watch this — don't assume it'll rebound on its own.`; }
  else if (delta >= 25) { level = "ok"; msg = `Up ${delta}% — great. Don't coast. Bank the windfall toward your next 30 days.`; }
  else if (delta >= 10) { level = "ok"; msg = `Up ${delta}% — genuinely growing. Keep the habits that got you here.`; }

  if (upcomingBills > last30 * 0.8) {
    level = "bad";
    msg += ` Your unpaid bills (${money(upcomingBills)}) are close to your whole month's income. Don't spend on extras until bills are covered.`;
  }

  return h("div", { class: `alert ${level}`, style: "margin-top:10px" }, msg);
}

async function runClaudeAnalysis(resultEl) {
  const b = state.brain;
  if (!b?.apiKey) { toast("Connect Claude first"); return; }

  resultEl.innerHTML = "";
  resultEl.append(h("div", { class: "meta" }, "Thinking…"));

  // Compact summary of her financial state to send to Claude
  const now = Date.now();
  const DAY = 86400000;
  const recentDeposits = state.income.deposits
    .filter((d) => new Date(d.date + "T00:00:00").getTime() > now - 90 * DAY)
    .map((d) => ({ date: d.date, amount: d.amount, source: d.source || "" }));
  const activeBills = state.income.bills
    .filter((x) => !x.paid)
    .map((b) => ({ name: b.name, amount: b.amount, due: b.due, priority: b.priority }));

  const br = currentBrand();
  const personalContext = br.business
    ? `Runs ${br.business.name}, ${br.business.program?.name || ""} with tuition around ${br.business.program?.tuition || "?"}`
    : "";

  const body = {
    model: b.model || "claude-opus-4-7",
    max_tokens: 1500,
    system:
      "You are a warm but genuinely honest financial advisor for a mom small-business-owner. Read her real deposit + bill data and give her 4-6 bullets of real talk. Style:\n" +
      "- Direct. No corporate hedging. No 'consider exploring options'. Say 'you need to X'.\n" +
      "- Kind. She's a human, not a spreadsheet. No shame.\n" +
      "- Specific. Point at numbers from her data.\n" +
      "- Actionable. Each bullet ends with a concrete next step she could do this week.\n" +
      "- NEVER pretend things are fine if they aren't. If she's losing money, say she's losing money.\n" +
      "- NEVER medical/legal/tax advice — redirect to a professional for those.\n" +
      "Return plain text bullets, one per line starting with '- '. No preamble.",
    messages: [{
      role: "user",
      content:
`My last 90 days of deposits (newest first): ${JSON.stringify(recentDeposits.slice(-20))}
My unpaid bills right now: ${JSON.stringify(activeBills)}
Context: ${personalContext}
Give me your honest read.`,
    }],
  };
  if (/opus-4-7|opus-4-6|sonnet-4-6/.test(body.model)) body.thinking = { type: "adaptive" };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": b.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}`);
    const data = await res.json();
    const textBlock = (data.content || []).find((x) => x.type === "text");
    const text = textBlock?.text || "";
    resultEl.innerHTML = "";
    const lines = text.split(/\n+/).filter((l) => l.trim().startsWith("-"));
    if (!lines.length) {
      resultEl.append(h("div", { class: "script-box" }, text));
    } else {
      const ul = h("ul", { class: "trend-bullets" });
      lines.forEach((l) => ul.append(h("li", {}, l.replace(/^-\s*/, ""))));
      resultEl.append(ul);
    }
  } catch (err) {
    resultEl.innerHTML = "";
    resultEl.append(h("div", { class: "alert bad" }, err.message || "Couldn't get analysis"));
  }
}

function renderDepositsCard(rerender) {
  const { deposits } = state.income;
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Deposits"),
    h("div", { class: "sub" }, "Log money in. More entries = better prediction."),
  ]);

  const form = h("form", { class: "form-row two", onsubmit: onAdd }, [
    h("label", { class: "field" }, [
      "Date",
      h("input", { type: "date", name: "date", value: todayISO(), required: true }),
    ]),
    h("label", { class: "field" }, [
      "Amount",
      h("input", { type: "number", name: "amount", min: "0", step: "0.01", placeholder: "0.00", required: true }),
    ]),
    h("label", { class: "field", style: "grid-column: 1 / -1" }, [
      "Source (optional)",
      h("input", { type: "text", name: "source", placeholder: "e.g. Paycheck, tuition deposit" }),
    ]),
    h("div", { class: "btn-row", style: "grid-column: 1 / -1" }, [
      h("button", { class: "btn", type: "submit" }, "Add deposit"),
    ]),
  ]);
  card.append(form);

  function onAdd(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    state.income.deposits.push({
      id: uid(),
      date: f.get("date"),
      amount: Number(f.get("amount")) || 0,
      source: (f.get("source") || "").toString().trim(),
    });
    state.income.deposits.sort((a, b) => a.date.localeCompare(b.date));
    save();
    toast("Deposit added");
    rerender();
  }

  const list = h("div", { class: "list", style: "margin-top:10px" });
  if (!deposits.length) {
    list.append(h("div", { class: "empty" }, "No deposits yet. Start with your last one."));
  } else {
    [...deposits].reverse().slice(0, 12).forEach((d) => {
      list.append(
        h("div", { class: "item" }, [
          h("div", {}, [
            h("div", { class: "title" }, d.source || "Deposit"),
            h("div", { class: "meta" }, friendlyDate(d.date)),
          ]),
          h("div", { class: "actions" }, [
            h("div", { class: "amount" }, money(d.amount)),
            h("button", { class: "btn danger small", onclick: () => removeDeposit(d.id, rerender) }, "Remove"),
          ]),
        ])
      );
    });
  }
  card.append(list);
  return card;
}

function removeDeposit(id, rerender) {
  state.income.deposits = state.income.deposits.filter((d) => d.id !== id);
  save();
  rerender();
}

function renderBillsCard(rerender) {
  const { bills } = state.income;
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Bills"),
    h("div", { class: "sub" }, "Due dates + priority. We'll warn you if you're about to fall behind."),
  ]);

  const form = h("form", { class: "form-row three", onsubmit: onAdd }, [
    h("label", { class: "field", style: "grid-column: 1 / -1" }, [
      "Bill",
      h("input", { type: "text", name: "name", placeholder: "e.g. Rent, car payment", required: true }),
    ]),
    h("label", { class: "field" }, [
      "Amount",
      h("input", { type: "number", name: "amount", min: "0", step: "0.01", required: true }),
    ]),
    h("label", { class: "field" }, [
      "Due",
      h("input", { type: "date", name: "due", required: true }),
    ]),
    h("label", { class: "field" }, [
      "Priority",
      h("select", { name: "priority" },
        PRIORITIES.map((p) => h("option", { value: p.value }, p.label))
      ),
    ]),
    h("div", { class: "btn-row", style: "grid-column: 1 / -1" }, [
      h("button", { class: "btn", type: "submit" }, "Add bill"),
    ]),
  ]);
  card.append(form);

  function onAdd(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const bill = {
      id: uid(),
      name: (f.get("name") || "").toString().trim(),
      amount: Number(f.get("amount")) || 0,
      due: f.get("due"),
      priority: Number(f.get("priority")) || 2,
      paid: false,
      recurring: false,
    };
    state.income.bills.push(bill);
    save();
    toast("Bill added");
    rerender();

    // Credit for fast entry vs digging through bank statements
    creditTimeSaved(4, "Bill logged");

    // Depth: offer next actions after adding a bill
    offerNextForBill(bill, rerender);
  }

  const sorted = [...bills].sort((a, b) => {
    if (a.paid !== b.paid) return a.paid ? 1 : -1;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return (a.due || "").localeCompare(b.due || "");
  });

  const list = h("div", { class: "list", style: "margin-top:10px" });
  if (!sorted.length) {
    list.append(h("div", { class: "empty" }, "Add your recurring bills so we can keep score."));
  } else {
    sorted.forEach((b) => {
      const d = daysFromNow(b.due);
      const urgent = !b.paid && d !== null && d <= 3;
      list.append(
        h("div", { class: "item" }, [
          h("div", {}, [
            h("div", { class: "title" }, [
              b.name, " ",
              b.paid
                ? h("span", { class: "pill paid" }, "paid")
                : urgent
                ? h("span", { class: "pill urgent" }, d < 0 ? "overdue" : "soon")
                : h("span", { class: "pill" }, `P${b.priority}`),
            ]),
            h("div", { class: "meta" }, `${friendlyDate(b.due)} · ${money(b.amount)}`),
          ]),
          h("div", { class: "actions" }, [
            h("button", {
              class: "btn small secondary",
              onclick: () => { b.paid = !b.paid; save(); rerender(); },
            }, b.paid ? "Unmark" : "Paid"),
            h("button", {
              class: "btn small danger",
              onclick: () => {
                if (!confirmAction(`Remove ${b.name}?`)) return;
                state.income.bills = state.income.bills.filter((x) => x.id !== b.id);
                save();
                rerender();
              },
            }, "Remove"),
          ]),
        ])
      );
    });
  }
  card.append(list);
  return card;
}

export function renderIncome(mount, ctx) {
  render(mount, ctx);
}
