// Heart view — compassionate relationship companion.
//
// Non-negotiables (from Ryan's brief):
//   - Never shame single motherhood.
//   - Never assume a partner is the goal.
//   - Never tell her to stay or leave.
//   - Biblical wisdom available, not imposed.
//   - Prompt him without pushing him away.
//   - Safety first — ALWAYS — when any safety flag trips.

import { state, save, uid } from "../store.js";
import { h, toast, confirmAction } from "../util.js";
import { micButton } from "../voice.js";
import { shareSheet } from "../share.js";
import {
  HEART_STATUSES, MAN_TRAITS, TRACKS, QUESTIONS_FOR_HIM, checkSafetyFlags,
} from "../relationship-framework.js";

function heartState() {
  if (!state.life.heart) {
    state.life.heart = {
      status: "", reflections: [], traitAssessment: {}, askedHim: [], lastStatusChangeAt: 0,
    };
  }
  const s = state.life.heart;
  if (!s.reflections) s.reflections = [];
  if (!s.traitAssessment) s.traitAssessment = {};
  if (!s.askedHim) s.askedHim = [];
  return s;
}

/* ---------- Intake ---------- */

function renderIntake(rerender) {
  return h("section", { class: "card" }, [
    h("h2", {}, "Where's your heart right now?"),
    h("div", { class: "sub" },
      "There's no wrong answer. You can change this any time. Nothing you pick is permanent, public, or shared."),
    h("div", { class: "list", style: "margin-top:10px" }, HEART_STATUSES.map((opt) =>
      h("button", {
        class: "item heart-option",
        onclick: () => {
          const s = heartState();
          s.status = opt.key;
          s.lastStatusChangeAt = Date.now();
          save();
          toast("Saved");
          rerender();
        },
      }, [
        h("div", { class: "title" }, opt.label),
        h("div", { class: "meta" }, opt.intake),
      ])
    )),
  ]);
}

/* ---------- Track card — status-specific content ---------- */

function renderTrackCard() {
  const s = heartState();
  const track = TRACKS[s.status];
  if (!track) return null;

  const wrap = h("section", { class: "card heart-track" }, [
    h("div", { class: "btn-row", style: "justify-content:space-between; align-items:center" }, [
      h("h2", { style: "margin:0" }, track.heading),
      h("button", {
        class: "btn small ghost",
        onclick: () => {
          if (!confirmAction("Change your status?")) return;
          const ss = heartState();
          ss.status = "";
          save();
          document.dispatchEvent(new CustomEvent("life:rerender"));
        },
      }, "Change"),
    ]),
  ]);

  if (track.encouragement?.length) {
    const enc = h("div", { style: "margin-top:10px" });
    track.encouragement.forEach((line) => enc.append(
      h("p", { style: "font-family:Georgia,serif; line-height:1.6; margin:8px 0" }, line)
    ));
    wrap.append(enc);
  }

  if (track.scripture?.length) {
    wrap.append(h("h3", { style: "margin:14px 0 6px; font-size:14px" }, "Scripture for here"));
    track.scripture.forEach((v) => {
      wrap.append(h("div", { class: "card", style: "background:var(--bg-elev-2); margin:6px 0" }, [
        h("div", { class: "verse-ref" }, v.ref),
        h("div", { class: "verse-text" }, `"${v.text}"`),
      ]));
    });
  }

  if (track.prompts?.length) {
    wrap.append(h("h3", { style: "margin:14px 0 6px; font-size:14px" }, "Questions to sit with"));
    track.prompts.forEach((p) =>
      wrap.append(h("div", { class: "item" }, [
        h("div", {}, p),
      ]))
    );
  }

  if (track.safety_resources) {
    wrap.append(h("div", { class: "alert warn", style: "margin-top:12px" }, [
      h("strong", {}, "If you're hurting or afraid, please reach out."),
      h("div", { style: "margin-top:6px" }, [
        h("a", { href: "tel:1-800-799-7233" }, "1-800-799-7233"),
        " — National Domestic Violence Hotline, 24/7, free, confidential. ",
        "Text ",
        h("a", { href: "sms:88788&body=START" }, "START to 88788"),
        " if calling isn't safe.",
      ]),
    ]));
  }

  return wrap;
}

/* ---------- Private journal ---------- */

function renderReflectionJournal(rerender) {
  const s = heartState();
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Your journal"),
    h("div", { class: "sub" },
      "Writing for yourself. Stays on your device. We'll flag safety concerns gently if they show up — never to anyone else, just to you."),
  ]);

  const ta = h("textarea", {
    placeholder: "Write what you're thinking. Or tap the mic.",
    rows: 4,
  });
  card.append(h("label", { class: "field" }, [ta]));
  card.append(h("div", { class: "btn-row" }, [micButton(ta)]));

  card.append(h("div", { class: "btn-row", style: "margin-top:8px" }, [
    h("button", {
      class: "btn",
      onclick: () => {
        const text = ta.value.trim();
        if (!text) return;
        const flags = checkSafetyFlags(text);
        s.reflections.unshift({
          id: uid(),
          createdAt: Date.now(),
          text,
          tags: flags.length ? ["safety"] : [],
        });
        save();
        ta.value = "";
        if (flags.length) {
          toast("Saved. Please see the safety note below.");
        } else {
          toast("Saved");
        }
        rerender();
      },
    }, "Save"),
  ]));

  // Safety-flag banner — shows if any recent reflection tripped a flag.
  const recentFlagged = s.reflections.filter((r) => (r.tags || []).includes("safety")).slice(0, 3);
  if (recentFlagged.length) {
    card.append(h("div", { class: "alert warn", style: "margin-top:14px" }, [
      h("strong", {}, "We're here — and so are people who can help."),
      h("div", { style: "margin-top:6px" },
        "Something you wrote suggests you may be going through real fear or harm. You are not crazy. You are not alone. You don't have to decide anything today. "),
      h("div", { style: "margin-top:6px" }, [
        h("a", { href: "tel:1-800-799-7233" }, "Call 1-800-799-7233"),
        " · ",
        h("a", { href: "sms:88788&body=START" }, "Text START to 88788"),
        " (National Domestic Violence Hotline, 24/7, confidential).",
      ]),
    ]));
  }

  // List recent reflections
  if (s.reflections.length) {
    const list = h("div", { class: "list", style: "margin-top:10px" });
    s.reflections.slice(0, 5).forEach((r) => {
      const when = new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      list.append(h("div", { class: "item" }, [
        h("div", {}, [
          h("div", { class: "meta" }, when),
          h("div", {}, r.text),
        ]),
        h("div", { class: "actions" }, [
          h("button", {
            class: "btn small danger",
            onclick: () => {
              if (!confirmAction("Delete this?")) return;
              s.reflections = s.reflections.filter((x) => x.id !== r.id);
              save(); rerender();
            },
          }, "×"),
        ]),
      ]));
    });
    card.append(list);
  }

  return card;
}

/* ---------- Private biblical framework checker ---------- */

function renderTraitFramework(rerender) {
  const s = heartState();
  const showFor = ["getting-to-know", "together", "complicated", "open"];
  if (!showFor.includes(s.status)) return null;

  const card = h("section", { class: "card" }, [
    h("h2", {}, "The framework (for your eyes only)"),
    h("div", { class: "sub" },
      "Scripture holds up certain qualities in a man — not as a checklist to judge him on, but as a mirror to help you see clearly. Tap each one. There's no right answer. Mark what feels true. This never leaves your device."),
  ]);

  MAN_TRAITS.forEach((t) => {
    const current = s.traitAssessment[t.key] || "unknown";
    const row = h("div", { class: "item heart-trait" }, [
      h("div", {}, [
        h("div", { class: "title" }, t.label),
        h("div", { class: "meta", style: "margin-top:2px" }, t.one_liner),
        h("div", { class: "meta", style: "opacity:0.7" }, "See: " + t.scripture.join(", ")),
        t.safety_flag && h("div", { class: "meta", style: "color:#c53030; margin-top:4px" },
          "⚠️ If this one isn't a yes, please take that seriously. This is a safety line, not a preference."),
      ]),
      h("div", { class: "chip-row", style: "margin-top:8px" }, [
        ["strong", "💚"], ["ok", "🙂"], ["concern", "⚠️"], ["unknown", "—"],
      ].map(([val, emoji]) =>
        h("button", {
          class: "chip" + (current === val ? " active" : ""),
          onclick: () => {
            s.traitAssessment[t.key] = val;
            save();
            rerender();
          },
        }, emoji + " " + val)
      )),
    ]);
    card.append(row);
  });

  // Summary — count, not score. Never say "he passes" / "he fails".
  const values = Object.values(s.traitAssessment);
  const strong = values.filter((v) => v === "strong").length;
  const concerns = values.filter((v) => v === "concern").length;
  if (values.length >= 3) {
    card.append(h("div", { class: "card", style: "background:var(--bg-elev-2); margin-top:12px" }, [
      h("div", { class: "sub" }, "What you've marked so far"),
      h("div", { style: "margin-top:6px" },
        `${strong} strong · ${concerns} concern${concerns === 1 ? "" : "s"} · ${values.length - strong - concerns} in-between or unknown.`),
      concerns >= 2 && h("div", { class: "sub", style: "margin-top:8px" },
        "Noticing concerns in more than one area isn't a verdict. It's information. Sit with it. Pray on it if you do that. Talk to someone you trust who won't tell you what you want to hear."),
    ]));
  }

  return card;
}

/* ---------- Send him a question ---------- */

function renderAskHim(rerender) {
  const s = heartState();
  const showFor = ["getting-to-know", "together"];
  if (!showFor.includes(s.status)) return null;

  const card = h("section", { class: "card" }, [
    h("h2", {}, "A question for him"),
    h("div", { class: "sub" },
      "Pick one and send it. Text, share sheet, read it to him over dinner — whatever works. These are designed to be gentle enough that he won't feel cornered."),
  ]);

  // Tiered chips
  const filterChips = h("div", { class: "chip-row", style: "margin-bottom:8px" });
  let tierFilter = "warm";
  const list = h("div", { class: "list" });

  function paint() {
    list.innerHTML = "";
    QUESTIONS_FOR_HIM.filter((q) => q.tier === tierFilter).forEach((q) => {
      list.append(h("div", { class: "item" }, [
        h("div", {}, q.text),
        h("div", { class: "btn-row", style: "gap:6px" }, [
          h("button", {
            class: "btn small",
            onclick: () => shareSheet({ title: "Something I was thinking", text: q.text }),
          }, "📤 Share"),
          h("button", {
            class: "btn small secondary",
            onclick: () => {
              s.askedHim.unshift({ id: uid(), askedAt: Date.now(), question: q.text, hisAnswer: "" });
              save();
              toast("Saved in your log");
              rerender();
            },
          }, "Mark asked"),
        ]),
      ]));
    });
  }

  ["warm", "medium", "deep"].forEach((tier) =>
    filterChips.append(h("button", {
      class: "chip" + (tier === tierFilter ? " active" : ""),
      onclick: (e) => {
        tierFilter = tier;
        filterChips.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        e.target.classList.add("active");
        paint();
      },
    }, tier))
  );
  card.append(filterChips);
  paint();
  card.append(list);

  if (s.askedHim.length) {
    card.append(h("h3", { style: "margin:14px 0 6px; font-size:14px" }, "What you've asked"));
    s.askedHim.slice(0, 5).forEach((a) => {
      const when = new Date(a.askedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      card.append(h("div", { class: "item" }, [
        h("div", {}, [
          h("div", { class: "meta" }, when),
          h("div", {}, a.question),
          a.hisAnswer
            ? h("div", { class: "sub", style: "margin-top:4px" }, "He said: " + a.hisAnswer)
            : null,
        ]),
      ]));
    });
  }

  return card;
}

/* ---------- Main ---------- */

export function renderHeart(rerender) {
  const wrap = h("div");
  const s = heartState();

  // Top-level intake if she hasn't picked a status yet
  if (!s.status) {
    wrap.append(renderIntake(rerender));
    return wrap;
  }

  const track = renderTrackCard();
  if (track) wrap.append(track);

  if (s.status !== "private") {
    wrap.append(renderReflectionJournal(rerender));
    const framework = renderTraitFramework(rerender);
    if (framework) wrap.append(framework);
    const askHim = renderAskHim(rerender);
    if (askHim) wrap.append(askHim);
  }

  return wrap;
}
