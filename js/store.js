const KEY = "amanda-toolkit:v1";

const defaults = () => ({
  brand: "default",
  profile: {
    firstName: "",
    partnerName: "",
    businessName: "",
    setupDone: false,
    roles: [],
    interests: [],
    enabledTabs: null,
  },
  auth: { pinHash: "", salt: "" },
  brain: {
    provider: "",
    apiKey: "",
    model: "claude-opus-4-7",
    history: [],
    systemExtras: "",
  },
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
  meals: {
    plan: {},
    grocery: [],
    recipes: [],
  },
  habits: {
    seeded: false,
    items: [],           // { id, label, emoji, schedule: 'daily'|'weekly', target, createdAt }
    log: {},             // "habitId:YYYY-MM-DD" → true
  },
  vault: {
    items: [],           // { id, title, category, dataUrl, mime, note, createdAt }
  },
  purchases: {},         // { [itemId]: { unlockedAt } }
  babyYear: {
    milestones: [],      // { id, title, due: "ageMonths:N", completedAt, photoUrl, note }
    seeded: false,
    growthLog: [],       // { id, date, weeks, lbs, oz, inches, notes }
  },
  social: {
    activeView: "profiles",
    profiles: {
      facebook:  { handle: "", url: "" },
      instagram: { handle: "", url: "" },
      tiktok:    { handle: "", url: "" },
    },
    posts: [],
    hashtagSets: [],
  },
  life: {
    activeView: "faith",
    partnerName: "",
    faith: { prayers: [], notes: "" },
    family: { kids: [], events: [], supporters: [] },
    pregnancy: {
      babyName: "",
      dueDate: "",
      lastMenstrualPeriod: "",
      appointments: [],
      kickSessions: [],
      hospitalBag: { seeded: false, items: [] },
      symptoms: [],
      letters: [],
    },
    loveNotes: { seeded: false, notes: [] },
    gratitude: { entries: [] },
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
