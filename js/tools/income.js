import { state, save, uid } from "../store.js";
import { money, todayISO, friendlyDate, daysFromNow, h, toast, confirmAction } from "../util.js";

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

  mount.append(renderDepositsCard(rerender));
  mount.append(renderBillsCard(rerender));
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
    state.income.bills.push({
      id: uid(),
      name: (f.get("name") || "").toString().trim(),
      amount: Number(f.get("amount")) || 0,
      due: f.get("due"),
      priority: Number(f.get("priority")) || 2,
      paid: false,
    });
    save();
    toast("Bill added");
    rerender();
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
