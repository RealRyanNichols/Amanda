import { state } from "../store.js";
import { h, friendlyDate, money } from "../util.js";
import { micButton } from "../voice.js";

// Collects searchable items from every feature tab into a flat index.
function buildIndex() {
  const idx = [];

  (state.followup?.leads || []).forEach((l) => {
    idx.push({
      type: "Lead",
      icon: "📲",
      title: l.name,
      subtitle: [l.temperature, l.interest, l.phone, l.email].filter(Boolean).join(" · "),
      text: [l.name, l.interest, l.notes, l.source, l.phone, l.email].join(" "),
      go: "followup",
    });
  });

  (state.booking?.appointments || []).forEach((a) => {
    idx.push({
      type: "Booking",
      icon: "📅",
      title: `${a.client}${a.service ? " — " + a.service : ""}`,
      subtitle: `${friendlyDate(a.date)} · ${money(a.price)}`,
      text: [a.client, a.service, a.phone, a.date, a.note].join(" "),
      go: "booking",
    });
  });

  (state.academy?.students || []).forEach((s) => {
    idx.push({
      type: "Student",
      icon: "🎓",
      title: `${s.firstName} ${s.lastName}`,
      subtitle: [s.phone, s.email].filter(Boolean).join(" · "),
      text: [s.firstName, s.lastName, s.phone, s.email, s.notes].join(" "),
      go: "academy",
    });
  });

  (state.academy?.programs || []).forEach((p) => {
    idx.push({
      type: "Cohort",
      icon: "🎓",
      title: p.name,
      subtitle: `${friendlyDate(p.startDate)}${p.endDate ? " – " + friendlyDate(p.endDate) : ""}`,
      text: p.name,
      go: "academy",
    });
  });

  (state.academy?.course?.modules || []).forEach((m) => {
    idx.push({
      type: "Course module",
      icon: "📘",
      title: m.title,
      subtitle: `${(m.lessons || []).length} lessons`,
      text: m.title + " " + (m.lessons || []).map((l) => l.title).join(" "),
      go: "academy",
    });
    (m.lessons || []).forEach((l) => {
      idx.push({
        type: "Lesson",
        icon: "📘",
        title: l.title,
        subtitle: m.title,
        text: l.title + " " + (l.notes || ""),
        go: "academy",
      });
    });
  });

  (state.income?.deposits || []).forEach((d) => {
    idx.push({
      type: "Deposit",
      icon: "💵",
      title: `${d.source || "Deposit"} ${money(d.amount)}`,
      subtitle: friendlyDate(d.date),
      text: (d.source || "") + " " + d.date,
      go: "income",
    });
  });

  (state.income?.bills || []).forEach((b) => {
    idx.push({
      type: "Bill",
      icon: "💵",
      title: `${b.name} ${money(b.amount)}`,
      subtitle: `Due ${friendlyDate(b.due)}${b.paid ? " · paid" : ""}`,
      text: b.name + " " + b.due,
      go: "income",
    });
  });

  (state.overload?.tasks || []).forEach((t) => {
    idx.push({
      type: "Task",
      icon: "🗂",
      title: t.text,
      subtitle: t.category,
      text: t.text,
      go: "overload",
    });
  });

  (state.life?.pregnancy?.letters || []).forEach((l) => {
    const when = l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "";
    idx.push({
      type: "Letter",
      icon: "💌",
      title: (l.body || "").slice(0, 80),
      subtitle: `${when}${l.author ? " · " + l.author : ""}`,
      text: l.body + " " + (l.author || ""),
      go: "life",
    });
  });

  (state.life?.family?.kids || []).forEach((k) => {
    idx.push({
      type: "Kid",
      icon: "👧",
      title: k.name,
      subtitle: [k.grade, k.school].filter(Boolean).join(" · "),
      text: [k.name, k.school, k.fav, k.grade].join(" "),
      go: "life",
    });
  });

  (state.life?.family?.supporters || []).forEach((s) => {
    idx.push({
      type: "Supporter",
      icon: "💖",
      title: s.name,
      subtitle: [s.relation, s.phone].filter(Boolean).join(" · "),
      text: [s.name, s.relation, s.phone].join(" "),
      go: "life",
    });
  });

  (state.life?.faith?.prayers || []).forEach((p) => {
    idx.push({
      type: "Prayer",
      icon: "🙏",
      title: (p.text || "").slice(0, 80),
      subtitle: p.answered ? "Answered" : "Active",
      text: p.text + " " + (p.answerNote || ""),
      go: "life",
    });
  });

  (state.meals?.recipes || []).forEach((r) => {
    idx.push({
      type: "Recipe",
      icon: "🍽️",
      title: r.name,
      subtitle: `${(r.ingredients || []).length} ingredients`,
      text: r.name + " " + (r.ingredients || []).join(" "),
      go: "meals",
    });
  });

  (state.meals?.grocery || []).forEach((g) => {
    idx.push({
      type: "Grocery",
      icon: "🛒",
      title: g.item,
      subtitle: g.category,
      text: g.item,
      go: "meals",
    });
  });

  (state.social?.posts || []).forEach((p) => {
    idx.push({
      type: "Post",
      icon: "📣",
      title: (p.body || "").slice(0, 80),
      subtitle: p.status,
      text: p.body,
      go: "social",
    });
  });

  (state.social?.hashtagSets || []).forEach((s) => {
    idx.push({
      type: "Hashtag set",
      icon: "#",
      title: s.name,
      subtitle: s.tags,
      text: s.name + " " + s.tags,
      go: "social",
    });
  });

  return idx;
}

function jumpTo(tab) {
  const btn = document.querySelector(`.tab[data-tab="${tab}"]`);
  if (btn) btn.click();
}

function scoreMatch(q, text) {
  if (!q) return 0;
  const t = text.toLowerCase();
  const needle = q.toLowerCase();
  if (t === needle) return 1000;
  if (t.startsWith(needle)) return 500;
  if (t.includes(needle)) return 100;
  // word starts
  const words = t.split(/\s+/);
  for (const w of words) if (w.startsWith(needle)) return 50;
  return 0;
}

export function renderSearch(mount) {
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Search everything"),
    h("div", { class: "sub" }, "Leads, students, letters, recipes, posts — all at once."),
  ]);

  const input = h("input", {
    type: "search",
    placeholder: "Try a name, a word, anything…",
    autofocus: true,
    autocomplete: "off",
  });
  const mic = micButton(input);

  const row = h("div", { class: "form-row" }, [
    h("label", { class: "field" }, [input]),
    h("div", { class: "btn-row" }, [mic]),
  ]);
  card.append(row);

  const results = h("div", { class: "list", style: "margin-top:12px" });
  card.append(results);

  const idx = buildIndex();

  const summary = h("div", { class: "meta", style: "margin-bottom:10px" },
    `Searching across ${idx.length} items.`);
  card.append(summary);

  function run(q) {
    results.innerHTML = "";
    if (!q.trim()) {
      results.append(h("div", { class: "empty" }, "Start typing — or tap the mic and say it."));
      return;
    }
    const scored = idx.map((i) => ({ ...i, score: scoreMatch(q, i.text) }))
      .filter((i) => i.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40);

    if (!scored.length) {
      results.append(h("div", { class: "empty" }, `No matches for "${q}".`));
      return;
    }

    scored.forEach((r) => {
      results.append(h("div", { class: "item search-item", onclick: () => jumpTo(r.go) }, [
        h("div", { class: "cal-icon" }, r.icon),
        h("div", { style: "flex:1; min-width:0" }, [
          h("div", { class: "title" }, [
            r.title, " ",
            h("span", { class: "pill" }, r.type),
          ]),
          r.subtitle && h("div", { class: "meta" }, r.subtitle),
        ]),
      ]));
    });
  }

  input.addEventListener("input", () => run(input.value));
  run("");

  mount.append(card);
}
