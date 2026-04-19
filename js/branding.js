import { state, save } from "./store.js";

const BRANDS = {
  default: {
    title: "Amanda's Toolkit",
    sub: "Five tools. One place.",
    mark: "◆",
    logo: null,
    business: null,
  },
  pda: {
    title: "Premier Dental Academy",
    sub: "Longview, TX · Business Suite",
    mark: "PD",
    logo: "./assets/pda/logo-512.jpg",
    business: {
      name: "Premier Dental Academy of Longview",
      legalName: "Premier Dental Academy of Longview, LLC",
      owner: "Amanda Williams",
      city: "Longview, Texas",
      address: "1405 McCann Rd, Longview, TX 75601",
      phone: "(903) 230-6444",
      phoneAlt: "(903) 913-6444",
      tagline: "Become a Dental Assistant in 14 Weeks",
      blurb: "Hands-on training in Longview, TX. Small classes, real skills, and support from day one.",
      established: "2018",
      program: {
        name: "Registered Dental Assistant (Texas)",
        weeks: 14,
        tuition: 4800,
        promo: 2997,
        weeklyPlan: 175,
        weeklyPlanWeeks: 12,
      },
      hours: [
        { day: "Monday",    open: "8:30 AM", close: "8:00 PM" },
        { day: "Tuesday",   open: "9:00 AM", close: "4:00 PM" },
        { day: "Wednesday", open: "8:30 AM", close: "12:30 PM" },
        { day: "Thursday",  open: "9:00 AM", close: "4:00 PM" },
        { day: "Friday",    open: "8:30 AM", close: "12:30 PM" },
      ],
      social: {
        website: "https://www.premierdentalacademyoflongview.com/",
        facebook: "https://www.facebook.com/premierdentalacademy/",
        instagram: "https://www.instagram.com/premierdentalacademy/",
        youtube: "https://www.youtube.com/@PremierDentalAcademy",
        tiktok: "https://www.tiktok.com/@premierdentalacademy",
      },
    },
  },
};

export function currentBrand() {
  return BRANDS[state.brand] || BRANDS.default;
}

export function applyBrand() {
  const b = currentBrand();
  document.body.dataset.brand = state.brand;
  const titleEl = document.getElementById("brandTitle");
  const subEl = document.getElementById("brandSub");
  const markEl = document.querySelector(".brand-mark");
  if (titleEl) titleEl.textContent = b.title;
  if (subEl) subEl.textContent = b.sub;
  if (markEl) {
    markEl.textContent = "";
    markEl.style.backgroundImage = "";
    if (b.logo) {
      markEl.style.backgroundImage = `url('${b.logo}')`;
      markEl.style.backgroundSize = "cover";
      markEl.style.backgroundPosition = "center";
    } else {
      markEl.textContent = b.mark;
    }
  }
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
