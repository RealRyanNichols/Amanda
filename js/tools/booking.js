import { state, save, uid } from "../store.js";
import { money, todayISO, friendlyDate, daysFromNow, h, toast, confirmAction } from "../util.js";

function renderStats(appointments) {
  const upcoming = appointments.filter((a) => !a.cancelled && daysFromNow(a.date) >= 0);
  const owed = appointments
    .filter((a) => !a.cancelled)
    .reduce((s, a) => s + Math.max(0, Number(a.price || 0) - Number(a.deposit || 0) - Number(a.paid || 0)), 0);
  const depositsHeld = appointments
    .filter((a) => !a.cancelled)
    .reduce((s, a) => s + Number(a.deposit || 0), 0);

  return h("section", { class: "card" }, [
    h("h2", {}, "Booking overview"),
    h("div", { class: "sub" }, "Deposits required. Balances tracked. Reschedule without losing the deposit."),
    h("div", { class: "stat-grid" }, [
      h("div", { class: "stat" }, [
        h("div", { class: "label" }, "Upcoming"),
        h("div", { class: "value" }, upcoming.length),
      ]),
      h("div", { class: "stat ok" }, [
        h("div", { class: "label" }, "Deposits held"),
        h("div", { class: "value" }, money(depositsHeld)),
      ]),
      h("div", { class: "stat warn" }, [
        h("div", { class: "label" }, "Still owed"),
        h("div", { class: "value" }, money(owed)),
      ]),
    ]),
  ]);
}

function renderForm(rerender) {
  const card = h("section", { class: "card" }, [
    h("h2", {}, "New booking"),
    h("div", { class: "sub" }, "Collect the deposit up front. It holds the slot."),
  ]);
  const form = h("form", { class: "form-row two", onsubmit: onAdd }, [
    h("label", { class: "field", style: "grid-column: 1 / -1" }, [
      "Client",
      h("input", { type: "text", name: "client", placeholder: "Full name", required: true }),
    ]),
    h("label", { class: "field" }, [
      "Phone (for reminders)",
      h("input", { type: "tel", name: "phone", placeholder: "555-555-5555" }),
    ]),
    h("label", { class: "field" }, [
      "Service",
      h("input", { type: "text", name: "service", placeholder: "e.g. Consultation, course seat" }),
    ]),
    h("label", { class: "field" }, [
      "Date",
      h("input", { type: "date", name: "date", value: todayISO(), required: true }),
    ]),
    h("label", { class: "field" }, [
      "Time",
      h("input", { type: "text", name: "time", placeholder: "e.g. 2:30 PM" }),
    ]),
    h("label", { class: "field" }, [
      "Total price",
      h("input", { type: "number", name: "price", min: "0", step: "0.01", required: true }),
    ]),
    h("label", { class: "field" }, [
      "Deposit paid",
      h("input", { type: "number", name: "deposit", min: "0", step: "0.01", value: "0" }),
    ]),
    h("div", { class: "btn-row", style: "grid-column: 1 / -1" }, [
      h("button", { class: "btn", type: "submit" }, "Book it"),
    ]),
  ]);
  card.append(form);

  function onAdd(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const price = Number(f.get("price")) || 0;
    const deposit = Number(f.get("deposit")) || 0;
    if (deposit <= 0) {
      if (!confirmAction("No deposit collected. Book anyway?")) return;
    }
    state.booking.appointments.push({
      id: uid(),
      client: (f.get("client") || "").toString().trim(),
      phone: (f.get("phone") || "").toString().trim(),
      service: (f.get("service") || "").toString().trim(),
      date: f.get("date"),
      time: (f.get("time") || "").toString().trim(),
      price,
      deposit,
      paid: 0,
      cancelled: false,
      note: "",
    });
    save();
    toast("Booked");
    e.target.reset();
    rerender();
  }
  return card;
}

function renderList(rerender) {
  const { appointments } = state.booking;
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Appointments"),
    h("div", { class: "sub" }, "Tap an appointment to record a payment or reschedule."),
  ]);

  const sorted = [...appointments].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const list = h("div", { class: "list" });

  if (!sorted.length) {
    list.append(h("div", { class: "empty" }, "No bookings yet."));
  } else {
    sorted.forEach((appt) => {
      const balance = Math.max(0, (appt.price || 0) - (appt.deposit || 0) - (appt.paid || 0));
      const pill = appt.cancelled
        ? h("span", { class: "pill" }, "cancelled")
        : balance === 0
        ? h("span", { class: "pill paid" }, "paid in full")
        : h("span", { class: "pill owed" }, money(balance) + " due");

      const row = h("div", { class: "item" }, [
        h("div", { style: "min-width:0; flex:1" }, [
          h("div", { class: "title" }, [`${appt.client} `, pill]),
          h("div", { class: "meta" },
            `${friendlyDate(appt.date)}${appt.time ? " · " + appt.time : ""}${appt.service ? " · " + appt.service : ""}`),
          h("div", { class: "meta" },
            `${money(appt.price)} total · deposit ${money(appt.deposit)} · paid ${money(appt.paid)}`),
        ]),
        h("div", { class: "actions" }, [
          h("button", { class: "btn small", onclick: () => recordPayment(appt, rerender) }, "Payment"),
          h("button", { class: "btn small secondary", onclick: () => reschedule(appt, rerender) }, "Reschedule"),
          h("button", { class: "btn small danger", onclick: () => remove(appt, rerender) }, "Remove"),
        ]),
      ]);

      if (appt.phone) {
        row.append(h("div", { class: "actions" }, [
          h("a", { class: "btn small secondary", href: `sms:${appt.phone}` }, "Text"),
          h("a", { class: "btn small secondary", href: `tel:${appt.phone}` }, "Call"),
        ]));
      }

      list.append(row);
    });
  }

  card.append(list);
  return card;
}

function recordPayment(appt, rerender) {
  const amt = prompt(`Amount received from ${appt.client}?`, "0");
  const n = Number(amt);
  if (!Number.isFinite(n) || n <= 0) return;
  appt.paid = (Number(appt.paid) || 0) + n;
  save();
  toast(`+${money(n)} recorded`);
  rerender();
}

function reschedule(appt, rerender) {
  const newDate = prompt(`New date for ${appt.client} (YYYY-MM-DD)?`, appt.date);
  if (!newDate) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) { toast("Date must be YYYY-MM-DD"); return; }
  const newTime = prompt("New time? (leave as-is if unchanged)", appt.time || "") || appt.time;
  appt.date = newDate;
  appt.time = newTime;
  save();
  toast("Rescheduled — deposit kept");
  rerender();
}

function remove(appt, rerender) {
  if (!confirmAction(`Remove ${appt.client}?`)) return;
  state.booking.appointments = state.booking.appointments.filter((a) => a.id !== appt.id);
  save();
  rerender();
}

function renderFollowupReminder(rerender) {
  const owing = state.booking.appointments
    .filter((a) => !a.cancelled)
    .map((a) => ({
      ...a,
      balance: Math.max(0, (a.price || 0) - (a.deposit || 0) - (a.paid || 0)),
    }))
    .filter((a) => a.balance > 0 && daysFromNow(a.date) < 0);

  if (!owing.length) return null;

  return h("section", { class: "card" }, [
    h("h2", {}, "Auto-follow up"),
    h("div", { class: "sub" }, "These clients had their appointment but still owe money."),
    h("div", { class: "list" },
      owing.map((a) =>
        h("div", { class: "item" }, [
          h("div", {}, [
            h("div", { class: "title" }, a.client),
            h("div", { class: "meta" }, `Owes ${money(a.balance)} · ${friendlyDate(a.date)}`),
          ]),
          h("div", { class: "actions" }, [
            a.phone && h("a", { class: "btn small", href: `sms:${a.phone}?&body=${encodeURIComponent(`Hi ${a.client}, friendly reminder: balance of ${money(a.balance)} is due. Thanks!`)}` }, "Text reminder"),
          ]),
        ])
      )),
  ]);
}

export function renderBooking(mount, { rerender }) {
  mount.append(renderStats(state.booking.appointments));
  const fr = renderFollowupReminder(rerender);
  if (fr) mount.append(fr);
  mount.append(renderForm(rerender));
  mount.append(renderList(rerender));
}
