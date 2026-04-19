import { state, save } from "./store.js";

const BRANDS = {
  default: {
    title: "Amanda's Toolkit",
    sub: "Five tools. One place.",
    mark: "◆",
    business: null,
  },
  pda: {
    title: "Premier Dental Academy",
    sub: "Longview, TX · Business Suite",
    mark: "PD",
    business: {
      name: "Premier Dental Academy of Longview",
      owner: "Amanda Williams",
      city: "Longview, Texas",
      area: "Gilmer Road",
    },
  },
};

export function currentBrand() {
  return BRANDS[state.brand] || BRANDS.default;
}

export function applyBrand() {
  const b = currentBrand();
  document.body.dataset.brand = state.brand;
  document.getElementById("brandTitle").textContent = b.title;
  document.getElementById("brandSub").textContent = b.sub;
  document.querySelector(".brand-mark").textContent = b.mark;
  const toggle = document.getElementById("brandToggle");
  if (toggle) toggle.checked = state.brand === "pda";
}

export function initBrandToggle(rerender) {
  const toggle = document.getElementById("brandToggle");
  toggle.addEventListener("change", () => {
    state.brand = toggle.checked ? "pda" : "default";
    save();
    applyBrand();
    rerender();
  });
}
