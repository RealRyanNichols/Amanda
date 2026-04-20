// Capture — the magic feature. She takes a photo of a receipt, a bill,
// a check, or a screenshot of something she saw online. Claude's vision
// reads the image, extracts structured data, suggests where it belongs,
// and files it with one tap.
//
// Requires a Claude API key (any tier). Opus 4.7 or Sonnet 4.6 recommended
// for best accuracy. Haiku 4.5 works in a pinch.

import { state, save, uid } from "../store.js";
import { h, toast, confirmAction, friendlyDate, todayISO } from "../util.js";
import { offerNext } from "../next-offer.js";
import { creditTimeSaved } from "../time-saved.js";

const EXPLAIN_TEMPLATES = [
  { key: "auto",       label: "Figure it out" },
  { key: "receipt",    label: "Receipt" },
  { key: "bill",       label: "Bill to pay" },
  { key: "check",      label: "Check / deposit" },
  { key: "business_card", label: "Business card / contact" },
  { key: "meal",       label: "Meal 🍽️" },
  { key: "screenshot", label: "Screenshot (inspiration / to-do)" },
  { key: "document",   label: "Important document (vault)" },
  { key: "other",      label: "Something else (tell us)" },
];

export function renderCapture(mount, { rerender }) {
  const hasKey = !!state.brain?.apiKey;

  const hero = h("section", { class: "card" }, [
    h("h2", {}, "📸 Capture anything"),
    h("div", { class: "sub" }, "Take a photo — receipt, bill, check, screenshot, business card — and I'll read it, tag it, and file it where it belongs."),
  ]);
  mount.append(hero);

  if (!hasKey) {
    mount.append(h("div", { class: "alert warn" },
      "Connect your Claude key in Settings → Brain to use Capture. It needs AI vision to read your photo."));
    return;
  }

  mount.append(renderQuickCapture(rerender));
  mount.append(renderHistory(rerender));
}

function renderQuickCapture(rerender) {
  let pendingDataUrl = "";
  let pendingIntent = "auto";
  let pendingNote = "";

  const card = h("section", { class: "card" }, [
    h("h2", { style: "font-size:14px" }, "What did you just see?"),
    h("div", { class: "sub" }, "Pick a quick type (or 'Figure it out' and I'll guess), then snap the photo."),
  ]);

  const chipRow = h("div", { class: "chip-row", style: "margin-bottom:10px" });
  EXPLAIN_TEMPLATES.forEach((t) => {
    const chip = h("button", {
      class: "chip" + (pendingIntent === t.key ? " active" : ""),
      onclick: () => {
        pendingIntent = t.key;
        chipRow.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
      },
    }, t.label);
    chipRow.append(chip);
  });
  card.append(chipRow);

  const preview = h("div", { class: "vault-preview" });

  card.append(h("label", { class: "field" }, [
    "Optional: one-liner about what this is",
    h("input", {
      type: "text",
      placeholder: "e.g. 'kitchen reno quote from the guy Amber recommended'",
      oninput: (e) => { pendingNote = e.target.value; },
    }),
  ]));

  const photoBtn = h("label", { class: "btn", style: "width:100%; justify-content:center" }, [
    "📷 Take photo or pick from library",
    h("input", {
      type: "file", accept: "image/*", capture: "environment", style: "display:none",
      onchange: async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const dataUrl = await compressImage(file, 1400, 0.78);
          pendingDataUrl = dataUrl;
          preview.innerHTML = "";
          preview.append(h("img", { src: dataUrl, alt: "preview" }));
          processBtn.disabled = false;
        } catch { toast("Couldn't load that photo"); }
        e.target.value = "";
      },
    }),
  ]);
  card.append(photoBtn);
  card.append(preview);

  const processBtn = h("button", {
    class: "btn", disabled: true, style: "width:100%; margin-top:10px",
    onclick: async () => {
      if (!pendingDataUrl) { toast("Take a photo first"); return; }
      processBtn.disabled = true;
      processBtn.textContent = "Reading it…";
      try {
        const result = await analyzeWithClaude(pendingDataUrl, pendingIntent, pendingNote);
        await fileCapture(result, pendingDataUrl, pendingIntent, pendingNote, rerender);
        pendingDataUrl = "";
        preview.innerHTML = "";
        processBtn.disabled = true;
        processBtn.textContent = "Read it + file it";
      } catch (err) {
        toast(err.message || "Couldn't analyze that");
        processBtn.disabled = false;
        processBtn.textContent = "Read it + file it";
      }
    },
  }, "Read it + file it");
  card.append(processBtn);

  return card;
}

async function compressImage(file, maxDim = 1400, quality = 0.78) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const hh = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = hh;
    canvas.getContext("2d").drawImage(img, 0, 0, w, hh);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function analyzeWithClaude(dataUrl, intent, note) {
  const [, base64] = dataUrl.split(",");

  const intentGuidance = {
    auto:         "Figure out what this is yourself.",
    receipt:      "She says this is a RECEIPT. Extract merchant, total, date, line items if readable.",
    bill:         "She says this is a BILL. Extract the billing party, amount due, due date, account number if present.",
    check:        "She says this is a CHECK or deposit. Extract amount, date, source, memo.",
    business_card: "She says this is a BUSINESS CARD. Extract name, role, business, phone, email, website.",
    meal:         "She says this is a MEAL. Describe it appetizingly in one line as 'meal_description' (for her meal log) AND suggest a short Instagram caption in 'caption_draft'. Example meal_description: 'Grilled chicken, sweet potato, broccoli'. Example caption: 'Simple + good. Protein-packed dinner in 25 minutes 🍗'.",
    screenshot:   "She says this is a SCREENSHOT. Summarize what's in it and suggest whether it's a reminder, a task, or inspiration.",
    document:    "She says this is a DOCUMENT for the vault. Extract title, category (ID / Insurance / Medical / Baby / Business / Tax / Car / Other), and any expiration dates.",
    other:       "She said something else. Use the note to figure it out.",
  }[intent] || "Figure out what this is yourself.";

  const system =
    "You are a vision assistant for a mom's business-and-life app. She took a photo. " +
    "Your ONLY job: read the image and return ONE single JSON object with the fields below — no preamble, no explanation. " +
    "If something isn't visible or readable, set the field to null.\n\n" +
    intentGuidance +
    "\n\nReturn strictly this JSON shape:\n" +
    `{
  "kind": "receipt" | "bill" | "deposit" | "contact" | "task" | "document" | "note",
  "summary": "<one short sentence about what this is>",
  "amount": <number or null>,
  "date": "<YYYY-MM-DD or null>",
  "due": "<YYYY-MM-DD or null>",
  "merchant": "<string or null>",
  "account_or_ref": "<string or null>",
  "contact": { "name": "<str|null>", "role": "<str|null>", "business": "<str|null>", "phone": "<str|null>", "email": "<str|null>", "website": "<str|null>" } or null,
  "suggested_destination": "income_deposits" | "income_bills" | "booking" | "followup" | "overload" | "vault" | "meal" | "notes",
  "category": "<e.g. 'rent', 'utilities', 'food', 'supplies', 'medical', 'baby', 'ID', 'Insurance' or null>",
  "meal_description": "<if this is food: one-line meal description, or null>",
  "caption_draft": "<if this is food or photogenic: a short Instagram caption with 2-3 hashtags, or null>",
  "note": "<optional short extraction notes>"
}`;

  const userNote = note?.trim() ? `Her note: "${note.trim()}"` : "";
  const body = {
    model: state.brain.model || "claude-opus-4-7",
    max_tokens: 1500,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
        { type: "text", text: userNote || "Analyze this image and return the JSON." },
      ],
    }],
  };
  if (/opus-4-7|opus-4-6|sonnet-4-6/.test(body.model)) body.thinking = { type: "adaptive" };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": state.brain.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Vision ${res.status}: ${errText.slice(0, 100)}`);
  }
  const data = await res.json();
  const textBlock = (data.content || []).find((b) => b.type === "text");
  const raw = textBlock?.text || "{}";
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  const jsonStr = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
  return JSON.parse(jsonStr);
}

async function fileCapture(result, dataUrl, intent, note, rerender) {
  // Save raw capture event regardless
  if (!state.captures) state.captures = [];
  const record = {
    id: uid(),
    intent,
    note,
    summary: result.summary || "",
    kind: result.kind || "note",
    raw: result,
    photoDataUrl: dataUrl,
    filedTo: result.suggested_destination || null,
    destinationId: null,
    createdAt: Date.now(),
  };
  state.captures.unshift(record);
  // Cap the capture history at 50 items so storage stays sane
  if (state.captures.length > 50) state.captures.length = 50;
  save();

  // Credit her for the time saved vs typing this into 3 different places manually
  creditTimeSaved(5, "Auto-filed capture");

  // File based on suggested destination
  const dest = result.suggested_destination;
  if (dest === "income_bills" && result.amount) {
    const billId = uid();
    state.income.bills.push({
      id: billId,
      name: result.merchant || result.summary || "Captured bill",
      amount: Number(result.amount) || 0,
      due: result.due || "",
      priority: 2,
      paid: false,
      recurring: false,
      fromCaptureId: record.id,
    });
    record.destinationId = billId;
    save();
    toast(`Filed as bill: ${result.merchant || "new bill"}`);
    offerNextForCapture(record, rerender);
  }
  else if (dest === "income_deposits" && result.amount) {
    const depositId = uid();
    state.income.deposits.push({
      id: depositId,
      date: result.date || todayISO(),
      amount: Number(result.amount) || 0,
      source: result.merchant || result.summary || "Captured deposit",
      fromCaptureId: record.id,
    });
    state.income.deposits.sort((a, b) => a.date.localeCompare(b.date));
    record.destinationId = depositId;
    save();
    toast(`Filed as deposit: $${result.amount}`);
    offerNextForCapture(record, rerender);
  }
  else if (dest === "followup" && result.contact?.name) {
    const c = result.contact;
    const leadId = uid();
    state.followup.leads.push({
      id: leadId,
      name: c.name,
      phone: c.phone || "",
      email: c.email || "",
      interest: c.business || c.role || result.summary || "",
      source: "Captured from photo",
      temperature: "warm",
      lastContact: todayISO(),
      nextContact: todayISO(),
      notes: note,
      closed: false,
      outcome: "",
      fromCaptureId: record.id,
    });
    record.destinationId = leadId;
    save();
    toast(`Added lead: ${c.name}`);
    offerNextForCapture(record, rerender);
  }
  else if (dest === "vault") {
    const vaultId = uid();
    if (!state.vault) state.vault = { items: [] };
    state.vault.items.unshift({
      id: vaultId,
      title: result.summary || "Captured document",
      category: result.category || "Other",
      note: note || (result.note || ""),
      dataUrl,
      mime: "image/jpeg",
      createdAt: Date.now(),
      fromCaptureId: record.id,
    });
    record.destinationId = vaultId;
    save();
    toast(`Filed to vault: ${result.summary}`);
    offerNextForCapture(record, rerender);
  }
  else if (dest === "overload") {
    const taskId = uid();
    state.overload.tasks.push({
      id: taskId,
      text: result.summary || "Captured reminder",
      category: "today",
      due: "",
      done: false,
      createdAt: todayISO(),
      fromCaptureId: record.id,
    });
    record.destinationId = taskId;
    save();
    toast("Added as a task");
    offerNextForCapture(record, rerender);
  }
  else if (dest === "meal" || intent === "meal" || result.kind === "meal") {
    const today = todayISO();
    const description = result.meal_description || result.summary || "Logged meal";
    const now = new Date();
    const hour = now.getHours();
    const mealKey = hour < 11 ? "breakfast" : hour < 15 ? "lunch" : hour < 20 ? "dinner" : "snack";
    if (!state.meals) state.meals = { plan: {}, grocery: [], recipes: [] };
    state.meals.plan[`${today}:${mealKey}`] = description;
    record.destinationId = `meal:${today}:${mealKey}`;
    save();
    toast(`Logged ${mealKey}: ${description}`);
    offerNextForCapture(record, rerender);
  }
  else {
    toast(`Saved: ${result.summary || "capture"}`);
    offerNextForCapture(record, rerender);
  }
  rerender();
}

function offerNextForCapture(record, rerender) {
  const r = record.raw || {};
  const isMeal = record.intent === "meal" || r.kind === "meal" || record.filedTo?.startsWith?.("meal");
  const hasCaption = !!(r.caption_draft && r.caption_draft.trim());

  offerNext({
    title: "Filed. Double-dip anywhere?",
    subtitle: record.summary,
    options: [
      // Double-dip: meal photo also becomes a social post
      isMeal && {
        emoji: "📸",
        label: "Also draft as a social post",
        onPick: () => doubleFileSocial(record, r.caption_draft, rerender),
      },
      // Double-dip: any captured photo can become a social post if she wants
      !isMeal && hasCaption && {
        emoji: "📸",
        label: "Also draft as a social post",
        onPick: () => doubleFileSocial(record, r.caption_draft, rerender),
      },
      // Double-dip: receipt also becomes a note in Organize
      record.filedTo === "income_bills" && {
        emoji: "📅",
        label: "Add a 1-day-before reminder",
        onPick: () => {
          const bill = state.income.bills.find((b) => b.id === record.destinationId);
          if (!bill?.due) return toast("No due date to remind on");
          toast("You can download .ics from the bill row → + Cal");
        },
      },
      record.filedTo === "followup" && {
        emoji: "🔥",
        label: "Mark this lead hot",
        onPick: () => {
          const lead = state.followup.leads.find((l) => l.id === record.destinationId);
          if (lead) { lead.temperature = "hot"; save(); toast("Marked hot"); rerender(); }
        },
      },
      record.filedTo === "followup" && {
        emoji: "💌",
        label: "Also send them a quick thank-you text",
        onPick: () => {
          const lead = state.followup.leads.find((l) => l.id === record.destinationId);
          if (lead?.phone) {
            const msg = `Hey ${lead.name.split(" ")[0]}, great meeting you. I saved your info. Let's keep in touch!`;
            window.location.href = `sms:${lead.phone}?&body=${encodeURIComponent(msg)}`;
          } else toast("No phone on file");
        },
      },
      {
        emoji: "↩️",
        label: "Refile somewhere else",
        onPick: () => reassign(record, rerender),
      },
      {
        emoji: "🗑",
        label: "That's wrong — undo",
        onPick: () => undoCapture(record, rerender),
      },
    ].filter(Boolean),
  });
}

function doubleFileSocial(record, captionDraft, rerender) {
  if (!state.social) state.social = { profiles: {}, posts: [], hashtagSets: [] };
  const postId = uid();
  state.social.posts.unshift({
    id: postId,
    body: captionDraft || record.summary || "",
    platforms: ["instagram"],
    status: "draft",
    scheduledFor: "",
    photoDataUrl: record.photoDataUrl,
    createdAt: Date.now(),
    fromCaptureId: record.id,
  });
  save();
  toast("Drafted as social post — edit in Social tab");
  rerender();
}

function reassign(record, rerender) {
  const options = ["income_bills","income_deposits","followup","vault","overload","notes"];
  const pick = prompt(`Refile to which? Options: ${options.join(", ")}`, record.filedTo || "notes");
  if (!pick) return;
  undoCapture(record, rerender, { silent: true });
  // Re-run file with the picked destination
  const modified = { ...record.raw, suggested_destination: pick };
  fileCapture(modified, record.photoDataUrl, record.intent, record.note, rerender);
}

function undoCapture(record, rerender, opts = {}) {
  if (record.filedTo === "income_bills") state.income.bills = state.income.bills.filter((x) => x.id !== record.destinationId);
  else if (record.filedTo === "income_deposits") state.income.deposits = state.income.deposits.filter((x) => x.id !== record.destinationId);
  else if (record.filedTo === "followup") state.followup.leads = state.followup.leads.filter((x) => x.id !== record.destinationId);
  else if (record.filedTo === "vault") state.vault.items = state.vault.items.filter((x) => x.id !== record.destinationId);
  else if (record.filedTo === "overload") state.overload.tasks = state.overload.tasks.filter((x) => x.id !== record.destinationId);
  state.captures = (state.captures || []).filter((x) => x.id !== record.id);
  save();
  if (!opts.silent) toast("Removed");
  rerender();
}

function renderHistory(rerender) {
  const items = state.captures || [];
  if (!items.length) return h("span");
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Recent captures"),
    h("div", { class: "sub" }, "Last 50 things you filed via photo."),
  ]);
  const list = h("div", { class: "list" });
  items.forEach((c) => {
    list.append(h("div", { class: "item" }, [
      h("img", { src: c.photoDataUrl, class: "capture-thumb", alt: "captured image" }),
      h("div", { style: "flex:1; min-width:0" }, [
        h("div", { class: "title" }, c.summary || "Capture"),
        h("div", { class: "meta" }, `${c.kind || "?"} · ${friendlyDate(new Date(c.createdAt).toISOString().slice(0, 10))}${c.filedTo ? " · filed to " + c.filedTo.replace(/_/g, " ") : ""}`),
      ]),
      h("button", {
        class: "btn small danger",
        onclick: () => {
          if (!confirmAction("Remove this capture and its filed record?")) return;
          undoCapture(c, rerender);
        },
      }, "×"),
    ]));
  });
  card.append(list);
  return card;
}
