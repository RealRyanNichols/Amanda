import { state, save } from "../store.js";
import { h, toast, friendlyDate, daysFromNow } from "../util.js";

// Calendar unifies events from across the app into one view.
// Sources: bookings, bills, kids events, pregnancy appointments,
// scheduled social posts, leads next-contact, letter anniversaries.

function ymd(d) { return d.toISOString().slice(0, 10); }

function collectEvents() {
  const out = [];

  // Bookings
  for (const a of state.booking.appointments || []) {
    if (!a.date || a.cancelled) continue;
    out.push({
      date: a.date, time: a.time || "",
      type: "booking",
      icon: "📅",
      title: `${a.client}${a.service ? " — " + a.service : ""}`,
      subtitle: a.time || "",
      go: "booking",
    });
  }

  // Bills due
  for (const b of state.income.bills || []) {
    if (b.paid || !b.due) continue;
    out.push({
      date: b.due,
      type: "bill",
      icon: "💵",
      title: `${b.name} due`,
      subtitle: `$${(Number(b.amount) || 0).toFixed(2)}`,
      go: "income",
    });
  }

  // Pregnancy appointments
  for (const v of state.life?.pregnancy?.appointments || []) {
    if (!v.date) continue;
    out.push({
      date: v.date,
      type: "pregnancy",
      icon: "👶",
      title: "Doctor visit" + (v.provider ? " · " + v.provider : ""),
      subtitle: v.notes?.slice(0, 60) || "",
      go: "life",
    });
  }

  // Scheduled social posts
  for (const p of state.social?.posts || []) {
    if (p.status !== "scheduled" || !p.scheduledFor) continue;
    const date = p.scheduledFor.slice(0, 10);
    const time = p.scheduledFor.slice(11, 16);
    out.push({
      date, time,
      type: "social",
      icon: "📣",
      title: "Post scheduled",
      subtitle: (p.platforms || []).join(" · ") + " · " + (p.body.slice(0, 60)),
      go: "social",
    });
  }

  // Leads next contact
  for (const l of state.followup?.leads || []) {
    if (l.closed || !l.nextContact) continue;
    out.push({
      date: l.nextContact,
      type: "lead",
      icon: "📲",
      title: `Follow up: ${l.name}`,
      subtitle: `${l.temperature}${l.interest ? " · " + l.interest : ""}`,
      go: "followup",
    });
  }

  // Family events
  for (const e of state.life?.family?.events || []) {
    if (!e.date) continue;
    out.push({
      date: e.date,
      type: "family",
      icon: "👨‍👩‍👧",
      title: e.title || "Event",
      subtitle: e.notes || "",
      go: "life",
    });
  }

  // Sort by date then time
  out.sort((a, b) => {
    const ca = (a.date || "") + (a.time || "");
    const cb = (b.date || "") + (b.time || "");
    return ca.localeCompare(cb);
  });
  return out;
}

function weekStart(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const shift = day === 0 ? -6 : 1 - day; // Monday start
  x.setDate(x.getDate() + shift);
  return x;
}

function renderUpcoming(events) {
  const today = ymd(new Date());
  const upcoming = events.filter((e) => e.date >= today).slice(0, 12);
  const past = events.filter((e) => e.date < today).slice(-5).reverse();

  const wrap = h("section", { class: "card" }, [
    h("h2", {}, "What's coming"),
    h("div", { class: "sub" }, "Everything happening across your tabs, in one place."),
  ]);

  if (!upcoming.length) {
    wrap.append(h("div", { class: "empty" }, "Nothing scheduled. Add bookings, bills, appointments, or social posts to see them here."));
  } else {
    const list = h("div", { class: "list" });
    upcoming.forEach((e) => list.append(renderEventRow(e)));
    wrap.append(list);
  }

  if (past.length) {
    wrap.append(h("h3", { style: "margin:18px 0 6px; font-size:13px; color:var(--text-dim); text-transform:uppercase; letter-spacing:.8px" }, "Recent"));
    const list = h("div", { class: "list" });
    past.forEach((e) => list.append(renderEventRow(e, true)));
    wrap.append(list);
  }

  return wrap;
}

function renderEventRow(e, muted = false) {
  const diff = daysFromNow(e.date);
  let dateLabel = friendlyDate(e.date);
  if (e.time) dateLabel += " · " + e.time;

  return h("div", { class: "item cal-item", style: muted ? "opacity:.65" : "" }, [
    h("div", { class: "cal-icon" }, e.icon),
    h("div", { style: "flex:1; min-width:0" }, [
      h("div", { class: "title" }, e.title),
      h("div", { class: "meta" }, dateLabel + (e.subtitle ? " · " + e.subtitle : "")),
    ]),
    h("div", { class: "actions" }, [
      h("button", {
        class: "btn small secondary",
        onclick: () => downloadIcs(e),
        title: "Add to iPhone/Google Calendar",
      }, "📅 +Cal"),
      h("button", {
        class: "btn small secondary",
        onclick: () => {
          const btn = document.querySelector(`.tab[data-tab="${e.go}"]`);
          if (btn) btn.click();
        },
      }, "Open"),
    ]),
  ]);
}

function downloadIcs(e) {
  const icsContent = buildIcs(e);
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${e.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function buildIcs(e) {
  const start = new Date(e.date + "T" + (e.time || "09:00") + ":00");
  const end = new Date(start.getTime() + 60 * 60 * 1000); // 1-hr default
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const uid = Math.random().toString(36).slice(2) + "@amanda-toolkit";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Amanda's Toolkit//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${escapeIcs(e.title)}`,
    `DESCRIPTION:${escapeIcs(e.subtitle || "")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function escapeIcs(s) {
  return (s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function renderMonthGrid(events) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstShift = first.getDay() === 0 ? 6 : first.getDay() - 1; // Mon-start
  const start = new Date(first); start.setDate(1 - firstShift);
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    days.push(d);
  }

  // Group events by date
  const byDate = {};
  for (const e of events) {
    (byDate[e.date] ||= []).push(e);
  }

  const wrap = h("section", { class: "card" }, [
    h("h2", {}, today.toLocaleDateString(undefined, { month: "long", year: "numeric" })),
    h("div", { class: "sub" }, "Tap any day to see what's on it."),
  ]);

  const dowRow = h("div", { class: "cal-dow" });
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((d) =>
    dowRow.append(h("div", {}, d))
  );
  wrap.append(dowRow);

  const grid = h("div", { class: "cal-grid" });
  days.forEach((d) => {
    const iso = ymd(d);
    const inMonth = d.getMonth() === today.getMonth();
    const isToday = iso === ymd(today);
    const events = byDate[iso] || [];
    const cell = h("button", {
      class: "cal-cell" + (isToday ? " today" : "") + (inMonth ? "" : " muted"),
      onclick: () => showDay(iso, events),
    }, [
      h("div", { class: "cal-cell-num" }, d.getDate()),
      h("div", { class: "cal-cell-dots" },
        events.slice(0, 4).map((e) => h("span", { class: "cal-dot cal-dot-" + e.type }))
      ),
    ]);
    grid.append(cell);
  });
  wrap.append(grid);

  return wrap;
}

function showDay(iso, events) {
  const overlay = h("div", { class: "photo-overlay", onclick: (e) => { if (e.target.classList.contains("photo-overlay")) overlay.remove(); } }, [
    h("div", { class: "card", style: "max-width:480px; width:100%; cursor:auto" }, [
      h("h2", {}, friendlyDate(iso)),
      events.length === 0
        ? h("div", { class: "empty" }, "Nothing on this day.")
        : h("div", { class: "list" }, events.map((e) => renderEventRow(e))),
      h("div", { class: "btn-row", style: "margin-top:12px; justify-content:flex-end" }, [
        h("button", { class: "btn", onclick: () => overlay.remove() }, "Close"),
      ]),
    ]),
  ]);
  document.body.append(overlay);
}

export function renderCalendar(mount) {
  const events = collectEvents();
  mount.append(renderMonthGrid(events));
  mount.append(renderUpcoming(events));
}
