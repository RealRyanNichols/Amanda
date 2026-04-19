import { state, save, uid } from "../store.js";
import { h, toast, confirmAction, todayISO, friendlyDate } from "../util.js";

const MEALS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch",     label: "Lunch" },
  { key: "dinner",    label: "Dinner" },
  { key: "snack",     label: "Snack" },
];

const GROCERY_CATEGORIES = [
  "Produce",
  "Meat & Fish",
  "Dairy",
  "Pantry",
  "Frozen",
  "Bakery",
  "Household",
  "Baby",
  "Other",
];

function mondayOf(date) {
  const d = new Date(date + "T00:00:00");
  const day = d.getDay(); // 0..6 Sun=0
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function weekDates(startISO) {
  const start = new Date(startISO + "T00:00:00");
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function dayLabel(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short" }) + " " + d.getDate();
}

function planKey(dateISO, meal) { return `${dateISO}:${meal}`; }

/* ---------- Sub-nav ---------- */

function subNav(current, set) {
  const views = [
    { key: "plan", label: "Weekly plan" },
    { key: "grocery", label: "Grocery list" },
    { key: "recipes", label: "Recipes" },
  ];
  const row = h("div", { class: "chip-row", style: "margin-bottom:12px" });
  views.forEach((v) =>
    row.append(h("button", {
      class: "chip" + (current === v.key ? " active" : ""),
      onclick: () => set(v.key),
    }, v.label))
  );
  return row;
}

/* ---------- Weekly plan ---------- */

function renderPlan(rerender) {
  const today = todayISO();
  const weekStart = mondayOf(today);
  const dates = weekDates(weekStart);
  const plan = state.meals.plan;

  const wrap = h("div");
  wrap.append(h("section", { class: "card" }, [
    h("h2", {}, "This week's meals"),
    h("div", { class: "sub" }, `Week of ${friendlyDate(weekStart)}. Tap a slot to fill it in.`),
  ]));

  dates.forEach((iso) => {
    const card = h("section", { class: "card" }, [
      h("h2", { style: "font-size:14px" }, dayLabel(iso) + (iso === today ? " · today" : "")),
    ]);
    const grid = h("div", { class: "form-row two" });
    MEALS.forEach((m) => {
      const k = planKey(iso, m.key);
      const val = plan[k] || "";
      grid.append(h("label", { class: "field" }, [
        m.label,
        h("input", {
          type: "text",
          value: val,
          placeholder: "—",
          oninput: (e) => {
            const v = e.target.value.trim();
            if (v) plan[k] = v; else delete plan[k];
            save();
          },
        }),
      ]));
    });
    card.append(grid);
    wrap.append(card);
  });

  wrap.append(h("section", { class: "card" }, [
    h("div", { class: "btn-row" }, [
      h("button", {
        class: "btn secondary",
        onclick: () => {
          if (!confirmAction("Clear this whole week's plan?")) return;
          for (const iso of dates) for (const m of MEALS) delete plan[planKey(iso, m.key)];
          save(); rerender();
        },
      }, "Clear week"),
      h("button", {
        class: "btn",
        onclick: () => {
          // Pull any recipes referenced in the plan to the grocery list automatically
          const used = new Set();
          dates.forEach((iso) => MEALS.forEach((m) => {
            const v = plan[planKey(iso, m.key)];
            if (v) used.add(v.trim().toLowerCase());
          }));
          let added = 0;
          state.meals.recipes.forEach((r) => {
            if (used.has(r.name.trim().toLowerCase())) {
              (r.ingredients || []).forEach((ing) => {
                if (!state.meals.grocery.find((g) => g.item.toLowerCase() === ing.toLowerCase())) {
                  state.meals.grocery.push({ id: uid(), item: ing, category: "Other", done: false, fromRecipe: r.name });
                  added++;
                }
              });
            }
          });
          save();
          toast(added ? `Added ${added} items to grocery` : "No matching recipes saved yet");
          rerender();
        },
      }, "Build grocery list from plan"),
    ]),
  ]));

  return wrap;
}

/* ---------- Grocery list ---------- */

function renderGrocery(rerender) {
  const grocery = state.meals.grocery;
  const wrap = h("div");
  wrap.append(h("section", { class: "card" }, [
    h("h2", {}, "Grocery list"),
    h("div", { class: "sub" }, "Add items, tap to check off as you shop. Clear done anytime."),
  ]));

  const form = h("form", { class: "form-row two", onsubmit: (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const item = (f.get("item") || "").toString().trim();
    if (!item) return;
    grocery.push({
      id: uid(),
      item,
      category: (f.get("category") || "Other").toString(),
      done: false,
    });
    save(); e.target.reset(); rerender();
  } }, [
    h("label", { class: "field" }, ["Item", h("input", { type: "text", name: "item", required: true })]),
    h("label", { class: "field" }, ["Category", h("select", { name: "category" },
      GROCERY_CATEGORIES.map((c) => h("option", { value: c }, c))
    )]),
    h("div", { class: "btn-row", style: "grid-column: 1 / -1" }, [h("button", { class: "btn", type: "submit" }, "+ Add")]),
  ]);
  wrap.append(h("section", { class: "card" }, [form]));

  // Group by category, with done items separately at the bottom
  const groups = {};
  const doneItems = [];
  grocery.forEach((g) => {
    if (g.done) doneItems.push(g);
    else (groups[g.category || "Other"] ||= []).push(g);
  });

  const orderedCategories = [...GROCERY_CATEGORIES, ...Object.keys(groups).filter((c) => !GROCERY_CATEGORIES.includes(c))];

  orderedCategories.forEach((cat) => {
    const items = groups[cat];
    if (!items?.length) return;
    const card = h("section", { class: "card" }, [
      h("h2", { style: "font-size:14px" }, cat),
    ]);
    const list = h("div", { class: "list" });
    items.forEach((g) => {
      list.append(h("div", { class: "item grocery-row" }, [
        h("label", { class: "grocery-label" }, [
          h("input", {
            type: "checkbox",
            onchange: () => { g.done = true; save(); rerender(); },
          }),
          h("span", { class: "title" }, g.item),
        ]),
        h("div", { class: "actions" }, [
          g.fromRecipe && h("span", { class: "pill" }, "plan"),
          h("button", {
            class: "btn small danger",
            onclick: () => {
              state.meals.grocery = grocery.filter((x) => x.id !== g.id);
              save(); rerender();
            },
          }, "×"),
        ]),
      ]));
    });
    card.append(list);
    wrap.append(card);
  });

  if (doneItems.length) {
    const card = h("section", { class: "card" }, [
      h("h2", { style: "font-size:14px; color:var(--text-dim)" }, `Done · ${doneItems.length}`),
      h("div", { class: "btn-row" }, [
        h("button", {
          class: "btn small secondary",
          onclick: () => {
            state.meals.grocery = grocery.filter((g) => !g.done);
            save(); toast("Cleared done"); rerender();
          },
        }, "Clear done"),
      ]),
    ]);
    const list = h("div", { class: "list", style: "margin-top:10px" });
    doneItems.forEach((g) => {
      list.append(h("div", { class: "item grocery-row" }, [
        h("label", { class: "grocery-label" }, [
          h("input", { type: "checkbox", checked: true, onchange: () => { g.done = false; save(); rerender(); } }),
          h("span", { class: "title", style: "text-decoration:line-through; opacity:.55" }, g.item),
        ]),
      ]));
    });
    card.append(list);
    wrap.append(card);
  }

  if (!grocery.length) {
    wrap.append(h("div", { class: "empty" }, "Your grocery list is empty."));
  }

  return wrap;
}

/* ---------- Recipes ---------- */

function renderRecipes(rerender) {
  const recipes = state.meals.recipes;
  const wrap = h("div");
  wrap.append(h("section", { class: "card" }, [
    h("h2", {}, "Saved recipes"),
    h("div", { class: "sub" }, "Save family favorites. Reference them by name in the weekly plan."),
  ]));

  const form = h("form", { class: "form-row", onsubmit: (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const name = (f.get("name") || "").toString().trim();
    const ingredientsRaw = (f.get("ingredients") || "").toString().trim();
    const steps = (f.get("steps") || "").toString().trim();
    if (!name) return;
    recipes.push({
      id: uid(),
      name,
      ingredients: ingredientsRaw.split("\n").map((s) => s.trim()).filter(Boolean),
      steps,
    });
    save(); toast("Recipe saved"); e.target.reset(); rerender();
  } }, [
    h("label", { class: "field" }, ["Recipe name", h("input", { type: "text", name: "name", required: true, placeholder: "e.g. Sheet-pan chicken" })]),
    h("label", { class: "field" }, [
      "Ingredients (one per line)",
      h("textarea", { name: "ingredients", placeholder: "2 lbs chicken thighs\n1 lb potatoes\n..." }),
    ]),
    h("label", { class: "field" }, [
      "Steps (optional)",
      h("textarea", { name: "steps", placeholder: "What you do." }),
    ]),
    h("div", { class: "btn-row" }, [h("button", { class: "btn", type: "submit" }, "+ Save")]),
  ]);
  wrap.append(h("section", { class: "card" }, [form]));

  if (!recipes.length) {
    wrap.append(h("div", { class: "empty" }, "No recipes yet. Add your first."));
    return wrap;
  }

  const list = h("div", { class: "list" });
  recipes.forEach((r) => {
    const row = h("section", { class: "card" }, [
      h("div", { class: "item", style: "padding:0; border:0; background:transparent" }, [
        h("div", {}, [
          h("div", { class: "title" }, r.name),
          h("div", { class: "meta" }, `${(r.ingredients || []).length} ingredients`),
        ]),
        h("div", { class: "actions" }, [
          h("button", {
            class: "btn small",
            onclick: () => {
              let added = 0;
              (r.ingredients || []).forEach((ing) => {
                if (!state.meals.grocery.find((g) => g.item.toLowerCase() === ing.toLowerCase())) {
                  state.meals.grocery.push({ id: uid(), item: ing, category: "Other", done: false, fromRecipe: r.name });
                  added++;
                }
              });
              save();
              toast(added ? `Added ${added} items` : "Already on your list");
            },
          }, "+ To grocery"),
          h("button", {
            class: "btn small danger",
            onclick: () => {
              if (!confirmAction(`Remove "${r.name}"?`)) return;
              state.meals.recipes = recipes.filter((x) => x.id !== r.id);
              save(); rerender();
            },
          }, "×"),
        ]),
      ]),
    ]);
    if ((r.ingredients || []).length) {
      row.append(h("ul", { class: "recipe-list" }, r.ingredients.map((i) => h("li", {}, i))));
    }
    if (r.steps) row.append(h("div", { class: "recipe-steps" }, r.steps));
    list.append(row);
  });
  wrap.append(list);
  return wrap;
}

/* ---------- Main render ---------- */

let activeView = "plan";

export function renderMeals(mount, { rerender }) {
  const set = (v) => { activeView = v; rerender(); };
  mount.append(subNav(activeView, set));
  if (activeView === "plan") mount.append(renderPlan(rerender));
  else if (activeView === "grocery") mount.append(renderGrocery(rerender));
  else mount.append(renderRecipes(rerender));
}
