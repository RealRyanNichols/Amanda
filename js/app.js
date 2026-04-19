import { state, save, exportJson, importJson } from "./store.js";
import { toast } from "./util.js";
import { applyBrand, initBrandToggle } from "./branding.js";
import { renderWelcome, renderLock, needsOnboarding, hasPin, setPin } from "./auth.js";
import { renderDashboard } from "./tools/dashboard.js";
import { renderIncome } from "./tools/income.js";
import { renderBooking } from "./tools/booking.js";
import { renderCareer } from "./tools/career.js";
import { renderAcademy } from "./tools/academy.js";
import { renderOverload } from "./tools/overload.js";
import { renderFollowup } from "./tools/followup.js";

const TOOLS = {
  dashboard: renderDashboard,
  income: renderIncome,
  booking: renderBooking,
  career: renderCareer,
  academy: renderAcademy,
  overload: renderOverload,
  followup: renderFollowup,
};

let currentTab = "dashboard";

const shellHTML = document.body.innerHTML;

function bootApp() {
  document.body.innerHTML = shellHTML;
  applyBrand();
  initBrandToggle(() => { syncTabVisibility(); render(); });
  wireTabs();
  wireExportImport();
  wireSettings();
  syncTabVisibility();
  render();
}

function syncTabVisibility() {
  const isPda = state.brand === "pda";
  const career = document.querySelector('.tab[data-tab="career"]');
  const academy = document.querySelector('.tab[data-tab="academy"]');
  if (career) career.hidden = isPda;
  if (academy) academy.hidden = !isPda;
  if (isPda && currentTab === "career") currentTab = "academy";
  if (!isPda && currentTab === "academy") currentTab = "career";
}

function render() {
  const mount = document.getElementById("app");
  mount.innerHTML = "";
  const tool = TOOLS[currentTab] || TOOLS.dashboard;
  tool(mount, { rerender: render });
}

function wireTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentTab = btn.dataset.tab;
      document.querySelectorAll(".tab").forEach((b) =>
        b.setAttribute("aria-selected", b === btn ? "true" : "false")
      );
      render();
    });
  });
}

function wireExportImport() {
  document.getElementById("exportBtn").addEventListener("click", () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `amanda-toolkit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Data exported");
  });
  const fileInput = document.getElementById("importFile");
  document.getElementById("importBtn").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      importJson(text);
      applyBrand();
      render();
      toast("Data imported");
    } catch {
      toast("Import failed");
    } finally {
      fileInput.value = "";
    }
  });
}

function wireSettings() {
  const btn = document.getElementById("settingsBtn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
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
  });
}

// Boot flow: onboarding → lock → app.
(function boot() {
  if (needsOnboarding()) {
    renderWelcome(() => {
      bootApp();
    });
    return;
  }
  if (hasPin()) {
    renderLock(() => {
      bootApp();
    });
    return;
  }
  bootApp();
})();

window.addEventListener("storage", () => {
  if (document.getElementById("app")) render();
});

document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
