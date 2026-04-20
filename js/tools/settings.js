import { state, save, resetAll } from "../store.js";
import { h, toast, confirmAction } from "../util.js";
import { ROLES, INTERESTS, setPin, hasPin } from "../auth.js";
import { MODEL_OPTIONS } from "./brain.js";
import { showSafetyNet } from "../safety-net.js";
import { currentUser, isSupabaseConfigured } from "../supabase.js";
import { ensureHousehold, getHousehold, inviteMember, updateMemberVisibility, removeMember } from "../household.js";
import {
  googleConnectedState, connectDrive, connectSheets, connectYouTube, connectAllGoogle,
  backupStateToDrive, syncIncomeToSheet,
} from "../google-connect.js";

// Capture the beforeinstallprompt event for a friendly in-app install button (Chrome/Edge/Android).
let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

function renderProfileCard(rerender) {
  const p = state.profile || {};
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Your profile"),
    h("div", { class: "sub" }, "You can change any of this any time."),
  ]);

  card.append(h("div", { class: "form-row two" }, [
    h("label", { class: "field" }, [
      "First name",
      h("input", { type: "text", value: p.firstName || "", oninput: (e) => { p.firstName = e.target.value; save(); } }),
    ]),
    h("label", { class: "field" }, [
      "Partner's name",
      h("input", { type: "text", value: p.partnerName || "", oninput: (e) => { p.partnerName = e.target.value; save(); } }),
    ]),
    h("label", { class: "field", style: "grid-column: 1 / -1" }, [
      "Business name",
      h("input", { type: "text", value: p.businessName || "", oninput: (e) => { p.businessName = e.target.value; save(); } }),
    ]),
  ]));

  card.append(h("h3", { style: "margin:16px 0 6px; font-size:13px; color:var(--text-dim); text-transform:uppercase; letter-spacing:.8px" }, "What are you?"));
  const roleGrid = h("div", { class: "chip-grid" });
  ROLES.forEach((r) => {
    const active = (p.roles || []).includes(r.key);
    roleGrid.append(
      h("button", {
        class: "chip-big" + (active ? " active" : ""),
        onclick: () => {
          p.roles = p.roles || [];
          if (active) p.roles = p.roles.filter((x) => x !== r.key);
          else p.roles.push(r.key);
          p.enabledTabs = null; // re-compute from roles
          save();
          rerender();
          document.dispatchEvent(new CustomEvent("tabs:refresh"));
        },
      }, r.label)
    );
  });
  card.append(roleGrid);

  card.append(h("h3", { style: "margin:16px 0 6px; font-size:13px; color:var(--text-dim); text-transform:uppercase; letter-spacing:.8px" }, "What matters most?"));
  const intGrid = h("div", { class: "chip-grid" });
  INTERESTS.forEach((i) => {
    const active = (p.interests || []).includes(i.key);
    intGrid.append(
      h("button", {
        class: "chip-big" + (active ? " active" : ""),
        onclick: () => {
          p.interests = p.interests || [];
          if (active) p.interests = p.interests.filter((x) => x !== i.key);
          else p.interests.push(i.key);
          save();
          rerender();
        },
      }, i.label)
    );
  });
  card.append(intGrid);

  return card;
}

function renderBrainCard(rerender) {
  const brain = state.brain;
  const hasKey = !!brain.apiKey;
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Gideon (your AI)"),
    h("div", { class: "sub" }, "Gideon runs on Claude when connected, local-mode when not. Same voice either way. Named for the Biblical Gideon (Judges 6–8) — evidence-tested, decisive, proven under pressure."),
  ]);

  card.append(h("div", { class: "alert " + (hasKey ? "ok" : "warn"), style: "margin-bottom:10px" },
    hasKey
      ? `Claude connected. Using ${brain.model}. Your key stays on this device.`
      : "No Claude key set. Gideon will run in local-only mode."));

  card.append(h("label", { class: "field" }, [
    "Anthropic API key (sk-ant-...)",
    h("input", {
      type: "password",
      placeholder: hasKey ? "•••• set — leave blank to keep" : "sk-ant-...",
      oninput: (e) => { if (e.target.value) { brain.apiKey = e.target.value.trim(); save(); } },
    }),
  ]));

  card.append(h("label", { class: "field", style: "margin-top:8px" }, [
    "Model",
    h("select", {
      onchange: (e) => { brain.model = e.target.value; save(); rerender(); },
    }, MODEL_OPTIONS.map((m) =>
      h("option", { value: m.value, selected: brain.model === m.value }, m.label)
    )),
  ]));

  card.append(h("div", { class: "btn-row", style: "margin-top:10px" }, [
    hasKey && h("button", {
      class: "btn small danger",
      onclick: () => {
        if (!confirmAction("Remove Claude key?")) return;
        brain.apiKey = "";
        save();
        toast("Key removed");
        rerender();
      },
    }, "Remove key"),
  ]));

  card.append(h("div", { class: "pda-contact" },
    "Privacy: when a key is set, messages you send to the Brain go directly from this device to Anthropic over HTTPS. Nothing passes through any server we control. Your chat history is stored in this browser only."));

  // Data-awareness toggle
  card.append(h("label", {
    class: "radio",
    style: "margin-top:10px; align-items:flex-start; gap:12px",
  }, [
    h("input", {
      type: "checkbox",
      checked: !!brain.shareData,
      onchange: (e) => { brain.shareData = e.target.checked; save(); rerender(); },
    }),
    h("div", {}, [
      h("div", { class: "title" }, "Let the Brain see my stats"),
      h("div", { class: "meta" },
        "When on, a short summary of your data (e.g. 3 unpaid bills, 12 open leads) is included with each Brain message. Makes answers way smarter. Raw details (names, amounts) NEVER leave your device unless you paste them yourself."),
    ]),
  ]));

  return card;
}

function renderSecurityCard(rerender) {
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Security"),
  ]);
  card.append(h("div", { class: "btn-row" }, [
    h("button", {
      class: "btn",
      onclick: async () => {
        const current = hasPin();
        const msg = current
          ? "Change PIN? Type the new PIN, or leave blank to remove the lock."
          : "Set a 4–6 digit PIN?";
        const pin = prompt(msg, "");
        if (pin === null) return;
        if (!pin) { await setPin(""); toast("PIN removed"); return; }
        if (!/^\d{4,6}$/.test(pin)) { toast("PIN must be 4–6 digits"); return; }
        await setPin(pin);
        toast("PIN updated");
      },
    }, hasPin() ? "Change PIN" : "Set PIN"),
  ]));
  return card;
}

function renderDataCard(rerender) {
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Data"),
    h("div", { class: "sub" }, "Everything stays on your device. Back it up before you switch phones."),
    h("div", { class: "btn-row" }, [
      h("button", {
        class: "btn secondary",
        onclick: () => document.getElementById("exportBtn")?.click(),
      }, "Export JSON"),
      h("button", {
        class: "btn secondary",
        onclick: () => document.getElementById("importBtn")?.click(),
      }, "Import JSON"),
      h("button", {
        class: "btn secondary",
        onclick: () => {
          if (!confirmAction("Start over from scratch? This wipes everything on this device and walks you through the welcome wizard again. Great for experiencing the app like a brand-new user.")) return;
          resetAll();
          location.reload();
        },
      }, "Experience fresh"),
      h("button", {
        class: "btn danger",
        onclick: () => {
          if (!confirmAction("Erase ALL data on this device? This cannot be undone.")) return;
          if (!confirmAction("Really? Everything will be gone.")) return;
          resetAll();
          location.reload();
        },
      }, "Erase everything"),
    ]),
    h("div", { class: "pda-contact", style: "margin-top:10px" },
      "Tip for testing: 'Experience fresh' wipes your current data so you can feel what a new user feels — the welcome wizard, fresh profile, empty dashboards. Export first if you want to bring your data back."),
  ]);
  return card;
}

function renderInstallCard() {
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  if (isStandalone) {
    return h("section", { class: "card" }, [
      h("h2", {}, "Installed ✓"),
      h("div", { class: "sub" }, "Running as an app on your home screen. Nice."),
    ]);
  }

  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Install as an app"),
    h("div", { class: "sub" }, "Get a real app icon on your home screen. No App Store needed."),
  ]);

  if (isIOS) {
    card.append(h("div", { class: "alert ok", style: "margin-top:6px" },
      "iPhone: tap the Share button in Safari, then 'Add to Home Screen'. It'll launch full-screen like a native app."));
  } else if (deferredInstallPrompt) {
    card.append(h("div", { class: "btn-row", style: "margin-top:6px" }, [
      h("button", {
        class: "btn",
        onclick: async () => {
          try {
            deferredInstallPrompt.prompt();
            const { outcome } = await deferredInstallPrompt.userChoice;
            if (outcome === "accepted") toast("Installed");
            deferredInstallPrompt = null;
          } catch {
            toast("Install not available right now");
          }
        },
      }, "Install app"),
    ]));
  } else {
    card.append(h("div", { class: "alert", style: "margin-top:6px" },
      "Android Chrome: open the browser menu (⋮) and tap 'Install app'. On desktop Chrome, look for the install icon in the address bar."));
  }
  return card;
}

function renderSafetyNetCard(rerender) {
  if (!state.safetyNet) state.safetyNet = { trustedName: "", trustedRelation: "", trustedPhone: "", countryCode: "US", consentPartnerAlerts: false, silentMonitoring: true, flagged: [] };
  const net = state.safetyNet;
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Safety Net"),
    h("div", { class: "sub" },
      "Set up the person you'd reach out to on a hard day. We NEVER auto-call or auto-text anyone on your behalf. The 988 Lifeline is always available if you open this screen yourself."),
  ]);

  card.append(h("div", { class: "form-row two" }, [
    h("label", { class: "field" }, [
      "Trusted person's name",
      h("input", {
        type: "text",
        value: net.trustedName || "",
        placeholder: "e.g. Mom, Sarah, Pastor Mike",
        oninput: (e) => { net.trustedName = e.target.value; save(); },
      }),
    ]),
    h("label", { class: "field" }, [
      "Relation",
      h("input", {
        type: "text",
        value: net.trustedRelation || "",
        placeholder: "e.g. best friend, mom, husband",
        oninput: (e) => { net.trustedRelation = e.target.value; save(); },
      }),
    ]),
    h("label", { class: "field", style: "grid-column: 1 / -1" }, [
      "Their phone",
      h("input", {
        type: "tel",
        value: net.trustedPhone || "",
        placeholder: "555-555-5555",
        oninput: (e) => { net.trustedPhone = e.target.value; save(); },
      }),
    ]),
  ]));

  card.append(h("div", { class: "btn-row", style: "margin-top:10px" }, [
    h("button", {
      class: "btn",
      onclick: () => showSafetyNet({ reason: "user" }),
    }, "Preview the help screen"),
  ]));

  // Transparency about silent monitoring
  card.append(h("h3", { style: "margin:16px 0 6px; font-size:13px; color:var(--text-dim); text-transform:uppercase; letter-spacing:.8px" }, "How we watch (honestly)"));
  card.append(h("div", { class: "sub", style: "line-height:1.6" },
    "If you write something that sounds like it might be more than venting, we quietly log it — no pop-ups, no banners, no interrupting you. We use AI to tell the difference between an exhausted mom using strong language (fine, stays private) and a real emergency (specific plan, means, timing). Only real emergencies trigger an alert, and those alerts go to people who can actually help — not to police unless it's immediate physical danger. You can turn this off below."));

  card.append(h("label", {
    class: "radio",
    style: "margin-top:10px; align-items:flex-start; gap:12px",
  }, [
    h("input", {
      type: "checkbox",
      checked: net.silentMonitoring !== false,
      onchange: (e) => { net.silentMonitoring = e.target.checked; save(); rerender(); },
    }),
    h("div", {}, [
      h("div", { class: "title" }, "Silent safety monitoring"),
      h("div", { class: "meta" },
        net.silentMonitoring !== false
          ? "On. We quietly watch for concerning language. No accusations, no interruptions."
          : "Off. Your words are never scanned for crisis language. You're on your own — and that's your right."),
    ]),
  ]));

  // If there's anything flagged, show a subtle review option (helps her review what WE flagged)
  const flaggedCount = (net.flagged || []).length;
  if (flaggedCount > 0 && net.silentMonitoring !== false) {
    card.append(h("div", { class: "btn-row", style: "margin-top:10px" }, [
      h("button", {
        class: "btn small secondary",
        onclick: () => reviewFlagged(rerender),
      }, `Review what we flagged (${flaggedCount})`),
    ]));
  }

  return card;
}

function reviewFlagged(rerender) {
  const flagged = state.safetyNet?.flagged || [];
  const overlay = h("div", { class: "note-overlay", onclick: (e) => { if (e.target.classList.contains("note-overlay")) overlay.remove(); } }, [
    h("div", { class: "card", style: "max-width:560px; width:100%; cursor:auto; max-height:80vh; overflow:auto" }, [
      h("h2", {}, "What we flagged"),
      h("div", { class: "sub" }, "Everything here is stored locally on your device. Clear any of it any time."),
      ...(flagged.length === 0 ? [h("div", { class: "empty" }, "Nothing flagged.")] : flagged.slice().reverse().map((f) => h("div", { class: "item", style: "flex-direction:column; align-items:stretch; gap:6px" }, [
        h("div", { class: "meta" }, `${new Date(f.at).toLocaleString()} · ${f.source} · ${f.level}${f.intent ? " · AI verdict: " + f.intent + " (" + Math.round((f.confidence || 0) * 100) + "%)" : " · AI pending"}`),
        h("div", { style: "font-size:.9375rem" }, f.text),
        f.reasoning && h("div", { class: "meta", style: "font-style:italic" }, "AI: " + f.reasoning),
      ]))),
      h("div", { class: "btn-row", style: "margin-top:12px; justify-content:space-between" }, [
        h("button", {
          class: "btn danger",
          onclick: () => {
            if (!confirm("Clear all flagged entries?")) return;
            state.safetyNet.flagged = [];
            save();
            overlay.remove();
            rerender();
          },
        }, "Clear all"),
        h("button", { class: "btn", onclick: () => overlay.remove() }, "Close"),
      ]),
    ]),
  ]);
  document.body.append(overlay);
}

function renderHouseholdCard(rerender) {
  const card = h("section", { class: "card" }, [
    h("h2", {}, "👨‍👩‍👧 Partner + family"),
    h("div", { class: "sub" }, "Share selected parts of your account with your partner, parent, or friend. You pick what they can see. They never see your private data unless you opt each thing in."),
  ]);

  if (!isSupabaseConfigured()) {
    card.append(h("div", { class: "alert" }, "Backend not configured yet — this activates when Supabase is fully wired."));
    return card;
  }

  const body = h("div");
  card.append(body);
  body.append(h("div", { class: "meta" }, "Loading…"));

  (async () => {
    try {
      const user = await currentUser();
      if (!user) {
        body.innerHTML = "";
        body.append(h("div", { class: "alert" }, "Sign in on the Account tab first."));
        return;
      }
      const household = await getHousehold();
      body.innerHTML = "";

      const members = (household?.household_members || []).filter((m) => m.role !== "primary");

      // Member list
      if (members.length) {
        body.append(h("h3", { style: "margin:12px 0 6px; font-size:13px; color:var(--text-dim); text-transform:uppercase; letter-spacing:.8px" }, "Sharing with"));
        const list = h("div", { class: "list" });
        members.forEach((m) => {
          list.append(h("div", { class: "item" }, [
            h("div", {}, [
              h("div", { class: "title" }, m.relation || m.role),
              h("div", { class: "meta" },
                `${m.pending_email || "linked"} · ${m.status}`),
              h("div", { class: "meta", style: "margin-top:4px" },
                [
                  m.can_see_calendar && "calendar",
                  m.can_see_baby_year && "baby year",
                  m.can_see_pregnancy && "pregnancy",
                  m.can_see_kids && "kids",
                  m.can_see_me_time && "me-time",
                ].filter(Boolean).join(" · ") || "(nothing shared yet)"),
            ]),
            h("div", { class: "actions" }, [
              h("button", {
                class: "btn small danger",
                onclick: async () => {
                  if (!confirm(`Remove ${m.relation || "this member"}? They won't see your data anymore.`)) return;
                  try { await removeMember(m.id); toast("Removed"); rerender(); }
                  catch (e) { toast(e.message || "Couldn't remove"); }
                },
              }, "Remove"),
            ]),
          ]));
        });
        body.append(list);
      }

      // Invite form
      body.append(h("h3", { style: "margin:14px 0 6px; font-size:13px; color:var(--text-dim); text-transform:uppercase; letter-spacing:.8px" }, "Invite someone"));

      const form = h("form", { class: "form-row two", onsubmit: async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const email = (f.get("email") || "").toString().trim();
        if (!email) return;
        const relation = (f.get("relation") || "").toString().trim();
        const role = (f.get("role") || "partner").toString();
        const visibility = {
          can_see_calendar: !!f.get("can_calendar"),
          can_see_baby_year: !!f.get("can_baby"),
          can_see_pregnancy: !!f.get("can_pregnancy"),
          can_see_kids: !!f.get("can_kids"),
          can_see_me_time: !!f.get("can_metime"),
          alert_on_concerning: !!f.get("alert_concerning"),
        };
        const faithContext = role === "partner" ? {
          faithStatus: (f.get("faith_status") || "unknown").toString(),
          churchFreq:  (f.get("church_freq")  || "unknown").toString(),
          nudgesOk:    !!f.get("faith_nudges"),
          prayerOk:    !!f.get("prayer_ok"),
        } : null;
        try {
          await inviteMember({ email, relation, role, visibility, faithContext });
          toast(`Invite saved. When ${email} signs up, they'll join automatically.`);
          e.target.reset();
          rerender();
        } catch (err) {
          toast(err.message || "Invite failed");
        }
      } }, [
        h("label", { class: "field" }, ["Their email", h("input", { type: "email", name: "email", required: true })]),
        h("label", { class: "field" }, ["Relation", h("input", { type: "text", name: "relation", placeholder: "husband, mom, best friend" })]),
        h("label", { class: "field", style: "grid-column: 1 / -1" }, [
          "Role",
          h("select", { name: "role" }, [
            h("option", { value: "partner" }, "Partner / spouse"),
            h("option", { value: "grandparent" }, "Grandparent"),
            h("option", { value: "helper" }, "Friend / helper"),
          ]),
        ]),
        h("fieldset", { class: "field", style: "grid-column: 1 / -1" }, [
          h("legend", {}, "What they can see"),
          h("label", { class: "radio" }, [h("input", { type: "checkbox", name: "can_calendar" }), h("span", {}, "My calendar (appointments + events)")]),
          h("label", { class: "radio" }, [h("input", { type: "checkbox", name: "can_baby" }), h("span", {}, "Baby Year tracker (milestones + photos)")]),
          h("label", { class: "radio" }, [h("input", { type: "checkbox", name: "can_pregnancy" }), h("span", {}, "Pregnancy visits + growth (letters and body-log stay private)")]),
          h("label", { class: "radio" }, [h("input", { type: "checkbox", name: "can_kids" }), h("span", {}, "Kids roster")]),
          h("label", { class: "radio" }, [h("input", { type: "checkbox", name: "can_metime" }), h("span", {}, "My Me-Time streak (summary only — no session text)")]),
          h("label", { class: "radio" }, [h("input", { type: "checkbox", name: "alert_concerning" }), h("span", {}, "Alert them if I'm in crisis (§20 — they only get a content-free 'reach out' ping)")]),
        ]),
        h("fieldset", { class: "field", style: "grid-column: 1 / -1" }, [
          h("legend", {}, "Faith context (partner only — optional)"),
          h("div", { class: "sub", style: "margin-bottom:8px" },
            "Totally optional. If you're inviting your partner, sharing where he is on his faith journey lets the app be a gentler companion for him (never preachy — men's prompts are about strength, fatherhood, and carrying real weight). He can change all of this himself once he signs in."),
          h("label", { class: "field" }, [
            "Is he a Christian?",
            h("select", { name: "faith_status" }, [
              h("option", { value: "unknown" }, "Prefer not to say"),
              h("option", { value: "believer" }, "Yes, practicing"),
              h("option", { value: "lapsed" }, "Used to be / fell away"),
              h("option", { value: "exploring" }, "Open / exploring"),
              h("option", { value: "not" }, "No"),
            ]),
          ]),
          h("label", { class: "field" }, [
            "How often does he go to church?",
            h("select", { name: "church_freq" }, [
              h("option", { value: "unknown" }, "Prefer not to say"),
              h("option", { value: "weekly" }, "Weekly"),
              h("option", { value: "occasional" }, "Sometimes"),
              h("option", { value: "used_to" }, "Used to"),
              h("option", { value: "never" }, "Never"),
            ]),
          ]),
          h("label", { class: "radio" }, [
            h("input", { type: "checkbox", name: "faith_nudges" }),
            h("span", {}, "It's okay to show him occasional scripture (strength, fatherhood, never pushy)"),
          ]),
          h("label", { class: "radio" }, [
            h("input", { type: "checkbox", name: "prayer_ok" }),
            h("span", {}, "It's okay to offer him prayer prompts (he can always skip them)"),
          ]),
        ]),
        h("div", { class: "btn-row", style: "grid-column: 1 / -1" }, [h("button", { class: "btn", type: "submit" }, "Send invite")]),
      ]);
      body.append(form);

      body.append(h("div", { class: "pda-contact" },
        "What stays ALWAYS private: your Brain chat history, prayer journal, gratitude, love notes, financial details, safety flags. Those are never shareable, period."));
    } catch (err) {
      body.innerHTML = "";
      body.append(h("div", { class: "alert bad" }, err.message || "Couldn't load household"));
    }
  })();

  return card;
}

function renderGoogleCard(rerender) {
  const g = googleConnectedState();
  const hasAny = g.connected.drive || g.connected.sheets || g.connected.youtube;

  const card = h("section", { class: "card" }, [
    h("h2", {}, "Google connectors"),
    h("div", { class: "sub" },
      "Connect your Google account once. Then back up your data to Drive, import/export income in Sheets, and upload videos to YouTube — all from inside the app."),
  ]);

  if (!isSupabaseConfigured()) {
    card.append(h("div", { class: "alert" },
      "Connect your account in Settings → Account first. Google sign-in runs through your account."));
    return card;
  }

  // Connection status
  const statusRow = h("div", { class: "form-row two", style: "margin-top:10px" }, [
    h("div", { class: "meta" }, `📂 Drive: ${g.connected.drive ? "✓ connected" : "not connected"}`),
    h("div", { class: "meta" }, `📊 Sheets: ${g.connected.sheets ? "✓ connected" : "not connected"}`),
    h("div", { class: "meta" }, `▶️ YouTube: ${g.connected.youtube ? "✓ connected" : "not connected"}`),
  ]);
  card.append(statusRow);

  // One-tap: connect all three (common path for new users)
  card.append(h("div", { class: "btn-row", style: "margin-top:12px; flex-wrap:wrap; gap:8px" }, [
    h("button", {
      class: "btn",
      onclick: async () => {
        try {
          await connectAllGoogle();
          toast("Redirecting to Google…");
        } catch (err) {
          toast(err.message || "Couldn't connect");
        }
      },
    }, hasAny ? "🔄 Reconnect Google" : "🔵 Connect Google (all)"),
    h("button", {
      class: "btn small secondary",
      onclick: async () => {
        try { await connectDrive(); toast("Redirecting…"); }
        catch (err) { toast(err.message); }
      },
    }, "Drive only"),
    h("button", {
      class: "btn small secondary",
      onclick: async () => {
        try { await connectSheets(); toast("Redirecting…"); }
        catch (err) { toast(err.message); }
      },
    }, "Drive + Sheets"),
    h("button", {
      class: "btn small secondary",
      onclick: async () => {
        try { await connectYouTube(); toast("Redirecting…"); }
        catch (err) { toast(err.message); }
      },
    }, "YouTube only"),
  ]));

  // Actions — only useful after she's connected the relevant scope.
  if (g.connected.drive) {
    card.append(h("div", { style: "margin-top:16px; border-top:1px dashed rgba(0,0,0,0.12); padding-top:12px" }, [
      h("h3", { style: "margin:0 0 6px; font-size:14px" }, "Backup"),
      h("div", { class: "btn-row" }, [
        h("button", {
          class: "btn small",
          onclick: async () => {
            try {
              const file = await backupStateToDrive();
              toast(`Saved to Drive: ${file.name || "backup"}`);
            } catch (err) {
              toast(err.message || "Backup failed — try reconnecting");
            }
          },
        }, "⬆️ Back up to Drive"),
      ]),
    ]));
  }

  if (g.connected.sheets) {
    const sheetUrlInput = h("input", {
      type: "url", placeholder: "Paste Google Sheet URL",
      value: state.google?.sheetUrl || "",
      oninput: (e) => {
        if (!state.google) state.google = {};
        state.google.sheetUrl = e.target.value;
        save();
      },
    });
    card.append(h("div", { style: "margin-top:16px; border-top:1px dashed rgba(0,0,0,0.12); padding-top:12px" }, [
      h("h3", { style: "margin:0 0 6px; font-size:14px" }, "Sheets sync"),
      h("div", { class: "sub" }, "Paste a sheet URL. We'll push deposits + bills to tabs named 'Deposits' and 'Bills'."),
      h("label", { class: "field" }, [sheetUrlInput]),
      h("button", {
        class: "btn small",
        onclick: async () => {
          const u = state.google?.sheetUrl;
          if (!u) { toast("Paste a sheet URL first"); return; }
          try {
            await syncIncomeToSheet(u);
            toast("Synced to Sheets ✓");
          } catch (err) {
            toast(err.message || "Sheet sync failed");
          }
        },
      }, "⬆️ Push income to sheet"),
    ]));
  }

  card.append(h("div", { class: "meta", style: "margin-top:12px" },
    "Heads up: Google access tokens last about an hour. If something fails with \"session expired\", tap Reconnect Google."));

  return card;
}

export function renderSettings(mount, { rerender }) {
  mount.append(renderProfileCard(rerender));
  mount.append(renderBrainCard(rerender));
  mount.append(renderHouseholdCard(rerender));
  mount.append(renderGoogleCard(rerender));
  mount.append(renderSafetyNetCard(rerender));
  mount.append(renderSecurityCard(rerender));
  mount.append(renderInstallCard());
  mount.append(renderDataCard(rerender));
}
