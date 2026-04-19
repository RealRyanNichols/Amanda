import { state, save, uid } from "../store.js";
import { h, toast, confirmAction, todayISO, friendlyDate } from "../util.js";
import { micButton, speechSupported } from "../voice.js";
import { renderReels } from "./reels.js";

const PLATFORMS = [
  { key: "facebook",  label: "Facebook",  emoji: "📘", base: "https://facebook.com/" },
  { key: "instagram", label: "Instagram", emoji: "📷", base: "https://instagram.com/" },
  { key: "tiktok",    label: "TikTok",    emoji: "🎵", base: "https://tiktok.com/@" },
];

const POST_STATUS = [
  { key: "draft",     label: "Draft",     pill: "" },
  { key: "scheduled", label: "Scheduled", pill: "warm" },
  { key: "posted",    label: "Posted",    pill: "paid" },
];

/* ---------- Sub-nav ---------- */

function subNav() {
  const views = [
    { key: "profiles", label: "Profiles" },
    { key: "planner",  label: "Planner" },
    { key: "reels",    label: "Reel Studio" },
    { key: "caption",  label: "Caption writer" },
    { key: "hashtags", label: "Hashtags" },
  ];
  const row = h("div", { class: "chip-row", style: "margin-bottom:12px" });
  views.forEach((v) =>
    row.append(h("button", {
      class: "chip" + (state.social.activeView === v.key ? " active" : ""),
      onclick: () => { state.social.activeView = v.key; save(); document.dispatchEvent(new CustomEvent("social:rerender")); },
    }, v.label))
  );
  return row;
}

/* ---------- Profiles ---------- */

function renderProfiles(rerender) {
  const wrap = h("div");
  wrap.append(h("section", { class: "card" }, [
    h("h2", {}, "Your handles"),
    h("div", { class: "sub" }, "Save your handles once. Tap to open your profile from anywhere in the app."),
  ]));

  PLATFORMS.forEach((pl) => {
    const p = state.social.profiles[pl.key];
    const card = h("section", { class: "card" }, [
      h("div", { class: "item", style: "align-items:center; padding:0; border:0; background:transparent" }, [
        h("div", { style: "flex:1; min-width:0" }, [
          h("div", { class: "title" }, `${pl.emoji} ${pl.label}`),
          h("div", { class: "meta" }, p.handle ? "@" + p.handle.replace(/^@/, "") : "Not set"),
        ]),
        p.handle && h("a", {
          class: "btn small", target: "_blank", rel: "noopener",
          href: (p.url?.trim()) || (pl.base + p.handle.replace(/^@/, "")),
        }, "Open"),
      ]),
      h("div", { class: "form-row two", style: "margin-top:10px" }, [
        h("label", { class: "field" }, [
          "Handle",
          h("input", {
            type: "text",
            value: p.handle || "",
            placeholder: "e.g. premierdentalacademy",
            oninput: (e) => { p.handle = e.target.value.trim().replace(/^@/, ""); save(); },
          }),
        ]),
        h("label", { class: "field" }, [
          "Full URL (optional)",
          h("input", {
            type: "url",
            value: p.url || "",
            placeholder: pl.base,
            oninput: (e) => { p.url = e.target.value.trim(); save(); },
          }),
        ]),
      ]),
    ]);
    wrap.append(card);
  });

  wrap.append(h("div", { class: "alert", style: "margin-top:4px" },
    "Heads up: connecting these accounts directly (auto-posting, comments, DMs) needs a developer account with Meta/TikTok and a backend. That's a later upgrade — for now use the Planner below to draft + schedule, and post manually with one tap."));

  return wrap;
}

/* ---------- Planner ---------- */

function renderPlanner(rerender) {
  const wrap = h("div");
  wrap.append(h("section", { class: "card" }, [
    h("h2", {}, "Content planner"),
    h("div", { class: "sub" }, "Draft posts, schedule them, get a reminder when it's time. Post manually for now."),
  ]));

  // New post form
  wrap.append(renderPostForm(rerender));

  const posts = [...state.social.posts];
  const due = posts.filter((p) => p.status === "scheduled" && p.scheduledFor && new Date(p.scheduledFor) <= new Date());
  if (due.length) {
    wrap.append(h("section", { class: "card" }, [
      h("div", { class: "alert warn" },
        `${due.length} post${due.length > 1 ? "s are" : " is"} due to be posted now. Open each one below and tap Share.`),
    ]));
  }

  // Tabs by status
  POST_STATUS.forEach((s) => {
    const items = posts
      .filter((p) => p.status === s.key)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (!items.length) return;
    const card = h("section", { class: "card" }, [
      h("h2", { style: "font-size:14px" }, `${s.label} · ${items.length}`),
    ]);
    const list = h("div", { class: "list" });
    items.forEach((p) => list.append(renderPostRow(p, rerender)));
    card.append(list);
    wrap.append(card);
  });

  if (!posts.length) {
    wrap.append(h("div", { class: "empty" }, "No posts yet. Draft one above."));
  }

  return wrap;
}

function renderPostForm(rerender) {
  const card = h("section", { class: "card" }, [
    h("h2", { style: "font-size:14px" }, "Draft a post"),
  ]);

  const textarea = h("textarea", {
    name: "body",
    placeholder: "What do you want to say? Or tap the mic and talk.",
    rows: "4",
  });

  const mic = micButton(textarea);

  const form = h("form", { class: "form-row", onsubmit: (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const body = textarea.value.trim();
    if (!body) return;
    const platforms = Array.from(e.target.querySelectorAll("input[name=platform]:checked")).map((x) => x.value);
    state.social.posts.unshift({
      id: uid(),
      body,
      platforms: platforms.length ? platforms : ["instagram"],
      status: f.get("schedule") ? "scheduled" : "draft",
      scheduledFor: (f.get("schedule") || "").toString(),
      createdAt: Date.now(),
    });
    save(); toast(f.get("schedule") ? "Scheduled" : "Saved"); e.target.reset(); textarea.value = ""; rerender();
  } }, [
    h("label", { class: "field" }, ["Caption", textarea]),
    h("div", { class: "btn-row" }, [mic]),
    h("fieldset", { class: "field" }, [
      h("legend", {}, "Post to"),
      h("div", { class: "chip-row" }, PLATFORMS.map((pl) =>
        h("label", { class: "radio", style: "padding:6px 12px; margin:0; border:1px solid var(--border); border-radius:999px" }, [
          h("input", { type: "checkbox", name: "platform", value: pl.key, checked: pl.key === "instagram" }),
          h("span", {}, `${pl.emoji} ${pl.label}`),
        ])
      )),
    ]),
    h("label", { class: "field" }, [
      "Schedule for (optional)",
      h("input", { type: "datetime-local", name: "schedule" }),
    ]),
    h("div", { class: "btn-row" }, [
      h("button", { class: "btn", type: "submit" }, "Save"),
    ]),
  ]);

  card.append(form);
  return card;
}

function renderPostRow(p, rerender) {
  const status = POST_STATUS.find((s) => s.key === p.status) || POST_STATUS[0];
  const platforms = p.platforms || [];

  return h("div", { class: "card", style: "background:var(--bg-elev-2); margin-bottom:8px; padding:14px" }, [
    h("div", { class: "item", style: "padding:0; border:0; background:transparent" }, [
      h("div", { style: "flex:1; min-width:0" }, [
        h("div", { class: "meta" }, [
          p.scheduledFor ? friendlyDate(p.scheduledFor.slice(0, 10)) + (p.scheduledFor.slice(11, 16) ? " · " + p.scheduledFor.slice(11, 16) : "") : "No schedule",
          " · ",
          platforms.map((k) => PLATFORMS.find((pl) => pl.key === k)?.emoji || "").join(" "),
          " ",
          status.pill ? h("span", { class: `pill ${status.pill}` }, status.label) : h("span", { class: "pill" }, status.label),
        ]),
        h("div", { class: "post-body" }, p.body),
      ]),
    ]),
    h("div", { class: "btn-row", style: "margin-top:10px" }, [
      h("button", {
        class: "btn small",
        onclick: () => {
          try { navigator.clipboard?.writeText(p.body); toast("Copied"); }
          catch { prompt("Copy caption:", p.body); }
        },
      }, "Copy caption"),
      ...platforms.map((k) => {
        const pl = PLATFORMS.find((x) => x.key === k);
        if (!pl) return null;
        return h("a", {
          class: "btn small secondary",
          href: platformShareUrl(pl.key, p.body),
          target: "_blank", rel: "noopener",
        }, `Open ${pl.label}`);
      }).filter(Boolean),
      p.status !== "posted" && h("button", {
        class: "btn small",
        onclick: () => { p.status = "posted"; p.postedAt = Date.now(); save(); toast("Marked posted"); rerender(); },
      }, "Mark posted"),
      h("button", {
        class: "btn small danger",
        onclick: () => {
          if (!confirmAction("Remove this post?")) return;
          state.social.posts = state.social.posts.filter((x) => x.id !== p.id);
          save(); rerender();
        },
      }, "×"),
    ]),
  ]);
}

function platformShareUrl(key, body) {
  if (key === "facebook") return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://example.com")}&quote=${encodeURIComponent(body)}`;
  // Instagram and TikTok don't accept pre-filled text via web — just open the app
  if (key === "instagram") return "https://www.instagram.com/";
  if (key === "tiktok") return "https://www.tiktok.com/upload";
  return "#";
}

/* ---------- Caption writer (Claude) ---------- */

function renderCaptionWriter(rerender) {
  const wrap = h("div");
  wrap.append(h("section", { class: "card" }, [
    h("h2", {}, "AI caption writer"),
    h("div", { class: "sub" }, "Tell Claude what the post is about. Get three caption options."),
  ]));

  const hasKey = !!state.brain?.apiKey;
  if (!hasKey) {
    wrap.append(h("div", { class: "alert warn" },
      "Connect your Claude key in Settings → Brain to use this. It's the only part of Social that needs an API key."));
  }

  const subject = h("textarea", {
    placeholder: 'e.g. "Photo of a student at the chair during externship, first day"',
    rows: "3",
  });

  const micBtn = micButton(subject);

  const form = h("form", { class: "form-row", onsubmit: async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const text = subject.value.trim();
    if (!text) return;
    if (!hasKey) { toast("Connect Claude first"); return; }

    const platform = f.get("platform") || "instagram";
    const vibe = f.get("vibe") || "warm and encouraging";
    const btn = form.querySelector("button[type=submit]");
    btn.textContent = "Writing…"; btn.disabled = true;

    try {
      const captions = await generateCaptions({ text, platform, vibe });
      renderResults(captions);
    } catch (err) {
      toast(err.message || "Couldn't generate");
    } finally {
      btn.textContent = "Write 3 captions"; btn.disabled = false;
    }
  } }, [
    h("label", { class: "field" }, ["What's the post about?", subject]),
    h("div", { class: "btn-row" }, [micBtn]),
    h("label", { class: "field" }, [
      "Platform",
      h("select", { name: "platform" },
        PLATFORMS.map((p) => h("option", { value: p.key }, p.label))
      ),
    ]),
    h("label", { class: "field" }, [
      "Vibe",
      h("select", { name: "vibe" }, [
        "warm and encouraging",
        "professional and authoritative",
        "playful and fun",
        "vulnerable and real",
        "educational, informative",
        "faith-forward",
      ].map((v) => h("option", { value: v }, v))),
    ]),
    h("div", { class: "btn-row" }, [
      h("button", { class: "btn", type: "submit", disabled: !hasKey }, "Write 3 captions"),
    ]),
  ]);
  wrap.append(h("section", { class: "card" }, [form]));

  const resultsContainer = h("div", { class: "list" });
  wrap.append(resultsContainer);

  function renderResults(captions) {
    resultsContainer.innerHTML = "";
    captions.forEach((c, i) => {
      resultsContainer.append(h("div", { class: "card", style: "margin-bottom:8px" }, [
        h("h2", { style: "font-size:14px" }, `Option ${i + 1} · ${c.style}`),
        h("div", { class: "post-body" }, c.text),
        h("div", { class: "btn-row", style: "margin-top:10px" }, [
          h("button", {
            class: "btn small",
            onclick: () => { navigator.clipboard?.writeText(c.text); toast("Copied"); },
          }, "Copy"),
          h("button", {
            class: "btn small secondary",
            onclick: () => {
              state.social.posts.unshift({
                id: uid(),
                body: c.text,
                platforms: [form.querySelector("[name=platform]").value],
                status: "draft",
                scheduledFor: "",
                createdAt: Date.now(),
              });
              save(); toast("Saved as draft"); rerender();
            },
          }, "Save as draft"),
        ]),
      ]));
    });
  }

  return wrap;
}

async function generateCaptions({ text, platform, vibe }) {
  const b = state.brain;
  const body = {
    model: b.model || "claude-opus-4-7",
    max_tokens: 1500,
    system:
      "You write social media captions for a mom-owned business. Given the subject and vibe, return exactly 3 caption options: short (under 100 chars, one punchy line), medium (a few sentences with emoji, ends in a gentle CTA), and long (a story-style caption 4-6 short paragraphs). " +
      "Use 5-8 relevant hashtags at the end of medium and long. " +
      "Match the platform conventions: Instagram allows longer captions, TikTok prefers punchy, Facebook is mid-length. " +
      "Be authentic, not salesy. Return ONLY valid JSON in the form: {\"captions\":[{\"style\":\"short\",\"text\":\"...\"},{\"style\":\"medium\",\"text\":\"...\"},{\"style\":\"long\",\"text\":\"...\"}]}",
    messages: [{ role: "user", content: `Platform: ${platform}\nVibe: ${vibe}\nSubject: ${text}` }],
  };
  if (/opus-4-7|opus-4-6|sonnet-4-6/.test(body.model)) body.thinking = { type: "adaptive" };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": b.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const data = await res.json();
  const textBlock = (data.content || []).find((x) => x.type === "text");
  const raw = textBlock?.text || "{}";
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const jsonStr = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
  const parsed = JSON.parse(jsonStr);
  return parsed.captions || [];
}

/* ---------- Hashtag bank ---------- */

function renderHashtags(rerender) {
  const wrap = h("div");
  wrap.append(h("section", { class: "card" }, [
    h("h2", {}, "Hashtag sets"),
    h("div", { class: "sub" }, "Save the sets you use on repeat. Tap to copy the whole block."),
  ]));

  const form = h("form", { class: "form-row", onsubmit: (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const name = (f.get("name") || "").toString().trim();
    const tags = (f.get("tags") || "").toString().trim();
    if (!name || !tags) return;
    state.social.hashtagSets.unshift({
      id: uid(),
      name,
      tags: normalizeTags(tags),
    });
    save(); toast("Saved"); e.target.reset(); rerender();
  } }, [
    h("label", { class: "field" }, ["Name of this set", h("input", { type: "text", name: "name", placeholder: "e.g. Dental academy", required: true })]),
    h("label", { class: "field" }, [
      "Hashtags (we'll clean them up)",
      h("textarea", { name: "tags", placeholder: "#dentalassistant #dentalschool #longviewtx ...", rows: "2" }),
    ]),
    h("div", { class: "btn-row" }, [h("button", { class: "btn", type: "submit" }, "Save set")]),
  ]);
  wrap.append(h("section", { class: "card" }, [form]));

  if (!state.social.hashtagSets.length) {
    wrap.append(h("div", { class: "empty" }, "No sets yet."));
    return wrap;
  }

  state.social.hashtagSets.forEach((s) => {
    wrap.append(h("section", { class: "card" }, [
      h("div", { class: "item", style: "padding:0; border:0; background:transparent" }, [
        h("div", {}, [
          h("div", { class: "title" }, s.name),
          h("div", { class: "meta" }, s.tags),
        ]),
        h("div", { class: "actions" }, [
          h("button", { class: "btn small", onclick: () => { navigator.clipboard?.writeText(s.tags); toast("Copied"); } }, "Copy"),
          h("button", {
            class: "btn small danger",
            onclick: () => {
              if (!confirmAction(`Remove "${s.name}"?`)) return;
              state.social.hashtagSets = state.social.hashtagSets.filter((x) => x.id !== s.id);
              save(); rerender();
            },
          }, "×"),
        ]),
      ]),
    ]));
  });

  return wrap;
}

function normalizeTags(raw) {
  const parts = raw
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : "#" + t));
  return [...new Set(parts)].join(" ");
}

/* ---------- Main render ---------- */

export function renderSocial(mount, { rerender }) {
  document.removeEventListener("social:rerender", rerender);
  document.addEventListener("social:rerender", rerender);

  mount.append(subNav());
  const v = state.social.activeView || "profiles";
  if (v === "profiles") mount.append(renderProfiles(rerender));
  else if (v === "planner") mount.append(renderPlanner(rerender));
  else if (v === "reels") mount.append(renderReels(rerender));
  else if (v === "caption") mount.append(renderCaptionWriter(rerender));
  else if (v === "hashtags") mount.append(renderHashtags(rerender));
}
