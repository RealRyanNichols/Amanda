import { state, save, uid } from "../store.js";
import { h, toast, confirmAction, todayISO, friendlyDate, money } from "../util.js";
import { currentBrand } from "../branding.js";
import { TEXAS_RDA_COURSE_SEED, TX_RDA_REQUIREMENTS } from "./rda-seed.js";

function ensureSeed() {
  if (!state.academy.course.seeded) {
    state.academy.course.modules = TEXAS_RDA_COURSE_SEED.map((m) => ({
      id: uid(),
      title: m.title,
      lessons: m.lessons.map((l) => ({ id: uid(), title: l.title, minutes: l.minutes, notes: l.notes })),
    }));
    state.academy.course.seeded = true;
    save();
  }
}

function emptyRequirements() {
  const req = {};
  for (const r of TX_RDA_REQUIREMENTS) req[r.key] = { done: false, date: "", expires: "", note: "" };
  return req;
}

function renderSubNav() {
  const views = [
    { key: "cohorts", label: "Cohorts" },
    { key: "students", label: "Students" },
    { key: "course", label: "Course" },
  ];
  const nav = h("div", { class: "chip-row", style: "margin-bottom: 12px" });
  views.forEach((v) =>
    nav.append(
      h("button", {
        class: "chip" + (state.academy.activeView === v.key ? " active" : ""),
        onclick: () => {
          state.academy.activeView = v.key;
          save();
          document.dispatchEvent(new CustomEvent("academy:rerender"));
        },
      }, v.label)
    )
  );
  return nav;
}

/* ---------- COHORTS ---------- */

function renderCohorts(rerender) {
  const { programs, students } = state.academy;

  const card = h("section", { class: "card" }, [
    h("h2", {}, "Cohorts / programs"),
    h("div", { class: "sub" }, "Create a cohort, then enroll students into it."),
  ]);

  const form = h("form", { class: "form-row two", onsubmit: onAdd }, [
    h("label", { class: "field", style: "grid-column: 1 / -1" }, [
      "Cohort name",
      h("input", { type: "text", name: "name", placeholder: "e.g. Spring 2026", required: true }),
    ]),
    h("label", { class: "field" }, [
      "Start date",
      h("input", { type: "date", name: "startDate", value: todayISO(), required: true }),
    ]),
    h("label", { class: "field" }, [
      "End date",
      h("input", { type: "date", name: "endDate" }),
    ]),
    h("label", { class: "field" }, [
      "Tuition (per student)",
      h("input", { type: "number", name: "tuition", min: "0", step: "0.01", placeholder: "4800" }),
    ]),
    h("label", { class: "field" }, [
      "Total hours required",
      h("input", { type: "number", name: "hours", min: "0", step: "1", placeholder: "300" }),
    ]),
    h("div", { class: "btn-row", style: "grid-column: 1 / -1" }, [
      h("button", { class: "btn", type: "submit" }, "Add cohort"),
    ]),
  ]);
  card.append(form);

  function onAdd(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    state.academy.programs.push({
      id: uid(),
      name: (f.get("name") || "").toString().trim(),
      startDate: f.get("startDate"),
      endDate: f.get("endDate") || "",
      tuition: Number(f.get("tuition")) || 0,
      totalHours: Number(f.get("hours")) || 0,
    });
    save();
    toast("Cohort added");
    e.target.reset();
    rerender();
  }

  const list = h("div", { class: "list", style: "margin-top:10px" });
  if (!programs.length) {
    list.append(h("div", { class: "empty" }, "No cohorts yet. Add your first one above."));
  } else {
    programs.forEach((p) => {
      const enrolled = students.filter((s) => s.programId === p.id && s.status !== "withdrawn").length;
      list.append(
        h("div", { class: "item" }, [
          h("div", {}, [
            h("div", { class: "title" }, p.name),
            h("div", { class: "meta" },
              `${friendlyDate(p.startDate)}${p.endDate ? " → " + friendlyDate(p.endDate) : ""} · ${enrolled} student${enrolled === 1 ? "" : "s"}${p.tuition ? " · " + money(p.tuition) : ""}`),
          ]),
          h("div", { class: "actions" }, [
            h("button", {
              class: "btn small danger",
              onclick: () => {
                if (!confirmAction(`Remove cohort "${p.name}"? Students stay — they'll just have no cohort.`)) return;
                state.academy.students.forEach((s) => { if (s.programId === p.id) s.programId = ""; });
                state.academy.programs = state.academy.programs.filter((x) => x.id !== p.id);
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

/* ---------- STUDENTS ---------- */

function renderStudents(rerender) {
  const { programs, students } = state.academy;

  const card = h("section", { class: "card" }, [
    h("h2", {}, "Students"),
    h("div", { class: "sub" }, "Track readiness, hours, tuition, and attendance."),
  ]);

  const form = h("form", { class: "form-row two", onsubmit: onAdd }, [
    h("label", { class: "field" }, [
      "First name",
      h("input", { type: "text", name: "firstName", required: true }),
    ]),
    h("label", { class: "field" }, [
      "Last name",
      h("input", { type: "text", name: "lastName", required: true }),
    ]),
    h("label", { class: "field" }, [
      "Phone",
      h("input", { type: "tel", name: "phone" }),
    ]),
    h("label", { class: "field" }, [
      "Email",
      h("input", { type: "email", name: "email" }),
    ]),
    h("label", { class: "field" }, [
      "Cohort",
      h("select", { name: "programId" }, [
        h("option", { value: "" }, "— none yet —"),
        ...programs.map((p) => h("option", { value: p.id }, p.name)),
      ]),
    ]),
    h("label", { class: "field" }, [
      "Enrolled on",
      h("input", { type: "date", name: "enrolledDate", value: todayISO() }),
    ]),
    h("div", { class: "btn-row", style: "grid-column: 1 / -1" }, [
      h("button", { class: "btn", type: "submit" }, "Add student"),
    ]),
  ]);
  card.append(form);

  function onAdd(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    state.academy.students.push({
      id: uid(),
      firstName: (f.get("firstName") || "").toString().trim(),
      lastName: (f.get("lastName") || "").toString().trim(),
      phone: (f.get("phone") || "").toString().trim(),
      email: (f.get("email") || "").toString().trim(),
      programId: f.get("programId") || "",
      enrolledDate: f.get("enrolledDate") || todayISO(),
      status: "enrolled",
      tuitionPaid: 0,
      hours: { classroom: 0, clinical: 0, externship: 0 },
      requirements: emptyRequirements(),
      attendance: {},
      notes: "",
      expanded: false,
    });
    save();
    toast("Student added");
    e.target.reset();
    rerender();
  }

  const list = h("div", { class: "list", style: "margin-top:10px" });
  if (!students.length) {
    list.append(h("div", { class: "empty" }, "No students yet."));
  } else {
    students.forEach((s) => list.append(renderStudentRow(s, programs, rerender)));
  }
  card.append(list);
  return card;
}

function renderStudentRow(s, programs, rerender) {
  const program = programs.find((p) => p.id === s.programId);
  const totalHoursReq = program?.totalHours || 0;
  const hoursDone = (s.hours?.classroom || 0) + (s.hours?.clinical || 0) + (s.hours?.externship || 0);
  const hoursPct = totalHoursReq ? Math.min(100, Math.round((hoursDone / totalHoursReq) * 100)) : 0;

  const tuition = program?.tuition || 0;
  const tuitionPct = tuition ? Math.min(100, Math.round((s.tuitionPaid / tuition) * 100)) : 0;

  const reqDone = Object.entries(s.requirements || {})
    .filter(([k, v]) => {
      const meta = TX_RDA_REQUIREMENTS.find((r) => r.key === k);
      return meta && !meta.optional && v.done;
    }).length;
  const reqTotal = TX_RDA_REQUIREMENTS.filter((r) => !r.optional).length;
  const gradReady = reqDone === reqTotal;

  const header = h("div", { class: "item", style: "align-items:center" }, [
    h("div", { style: "flex:1; min-width:0" }, [
      h("div", { class: "title" }, [
        `${s.firstName} ${s.lastName} `,
        gradReady
          ? h("span", { class: "pill paid" }, "grad-ready")
          : h("span", { class: "pill" }, `${reqDone}/${reqTotal} reqs`),
      ]),
      h("div", { class: "meta" },
        [program?.name, s.phone, s.email].filter(Boolean).join(" · ") || "—"),
    ]),
    h("div", { class: "actions" }, [
      h("button", {
        class: "btn small secondary",
        onclick: () => { s.expanded = !s.expanded; save(); rerender(); },
      }, s.expanded ? "Hide" : "Open"),
      h("button", {
        class: "btn small danger",
        onclick: () => {
          if (!confirmAction(`Remove ${s.firstName} ${s.lastName}?`)) return;
          state.academy.students = state.academy.students.filter((x) => x.id !== s.id);
          save();
          rerender();
        },
      }, "×"),
    ]),
  ]);

  if (!s.expanded) return header;

  const wrap = h("div", {}, [header]);

  // Progress bars
  wrap.append(h("div", { class: "card", style: "margin-top:8px" }, [
    h("h2", { style: "font-size:14px" }, "Progress"),
    h("div", { class: "meta" }, `Hours: ${hoursDone}${totalHoursReq ? " / " + totalHoursReq : ""}${totalHoursReq ? " · " + hoursPct + "%" : ""}`),
    totalHoursReq ? h("div", { class: "progress" }, [h("span", { style: `width:${hoursPct}%` })]) : null,
    h("div", { class: "meta", style: "margin-top:8px" }, `Tuition: ${money(s.tuitionPaid)}${tuition ? " / " + money(tuition) : ""}${tuition ? " · " + tuitionPct + "%" : ""}`),
    tuition ? h("div", { class: "progress" }, [h("span", { style: `width:${tuitionPct}%` })]) : null,
  ]));

  // Hours editor
  wrap.append(h("div", { class: "card", style: "margin-top:8px" }, [
    h("h2", { style: "font-size:14px" }, "Log hours"),
    h("div", { class: "form-row three" }, [
      hoursInput(s, "classroom", rerender),
      hoursInput(s, "clinical", rerender),
      hoursInput(s, "externship", rerender),
    ]),
  ]));

  // Tuition payment
  wrap.append(h("div", { class: "card", style: "margin-top:8px" }, [
    h("h2", { style: "font-size:14px" }, "Record payment"),
    h("div", { class: "btn-row" }, [
      h("button", { class: "btn small", onclick: () => addPayment(s, rerender) }, "+ Payment"),
      h("button", { class: "btn small secondary", onclick: () => { s.tuitionPaid = 0; save(); rerender(); } }, "Reset paid"),
    ]),
  ]));

  // Requirements checklist
  const reqCard = h("div", { class: "card", style: "margin-top:8px" }, [
    h("h2", { style: "font-size:14px" }, "Texas RDA readiness"),
    h("div", { class: "sub" }, "Verify current rules at TSBDE before relying on this list."),
  ]);
  const reqList = h("div", { class: "list" });
  TX_RDA_REQUIREMENTS.forEach((r) => {
    const v = s.requirements[r.key] || { done: false, date: "", expires: "", note: "" };
    const pill = v.done
      ? h("span", { class: "pill paid" }, "done")
      : r.optional
      ? h("span", { class: "pill cold" }, "optional")
      : h("span", { class: "pill" }, "todo");
    reqList.append(
      h("div", { class: "item" }, [
        h("div", {}, [
          h("div", { class: "title" }, [r.label, " ", pill]),
          v.date && h("div", { class: "meta" }, `Completed ${friendlyDate(v.date)}${v.expires ? " · expires " + friendlyDate(v.expires) : ""}`),
        ]),
        h("div", { class: "actions" }, [
          h("button", {
            class: "btn small " + (v.done ? "secondary" : ""),
            onclick: () => {
              if (!v.done) {
                v.done = true;
                v.date = todayISO();
                if (r.hasExpiration) {
                  const yr = new Date();
                  yr.setFullYear(yr.getFullYear() + 2);
                  v.expires = yr.toISOString().slice(0, 10);
                }
              } else {
                v.done = false; v.date = ""; v.expires = "";
              }
              s.requirements[r.key] = v;
              save();
              rerender();
            },
          }, v.done ? "Undo" : "Mark done"),
        ]),
      ])
    );
  });
  reqCard.append(reqList);
  wrap.append(reqCard);

  // Attendance today
  const today = todayISO();
  const todayMark = s.attendance?.[today] || "";
  wrap.append(h("div", { class: "card", style: "margin-top:8px" }, [
    h("h2", { style: "font-size:14px" }, `Attendance · ${friendlyDate(today)}`),
    h("div", { class: "btn-row" }, [
      attendanceBtn(s, "present", todayMark, rerender),
      attendanceBtn(s, "tardy", todayMark, rerender),
      attendanceBtn(s, "excused", todayMark, rerender),
      attendanceBtn(s, "absent", todayMark, rerender),
      h("button", { class: "btn small secondary", onclick: () => { delete s.attendance[today]; save(); rerender(); } }, "Clear"),
    ]),
  ]));

  return wrap;
}

function hoursInput(s, key, rerender) {
  return h("label", { class: "field" }, [
    key.charAt(0).toUpperCase() + key.slice(1),
    h("div", { class: "btn-row" }, [
      h("button", { class: "btn small secondary", type: "button", onclick: () => { s.hours[key] = Math.max(0, (s.hours[key] || 0) - 1); save(); rerender(); } }, "−1"),
      h("input", {
        type: "number", value: s.hours?.[key] || 0, min: "0", step: "0.5",
        style: "max-width: 80px",
        oninput: (e) => { s.hours[key] = Number(e.target.value) || 0; save(); },
        onblur: () => rerender(),
      }),
      h("button", { class: "btn small", type: "button", onclick: () => { s.hours[key] = (s.hours[key] || 0) + 1; save(); rerender(); } }, "+1"),
    ]),
  ]);
}

function addPayment(s, rerender) {
  const amt = Number(prompt(`Payment received from ${s.firstName}?`, "175"));
  if (!Number.isFinite(amt) || amt <= 0) return;
  s.tuitionPaid = (Number(s.tuitionPaid) || 0) + amt;
  save();
  toast(`+${money(amt)} recorded`);
  rerender();
}

function attendanceBtn(s, value, current, rerender) {
  return h("button", {
    class: "btn small " + (current === value ? "" : "secondary"),
    onclick: () => { s.attendance[todayISO()] = value; save(); rerender(); },
  }, value);
}

/* ---------- COURSE ---------- */

function renderCourse(rerender) {
  ensureSeed();
  const { modules } = state.academy.course;

  const header = h("section", { class: "card" }, [
    h("h2", {}, "Online course — Kajabi drop-in"),
    h("div", { class: "sub" }, "Write once here. Click 'Copy for Kajabi' to paste into a lesson."),
    h("div", { class: "btn-row" }, [
      h("button", { class: "btn", onclick: () => addModule(rerender) }, "+ Add module"),
      h("button", { class: "btn secondary", onclick: () => copyForKajabi() }, "Copy for Kajabi"),
      h("button", { class: "btn secondary", onclick: () => downloadMarkdown() }, "Download .md"),
      h("button", { class: "btn secondary", onclick: () => resetCourse(rerender) }, "Reset to Texas RDA"),
    ]),
  ]);

  const wrap = h("div", {}, [header]);

  if (!modules.length) {
    wrap.append(h("div", { class: "empty" }, "No modules yet."));
    return wrap;
  }

  modules.forEach((m, mi) => {
    const modCard = h("section", { class: "card" }, [
      h("div", { class: "item", style: "padding:0; border:0; background:transparent" }, [
        h("div", { style: "flex:1" }, [
          h("input", {
            type: "text", value: m.title, style: "font-weight:700; font-size:15px",
            oninput: (e) => { m.title = e.target.value; save(); },
          }),
        ]),
        h("div", { class: "actions" }, [
          h("button", { class: "btn small secondary", onclick: () => moveModule(mi, -1, rerender) }, "↑"),
          h("button", { class: "btn small secondary", onclick: () => moveModule(mi, 1, rerender) }, "↓"),
          h("button", { class: "btn small", onclick: () => addLesson(m, rerender) }, "+ Lesson"),
          h("button", {
            class: "btn small danger",
            onclick: () => {
              if (!confirmAction(`Remove "${m.title}" and its lessons?`)) return;
              state.academy.course.modules = modules.filter((x) => x.id !== m.id);
              save();
              rerender();
            },
          }, "×"),
        ]),
      ]),
    ]);

    m.lessons.forEach((l, li) => {
      modCard.append(
        h("div", { class: "item", style: "flex-direction:column; align-items:stretch; gap:8px; margin-top:8px" }, [
          h("div", { class: "form-row two" }, [
            h("label", { class: "field" }, [
              "Lesson title",
              h("input", {
                type: "text", value: l.title,
                oninput: (e) => { l.title = e.target.value; save(); },
              }),
            ]),
            h("label", { class: "field" }, [
              "Minutes",
              h("input", {
                type: "number", value: l.minutes || 0, min: "0", step: "1",
                oninput: (e) => { l.minutes = Number(e.target.value) || 0; save(); },
              }),
            ]),
          ]),
          h("label", { class: "field" }, [
            "Notes / script / objectives",
            h("textarea", {
              oninput: (e) => { l.notes = e.target.value; save(); },
            }, l.notes || ""),
          ]),
          h("div", { class: "btn-row" }, [
            h("button", { class: "btn small secondary", onclick: () => moveLesson(m, li, -1, rerender) }, "↑"),
            h("button", { class: "btn small secondary", onclick: () => moveLesson(m, li, 1, rerender) }, "↓"),
            h("button", {
              class: "btn small danger",
              onclick: () => {
                if (!confirmAction(`Remove lesson "${l.title}"?`)) return;
                m.lessons = m.lessons.filter((x) => x.id !== l.id);
                save();
                rerender();
              },
            }, "Delete lesson"),
          ]),
        ])
      );
    });

    wrap.append(modCard);
  });

  return wrap;
}

function addModule(rerender) {
  state.academy.course.modules.push({
    id: uid(), title: "New module", lessons: [],
  });
  save();
  rerender();
}
function addLesson(m, rerender) {
  m.lessons.push({ id: uid(), title: "New lesson", minutes: 0, notes: "" });
  save();
  rerender();
}
function moveModule(i, delta, rerender) {
  const list = state.academy.course.modules;
  const j = i + delta;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  save();
  rerender();
}
function moveLesson(m, i, delta, rerender) {
  const j = i + delta;
  if (j < 0 || j >= m.lessons.length) return;
  [m.lessons[i], m.lessons[j]] = [m.lessons[j], m.lessons[i]];
  save();
  rerender();
}
function resetCourse(rerender) {
  if (!confirmAction("Reset the course to the Texas RDA starter outline? Your edits will be lost.")) return;
  state.academy.course.seeded = false;
  state.academy.course.modules = [];
  ensureSeed();
  rerender();
}

function buildKajabiText() {
  const b = currentBrand();
  const header = b.business
    ? `${b.business.name} — Online Course Outline\n${b.business.tagline || ""}\n\n`
    : "Online Course Outline\n\n";
  const modText = state.academy.course.modules.map((m, mi) => {
    const lessonText = m.lessons.map((l, li) => {
      const min = l.minutes ? ` (${l.minutes} min)` : "";
      const notes = l.notes ? `\n   ${l.notes.split("\n").join("\n   ")}` : "";
      return `  ${li + 1}. ${l.title}${min}${notes}`;
    }).join("\n");
    return `${mi + 1}. ${m.title}\n${lessonText}`;
  }).join("\n\n");
  return header + modText;
}

function buildMarkdown() {
  const b = currentBrand();
  const header = b.business
    ? `# ${b.business.name} — Online Course\n\n_${b.business.tagline || ""}_\n\n`
    : "# Online Course\n\n";
  const modText = state.academy.course.modules.map((m) => {
    const lessonText = m.lessons.map((l) => {
      const min = l.minutes ? ` _(${l.minutes} min)_` : "";
      const notes = l.notes ? `\n  - ${l.notes.split("\n").join("\n  - ")}` : "";
      return `- **${l.title}**${min}${notes}`;
    }).join("\n");
    return `## ${m.title}\n\n${lessonText}`;
  }).join("\n\n");
  return header + modText;
}

async function copyForKajabi() {
  const text = buildKajabiText();
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied — paste into Kajabi");
  } catch {
    prompt("Copy this:", text);
  }
}
function downloadMarkdown() {
  const text = buildMarkdown();
  const blob = new Blob([text], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "course-outline.md"; a.click();
  URL.revokeObjectURL(url);
}

/* ---------- MAIN RENDER ---------- */

export function renderAcademy(mount, { rerender }) {
  document.removeEventListener("academy:rerender", rerender);
  document.addEventListener("academy:rerender", rerender);

  mount.append(renderSubNav());
  const view = state.academy.activeView || "students";
  if (view === "cohorts") mount.append(renderCohorts(rerender));
  else if (view === "course") mount.append(renderCourse(rerender));
  else mount.append(renderStudents(rerender));
}
