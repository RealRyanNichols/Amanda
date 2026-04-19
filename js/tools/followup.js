import { state, save, uid } from "../store.js";
import { h, toast, confirmAction, todayISO, friendlyDate, daysFromNow } from "../util.js";
import { currentBrand } from "../branding.js";
import { offerNext } from "../next-offer.js";
import { creditTimeSaved } from "../time-saved.js";

const TEMPERATURES = [
  { value: "hot",  label: "Hot",  next: 1 },
  { value: "warm", label: "Warm", next: 3 },
  { value: "cold", label: "Cold", next: 14 },
];

function scriptFor(lead) {
  const b = currentBrand();
  const business = b.business?.name || "our program";
  const first = (lead.name || "").split(/\s+/)[0] || "there";
  const day = daysFromNow(lead.lastContact) ?? 0;

  if (lead.temperature === "hot") {
    return `Hi ${first}! It's ${b.business?.owner || "me"} from ${business}. You sounded excited about getting started — are you free tomorrow at 10 or 2 to lock in your seat? I'll hold one for you until the end of the day.`;
  }
  if (lead.temperature === "warm") {
    return `Hey ${first}, checking in. Last time we talked about ${lead.interest || "the program"} — do you still want me to send the cost breakdown and next start date? Takes 2 minutes.`;
  }
  return `Hi ${first}, it's been about ${Math.max(day, 7)} days — I wanted to make sure you got the info on ${lead.interest || business}. If it's bad timing, no worries. If you want, I can resend the details — just say the word.`;
}

function renderStats() {
  const { leads } = state.followup;
  const hot = leads.filter((l) => l.temperature === "hot" && !l.closed).length;
  const warm = leads.filter((l) => l.temperature === "warm" && !l.closed).length;
  const cold = leads.filter((l) => l.temperature === "cold" && !l.closed).length;
  const dueNow = leads.filter((l) => !l.closed && l.nextContact && daysFromNow(l.nextContact) <= 0).length;

  return h("section", { class: "card" }, [
    h("h2", {}, "Your pipeline"),
    h("div", { class: "sub" }, "Hot, warm, cold. We'll nudge you before you lose the lead."),
    h("div", { class: "stat-grid" }, [
      h("div", { class: "stat bad" }, [
        h("div", { class: "label" }, "Hot"),
        h("div", { class: "value" }, hot),
      ]),
      h("div", { class: "stat warn" }, [
        h("div", { class: "label" }, "Warm"),
        h("div", { class: "value" }, warm),
      ]),
      h("div", { class: "stat" }, [
        h("div", { class: "label" }, "Cold"),
        h("div", { class: "value" }, cold),
      ]),
    ]),
    dueNow > 0 && h("div", { class: "alert warn", style: "margin-top:10px" },
      `${dueNow} lead${dueNow > 1 ? "s" : ""} need a follow-up today. Don't lose them.`),
  ]);
}

function renderForm(rerender) {
  const card = h("section", { class: "card" }, [
    h("h2", {}, "New lead"),
    h("div", { class: "sub" }, "Log them fast. You can fill in details later."),
  ]);

  const form = h("form", { class: "form-row two", onsubmit: onAdd }, [
    h("label", { class: "field" }, [
      "Name",
      h("input", { type: "text", name: "name", required: true }),
    ]),
    h("label", { class: "field" }, [
      "Phone",
      h("input", { type: "tel", name: "phone", placeholder: "555-555-5555" }),
    ]),
    h("label", { class: "field" }, [
      "Email",
      h("input", { type: "email", name: "email" }),
    ]),
    h("label", { class: "field" }, [
      "Interest",
      h("input", { type: "text", name: "interest", placeholder: "e.g. dental program, July start" }),
    ]),
    h("label", { class: "field" }, [
      "Temperature",
      h("select", { name: "temperature" }, TEMPERATURES.map((t) =>
        h("option", { value: t.value }, t.label)
      )),
    ]),
    h("label", { class: "field" }, [
      "Source",
      h("input", { type: "text", name: "source", placeholder: "IG, referral, walk-in..." }),
    ]),
    h("div", { class: "btn-row", style: "grid-column: 1 / -1" }, [
      h("button", { class: "btn", type: "submit" }, "Add lead"),
    ]),
  ]);

  card.append(form);

  function onAdd(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const temp = f.get("temperature") || "warm";
    const next = TEMPERATURES.find((t) => t.value === temp)?.next ?? 3;
    const nextContact = new Date();
    nextContact.setDate(nextContact.getDate() + next);
    state.followup.leads.push({
      id: uid(),
      name: (f.get("name") || "").toString().trim(),
      phone: (f.get("phone") || "").toString().trim(),
      email: (f.get("email") || "").toString().trim(),
      interest: (f.get("interest") || "").toString().trim(),
      source: (f.get("source") || "").toString().trim(),
      temperature: temp,
      lastContact: todayISO(),
      nextContact: nextContact.toISOString().slice(0, 10),
      notes: "",
      closed: false,
      outcome: "",
    });
    save();
    toast("Lead added");
    e.target.reset();
    rerender();

    // Credit for using structured CRM vs notebook
    creditTimeSaved(3, "Lead logged");

    // Depth: offer next actions after adding a lead
    const newLead = state.followup.leads[state.followup.leads.length - 1];
    offerNextForLead(newLead, rerender);
  }

  return card;
}

function offerNextForLead(lead, rerender) {
  const first = (lead.name || "").split(/\s+/)[0] || "them";
  const options = [
    lead.phone && {
      emoji: "📲",
      label: `Text ${first} now (with script)`,
      onPick: () => showScript(lead),
    },
    {
      emoji: "📅",
      label: "Add follow-up to my Calendar",
      onPick: () => {
        const days = lead.temperature === "hot" ? 1 : lead.temperature === "warm" ? 3 : 14;
        const d = new Date();
        d.setDate(d.getDate() + days);
        lead.nextContact = d.toISOString().slice(0, 10);
        save();
        toast(`Follow-up set for ${days} day${days > 1 ? "s" : ""}`);
        rerender();
      },
    },
    lead.temperature === "hot" && {
      emoji: "🔥",
      label: "Mark as top priority today",
      onPick: () => {
        const today = new Date().toISOString().slice(0, 10);
        lead.nextContact = today;
        save();
        toast("Top priority today");
        rerender();
      },
    },
    {
      emoji: "🧠",
      label: "Ask the Brain: what's my pitch?",
      onPick: () => {
        state.brain = state.brain || {};
        state.brain.history = state.brain.history || [];
        state.brain.history.push({
          id: uid(), role: "user", at: Date.now(),
          text: `I just got a new ${lead.temperature} lead: ${lead.name}. Their interest is "${lead.interest || "unknown"}". What's my best pitch?`,
        });
        save();
        const brainTab = document.querySelector('.tab[data-tab="brain"]');
        if (brainTab) brainTab.click();
      },
    },
  ].filter(Boolean);

  offerNext({
    title: `${lead.name} saved. What now?`,
    subtitle: `${lead.temperature}${lead.interest ? " · " + lead.interest : ""}`,
    options,
  });
}

function renderLeads(rerender) {
  const { leads } = state.followup;
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Leads"),
    h("div", { class: "sub" }, "Tap 'Script' for a ready-to-send message."),
  ]);

  if (!leads.length) {
    card.append(h("div", { class: "empty" }, "Add your first lead above."));
    return card;
  }

  const sorted = [...leads].sort((a, b) => {
    if (a.closed !== b.closed) return a.closed ? 1 : -1;
    const da = daysFromNow(a.nextContact) ?? 9999;
    const db = daysFromNow(b.nextContact) ?? 9999;
    return da - db;
  });

  const list = h("div", { class: "list" });
  sorted.forEach((lead) => {
    const due = daysFromNow(lead.nextContact);
    const overdue = !lead.closed && due !== null && due <= 0;
    const pillClass = lead.closed ? "paid" : lead.temperature;

    list.append(
      h("div", { class: "item" }, [
        h("div", { style: "min-width:0; flex:1" }, [
          h("div", { class: "title" }, [
            lead.name, " ",
            h("span", { class: `pill ${pillClass}` }, lead.closed ? (lead.outcome || "closed") : lead.temperature),
          ]),
          h("div", { class: "meta" },
            [lead.interest, lead.source && `via ${lead.source}`].filter(Boolean).join(" · ") || "—"),
          h("div", { class: "meta" },
            lead.closed
              ? `Closed`
              : `Next contact ${friendlyDate(lead.nextContact)}${overdue ? " · overdue" : ""}`),
        ]),
        h("div", { class: "actions" }, [
          !lead.closed && h("button", { class: "btn small", onclick: () => showScript(lead) }, "Script"),
          lead.phone && h("a", { class: "btn small secondary", href: `sms:${lead.phone}?&body=${encodeURIComponent(scriptFor(lead))}` }, "Text"),
          lead.phone && h("a", { class: "btn small secondary", href: `tel:${lead.phone}` }, "Call"),
          !lead.closed && h("button", { class: "btn small secondary", onclick: () => snooze(lead, rerender) }, "Snooze"),
          !lead.closed && h("button", { class: "btn small", onclick: () => win(lead, rerender) }, "Won"),
          h("button", { class: "btn small danger", onclick: () => remove(lead, rerender) }, "×"),
        ]),
      ])
    );
  });

  card.append(list);
  return card;
}

function showScript(lead) {
  const text = scriptFor(lead);
  const existing = document.querySelector(".script-popup");
  if (existing) existing.remove();
  const pop = h("div", { class: "card script-popup" }, [
    h("h2", {}, `Script — ${lead.name}`),
    h("div", { class: "script-box" }, text),
    h("div", { class: "btn-row", style: "margin-top:10px" }, [
      h("button", {
        class: "btn",
        onclick: () => {
          navigator.clipboard?.writeText(text);
          toast("Copied");
        },
      }, "Copy"),
      h("button", { class: "btn secondary", onclick: () => pop.remove() }, "Close"),
    ]),
  ]);
  document.getElementById("app").prepend(pop);
  pop.scrollIntoView({ behavior: "smooth", block: "start" });
}

function snooze(lead, rerender) {
  const days = Number(prompt(`Snooze ${lead.name} for how many days?`, "3"));
  if (!Number.isFinite(days) || days <= 0) return;
  const d = new Date();
  d.setDate(d.getDate() + days);
  lead.nextContact = d.toISOString().slice(0, 10);
  lead.lastContact = todayISO();
  save();
  toast(`Snoozed ${days}d`);
  rerender();
}

function win(lead, rerender) {
  if (!confirmAction(`Mark ${lead.name} as enrolled/won?`)) return;
  lead.closed = true;
  lead.outcome = "won";
  save();
  toast("Nice 🎉");
  rerender();
}

function remove(lead, rerender) {
  if (!confirmAction(`Remove ${lead.name}?`)) return;
  state.followup.leads = state.followup.leads.filter((l) => l.id !== lead.id);
  save();
  rerender();
}

function renderAnalytics() {
  const leads = state.followup?.leads || [];
  if (leads.length < 3) return null;

  const closed = leads.filter((l) => l.closed);
  const won = closed.filter((l) => (l.outcome || "") === "won");
  const lost = closed.length - won.length;
  const conv = closed.length > 0 ? Math.round((won.length / closed.length) * 100) : 0;

  // Revenue per source
  const bySource = {};
  for (const l of leads) {
    const src = (l.source || "").trim() || "Unknown";
    bySource[src] = bySource[src] || { total: 0, won: 0, lost: 0, open: 0 };
    bySource[src].total++;
    if (!l.closed) bySource[src].open++;
    else if ((l.outcome || "") === "won") bySource[src].won++;
    else bySource[src].lost++;
  }
  const sources = Object.entries(bySource).sort((a, b) => b[1].won - a[1].won);

  const card = h("section", { class: "card" }, [
    h("h2", {}, "Pipeline analytics"),
    h("div", { class: "sub" }, "Real numbers from your leads. No guessing."),
    h("div", { class: "stat-grid" }, [
      h("div", { class: "stat ok" }, [
        h("div", { class: "label" }, "Won"),
        h("div", { class: "value" }, won.length),
      ]),
      h("div", { class: "stat" }, [
        h("div", { class: "label" }, "Conversion"),
        h("div", { class: "value" }, conv + "%"),
      ]),
      h("div", { class: "stat warn" }, [
        h("div", { class: "label" }, "Open"),
        h("div", { class: "value" }, leads.length - closed.length),
      ]),
    ]),
  ]);

  if (sources.length) {
    card.append(h("h3", { style: "margin:14px 0 6px; font-size:13px; color:var(--text-dim); text-transform:uppercase; letter-spacing:.8px" }, "By source"));
    const list = h("div", { class: "list" });
    sources.slice(0, 6).forEach(([src, stats]) => {
      const rate = stats.won + stats.lost > 0 ? Math.round((stats.won / (stats.won + stats.lost)) * 100) : 0;
      list.append(h("div", { class: "item" }, [
        h("div", {}, [
          h("div", { class: "title" }, src),
          h("div", { class: "meta" },
            `${stats.total} leads · ${stats.won} won · ${stats.lost} lost${stats.open ? " · " + stats.open + " open" : ""}${stats.won + stats.lost > 0 ? " · " + rate + "% convert" : ""}`),
        ]),
      ]));
    });
    card.append(list);
  }

  return card;
}

export function renderFollowup(mount, { rerender }) {
  mount.append(renderStats());
  const analytics = renderAnalytics();
  if (analytics) mount.append(analytics);
  mount.append(renderForm(rerender));
  mount.append(renderLeads(rerender));
}
