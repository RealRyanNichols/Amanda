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
import { renderCapture } from "./tools/capture.js";
import { renderMeTime } from "./tools/metime.js";
import { renderAccount } from "./tools/account.js";
import { mountFloatingBrain } from "./floating-brain.js";
import { initPlan, canAccessTab, isPaid, isInTrial, upgradeMessage, tier } from "./plan.js";
import { renderUpgradeWall } from "./tools/upgrade.js";

const TOOLS = {
  dashboard: renderDashboard,
  brain: renderBrain,
  capture: renderCapture,
  calendar: renderCalendar,
  bible: renderBible,
  search: renderSearch,
  habits: renderHabits,
  metime: renderMeTime,
  vault: renderVault,
  babyyear: renderBabyYear,
  store: renderStore,
  account: renderAccount,
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
  initPlan();
  applyBrand();
  initBrandToggle(() => { syncTabVisibility(); render(); });
  wireTabs();
  wireExportImport();
  syncTabVisibility();
  render();
  mountFloatingBrain();
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
  // If this tab is locked for her plan, show an upgrade wall instead of content
  if (!canAccessTab(currentTab)) {
    renderUpgradeWall(mount, currentTab);
    return;
  }
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

function handleStripeReturn() {
  // Stripe Payment Link redirects back with ?stripe_success=1&item=<id>
  // on successful checkout. Unlock the item locally and celebrate.
  // Server-side verification comes with Supabase webhooks (desktop phase);
  // for now we trust the redirect (acceptable for solo-device launch).
  const params = new URLSearchParams(location.search);
  if (params.get("stripe_success") !== "1") return false;
  const itemId = params.get("item");
  if (!itemId) return false;
  if (!state.purchases) state.purchases = {};
  state.purchases[itemId] = { unlockedAt: Date.now(), via: "stripe" };

  // Voice time top-ups: credit the unlocked hours
  let toastMsg = "Payment received — unlocked ✓";
  if (itemId === "voice-1day" || itemId === "voice-3day" || itemId === "voice-week") {
    import("./stripe-config.js").then(({ voiceTopupHours }) => {
      const hours = voiceTopupHours(itemId);
      import("./plan.js").then(({ creditVoiceTopup }) => {
        creditVoiceTopup(hours);
      });
    });
    const days = itemId === "voice-1day" ? "24 hours" : itemId === "voice-3day" ? "3 days" : "7 days";
    toastMsg = `Voice unlimited for ${days} ✓`;
  }
  // Subscription purchases: flip plan tier
  if (itemId === "core-monthly" || itemId === "core-annual") {
    if (!state.plan) state.plan = {};
    state.plan.tier = itemId === "core-annual" ? "core_annual" : "core";
    toastMsg = "Welcome aboard — everything unlocked ✓";
  }
  if (itemId === "brain-pro")   { if (!state.plan) state.plan = {}; state.plan.brainTier = "pro"; }
  if (itemId === "brain-ultra") { if (!state.plan) state.plan = {}; state.plan.brainTier = "ultra"; }

  save();
  // Clean the URL so refresh doesn't re-trigger
  history.replaceState({}, document.title, location.pathname);
  // Show celebration after boot
  setTimeout(() => {
    const toast = document.createElement("div");
    toast.className = "toast show";
    toast.textContent = toastMsg;
    document.body.append(toast);
    setTimeout(() => toast.remove(), 3500);
  }, 500);
  return true;
}

(function boot() {
  // Register service worker for offline + installability (PWA).
  // Fails silently on http://, file://, or unsupported browsers.
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  // Handle any Stripe checkout return before routing
  handleStripeReturn();

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
