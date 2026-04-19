import { state, save, exportJson, importJson } from "./store.js";
import { toast } from "./util.js";
import { applyBrand, initBrandToggle } from "./branding.js";
import { renderWelcome, renderLock, needsOnboarding, hasPin, enabledTabsForProfile } from "./auth.js";
import { renderDashboard } from "./tools/dashboard.js";
import { renderIncome } from "./tools/income.js";
import { renderBooking } from "./tools/booking.js";
import { renderCareer } from "./tools/career.js";
import { renderAcademy } from "./tools/academy.js";
import { renderOverload } from "./tools/overload.js";
import { renderFollowup } from "./tools/followup.js";
import { renderBrain } from "./tools/brain.js";
import { renderSettings } from "./tools/settings.js";
import { renderLife } from "./tools/life.js";
import { renderMeals } from "./tools/meals.js";
import { renderSocial } from "./tools/social.js";
import { renderCalendar } from "./tools/calendar.js";
import { renderBible } from "./tools/bible.js";
import { renderHabits } from "./tools/habits.js";
import { renderBabyYear } from "./tools/baby-year.js";
import { renderSearch } from "./tools/search.js";
import { renderVault } from "./tools/vault.js";
import { renderStore } from "./tools/store.js";

const TOOLS = {
  dashboard: renderDashboard,
  brain: renderBrain,
  calendar: renderCalendar,
  bible: renderBible,
  search: renderSearch,
  habits: renderHabits,
  vault: renderVault,
  babyyear: renderBabyYear,
  store: renderStore,
  income: renderIncome,
  booking: renderBooking,
  career: renderCareer,
  academy: renderAcademy,
  meals: renderMeals,
  overload: renderOverload,
  followup: renderFollowup,
  social: renderSocial,
  life: renderLife,
  settings: renderSettings,
};

let currentTab = "dashboard";

const shellHTML = document.body.innerHTML;

function bootApp() {
  document.body.innerHTML = shellHTML;
  applyBrand();
  initBrandToggle(() => { syncTabVisibility(); render(); });
  wireTabs();
  wireExportImport();
  syncTabVisibility();
  render();
  document.addEventListener("tabs:refresh", syncTabVisibility);
}

function syncTabVisibility() {
  const isPda = state.brand === "pda";
  const enabled = new Set(enabledTabsForProfile(state.profile || {}));
  // Brand rule: PDA hides Career, default hides Academy — keeps white-label clean.
  if (isPda) enabled.delete("career");
  else enabled.delete("academy");

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.hidden = !enabled.has(btn.dataset.tab);
  });

  if (!enabled.has(currentTab)) {
    currentTab = "dashboard";
    document.querySelectorAll(".tab").forEach((b) =>
      b.setAttribute("aria-selected", b.dataset.tab === currentTab ? "true" : "false")
    );
  }
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
      syncTabVisibility();
      render();
      toast("Data imported");
    } catch {
      toast("Import failed");
    } finally {
      fileInput.value = "";
    }
  });
}

(function boot() {
  // Register service worker for offline + installability (PWA).
  // Fails silently on http://, file://, or unsupported browsers.
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  if (needsOnboarding()) {
    renderWelcome(() => { bootApp(); });
    return;
  }
  if (hasPin()) {
    renderLock(() => { bootApp(); });
    return;
  }
  bootApp();
})();

window.addEventListener("storage", () => {
  if (document.getElementById("app")) render();
});

document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
