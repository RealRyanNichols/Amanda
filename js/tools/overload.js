import { state, save, uid } from "../store.js";
import { h, toast, confirmAction, todayISO, friendlyDate } from "../util.js";
import { micButton } from "../voice.js";
import { scanForConcerns, logConcern } from "../safety-net.js";

const CATEGORIES = [
  { value: "now", label: "Do now", pill: "urgent" },
  { value: "today", label: "Today", pill: "hot" },
  { value: "this-week", label: "This week", pill: "warm" },
  { value: "later", label: "Later", pill: "cold" },
  { value: "feeling", label: "Feelings", pill: "" },
];

function renderDump(rerender) {
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Dump everything on your mind"),
    h("div", { class: "sub" }, "Freeform. One thought per line. Hit 'Organize' when you're done."),
  ]);
  const ta = h("textarea", {
    placeholder: "rent due friday\nneed to text mom back\nstudent schedule\nfeeling anxious about the week\n...\n(or hold the mic and dump it all out loud)",
    style: "min-height:140px",
  });
  ta.value = state.overload.brainDump || "";
  ta.addEventListener("input", () => {
    state.overload.brainDump = ta.value;
    save();
  });
  card.append(ta);

  const mic = micButton(ta);
  const row = h("div", { class: "btn-row", style: "margin-top:8px" }, [
    mic,
    h("button", { class: "btn", onclick: organize }, "Organize into priorities"),
    h("button", { class: "btn secondary", onclick: clear }, "Clear"),
  ]);
  card.append(row);

  function organize() {
    const rawDump = state.overload.brainDump || "";
    const lines = rawDump
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) { toast("Nothing to organize"); return; }

    // Safety Net: silent log only. Brain dump is a vent space — no banners.
    const concern = scanForConcerns(rawDump);
    if (concern.level !== "none") logConcern({ source: "overload", text: rawDump, level: concern.level });

    lines.forEach((text) => {
      state.overload.tasks.push({
        id: uid(),
        text,
        category: guessCategory(text),
        due: "",
        done: false,
        createdAt: todayISO(),
      });
    });
    state.overload.brainDump = "";
    save();
    toast(`${lines.length} item${lines.length > 1 ? "s" : ""} organized`);
    rerender();
  }
  function clear() {
    if (!state.overload.brainDump) return;
    if (!confirmAction("Clear the brain dump?")) return;
    state.overload.brainDump = "";
    save();
    rerender();
  }

  return card;
}

function guessCategory(text) {
  const t = text.toLowerCase();
  if (/\b(feel|anxious|sad|happy|angry|tired|overwhelm|stress|lonely|grateful)\b/.test(t)) return "feeling";
  if (/\b(now|asap|immediately|emergency|urgent)\b/.test(t)) return "now";
  if (/\b(today|tonight)\b/.test(t)) return "today";
  if (/\b(this week|by friday|by weekend)\b/.test(t)) return "this-week";
  if (/\b(rent|bill|due|payment|overdue|past due)\b/.test(t)) return "today";
  return "later";
}

function renderEmergency() {
  const { tasks } = state.overload;
  const now = tasks.filter((t) => !t.done && t.category === "now");
  const today = tasks.filter((t) => !t.done && t.category === "today");
  const first = now[0] || today[0];
  if (!first) return null;
  return h("section", { class: "card" }, [
    h("h2", {}, "Handle this first"),
    h("div", { class: "sub" }, "When everything feels like a lot, just do the next thing."),
    h("div", { class: "alert bad", style: "font-size:15px; font-weight:600" }, first.text),
  ]);
}

function renderTasks(rerender) {
  const { tasks } = state.overload;
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Your list"),
    h("div", { class: "sub" }, "Move things around. Check them off. Breathe."),
  ]);

  if (!tasks.length) {
    card.append(h("div", { class: "empty" }, "Empty. Use the brain dump above."));
    return card;
  }

  CATEGORIES.forEach((cat) => {
    const rows = tasks.filter((t) => t.category === cat.value);
    if (!rows.length) return;
    card.append(h("h3", { style: "margin:12px 0 6px; font-size:13px; color:var(--text-dim); text-transform:uppercase; letter-spacing:.8px" }, cat.label));
    const list = h("div", { class: "list" });
    rows.forEach((t) => {
      list.append(
        h("div", { class: "item" }, [
          h("div", {}, [
            h("div", { class: "title", style: t.done ? "text-decoration:line-through;opacity:.6" : "" }, [
              t.text, " ",
              cat.pill && h("span", { class: `pill ${cat.pill}` }, cat.label),
            ]),
            t.due && h("div", { class: "meta" }, `due ${friendlyDate(t.due)}`),
          ]),
          h("div", { class: "actions" }, [
            h("button", {
              class: "btn small " + (t.done ? "secondary" : ""),
              onclick: () => { t.done = !t.done; save(); rerender(); },
            }, t.done ? "Undo" : "Done"),
            h("select", {
              class: "", style: "padding:6px 8px; font-size:12px",
              onchange: (e) => { t.category = e.target.value; save(); rerender(); },
            }, CATEGORIES.map((c) => h("option", { value: c.value, selected: c.value === t.category }, c.label))),
            h("button", {
              class: "btn small danger",
              onclick: () => {
                state.overload.tasks = state.overload.tasks.filter((x) => x.id !== t.id);
                save();
                rerender();
              },
            }, "×"),
          ]),
        ])
      );
    });
    card.append(list);
  });

  card.append(h("div", { class: "btn-row", style: "margin-top:12px" }, [
    h("button", {
      class: "btn secondary",
      onclick: () => {
        const count = state.overload.tasks.filter((t) => t.done).length;
        if (!count) return toast("Nothing finished yet");
        if (!confirmAction(`Clear ${count} finished task${count > 1 ? "s" : ""}?`)) return;
        state.overload.tasks = state.overload.tasks.filter((t) => !t.done);
        save();
        rerender();
      },
    }, "Clear finished"),
  ]));

  return card;
}

export function renderOverload(mount, { rerender }) {
  const emer = renderEmergency();
  if (emer) mount.append(emer);
  mount.append(renderDump(rerender));
  mount.append(renderTasks(rerender));
}
