import { state, save } from "../store.js";
import { h, toast } from "../util.js";
import { currentBrand } from "../branding.js";

const PATHWAYS = {
  "dental-assisting": {
    title: "Dental Assisting",
    summary: "Hands-on clinical role. Short training window, strong job placement.",
    typicalCostLow: 2500,
    typicalCostHigh: 6500,
    weeksToComplete: "10–14 weeks",
    steps: [
      { title: "Enroll", detail: "Apply to a dental-assisting program. Ask about payment plans and financing." },
      { title: "Train", detail: "Complete chairside instruction: instruments, radiology, infection control, charting." },
      { title: "Certify", detail: "Earn Radiology + CPR; prepare for DANB RHS/ICE if required in your state." },
      { title: "Externship", detail: "Practice in a live office. This is often how your first job offer shows up." },
      { title: "Get hired", detail: "Use your program's placement network. Build a one-page resume with clinic hours." },
    ],
  },
  "trucking": {
    title: "CDL Trucking",
    summary: "High-demand. Paid training available through many carriers.",
    typicalCostLow: 3000,
    typicalCostHigh: 9000,
    weeksToComplete: "3–8 weeks",
    steps: [
      { title: "DOT medical", detail: "Pass DOT physical — required before enrollment." },
      { title: "CLP", detail: "Study and pass the Commercial Learner's Permit written test." },
      { title: "School", detail: "Enroll in a CDL school (or a carrier-paid program)." },
      { title: "Skills + road test", detail: "Pre-trip, backing, and on-road exam at the state DMV." },
      { title: "Get hired", detail: "Pick a carrier: OTR, regional, or local. Negotiate tuition reimbursement." },
    ],
  },
  "cosmetology": {
    title: "Cosmetology",
    summary: "Creative, service-based career. Licensing is state-regulated.",
    typicalCostLow: 6000,
    typicalCostHigh: 20000,
    weeksToComplete: "40–60 weeks",
    steps: [
      { title: "Pick a school", detail: "Compare hours required (varies by state) and Title IV aid." },
      { title: "Complete hours", detail: "Mix of theory + clinic floor. Build a portfolio as you go." },
      { title: "State exam", detail: "Pass written + practical licensing exam." },
      { title: "Get licensed", detail: "Apply for your state board license." },
      { title: "Book + build", detail: "Booth rent, salon hire, or mobile. Start with a booking system." },
    ],
  },
  "medical-assisting": {
    title: "Medical Assisting",
    summary: "Front + back office medical role. Widely available, stable demand.",
    typicalCostLow: 3000,
    typicalCostHigh: 12000,
    weeksToComplete: "9 months – 2 years",
    steps: [
      { title: "Enroll", detail: "Choose an accredited program (CAAHEP/ABHES if you want national certification)." },
      { title: "Train", detail: "Clinical skills, EKG, phlebotomy, coding/billing basics." },
      { title: "Externship", detail: "Unpaid hours in a real clinic — often a direct pipeline to a job." },
      { title: "Certify", detail: "Sit for CMA (AAMA) or RMA (AMT) exam." },
      { title: "Get hired", detail: "Apply to clinics, urgent care, specialty practices." },
    ],
  },
  "welding": {
    title: "Welding",
    summary: "Skilled trade. Certifications unlock higher pay tiers.",
    typicalCostLow: 4000,
    typicalCostHigh: 15000,
    weeksToComplete: "6 months – 1 year",
    steps: [
      { title: "Enroll", detail: "Community college or trade school welding program." },
      { title: "Learn processes", detail: "MIG, TIG, Stick, flux-core — pick a specialty." },
      { title: "Certify", detail: "AWS certifications (e.g. D1.1) for structural welding." },
      { title: "Build portfolio", detail: "Photograph test coupons and real projects." },
      { title: "Get hired", detail: "Union, fabrication shops, pipeline, or manufacturing." },
    ],
  },
};

function pathwayKeys() { return Object.keys(PATHWAYS); }

function renderPicker(rerender) {
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Pick a career"),
    h("div", { class: "sub" }, "Step-by-step: Enroll → Train → Certify → Get hired."),
  ]);
  const row = h("div", { class: "chip-row" });
  pathwayKeys().forEach((key) => {
    const p = PATHWAYS[key];
    row.append(
      h("button", {
        class: "chip" + (state.career.selected === key ? " active" : ""),
        onclick: () => { state.career.selected = key; save(); rerender(); },
      }, p.title)
    );
  });
  card.append(row);
  return card;
}

function renderPathway(rerender) {
  const key = state.career.selected;
  const p = PATHWAYS[key];
  if (!p) return h("div", { class: "empty" }, "Pick a career above.");

  const completed = state.career.completedSteps[key] || {};
  const doneCount = p.steps.filter((_, i) => completed[i]).length;
  const pct = Math.round((doneCount / p.steps.length) * 100);

  const card = h("section", { class: "card" }, [
    h("h2", {}, p.title),
    h("div", { class: "sub" }, p.summary),
    h("div", { class: "stat-grid" }, [
      h("div", { class: "stat" }, [
        h("div", { class: "label" }, "Typical cost"),
        h("div", { class: "value" }, `$${p.typicalCostLow.toLocaleString()}–$${p.typicalCostHigh.toLocaleString()}`),
      ]),
      h("div", { class: "stat" }, [
        h("div", { class: "label" }, "Time"),
        h("div", { class: "value" }, p.weeksToComplete),
      ]),
      h("div", { class: "stat ok" }, [
        h("div", { class: "label" }, "Your progress"),
        h("div", { class: "value" }, `${pct}%`),
      ]),
    ]),
    h("div", { class: "progress", style: "margin-top:10px" }, [
      h("span", { style: `width:${pct}%` }),
    ]),
  ]);

  const steps = h("div", { class: "list", style: "margin-top:12px" });
  p.steps.forEach((s, i) => {
    const isDone = !!completed[i];
    steps.append(
      h("div", { class: "item" }, [
        h("div", {}, [
          h("div", { class: "title" }, [`${i + 1}. ${s.title} `,
            isDone ? h("span", { class: "pill paid" }, "done") : h("span", { class: "pill" }, "todo")]),
          h("div", { class: "meta" }, s.detail),
        ]),
        h("div", { class: "actions" }, [
          h("button", {
            class: "btn small " + (isDone ? "secondary" : ""),
            onclick: () => {
              completed[i] = !isDone;
              state.career.completedSteps[key] = completed;
              save();
              if (!isDone && doneCount + 1 === p.steps.length) toast("You did it 🎉");
              rerender();
            },
          }, isDone ? "Undo" : "Mark done"),
        ]),
      ])
    );
  });
  card.append(steps);
  return card;
}

function renderBrandCallout() {
  const b = currentBrand();
  if (!b.business) return null;
  return h("section", { class: "card" }, [
    h("h2", {}, `Local program: ${b.business.name}`),
    h("div", { class: "sub" }, `${b.business.city} · ${b.business.area}`),
    h("p", { style: "margin:0 0 8px" },
      "Interested in dental assisting? Our program gets you from zero to chairside-ready with hands-on training and job-placement support."),
    h("div", { class: "btn-row" }, [
      h("a", { class: "btn", href: "https://www.google.com/search?q=Premier+Dental+Academy+of+Longview", target: "_blank", rel: "noopener" },
        "Find Premier Dental Academy"),
    ]),
  ]);
}

export function renderCareer(mount, { rerender }) {
  mount.append(renderPicker(rerender));
  mount.append(renderPathway(rerender));
  const callout = renderBrandCallout();
  if (callout) mount.append(callout);
}
