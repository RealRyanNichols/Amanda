import { state, save, uid } from "../store.js";
import { h, toast, confirmAction, todayISO, friendlyDate, daysFromNow } from "../util.js";
import { currentBrand } from "../branding.js";
import { VERSES, verseOfTheDay, HOSPITAL_BAG_SEED, LOVE_NOTES_SEED, babySizeForWeek } from "./life-seeds.js";

function ensureSeeds() {
  if (!state.life.loveNotes.seeded) {
    state.life.loveNotes.notes = LOVE_NOTES_SEED.map((n) => ({ id: uid(), ...n }));
    state.life.loveNotes.seeded = true;
    save();
  }
  if (!state.life.pregnancy.hospitalBag.seeded) {
    state.life.pregnancy.hospitalBag.items = HOSPITAL_BAG_SEED.map((i) => ({
      id: uid(), ...i, packed: false,
    }));
    state.life.pregnancy.hospitalBag.seeded = true;
    save();
  }
}

function subNav() {
  const views = [
    { key: "faith",     label: "Faith" },
    { key: "family",    label: "Family" },
    { key: "pregnancy", label: "Pregnancy" },
    { key: "love",      label: "Love" },
    { key: "gratitude", label: "Gratitude" },
  ];
  const nav = h("div", { class: "chip-row", style: "margin-bottom: 12px" });
  views.forEach((v) =>
    nav.append(h("button", {
      class: "chip" + (state.life.activeView === v.key ? " active" : ""),
      onclick: () => { state.life.activeView = v.key; save(); document.dispatchEvent(new CustomEvent("life:rerender")); },
    }, v.label))
  );
  return nav;
}

/* ---------- FAITH ---------- */

function renderFaith(rerender) {
  const wrap = h("div");
  const v = verseOfTheDay();

  wrap.append(h("section", { class: "card" }, [
    h("h2", {}, "Today's Scripture"),
    h("div", { class: "verse-ref" }, v.ref),
    h("div", { class: "verse-text" }, `"${v.text}"`),
    h("div", { class: "btn-row", style: "margin-top:10px" }, [
      h("button", {
        class: "btn small secondary",
        onclick: async () => {
          try { await navigator.clipboard.writeText(`${v.ref} — "${v.text}"`); toast("Copied"); }
          catch { prompt("Copy verse:", `${v.ref} — "${v.text}"`); }
        },
      }, "Copy verse"),
      h("button", {
        class: "btn small secondary",
        onclick: () => {
          const random = VERSES[Math.floor(Math.random() * VERSES.length)];
          const c = wrap.querySelector(".verse-ref");
          const t = wrap.querySelector(".verse-text");
          if (c) c.textContent = random.ref;
          if (t) t.textContent = `"${random.text}"`;
        },
      }, "Give me another"),
    ]),
  ]));

  // Prayer journal
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Prayer journal"),
    h("div", { class: "sub" }, "Write prayers. Mark them answered. Keep a record of what God has done."),
  ]);

  const form = h("form", { class: "form-row", onsubmit: onAdd }, [
    h("label", { class: "field" }, [
      "A new prayer",
      h("textarea", { name: "text", required: true, placeholder: "What's on your heart?" }),
    ]),
    h("div", { class: "btn-row" }, [h("button", { class: "btn", type: "submit" }, "Add prayer")]),
  ]);
  card.append(form);

  function onAdd(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    state.life.faith.prayers.push({
      id: uid(),
      text: (f.get("text") || "").toString().trim(),
      createdAt: todayISO(),
      answered: false, answeredAt: "", answerNote: "",
    });
    save(); toast("Added"); e.target.reset(); rerender();
  }

  const list = h("div", { class: "list", style: "margin-top:10px" });
  const prayers = [...state.life.faith.prayers].sort((a, b) => {
    if (a.answered !== b.answered) return a.answered ? 1 : -1;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });
  if (!prayers.length) list.append(h("div", { class: "empty" }, "No prayers yet."));
  else prayers.forEach((p) => {
    list.append(
      h("div", { class: "item" }, [
        h("div", {}, [
          h("div", { class: "title" }, [
            p.answered ? h("span", { class: "pill paid" }, "answered") : h("span", { class: "pill" }, "praying"),
            " " + p.text,
          ]),
          h("div", { class: "meta" }, `Started ${friendlyDate(p.createdAt)}${p.answered && p.answeredAt ? " · answered " + friendlyDate(p.answeredAt) : ""}`),
          p.answerNote && h("div", { class: "meta", style: "margin-top:4px; color:var(--ok)" }, "→ " + p.answerNote),
        ]),
        h("div", { class: "actions" }, [
          !p.answered && h("button", { class: "btn small", onclick: () => markAnswered(p, rerender) }, "Answered"),
          h("button", {
            class: "btn small danger",
            onclick: () => {
              if (!confirmAction("Remove this prayer?")) return;
              state.life.faith.prayers = state.life.faith.prayers.filter((x) => x.id !== p.id);
              save(); rerender();
            },
          }, "×"),
        ]),
      ])
    );
  });
  card.append(list);
  wrap.append(card);
  return wrap;
}

function markAnswered(p, rerender) {
  const note = prompt("How was it answered? (optional)", "");
  p.answered = true;
  p.answeredAt = todayISO();
  p.answerNote = (note || "").trim();
  save();
  toast("Praise God 🙏");
  rerender();
}

/* ---------- FAMILY ---------- */

function renderFamily(rerender) {
  const { kids, supporters } = state.life.family;
  const wrap = h("div");

  // Kids
  const kidsCard = h("section", { class: "card" }, [
    h("h2", {}, "Kids"),
    h("div", { class: "sub" }, "Names, ages, school, and pickup time."),
  ]);

  const kidForm = h("form", { class: "form-row three", onsubmit: onAddKid }, [
    h("label", { class: "field" }, ["Name", h("input", { type: "text", name: "name", required: true })]),
    h("label", { class: "field" }, ["Grade", h("input", { type: "text", name: "grade", placeholder: "e.g. 3rd" })]),
    h("label", { class: "field" }, ["Age", h("input", { type: "number", name: "age", min: "0", max: "30" })]),
    h("label", { class: "field", style: "grid-column: 1 / -1" }, ["School", h("input", { type: "text", name: "school" })]),
    h("label", { class: "field" }, ["Drop-off", h("input", { type: "text", name: "dropoff", placeholder: "e.g. 7:45 AM" })]),
    h("label", { class: "field" }, ["Pickup", h("input", { type: "text", name: "pickup", placeholder: "e.g. 3:15 PM" })]),
    h("label", { class: "field" }, ["Favorite thing", h("input", { type: "text", name: "fav", placeholder: "optional — sweet detail" })]),
    h("div", { class: "btn-row", style: "grid-column: 1 / -1" }, [h("button", { class: "btn", type: "submit" }, "Add kid")]),
  ]);
  kidsCard.append(kidForm);

  function onAddKid(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    state.life.family.kids.push({
      id: uid(),
      name: (f.get("name") || "").toString().trim(),
      grade: (f.get("grade") || "").toString().trim(),
      age: f.get("age") ? Number(f.get("age")) : null,
      school: (f.get("school") || "").toString().trim(),
      dropoff: (f.get("dropoff") || "").toString().trim(),
      pickup: (f.get("pickup") || "").toString().trim(),
      fav: (f.get("fav") || "").toString().trim(),
    });
    save(); toast("Added"); e.target.reset(); rerender();
  }

  const kidList = h("div", { class: "list", style: "margin-top:10px" });
  if (!kids.length) kidList.append(h("div", { class: "empty" }, "Add your kids."));
  else kids.forEach((k) => {
    kidList.append(
      h("div", { class: "item" }, [
        h("div", {}, [
          h("div", { class: "title" }, k.name + (k.age != null ? ` · ${k.age}` : "") + (k.grade ? ` · ${k.grade}` : "")),
          k.school && h("div", { class: "meta" }, k.school),
          (k.dropoff || k.pickup) && h("div", { class: "meta" }, [k.dropoff && `Drop ${k.dropoff}`, k.pickup && `Pick ${k.pickup}`].filter(Boolean).join(" · ")),
          k.fav && h("div", { class: "meta", style: "color:var(--accent)" }, "♡ " + k.fav),
        ]),
        h("div", { class: "actions" }, [
          h("button", {
            class: "btn small danger",
            onclick: () => {
              if (!confirmAction(`Remove ${k.name}?`)) return;
              state.life.family.kids = state.life.family.kids.filter((x) => x.id !== k.id);
              save(); rerender();
            },
          }, "×"),
        ]),
      ])
    );
  });
  kidsCard.append(kidList);
  wrap.append(kidsCard);

  // Supporters — "Who loves you today"
  const sCard = h("section", { class: "card" }, [
    h("h2", {}, "Who loves you"),
    h("div", { class: "sub" }, "People you can reach out to when things are heavy. One tap to call or text."),
  ]);

  const sForm = h("form", { class: "form-row two", onsubmit: onAddSupporter }, [
    h("label", { class: "field" }, ["Name", h("input", { type: "text", name: "name", required: true })]),
    h("label", { class: "field" }, ["Relation", h("input", { type: "text", name: "relation", placeholder: "e.g. best friend, mom, pastor" })]),
    h("label", { class: "field", style: "grid-column: 1 / -1" }, ["Phone", h("input", { type: "tel", name: "phone" })]),
    h("div", { class: "btn-row", style: "grid-column: 1 / -1" }, [h("button", { class: "btn", type: "submit" }, "Add")]),
  ]);
  sCard.append(sForm);

  function onAddSupporter(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    state.life.family.supporters.push({
      id: uid(),
      name: (f.get("name") || "").toString().trim(),
      relation: (f.get("relation") || "").toString().trim(),
      phone: (f.get("phone") || "").toString().trim(),
    });
    save(); toast("Added"); e.target.reset(); rerender();
  }

  const sList = h("div", { class: "list", style: "margin-top:10px" });
  if (!supporters.length) sList.append(h("div", { class: "empty" }, "Build your circle."));
  else supporters.forEach((s) => {
    sList.append(
      h("div", { class: "item" }, [
        h("div", {}, [
          h("div", { class: "title" }, s.name),
          s.relation && h("div", { class: "meta" }, s.relation),
        ]),
        h("div", { class: "actions" }, [
          s.phone && h("a", { class: "btn small", href: `tel:${s.phone}` }, "Call"),
          s.phone && h("a", { class: "btn small secondary", href: `sms:${s.phone}` }, "Text"),
          h("button", {
            class: "btn small danger",
            onclick: () => {
              if (!confirmAction(`Remove ${s.name}?`)) return;
              state.life.family.supporters = state.life.family.supporters.filter((x) => x.id !== s.id);
              save(); rerender();
            },
          }, "×"),
        ]),
      ])
    );
  });
  sCard.append(sList);
  wrap.append(sCard);

  return wrap;
}

/* ---------- PREGNANCY ---------- */

function weeksPregnant(dueDate) {
  if (!dueDate) return null;
  const d = new Date(dueDate + "T00:00:00");
  // Full-term = 40 weeks; so conception was ~280 days before due date
  const conception = new Date(d.getTime() - 280 * 86400000);
  const now = new Date();
  const weeks = Math.max(0, Math.floor((now - conception) / (7 * 86400000)));
  return Math.min(weeks, 42);
}

function trimesterLabel(weeks) {
  if (weeks == null) return "";
  if (weeks < 14) return "First trimester";
  if (weeks < 27) return "Second trimester";
  return "Third trimester";
}

function renderPregnancy(rerender) {
  const wrap = h("div");
  const p = state.life.pregnancy;
  const weeks = weeksPregnant(p.dueDate);
  const daysLeft = p.dueDate ? daysFromNow(p.dueDate) : null;
  const name = (p.babyName || "").trim();
  const him = name || "Baby";

  // Status card — name + countdown
  const status = h("section", { class: "card" }, [
    h("h2", {}, name ? `${name}'s countdown` : "Baby countdown"),
    p.dueDate
      ? h("div", { class: "sub" }, `${trimesterLabel(weeks)}${weeks != null ? ` · ${him} is ${weeks} weeks along` : ""}`)
      : h("div", { class: "sub" }, "Set a due date to see your countdown."),
  ]);

  // Baby name — prominent, editable
  status.append(h("label", { class: "field", style: "margin-top:8px" }, [
    "Baby's name (so everything refers to him by name)",
    h("input", {
      type: "text",
      value: p.babyName || "",
      placeholder: "e.g. Thomas",
      oninput: (e) => { p.babyName = e.target.value; save(); },
      onblur: () => rerender(),
    }),
  ]));

  if (p.dueDate) {
    status.append(h("div", { class: "stat-grid", style: "margin-top:10px" }, [
      h("div", { class: "stat" }, [h("div", { class: "label" }, "Weeks"), h("div", { class: "value" }, weeks != null ? weeks : "—")]),
      h("div", { class: "stat" }, [h("div", { class: "label" }, "Due"), h("div", { class: "value" }, friendlyDate(p.dueDate))]),
      h("div", { class: "stat ok" }, [h("div", { class: "label" }, "Days left"), h("div", { class: "value" }, daysLeft != null ? Math.max(0, daysLeft) : "—")]),
    ]));
    if (weeks != null) {
      const pct = Math.min(100, Math.round((weeks / 40) * 100));
      status.append(h("div", { class: "progress", style: "margin-top:10px" }, [h("span", { style: `width:${pct}%` })]));
    }
  }

  status.append(h("label", { class: "field", style: "margin-top:12px" }, [
    "Due date",
    h("input", { type: "date", value: p.dueDate || "", onchange: (e) => { p.dueDate = e.target.value; save(); rerender(); } }),
  ]));

  wrap.append(status);

  // Baby size by week
  const size = weeks != null ? babySizeForWeek(weeks) : null;
  if (size) {
    wrap.append(h("section", { class: "card baby-size" }, [
      h("h2", {}, name ? `This week — ${name} is about the size of a…` : "This week — baby is about the size of a…"),
      h("div", { class: "baby-size-label" }, size.size),
      h("div", { class: "baby-size-note" }, size.note),
      h("div", { class: "meta", style: "margin-top:6px" }, `Week ${size.week}`),
    ]));
  }

  // Photo gallery summary
  wrap.append(renderBabyGallery(name));

  // Doctor visits
  wrap.append(renderVisits(rerender, him));

  // Kick counter
  wrap.append(renderKickCounter(rerender, him));

  // Letters to him
  wrap.append(renderLetters(rerender, name));

  // Hospital bag
  wrap.append(renderHospitalBag(rerender));

  return wrap;
}

function renderLetters(rerender, name) {
  const p = state.life.pregnancy;
  const target = name || "baby";
  const card = h("section", { class: "card" }, [
    h("h2", {}, `Letters to ${target}`),
    h("div", { class: "sub" }, `Little notes for ${target} to read one day. From mom, from dad, from anyone who loves him.`),
  ]);

  const form = h("form", { class: "form-row", onsubmit: (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const body = (f.get("body") || "").toString().trim();
    const author = (f.get("author") || "").toString().trim();
    if (!body) return;
    p.letters.unshift({
      id: uid(),
      body,
      author: author || "",
      createdAt: Date.now(),
    });
    save(); toast("Saved"); e.target.reset(); rerender();
  } }, [
    h("label", { class: "field" }, [
      "A note for him",
      h("textarea", { name: "body", required: true, placeholder: "What do you want him to know?" }),
    ]),
    h("label", { class: "field" }, [
      "Signed",
      h("input", { type: "text", name: "author", placeholder: "Mom / Dad / etc." }),
    ]),
    h("div", { class: "btn-row" }, [h("button", { class: "btn", type: "submit" }, "Save letter")]),
  ]);
  card.append(form);

  const list = h("div", { class: "list", style: "margin-top:10px" });
  if (!p.letters.length) list.append(h("div", { class: "empty" }, `No letters yet. Write ${target} one.`));
  else p.letters.forEach((l) => {
    const d = new Date(l.createdAt);
    list.append(h("div", { class: "letter-item" }, [
      h("div", { class: "letter-date" }, d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })),
      h("div", { class: "letter-body" }, l.body),
      l.author && h("div", { class: "letter-sig" }, "— " + l.author),
      h("button", {
        class: "btn small danger",
        style: "align-self:flex-end",
        onclick: () => {
          if (!confirmAction("Remove this letter?")) return;
          p.letters = p.letters.filter((x) => x.id !== l.id);
          save(); rerender();
        },
      }, "×"),
    ]));
  });
  card.append(list);

  return card;
}

function renderBabyGallery(name) {
  const photos = [];
  for (const v of state.life.pregnancy.appointments) {
    for (const p of v.photos || []) photos.push({ ...p, when: v.date, caption: p.caption || v.notes?.slice(0, 60) });
  }
  if (!photos.length) return h("span");
  photos.sort((a, b) => (b.when || "").localeCompare(a.when || ""));

  const grid = h("div", { class: "photo-grid" });
  photos.slice(0, 9).forEach((p) => {
    grid.append(h("figure", { class: "photo-tile" }, [
      h("img", { src: p.dataUrl, alt: p.caption || "photo" }),
      h("figcaption", {}, friendlyDate(p.when)),
    ]));
  });

  return h("section", { class: "card" }, [
    h("h2", {}, name ? `Photos of ${name}` : "Baby photo gallery"),
    h("div", { class: "sub" }, "Most recent sonograms and photos from your visits."),
    grid,
  ]);
}

function renderVisits(rerender, him) {
  const p = state.life.pregnancy;
  const target = him || "baby";
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Doctor visits"),
    h("div", { class: "sub" }, `Log visits. Add sonogram photos of ${target} from each one.`),
  ]);

  const form = h("form", { class: "form-row two", onsubmit: onAdd }, [
    h("label", { class: "field" }, ["Date", h("input", { type: "date", name: "date", value: todayISO(), required: true })]),
    h("label", { class: "field" }, ["Provider", h("input", { type: "text", name: "provider", placeholder: "OB / clinic name" })]),
    h("label", { class: "field" }, ["Weeks at visit", h("input", { type: "number", name: "weeks", min: "0", max: "45", placeholder: "auto-calc if blank" })]),
    h("label", { class: "field" }, ["Weight", h("input", { type: "text", name: "weight", placeholder: "lbs" })]),
    h("label", { class: "field", style: "grid-column: 1 / -1" }, ["Notes / what the doctor said", h("textarea", { name: "notes" })]),
    h("div", { class: "btn-row", style: "grid-column: 1 / -1" }, [h("button", { class: "btn", type: "submit" }, "Add visit")]),
  ]);
  card.append(form);

  function onAdd(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const date = f.get("date");
    const weeksField = f.get("weeks");
    p.appointments.push({
      id: uid(),
      date,
      provider: (f.get("provider") || "").toString().trim(),
      weeks: weeksField ? Number(weeksField) : weeksPregnant(p.dueDate),
      weight: (f.get("weight") || "").toString().trim(),
      notes: (f.get("notes") || "").toString().trim(),
      photos: [],
    });
    save(); toast("Visit saved"); e.target.reset(); rerender();
  }

  const list = h("div", { class: "list", style: "margin-top:10px" });
  const sorted = [...p.appointments].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  if (!sorted.length) list.append(h("div", { class: "empty" }, "No visits logged yet."));
  else sorted.forEach((v) => {
    const row = h("div", { class: "card", style: "background:var(--bg-elev-2); margin-bottom:8px" }, [
      h("div", { class: "item", style: "padding:0; border:0; background:transparent" }, [
        h("div", {}, [
          h("div", { class: "title" }, friendlyDate(v.date) + (v.provider ? " · " + v.provider : "")),
          h("div", { class: "meta" }, [v.weeks != null && `${v.weeks} wks`, v.weight].filter(Boolean).join(" · ")),
          v.notes && h("div", { class: "meta", style: "margin-top:6px; white-space:pre-wrap" }, v.notes),
        ]),
        h("div", { class: "actions" }, [
          h("label", { class: "btn small" }, [
            "+ Photo",
            h("input", {
              type: "file", accept: "image/*", capture: "environment",
              style: "display:none",
              onchange: async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const caption = prompt("Caption (optional):", "") || "";
                try {
                  const dataUrl = await compressImage(file, 800, 0.72);
                  v.photos = v.photos || [];
                  v.photos.push({ id: uid(), caption, dataUrl });
                  save();
                  toast("Photo saved");
                  rerender();
                } catch (err) {
                  toast("Couldn't save photo");
                }
                e.target.value = "";
              },
            }),
          ]),
          h("button", {
            class: "btn small danger",
            onclick: () => {
              if (!confirmAction("Remove this visit and its photos?")) return;
              p.appointments = p.appointments.filter((x) => x.id !== v.id);
              save(); rerender();
            },
          }, "×"),
        ]),
      ]),
    ]);

    if ((v.photos || []).length) {
      const grid = h("div", { class: "photo-grid", style: "margin-top:10px" });
      v.photos.forEach((ph) => {
        grid.append(h("figure", { class: "photo-tile" }, [
          h("img", { src: ph.dataUrl, alt: ph.caption || "photo", onclick: () => openPhoto(ph) }),
          ph.caption && h("figcaption", {}, ph.caption),
          h("button", {
            class: "btn small danger photo-remove",
            onclick: () => {
              if (!confirmAction("Remove this photo?")) return;
              v.photos = v.photos.filter((x) => x.id !== ph.id);
              save(); rerender();
            },
          }, "×"),
        ]));
      });
      row.append(grid);
    }

    list.append(row);
  });

  card.append(list);
  return card;
}

function openPhoto(ph) {
  const overlay = h("div", { class: "photo-overlay", onclick: () => overlay.remove() }, [
    h("img", { src: ph.dataUrl, alt: ph.caption || "photo" }),
    ph.caption && h("div", { class: "photo-overlay-caption" }, ph.caption),
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

function renderKickCounter(rerender, him) {
  const p = state.life.pregnancy;
  const target = him || "baby";
  const active = p.kickSessions.find((s) => !s.endedAt);
  const kickCount = active ? active.kicks.length : 0;

  const card = h("section", { class: "card" }, [
    h("h2", {}, `${target}'s kick counter`),
    h("div", { class: "sub" }, "Many providers suggest 10 kicks in 2 hours after week 28. Ask yours."),
  ]);

  card.append(h("div", { class: "stat-grid" }, [
    h("div", { class: "stat ok" }, [h("div", { class: "label" }, "This session"), h("div", { class: "value" }, active ? kickCount : "—")]),
    h("div", { class: "stat" }, [h("div", { class: "label" }, "Goal"), h("div", { class: "value" }, "10")]),
    h("div", { class: "stat" }, [h("div", { class: "label" }, "Sessions"), h("div", { class: "value" }, p.kickSessions.filter((s) => s.endedAt).length)]),
  ]));

  const row = h("div", { class: "btn-row", style: "margin-top:10px" }, []);
  if (!active) {
    row.append(h("button", {
      class: "btn",
      onclick: () => {
        p.kickSessions.push({ id: uid(), startedAt: Date.now(), endedAt: null, kicks: [] });
        save(); rerender();
      },
    }, "Start session"));
  } else {
    row.append(h("button", {
      class: "btn",
      onclick: () => { active.kicks.push(Date.now()); save(); rerender(); },
    }, `+1 kick (${kickCount})`));
    row.append(h("button", {
      class: "btn secondary",
      onclick: () => { active.endedAt = Date.now(); save(); toast("Session ended"); rerender(); },
    }, "End session"));
  }
  card.append(row);

  if (active) {
    const elapsed = Math.round((Date.now() - active.startedAt) / 60000);
    card.append(h("div", { class: "meta", style: "margin-top:8px" }, `${elapsed} minute${elapsed === 1 ? "" : "s"} in this session`));
  }

  return card;
}

function renderHospitalBag(rerender) {
  const p = state.life.pregnancy.hospitalBag;
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Hospital bag checklist"),
    h("div", { class: "sub" }, "Starter list. Add your own items."),
  ]);

  // Group by category
  const groups = {};
  p.items.forEach((it) => { (groups[it.category] ||= []).push(it); });

  Object.entries(groups).forEach(([cat, items]) => {
    card.append(h("h3", { style: "margin:14px 0 6px; font-size:13px; color:var(--text-dim); text-transform:uppercase; letter-spacing:.8px" }, cat));
    const list = h("div", { class: "list" });
    items.forEach((it) => {
      list.append(h("div", { class: "item" }, [
        h("div", {}, [
          h("div", { class: "title", style: it.packed ? "opacity:.6;text-decoration:line-through" : "" }, it.item),
        ]),
        h("div", { class: "actions" }, [
          h("button", { class: "btn small" + (it.packed ? " secondary" : ""), onclick: () => { it.packed = !it.packed; save(); rerender(); } }, it.packed ? "Unpack" : "Pack"),
          h("button", {
            class: "btn small danger",
            onclick: () => {
              if (!confirmAction(`Remove "${it.item}"?`)) return;
              state.life.pregnancy.hospitalBag.items = p.items.filter((x) => x.id !== it.id);
              save(); rerender();
            },
          }, "×"),
        ]),
      ]));
    });
    card.append(list);
  });

  // Add item form
  const form = h("form", { class: "form-row two", style: "margin-top:12px", onsubmit: (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    state.life.pregnancy.hospitalBag.items.push({
      id: uid(),
      category: (f.get("category") || "Other").toString().trim(),
      item: (f.get("item") || "").toString().trim(),
      packed: false,
    });
    save(); e.target.reset(); rerender();
  } }, [
    h("label", { class: "field" }, ["Category", h("input", { type: "text", name: "category", placeholder: "For mom / For baby / Docs / Other" })]),
    h("label", { class: "field" }, ["Item", h("input", { type: "text", name: "item", required: true })]),
    h("div", { class: "btn-row", style: "grid-column: 1 / -1" }, [h("button", { class: "btn", type: "submit" }, "+ Add")]),
  ]);
  card.append(form);

  return card;
}

/* ---------- LOVE NOTES ---------- */

function renderLove(rerender) {
  const wrap = h("div");
  const notes = state.life.loveNotes.notes;
  const partner = state.profile.partnerName || (state.brand === "pda" ? "Ryan" : "");

  wrap.append(h("section", { class: "card" }, [
    h("h2", {}, "Love notes" + (partner ? ` from ${partner}` : "")),
    h("div", { class: "sub" }, "Envelopes to open when you need them. Tap to reveal."),
  ]));

  const grid = h("div", { class: "envelope-grid" });
  notes.forEach((n) => {
    const env = h("button", {
      class: "envelope" + (n.opened ? " opened" : ""),
      onclick: () => openNote(n, rerender),
    }, [
      h("div", { class: "envelope-icon" }, n.opened ? "💌" : "✉️"),
      h("div", { class: "envelope-label" }, n.occasion),
    ]);
    grid.append(env);
  });
  wrap.append(grid);

  // Add new note (so Ryan can add his own from his own phone if he wants)
  const add = h("section", { class: "card" }, [
    h("h2", {}, "Write a new one"),
    h("div", { class: "sub" }, "Leave a message for later."),
  ]);

  const form = h("form", { class: "form-row", onsubmit: (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    notes.unshift({
      id: uid(),
      occasion: (f.get("occasion") || "Open anytime").toString().trim(),
      body: (f.get("body") || "").toString().trim(),
      opened: false,
    });
    save(); toast("Saved"); e.target.reset(); rerender();
  } }, [
    h("label", { class: "field" }, ["When should she open it?", h("input", { type: "text", name: "occasion", placeholder: "e.g. Open on a hard day", required: true })]),
    h("label", { class: "field" }, ["Your message", h("textarea", { name: "body", required: true, placeholder: "Write your words here" })]),
    h("div", { class: "btn-row" }, [h("button", { class: "btn", type: "submit" }, "Save note")]),
  ]);
  add.append(form);
  wrap.append(add);

  return wrap;
}

function openNote(n, rerender) {
  n.opened = true;
  save();
  const overlay = h("div", { class: "note-overlay", onclick: (e) => { if (e.target.classList.contains("note-overlay")) overlay.remove(); } }, [
    h("div", { class: "note-letter" }, [
      h("div", { class: "note-occasion" }, n.occasion),
      h("div", { class: "note-body" }, n.body),
      h("div", { class: "btn-row", style: "margin-top:14px; justify-content:center" }, [
        h("button", {
          class: "btn",
          onclick: () => overlay.remove(),
        }, "Close"),
        h("button", {
          class: "btn secondary",
          onclick: () => {
            const newBody = prompt("Edit this note:", n.body);
            if (newBody != null) { n.body = newBody; save(); overlay.remove(); rerender(); }
          },
        }, "Edit"),
        h("button", {
          class: "btn danger",
          onclick: () => {
            if (!confirmAction("Remove this note?")) return;
            state.life.loveNotes.notes = state.life.loveNotes.notes.filter((x) => x.id !== n.id);
            save(); overlay.remove(); rerender();
          },
        }, "Remove"),
      ]),
    ]),
  ]);
  document.body.append(overlay);
  rerender();
}

/* ---------- GRATITUDE ---------- */

function renderGratitude(rerender) {
  const { entries } = state.life.gratitude;
  const today = todayISO();
  const todayEntry = entries.find((e) => e.date === today);
  const wrap = h("div");

  const todayCard = h("section", { class: "card" }, [
    h("h2", {}, "Three things today"),
    h("div", { class: "sub" }, "Tiny moments count. Food. Weather. A text. Your kid's laugh."),
  ]);

  const items = [0, 1, 2];
  items.forEach((i) => {
    todayCard.append(h("label", { class: "field" }, [
      `${i + 1}.`,
      h("input", {
        type: "text",
        value: todayEntry?.things?.[i] || "",
        placeholder: i === 0 ? "Something small that was good" : "",
        oninput: (e) => {
          if (!todayEntry) {
            entries.unshift({ id: uid(), date: today, things: ["", "", ""] });
          }
          const current = entries.find((x) => x.date === today);
          current.things[i] = e.target.value;
          save();
        },
      }),
    ]));
  });
  wrap.append(todayCard);

  // History
  const history = [...entries].sort((a, b) => (b.date || "").localeCompare(a.date || "")).filter((e) => e.date !== today).slice(0, 14);
  if (history.length) {
    const card = h("section", { class: "card" }, [
      h("h2", {}, "Looking back"),
      h("div", { class: "sub" }, "Last two weeks of gratitude."),
    ]);
    history.forEach((e) => {
      if (!(e.things || []).some((t) => t?.trim())) return;
      card.append(h("div", { class: "item" }, [
        h("div", {}, [
          h("div", { class: "title" }, friendlyDate(e.date)),
          h("div", { class: "meta" }, e.things.filter(Boolean).map((t, i) => `${i + 1}. ${t}`).join(" · ")),
        ]),
      ]));
    });
    wrap.append(card);
  }

  return wrap;
}

/* ---------- MAIN RENDER ---------- */

export function renderLife(mount, { rerender }) {
  ensureSeeds();
  document.removeEventListener("life:rerender", rerender);
  document.addEventListener("life:rerender", rerender);

  mount.append(subNav());
  const v = state.life.activeView || "faith";
  if (v === "faith") mount.append(renderFaith(rerender));
  else if (v === "family") mount.append(renderFamily(rerender));
  else if (v === "pregnancy") mount.append(renderPregnancy(rerender));
  else if (v === "love") mount.append(renderLove(rerender));
  else if (v === "gratitude") mount.append(renderGratitude(rerender));
}

export { verseOfTheDay };
