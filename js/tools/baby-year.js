import { state, save, uid } from "../store.js";
import { h, toast, confirmAction, todayISO, friendlyDate } from "../util.js";
import { micButton } from "../voice.js";

// First-year milestone seed — common developmental touchstones.
// Months are loose: "about" this age. Varies baby to baby.
const MILESTONES_SEED = [
  { ageMonths: 0,  title: "First bath at home" },
  { ageMonths: 0,  title: "First family photo" },
  { ageMonths: 0,  title: "First visit home" },
  { ageMonths: 1,  title: "First smile" },
  { ageMonths: 1,  title: "First real eye contact" },
  { ageMonths: 2,  title: "First coo" },
  { ageMonths: 2,  title: "First laugh" },
  { ageMonths: 3,  title: "Holds head up" },
  { ageMonths: 3,  title: "Reaches for a toy" },
  { ageMonths: 4,  title: "Rolls tummy-to-back" },
  { ageMonths: 4,  title: "Recognizes mom's voice" },
  { ageMonths: 5,  title: "Sits with support" },
  { ageMonths: 6,  title: "First solid food" },
  { ageMonths: 6,  title: "Sits unassisted" },
  { ageMonths: 7,  title: "First tooth" },
  { ageMonths: 7,  title: "Starts babbling (ba-ba, da-da)" },
  { ageMonths: 8,  title: "Crawls" },
  { ageMonths: 9,  title: "Pulls to stand" },
  { ageMonths: 10, title: "First word" },
  { ageMonths: 10, title: "Cruises along furniture" },
  { ageMonths: 11, title: "Waves bye-bye" },
  { ageMonths: 12, title: "First steps" },
  { ageMonths: 12, title: "First birthday" },
  { ageMonths: 12, title: "Blows out first candle" },
];

// Standard well-baby checkup schedule (US).
const CHECKUP_AGES = [
  { ageMonths: 0,  label: "Newborn visit (3-5 days)" },
  { ageMonths: 1,  label: "1-month checkup" },
  { ageMonths: 2,  label: "2-month checkup" },
  { ageMonths: 4,  label: "4-month checkup" },
  { ageMonths: 6,  label: "6-month checkup" },
  { ageMonths: 9,  label: "9-month checkup" },
  { ageMonths: 12, label: "12-month checkup" },
];

function seedIfNeeded() {
  const by = state.babyYear;
  if (by.seeded) return;
  by.milestones = MILESTONES_SEED.map((m) => ({
    id: uid(),
    title: m.title,
    dueMonths: m.ageMonths,
    completedAt: null,
    note: "",
    photoUrl: "",
  }));
  by.seeded = true;
  save();
}

function babyBirthDate() {
  // If Thomas has been born, state.life.pregnancy should have a "birthDate" field.
  // For now, use the due date as a placeholder until birth.
  return state.life?.pregnancy?.birthDate || null;
}

function ageMonths(birthISO) {
  if (!birthISO) return 0;
  const birth = new Date(birthISO + "T00:00:00");
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) return months - 1;
  return Math.max(0, months);
}

function babyName() {
  return (state.life?.pregnancy?.babyName || "").trim();
}

function renderHeader(rerender) {
  const name = babyName();
  const birth = babyBirthDate();
  const card = h("section", { class: "card" }, [
    h("h2", {}, name ? `${name}'s first year` : "Baby's first year"),
    birth
      ? h("div", { class: "sub" }, `Born ${friendlyDate(birth)} · ${ageMonths(birth)} month${ageMonths(birth) === 1 ? "" : "s"} old`)
      : h("div", { class: "sub" }, "Once your baby is born, set the birth date below to unlock age-aware milestones."),
  ]);

  card.append(h("div", { class: "form-row two", style: "margin-top:10px" }, [
    h("label", { class: "field" }, [
      "Birth date",
      h("input", {
        type: "date",
        value: birth || "",
        onchange: (e) => {
          state.life.pregnancy.birthDate = e.target.value;
          save();
          rerender();
        },
      }),
    ]),
    h("label", { class: "field" }, [
      `${name || "Baby"}'s name`,
      h("input", {
        type: "text",
        value: name,
        placeholder: "e.g. Thomas",
        oninput: (e) => { state.life.pregnancy.babyName = e.target.value; save(); },
        onblur: () => rerender(),
      }),
    ]),
  ]));

  return card;
}

function renderMilestones(rerender) {
  const by = state.babyYear;
  const name = babyName() || "baby";
  const birth = babyBirthDate();
  const age = birth ? ageMonths(birth) : null;

  const card = h("section", { class: "card" }, [
    h("h2", {}, "Milestones"),
    h("div", { class: "sub" }, `Tap to mark when ${name} does it. Add a photo and a memory.`),
  ]);

  // Group by "age bracket"
  const brackets = [
    { label: "Newborn (0-1 mo)",  min: 0, max: 1 },
    { label: "1-3 months",        min: 1, max: 3 },
    { label: "3-6 months",        min: 3, max: 6 },
    { label: "6-9 months",        min: 6, max: 9 },
    { label: "9-12 months",       min: 9, max: 13 },
    { label: "After 1",           min: 13, max: 999 },
  ];

  brackets.forEach((br) => {
    const items = by.milestones.filter((m) => m.dueMonths >= br.min && m.dueMonths < br.max);
    if (!items.length) return;
    const section = h("div", { style: "margin-top:14px" });
    section.append(h("h3", { class: "baby-year-bracket" + (age != null && age >= br.min && age < br.max ? " now" : "") }, br.label));
    const list = h("div", { class: "list" });
    items.forEach((m) => {
      const done = !!m.completedAt;
      list.append(h("div", { class: "item milestone-item" + (done ? " done" : "") }, [
        h("div", { style: "flex:1; min-width:0" }, [
          h("div", { class: "title" }, [
            done ? h("span", { class: "pill paid" }, "done") : h("span", { class: "pill" }, `~${m.dueMonths}mo`),
            " ", m.title,
          ]),
          m.completedAt && h("div", { class: "meta" }, "Happened " + friendlyDate(m.completedAt.slice(0, 10))),
          m.note && h("div", { class: "meta milestone-note" }, m.note),
        ]),
        m.photoUrl && h("img", { class: "milestone-photo", src: m.photoUrl, alt: m.title, onclick: () => openPhoto(m.photoUrl) }),
        h("div", { class: "actions" }, [
          !done && h("button", {
            class: "btn small",
            onclick: () => markMilestone(m, rerender),
          }, "Mark"),
          done && h("button", {
            class: "btn small secondary",
            onclick: () => { m.completedAt = null; save(); rerender(); },
          }, "Undo"),
          h("label", { class: "btn small secondary" }, [
            "📷",
            h("input", {
              type: "file", accept: "image/*", capture: "environment", style: "display:none",
              onchange: async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const dataUrl = await compressImage(file, 800, 0.72);
                  m.photoUrl = dataUrl;
                  if (!m.completedAt) m.completedAt = new Date().toISOString();
                  save(); toast("Photo saved"); rerender();
                } catch { toast("Couldn't save photo"); }
                e.target.value = "";
              },
            }),
          ]),
          h("button", {
            class: "btn small danger",
            onclick: () => {
              if (!confirmAction(`Remove "${m.title}"?`)) return;
              by.milestones = by.milestones.filter((x) => x.id !== m.id);
              save(); rerender();
            },
          }, "×"),
        ]),
      ]));
    });
    section.append(list);
    card.append(section);
  });

  // Add custom milestone
  card.append(h("h3", { class: "baby-year-bracket" }, "Add a moment"));
  const form = h("form", { class: "form-row two", onsubmit: (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const title = (f.get("title") || "").toString().trim();
    if (!title) return;
    by.milestones.push({
      id: uid(),
      title,
      dueMonths: Number(f.get("age")) || 0,
      completedAt: null,
      note: "",
      photoUrl: "",
    });
    save(); e.target.reset(); rerender();
  } }, [
    h("label", { class: "field" }, ["Moment", h("input", { type: "text", name: "title", required: true, placeholder: "e.g. Met his grandparents" })]),
    h("label", { class: "field" }, ["Age (months, approx)", h("input", { type: "number", name: "age", min: "0", max: "36", value: "0" })]),
    h("div", { class: "btn-row", style: "grid-column: 1 / -1" }, [h("button", { class: "btn", type: "submit" }, "+ Add moment")]),
  ]);
  card.append(form);

  return card;
}

function markMilestone(m, rerender) {
  const note = prompt(`Tell the story of "${m.title}" — one sentence is plenty.`, m.note || "");
  if (note === null) return;
  m.note = note.trim();
  m.completedAt = new Date().toISOString();
  save();
  toast("Saved 💛");
  rerender();
}

function openPhoto(dataUrl) {
  const overlay = h("div", { class: "photo-overlay", onclick: () => overlay.remove() }, [
    h("img", { src: dataUrl, alt: "" }),
  ]);
  document.body.append(overlay);
}

async function compressImage(file, maxDim = 800, quality = 0.72) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const hh = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = hh;
    canvas.getContext("2d").drawImage(img, 0, 0, w, hh);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function renderCheckups() {
  const birth = babyBirthDate();
  if (!birth) return h("span");
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Pediatrician visits"),
    h("div", { class: "sub" }, "Standard well-baby schedule. Verify dates with your pediatrician."),
  ]);
  const list = h("div", { class: "list" });
  const birthDate = new Date(birth + "T00:00:00");
  CHECKUP_AGES.forEach((c) => {
    const d = new Date(birthDate);
    d.setMonth(d.getMonth() + c.ageMonths);
    list.append(h("div", { class: "item" }, [
      h("div", {}, [
        h("div", { class: "title" }, c.label),
        h("div", { class: "meta" }, `~${friendlyDate(d.toISOString().slice(0, 10))}`),
      ]),
    ]));
  });
  card.append(list);
  return card;
}

function renderGrowth(rerender) {
  const by = state.babyYear;
  const name = babyName() || "baby";
  const card = h("section", { class: "card" }, [
    h("h2", {}, `${name}'s growth log`),
    h("div", { class: "sub" }, "From each pediatrician visit."),
  ]);

  const form = h("form", { class: "form-row three", onsubmit: (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    by.growthLog.push({
      id: uid(),
      date: f.get("date"),
      lbs: Number(f.get("lbs")) || 0,
      oz: Number(f.get("oz")) || 0,
      inches: Number(f.get("inches")) || 0,
      notes: (f.get("notes") || "").toString().trim(),
    });
    save(); e.target.reset(); rerender();
  } }, [
    h("label", { class: "field" }, ["Date", h("input", { type: "date", name: "date", value: todayISO(), required: true })]),
    h("label", { class: "field" }, ["Lbs", h("input", { type: "number", name: "lbs", step: "0.1" })]),
    h("label", { class: "field" }, ["Oz", h("input", { type: "number", name: "oz", step: "0.1" })]),
    h("label", { class: "field" }, ["Inches", h("input", { type: "number", name: "inches", step: "0.1" })]),
    h("label", { class: "field", style: "grid-column: 1 / -1" }, ["Notes", h("input", { type: "text", name: "notes" })]),
    h("div", { class: "btn-row", style: "grid-column: 1 / -1" }, [h("button", { class: "btn", type: "submit" }, "+ Log visit")]),
  ]);
  card.append(form);

  const list = h("div", { class: "list", style: "margin-top:10px" });
  [...by.growthLog]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .forEach((g) => {
      list.append(h("div", { class: "item" }, [
        h("div", {}, [
          h("div", { class: "title" }, friendlyDate(g.date)),
          h("div", { class: "meta" }, [
            g.lbs ? `${g.lbs} lb${g.oz ? " " + g.oz + " oz" : ""}` : null,
            g.inches ? `${g.inches} in` : null,
            g.notes,
          ].filter(Boolean).join(" · ")),
        ]),
        h("div", { class: "actions" }, [
          h("button", {
            class: "btn small danger",
            onclick: () => {
              if (!confirmAction("Remove this log?")) return;
              by.growthLog = by.growthLog.filter((x) => x.id !== g.id);
              save(); rerender();
            },
          }, "×"),
        ]),
      ]));
    });
  card.append(list);
  return card;
}

export function renderBabyYear(mount, { rerender }) {
  seedIfNeeded();
  mount.append(renderHeader(rerender));
  mount.append(renderMilestones(rerender));
  if (babyBirthDate()) {
    mount.append(renderCheckups());
    mount.append(renderGrowth(rerender));
  }
}
