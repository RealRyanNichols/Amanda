import { state, save, exportJson, importJson } from "./store.js";
import { toast } from "./util.js";
import { applyBrand, initBrandToggle } from "./branding.js";
import { renderIncome } from "./tools/income.js";
import { renderBooking } from "./tools/booking.js";
import { renderCareer } from "./tools/career.js";
import { renderOverload } from "./tools/overload.js";
import { renderFollowup } from "./tools/followup.js";

const TOOLS = {
  income: renderIncome,
  booking: renderBooking,
  career: renderCareer,
  overload: renderOverload,
  followup: renderFollowup,
};

let currentTab = "income";

function render() {
  const mount = document.getElementById("app");
  mount.innerHTML = "";
  const tool = TOOLS[currentTab] || TOOLS.income;
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

applyBrand();
initBrandToggle(render);
wireTabs();
wireExportImport();
render();

window.addEventListener("storage", () => {
  // multi-tab sync: reload state-dependent UI if another tab saved.
  render();
});

// Auto-save on tab hide (belt-and-suspenders — tools save on every change).
document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });
