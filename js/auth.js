import { state, save } from "./store.js";
import { h, toast } from "./util.js";
import { currentBrand } from "./branding.js";

const ROLES = [
  { key: "mom",         label: "Mom",                          tabs: ["life"] },
  { key: "business",    label: "Business owner",               tabs: ["income", "booking", "followup"] },
  { key: "school",      label: "I run a dental-assistant academy", tabs: ["academy"] },
  { key: "student",     label: "I'm exploring a new career",   tabs: ["career"] },
  { key: "pregnant",    label: "Currently pregnant",           tabs: ["life"] },
  { key: "faith",       label: "Faith matters to me",          tabs: ["life"] },
];

const INTERESTS = [
  { key: "money",       label: "Keeping money sane" },
  { key: "time",        label: "Getting time back" },
  { key: "family",      label: "Family first" },
  { key: "growth",      label: "Growing my business" },
  { key: "calm",        label: "Less overwhelm" },
  { key: "encouragement", label: "Daily encouragement" },
];

async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPin(pin, salt) { return sha256(`${salt}:${pin}`); }

export async function setPin(pin) {
  if (!pin) { state.auth.pinHash = ""; state.auth.salt = ""; save(); return; }
  const salt = randomSalt();
  state.auth.salt = salt;
  state.auth.pinHash = await hashPin(pin, salt);
  save();
}

export async function verifyPin(pin) {
  if (!state.auth.pinHash) return true;
  return (await hashPin(pin, state.auth.salt)) === state.auth.pinHash;
}

export function hasPin() { return !!state.auth.pinHash; }
export function needsOnboarding() { return !state.profile?.setupDone; }

// Compute enabled tabs based on the user's roles (if they haven't overridden).
export function enabledTabsForProfile(profile) {
  if (profile.enabledTabs && Array.isArray(profile.enabledTabs)) return profile.enabledTabs;
  const always = ["dashboard", "calendar", "search", "habits", "vault", "overload", "brain", "store", "settings"];
  const tabs = new Set(always);
  const roles = profile.roles || [];

  for (const r of roles) {
    const def = ROLES.find((x) => x.key === r);
    if (def) for (const t of def.tabs) tabs.add(t);
  }
  // Business owner defaults
  if (roles.includes("business") || roles.includes("school")) {
    tabs.add("income"); tabs.add("booking"); tabs.add("followup"); tabs.add("social");
  }
  // Life tab: auto-show if mom / pregnant / faith — otherwise hide unless they want it
  if (roles.includes("mom") || roles.includes("pregnant") || roles.includes("faith")) {
    tabs.add("life");
  }
  // Bible tab: faith-forward
  if (roles.includes("faith")) tabs.add("bible");
  // Baby Year tab: once Thomas is born (pregnant role — they'll keep using it forever)
  if (roles.includes("pregnant") || roles.includes("mom")) tabs.add("babyyear");
  // Meals tab: moms mostly, plus default
  if (roles.includes("mom") || roles.includes("pregnant")) {
    tabs.add("meals");
  }
  // If they didn't pick anything, show a reasonable minimum
  if (roles.length === 0) { tabs.add("life"); tabs.add("income"); tabs.add("meals"); }
  return [...tabs];
}

function brandMark() {
  const b = currentBrand();
  const mark = h("div", { class: "brand-mark auth-mark", style: "margin:0 auto 12px" });
  if (b.logo) {
    mark.style.backgroundImage = `url('${b.logo}')`;
    mark.style.backgroundSize = "cover";
    mark.style.backgroundPosition = "center";
  } else {
    mark.textContent = b.mark;
  }
  return mark;
}

/* ---------- Welcome wizard ---------- */

export function renderWelcome(onDone) {
  document.body.innerHTML = "";
  const draft = {
    firstName: "",
    partnerName: "",
    businessName: "",
    brand: state.brand || "default",
    roles: [],
    interests: [],
    pin: "",
    pin2: "",
  };

  let step = 0;
  const totalSteps = 5;

  const wrap = h("div", { class: "auth-wrap" });
  const card = h("div", { class: "auth-card" });
  wrap.append(card);
  document.body.append(wrap);

  function renderStep() {
    card.innerHTML = "";
    card.append(brandMark());
    card.append(h("div", { class: "wizard-progress" }, [
      h("span", { style: `width:${((step + 1) / totalSteps) * 100}%` }),
    ]));

    if (step === 0) stepIntro();
    else if (step === 1) stepRoles();
    else if (step === 2) stepInterests();
    else if (step === 3) stepBusiness();
    else if (step === 4) stepPin();
  }

  function navRow(back = true, nextLabel = "Next", onNext = () => next()) {
    return h("div", { class: "btn-row", style: "margin-top:14px" }, [
      back && step > 0 ? h("button", { class: "btn secondary", type: "button", onclick: () => { step--; renderStep(); } }, "Back") : null,
      h("button", { class: "btn", type: "button", onclick: onNext }, nextLabel),
    ]);
  }

  function next() { step++; renderStep(); }

  function stepIntro() {
    card.append(h("h1", { class: "auth-title" }, "Welcome"));
    card.append(h("p", { class: "auth-sub" }, "A gentle little home for your business, your family, and your days. Let's tailor it to you."));

    const form = h("form", { class: "auth-form", onsubmit: (e) => { e.preventDefault(); if (!draft.firstName) return toast("Your first name"); next(); } }, [
      h("label", { class: "field" }, [
        "Your first name",
        h("input", { type: "text", required: true, autofocus: true, oninput: (e) => draft.firstName = e.target.value, value: draft.firstName }),
      ]),
      h("label", { class: "field" }, [
        "Partner's name (optional — for love notes etc.)",
        h("input", { type: "text", oninput: (e) => draft.partnerName = e.target.value, value: draft.partnerName }),
      ]),
      navRow(false, "Next →", () => {
        if (!draft.firstName.trim()) return toast("Please enter your name");
        next();
      }),
    ]);
    card.append(form);
  }

  function stepRoles() {
    card.append(h("h1", { class: "auth-title" }, `Hi ${draft.firstName.split(" ")[0]}`));
    card.append(h("p", { class: "auth-sub" }, "Which of these are you? Pick all that apply — it tailors what you'll see."));

    const grid = h("div", { class: "chip-grid" });
    ROLES.forEach((r) => {
      const btn = h("button", {
        class: "chip-big" + (draft.roles.includes(r.key) ? " active" : ""),
        type: "button",
        onclick: () => {
          if (draft.roles.includes(r.key)) draft.roles = draft.roles.filter((x) => x !== r.key);
          else draft.roles.push(r.key);
          btn.classList.toggle("active");
        },
      }, r.label);
      grid.append(btn);
    });
    card.append(grid);
    card.append(navRow(true, "Next →"));
  }

  function stepInterests() {
    card.append(h("h1", { class: "auth-title" }, "What matters most right now?"));
    card.append(h("p", { class: "auth-sub" }, "No wrong answer. We'll use this to set your priorities."));

    const grid = h("div", { class: "chip-grid" });
    INTERESTS.forEach((i) => {
      const btn = h("button", {
        class: "chip-big" + (draft.interests.includes(i.key) ? " active" : ""),
        type: "button",
        onclick: () => {
          if (draft.interests.includes(i.key)) draft.interests = draft.interests.filter((x) => x !== i.key);
          else draft.interests.push(i.key);
          btn.classList.toggle("active");
        },
      }, i.label);
      grid.append(btn);
    });
    card.append(grid);
    card.append(navRow(true, "Next →"));
  }

  function stepBusiness() {
    card.append(h("h1", { class: "auth-title" }, "Your space"));
    card.append(h("p", { class: "auth-sub" }, "If you run a business, we can put your name on it. Otherwise skip."));

    card.append(h("div", { class: "auth-form" }, [
      h("label", { class: "field" }, [
        "Business name (optional)",
        h("input", { type: "text", oninput: (e) => draft.businessName = e.target.value, value: draft.businessName, placeholder: "Premier Dental Academy of Longview" }),
      ]),
      h("fieldset", { class: "field" }, [
        h("legend", {}, "Look & feel"),
        h("label", { class: "radio" }, [
          h("input", { type: "radio", name: "brand", value: "default", checked: draft.brand === "default", onchange: () => draft.brand = "default" }),
          h("span", {}, "Clean default"),
        ]),
        h("label", { class: "radio" }, [
          h("input", { type: "radio", name: "brand", value: "pda", checked: draft.brand === "pda", onchange: () => draft.brand = "pda" }),
          h("span", {}, "Premier Dental Academy branding"),
        ]),
      ]),
      navRow(true, "Next →"),
    ]));
  }

  function stepPin() {
    card.append(h("h1", { class: "auth-title" }, "Protect your data"));
    card.append(h("p", { class: "auth-sub" }, "Optional 4–6 digit PIN. Stays on this device."));

    const form = h("form", { class: "auth-form", onsubmit: async (e) => { e.preventDefault(); await finish(); } }, [
      h("div", { class: "form-row two" }, [
        h("label", { class: "field" }, [
          "PIN",
          h("input", { type: "password", inputmode: "numeric", maxlength: "6", minlength: "4", pattern: "[0-9]{4,6}", placeholder: "optional", oninput: (e) => draft.pin = e.target.value }),
        ]),
        h("label", { class: "field" }, [
          "Confirm",
          h("input", { type: "password", inputmode: "numeric", maxlength: "6", minlength: "4", pattern: "[0-9]{4,6}", placeholder: "optional", oninput: (e) => draft.pin2 = e.target.value }),
        ]),
      ]),
      h("div", { class: "btn-row", style: "margin-top:14px" }, [
        h("button", { class: "btn secondary", type: "button", onclick: () => { step--; renderStep(); } }, "Back"),
        h("button", { class: "btn", type: "submit" }, "Let's go"),
      ]),
    ]);
    card.append(form);
  }

  async function finish() {
    if (draft.pin || draft.pin2) {
      if (draft.pin !== draft.pin2) { toast("PINs don't match"); return; }
      if (!/^\d{4,6}$/.test(draft.pin)) { toast("PIN must be 4–6 digits"); return; }
    }

    state.profile = {
      firstName: draft.firstName.trim(),
      partnerName: draft.partnerName.trim(),
      businessName: draft.businessName.trim(),
      setupDone: true,
      roles: draft.roles,
      interests: draft.interests,
      enabledTabs: null, // computed from roles, overridable in Settings
    };
    state.brand = draft.brand;
    save();
    if (draft.pin) await setPin(draft.pin);
    onDone();
  }

  renderStep();
}

/* ---------- Lock screen ---------- */

export function renderLock(onUnlock) {
  document.body.innerHTML = "";
  const wrap = h("div", { class: "auth-wrap" }, [
    h("div", { class: "auth-card" }, [
      brandMark(),
      h("h1", { class: "auth-title" }, `Hi${state.profile?.firstName ? ", " + state.profile.firstName : ""}`),
      h("p", { class: "auth-sub" }, "Enter your PIN to unlock."),
      renderLockForm(onUnlock),
    ]),
  ]);
  document.body.append(wrap);
}

function renderLockForm(onUnlock) {
  const err = h("div", { class: "auth-error", "aria-live": "polite" });
  const form = h("form", { class: "auth-form", onsubmit: submit }, [
    h("label", { class: "field" }, [
      "PIN",
      h("input", {
        type: "password", name: "pin", required: true, autofocus: true,
        inputmode: "numeric", maxlength: "6", minlength: "4", pattern: "[0-9]{4,6}",
        placeholder: "••••",
      }),
    ]),
    err,
    h("button", { class: "btn", type: "submit", style: "width:100%" }, "Unlock"),
    h("button", { class: "link-btn", type: "button", onclick: forgot }, "Forgot PIN?"),
  ]);

  async function submit(e) {
    e.preventDefault();
    const pin = new FormData(e.target).get("pin").toString();
    const ok = await verifyPin(pin);
    if (!ok) { err.textContent = "That PIN didn't match. Try again."; return; }
    onUnlock();
  }

  function forgot() {
    const ok = window.confirm("To reset the PIN we have to clear it here on this device. Your data stays. Continue?");
    if (!ok) return;
    state.auth.pinHash = ""; state.auth.salt = ""; save();
    onUnlock();
  }

  return form;
}

export { ROLES, INTERESTS };
