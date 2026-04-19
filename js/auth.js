import { state, save } from "./store.js";
import { h, toast } from "./util.js";
import { currentBrand } from "./branding.js";

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

export async function hashPin(pin, salt) {
  return sha256(`${salt}:${pin}`);
}

export async function setPin(pin) {
  if (!pin) {
    state.auth.pinHash = "";
    state.auth.salt = "";
    save();
    return;
  }
  const salt = randomSalt();
  state.auth.salt = salt;
  state.auth.pinHash = await hashPin(pin, salt);
  save();
}

export async function verifyPin(pin) {
  if (!state.auth.pinHash) return true;
  const h = await hashPin(pin, state.auth.salt);
  return h === state.auth.pinHash;
}

export function hasPin() {
  return !!state.auth.pinHash;
}

export function needsOnboarding() {
  return !state.profile?.setupDone;
}

export function renderWelcome(onDone) {
  document.body.innerHTML = "";
  const wrap = h("div", { class: "auth-wrap" }, [
    h("div", { class: "auth-card" }, [
      brandMark(),
      h("h1", { class: "auth-title" }, "Welcome"),
      h("p", { class: "auth-sub" }, "A little setup so this feels like yours."),
      renderWelcomeForm(onDone),
    ]),
  ]);
  document.body.append(wrap);
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

function renderWelcomeForm(onDone) {
  const form = h("form", { class: "auth-form", onsubmit: submit }, [
    h("label", { class: "field" }, [
      "Your first name",
      h("input", { type: "text", name: "firstName", required: true, autofocus: true, placeholder: "Amanda" }),
    ]),
    h("label", { class: "field" }, [
      "Business name (optional)",
      h("input", { type: "text", name: "businessName", placeholder: "Premier Dental Academy of Longview" }),
    ]),
    h("fieldset", { class: "field" }, [
      h("legend", {}, "Look & feel"),
      h("label", { class: "radio" }, [
        h("input", { type: "radio", name: "brand", value: "default", checked: true }),
        h("span", {}, "Clean default — works for any business"),
      ]),
      h("label", { class: "radio" }, [
        h("input", { type: "radio", name: "brand", value: "pda" }),
        h("span", {}, "Premier Dental Academy branding"),
      ]),
    ]),
    h("fieldset", { class: "field" }, [
      h("legend", {}, "Protect your data"),
      h("div", { class: "sub" }, "Optional 4-digit PIN to unlock the app. Stays on this device."),
      h("div", { class: "form-row two" }, [
        h("label", { class: "field" }, [
          "PIN",
          h("input", { type: "password", name: "pin", inputmode: "numeric", maxlength: "6", minlength: "4", pattern: "[0-9]{4,6}", placeholder: "optional" }),
        ]),
        h("label", { class: "field" }, [
          "Confirm",
          h("input", { type: "password", name: "pin2", inputmode: "numeric", maxlength: "6", minlength: "4", pattern: "[0-9]{4,6}", placeholder: "optional" }),
        ]),
      ]),
    ]),
    h("button", { class: "btn", type: "submit", style: "width:100%; margin-top:6px" }, "Let's go"),
  ]);

  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const firstName = (f.get("firstName") || "").toString().trim();
    const businessName = (f.get("businessName") || "").toString().trim();
    const brand = (f.get("brand") || "default").toString();
    const pin = (f.get("pin") || "").toString();
    const pin2 = (f.get("pin2") || "").toString();
    if (pin || pin2) {
      if (pin !== pin2) { toast("PINs don't match"); return; }
      if (!/^\d{4,6}$/.test(pin)) { toast("PIN must be 4–6 digits"); return; }
    }

    state.profile = { firstName, businessName, setupDone: true };
    state.brand = brand;
    save();
    if (pin) await setPin(pin);
    onDone();
  }

  return form;
}

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
    const ok = window.confirm(
      "To reset the PIN we have to clear it here on this device. Your data stays. Continue?"
    );
    if (!ok) return;
    state.auth.pinHash = "";
    state.auth.salt = "";
    save();
    onUnlock();
  }

  return form;
}
