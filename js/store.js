const KEY = "amanda-toolkit:v1";

const defaults = () => ({
  brand: "default",
  profile: { firstName: "", businessName: "", setupDone: false },
  auth: { pinHash: "", salt: "" },
  income: { deposits: [], bills: [] },
  booking: { clients: [], appointments: [] },
  career: { selected: "dental-assisting", completedSteps: {} },
  overload: { brainDump: "", tasks: [] },
  followup: { leads: [] },
  academy: {
    activeView: "students",
    programs: [],
    students: [],
    course: { seeded: false, modules: [] },
  },
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw);
    return { ...defaults(), ...parsed };
  } catch {
    return defaults();
  }
}

export const state = load();

export function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function exportJson() {
  return JSON.stringify(state, null, 2);
}

export function importJson(text) {
  const parsed = JSON.parse(text);
  Object.assign(state, { ...defaults(), ...parsed });
  save();
}

export function resetAll() {
  Object.assign(state, defaults());
  save();
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
