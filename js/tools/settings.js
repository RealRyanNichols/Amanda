import { state, save, resetAll } from "../store.js";
import { h, toast, confirmAction } from "../util.js";
import { ROLES, INTERESTS, setPin, hasPin } from "../auth.js";
import { MODEL_OPTIONS } from "./brain.js";

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
    h("h2", {}, "The Brain (AI assistant)"),
    h("div", { class: "sub" }, "Connect your Anthropic key for a full Claude-powered assistant inside the app. Without a key, the Brain still helps using local search."),
  ]);

  card.append(h("div", { class: "alert " + (hasKey ? "ok" : "warn"), style: "margin-bottom:10px" },
    hasKey
      ? `Claude connected. Using ${brain.model}. Your key stays on this device.`
      : "No Claude key set. The Brain will run in local-only mode."));

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
        class: "btn danger",
        onclick: () => {
          if (!confirmAction("Erase ALL data on this device? This cannot be undone.")) return;
          if (!confirmAction("Really? Everything will be gone.")) return;
          resetAll();
          location.reload();
        },
      }, "Erase everything"),
    ]),
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

export function renderSettings(mount, { rerender }) {
  mount.append(renderProfileCard(rerender));
  mount.append(renderBrainCard(rerender));
  mount.append(renderSecurityCard(rerender));
  mount.append(renderInstallCard());
  mount.append(renderDataCard(rerender));
}
