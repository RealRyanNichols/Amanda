// Share utilities — open the right compose flow for each platform.
//
// Honest status of platform share APIs (as of 2026-04):
//   X         — intent URL works. Pre-fills text (+ optional url).
//   Facebook  — sharer.php works for URLs. Text pre-fill was removed
//               years ago by Meta; we can still pass the URL, FB will
//               scrape OG tags for preview text. Text is copied to
//               clipboard as a fallback so she can paste it in.
//   LinkedIn  — share-offsite works. Title + summary fill automatically
//               from OG tags on the shared URL.
//   WhatsApp  — wa.me intent works. Text + URL concatenated.
//   SMS       — sms: URI works on mobile.
//   Email     — mailto: works everywhere.
//   Instagram — NO web compose intent exists. Must use:
//               (a) Web Share API (native mobile share sheet), or
//               (b) download image + copy caption + prompt to paste in app.
//   TikTok    — same as Instagram. No web compose intent.
//
// Therefore: on mobile we prefer Web Share API (one tap to system share
// sheet, which lists EVERY installed app including IG/TikTok/CapCut).
// On desktop we fall back to per-platform intent URLs and clipboard copy.

const INTENT_URLS = {
  x: ({ text, url }) => {
    const params = new URLSearchParams();
    if (text) params.set("text", text);
    if (url) params.set("url", url);
    return `https://x.com/intent/post?${params.toString()}`;
  },
  facebook: ({ url }) => {
    // FB removed the text pre-fill (`quote`) param. URL only.
    const params = new URLSearchParams();
    params.set("u", url || location.href);
    return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`;
  },
  linkedin: ({ url }) => {
    // LinkedIn builds the preview from the target URL's OG tags.
    const params = new URLSearchParams();
    params.set("url", url || location.href);
    return `https://www.linkedin.com/sharing/share-offsite/?${params.toString()}`;
  },
  whatsapp: ({ text, url }) => {
    const msg = [text, url].filter(Boolean).join(" ");
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  },
  sms: ({ text, url }) => {
    const msg = [text, url].filter(Boolean).join(" ");
    return `sms:?&body=${encodeURIComponent(msg)}`;
  },
  email: ({ text, url, title }) => {
    const subject = title || "Thought I'd share this";
    const body = [text, url].filter(Boolean).join("\n\n");
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  },
};

// Try Web Share API first — if she's on mobile and has the apps
// installed, this is the cleanest path and lists IG, TikTok, CapCut, etc.
export async function shareNative(payload = {}) {
  if (!navigator.share) return false;
  try {
    const out = { text: payload.text, url: payload.url, title: payload.title };
    if (payload.files && payload.files.length) {
      if (navigator.canShare && navigator.canShare({ files: payload.files })) {
        out.files = payload.files;
      }
    }
    await navigator.share(out);
    return true;
  } catch {
    // User dismissed or share failed — caller can fall back to intent URLs.
    return false;
  }
}

export function openIntent(platform, payload = {}) {
  const fn = INTENT_URLS[platform];
  if (!fn) return false;
  const url = fn(payload);
  // New tab on desktop; same-context location change on mobile Safari works fine.
  window.open(url, "_blank", "noopener");
  return true;
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Render a bottom-sheet share chooser with every viable platform.
// Caller passes { text, url, files, title } — anything supported by the
// relevant platform is used automatically.
export function shareSheet({ text = "", url = "", files = null, title = "" }) {
  // Remove any existing sheet so we don't stack them.
  document.querySelectorAll(".share-sheet-backdrop").forEach((el) => el.remove());

  const backdrop = document.createElement("div");
  backdrop.className = "share-sheet-backdrop";
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.remove();
  });

  const sheet = document.createElement("div");
  sheet.className = "share-sheet";

  const header = document.createElement("div");
  header.className = "share-sheet-header";
  header.textContent = "Share to…";
  sheet.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "share-sheet-grid";

  const options = [
    // Native share first — one tap to system share sheet (IG/TikTok/CapCut live here)
    navigator.share && {
      emoji: "📱", label: "Phone share sheet",
      click: async () => {
        await shareNative({ text, url, title, files });
        backdrop.remove();
      },
    },
    { emoji: "✖️", label: "X",        click: () => { openIntent("x",        { text, url }); backdrop.remove(); } },
    { emoji: "📘", label: "Facebook", click: () => { openIntent("facebook", { url }); copyToClipboard(text); backdrop.remove(); } },
    { emoji: "💼", label: "LinkedIn", click: () => { openIntent("linkedin", { url }); backdrop.remove(); } },
    { emoji: "💬", label: "WhatsApp", click: () => { openIntent("whatsapp", { text, url }); backdrop.remove(); } },
    { emoji: "📩", label: "Text",     click: () => { openIntent("sms",      { text, url }); backdrop.remove(); } },
    { emoji: "✉️", label: "Email",    click: () => { openIntent("email",    { text, url, title }); backdrop.remove(); } },
    { emoji: "📋", label: "Copy text",
      click: async () => {
        const ok = await copyToClipboard([text, url].filter(Boolean).join("\n"));
        backdrop.remove();
        if (ok) toastMsg("Copied — paste anywhere");
      },
    },
  ].filter(Boolean);

  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "share-option";
    btn.innerHTML = `<span class="share-emoji">${opt.emoji}</span><span class="share-label">${opt.label}</span>`;
    btn.addEventListener("click", opt.click);
    grid.appendChild(btn);
  });

  sheet.appendChild(grid);

  // IG + TikTok note — they have no web compose intent; be upfront.
  if (!navigator.share) {
    const note = document.createElement("div");
    note.className = "share-sheet-note";
    note.textContent = "Instagram and TikTok don't offer a web compose link. On your phone, use the Phone share sheet button above — IG and TikTok appear there.";
    sheet.appendChild(note);
  }

  const cancel = document.createElement("button");
  cancel.className = "share-cancel";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => backdrop.remove());
  sheet.appendChild(cancel);

  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);
}

function toastMsg(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1800);
}

// Convenience: one-tap share that prefers native share sheet, falls back
// to the multi-platform chooser. Great for tiny "Share" buttons that
// don't need a full modal every time.
export async function quickShare(payload) {
  const ok = await shareNative(payload);
  if (!ok) shareSheet(payload);
}
