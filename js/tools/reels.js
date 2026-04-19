// Reel Studio — client-side slideshow/collage maker.
//
// Why we built this instead of embedding CapCut:
//   CapCut has no public web SDK. Their "Open Platform" only lets you build
//   plugins that run INSIDE CapCut (the opposite of what we need). Their
//   mobile SDK is for native iOS/Android apps, not browser PWAs. And CapCut's
//   auth is not OAuth-embeddable — you can't "log into CapCut from our site"
//   via Facebook/TikTok/Instagram because they don't expose that flow.
//
// What we do instead — realistic and shippable today:
//   1) Upload photos (baby, family, anything). Stored as object URLs only;
//      NEVER uploaded to a server unless she explicitly exports + shares.
//   2) Pick a template (Baby month, Pregnancy countdown, Family collage,
//      Business highlight reel).
//   3) Render a preview on <canvas>. For the MVP we generate a still-image
//      collage (instant, zero dependencies). The MediaRecorder path (stills
//      → .webm video with Ken-Burns pans) lands next — gated behind a
//      "Generate reel" button so we don't burn battery by default.
//   4) Share via Web Share API (native share sheet on iOS/Android) straight
//      to IG / TikTok / Messages / wherever she wants.
//   5) "Open in CapCut" hand-off: deep-links to the CapCut app with the
//      images in the share sheet if she wants to do finishing touches there.
//
// Future (tracked in DESKTOP_HANDOFF): music library, captions, stickers,
// beat-sync. All possible with Canvas + WebAudio. No vendor lock-in.

import { state, save, uid } from "../store.js";
import { h, toast } from "../util.js";

const TEMPLATES = [
  {
    key: "baby-month",
    label: "Baby month milestone",
    caption: "Month {n} with our boy 💙",
    minPhotos: 1,
    bg: "#fde8f0",
    accent: "#d53f8c",
  },
  {
    key: "preg-countdown",
    label: "Pregnancy countdown",
    caption: "{weeks} weeks down. Can't wait to meet you.",
    minPhotos: 1,
    bg: "#fef3e6",
    accent: "#c48840",
  },
  {
    key: "family-collage",
    label: "Family collage",
    caption: "These people. Every day.",
    minPhotos: 3,
    bg: "#eaf6f2",
    accent: "#2f855a",
  },
  {
    key: "business-highlight",
    label: "Business highlight reel",
    caption: "{business} — booking now.",
    minPhotos: 2,
    bg: "#eef2ff",
    accent: "#4c51bf",
  },
];

function reelsState() {
  if (!state.reels) state.reels = { photos: [], templateKey: "baby-month", caption: "" };
  if (!state.reels.photos) state.reels.photos = [];
  return state.reels;
}

function fillTemplate(tpl, vars) {
  return (tpl || "").replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function templateVars() {
  const p = state.life?.pregnancy;
  let weeks = "";
  if (p?.dueDate) {
    const due = new Date(p.dueDate + "T00:00:00");
    const conception = new Date(due.getTime() - 280 * 86400000);
    weeks = Math.max(0, Math.floor((Date.now() - conception) / (7 * 86400000)));
  }
  return {
    weeks,
    n: state.babyYear?.currentMonth || 1,
    business: state.profile?.businessName || "Your business",
  };
}

/* ---------- Canvas renderer ---------- */

// Draw a 1080x1350 (IG portrait) collage onto the canvas. For 1 photo it's
// a single crop with caption bar. For 3+ it's a grid. Instant, synchronous.
async function renderCollage(canvas, photos, template, caption) {
  const W = 1080, H = 1350;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = template.bg;
  ctx.fillRect(0, 0, W, H);

  const imgs = await Promise.all(photos.map(loadImage));
  const valid = imgs.filter(Boolean);
  if (valid.length === 0) {
    ctx.fillStyle = "#999";
    ctx.font = "32px -apple-system, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Upload photos to preview", W / 2, H / 2);
    return;
  }

  const padding = 32;
  const captionH = 180;
  const photoArea = { x: padding, y: padding, w: W - padding * 2, h: H - captionH - padding * 2 };

  if (valid.length === 1) {
    drawCover(ctx, valid[0], photoArea.x, photoArea.y, photoArea.w, photoArea.h);
  } else if (valid.length === 2) {
    const gap = 16;
    const cellH = (photoArea.h - gap) / 2;
    drawCover(ctx, valid[0], photoArea.x, photoArea.y, photoArea.w, cellH);
    drawCover(ctx, valid[1], photoArea.x, photoArea.y + cellH + gap, photoArea.w, cellH);
  } else {
    const gap = 16;
    const cols = 2;
    const rows = Math.ceil(valid.length / cols);
    const cellW = (photoArea.w - gap * (cols - 1)) / cols;
    const cellH = (photoArea.h - gap * (rows - 1)) / rows;
    valid.slice(0, 6).forEach((img, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      drawCover(ctx, img,
        photoArea.x + c * (cellW + gap),
        photoArea.y + r * (cellH + gap),
        cellW, cellH);
    });
  }

  // Caption bar
  ctx.fillStyle = template.accent;
  ctx.fillRect(0, H - captionH, W, captionH);
  ctx.fillStyle = "#fff";
  ctx.font = "600 56px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const text = caption || fillTemplate(template.caption, templateVars());
  wrapText(ctx, text, W / 2, H - captionH / 2, W - 80, 64);
}

function loadImage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// Draw img into rect, cover-fit (center-crop), rounded corners.
function drawCover(ctx, img, x, y, w, h) {
  const r = 20;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.clip();

  const ratio = Math.max(w / img.width, h / img.height);
  const dw = img.width * ratio, dh = img.height * ratio;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = (text || "").split(" ");
  const lines = [];
  let cur = "";
  words.forEach((w) => {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  });
  if (cur) lines.push(cur);
  const startY = y - ((lines.length - 1) * lineH) / 2;
  lines.forEach((ln, i) => ctx.fillText(ln, x, startY + i * lineH));
}

/* ---------- UI ---------- */

export function renderReels(rerender) {
  const r = reelsState();
  const tpl = TEMPLATES.find((t) => t.key === r.templateKey) || TEMPLATES[0];
  const wrap = h("div");

  wrap.append(h("section", { class: "card" }, [
    h("h2", {}, "Reel Studio"),
    h("div", { class: "sub" },
      "Drop in photos. Pick a template. We'll make a shareable still right here — no app switch. (Video reels coming next.)"),
  ]));

  // Template picker
  const tplGrid = h("div", { class: "chip-row", style: "flex-wrap:wrap" });
  TEMPLATES.forEach((t) => {
    tplGrid.append(h("button", {
      class: "chip" + (t.key === r.templateKey ? " active" : ""),
      onclick: () => { r.templateKey = t.key; save(); rerender(); },
    }, t.label));
  });
  wrap.append(h("section", { class: "card" }, [
    h("h2", { style: "font-size:14px" }, "Template"),
    tplGrid,
  ]));

  // Upload
  const fileInput = h("input", {
    type: "file", accept: "image/*", multiple: true,
    style: "display:none",
    onchange: async (e) => {
      const files = Array.from(e.target.files || []);
      for (const f of files) {
        const dataUrl = await fileToDataUrl(f);
        r.photos.push({ id: uid(), dataUrl, name: f.name });
      }
      save();
      rerender();
      e.target.value = "";
    },
  });
  const thumbs = h("div", { class: "reel-thumbs" });
  r.photos.forEach((p) => {
    thumbs.append(h("div", { class: "reel-thumb" }, [
      h("img", { src: p.dataUrl, alt: p.name }),
      h("button", {
        class: "btn tiny danger",
        onclick: () => {
          r.photos = r.photos.filter((x) => x.id !== p.id);
          save(); rerender();
        },
      }, "×"),
    ]));
  });

  wrap.append(h("section", { class: "card" }, [
    h("h2", { style: "font-size:14px" }, "Photos"),
    fileInput,
    h("button", {
      class: "btn secondary",
      onclick: () => fileInput.click(),
    }, r.photos.length ? "+ Add more" : "+ Upload photos"),
    r.photos.length > 0 && thumbs,
    r.photos.length > 0 && h("button", {
      class: "btn tiny secondary", style: "margin-top:8px",
      onclick: () => {
        if (!confirm("Remove all photos?")) return;
        r.photos = []; save(); rerender();
      },
    }, "Clear all"),
  ]));

  // Caption
  wrap.append(h("section", { class: "card" }, [
    h("h2", { style: "font-size:14px" }, "Caption"),
    h("div", { class: "sub" }, `Default: "${fillTemplate(tpl.caption, templateVars())}"`),
    h("label", { class: "field" }, [
      h("textarea", {
        rows: 2,
        placeholder: "Write your own, or leave blank to use the default",
        oninput: (e) => { r.caption = e.target.value; save(); },
      }, r.caption || ""),
    ]),
  ]));

  // Preview + actions
  const canvas = h("canvas", { class: "reel-canvas" });
  const previewCard = h("section", { class: "card" }, [
    h("h2", { style: "font-size:14px" }, "Preview"),
    canvas,
    h("div", { class: "btn-row", style: "margin-top:12px; flex-wrap:wrap; gap:8px" }, [
      h("button", {
        class: "btn",
        onclick: () => renderCollage(canvas, r.photos.map((p) => p.dataUrl), tpl, r.caption),
      }, "🔁 Refresh preview"),
      h("button", {
        class: "btn",
        onclick: () => downloadCanvas(canvas, tpl.key),
      }, "⬇ Download"),
      h("button", {
        class: "btn secondary",
        onclick: () => shareCanvas(canvas, tpl, r.caption),
      }, "📤 Share"),
      h("button", {
        class: "btn ghost",
        onclick: () => openInCapcut(r.photos),
      }, "Open in CapCut →"),
    ]),
    h("div", { class: "sub", style: "margin-top:10px" },
      "CapCut doesn't offer a web embed (we checked their SDK — it's mobile-only and plugins run inside their app, not ours). \"Open in CapCut\" hands your photos to the CapCut app via your phone's share sheet."),
  ]);
  wrap.append(previewCard);

  // Render the preview after mount
  setTimeout(() => renderCollage(canvas, r.photos.map((p) => p.dataUrl), tpl, r.caption), 0);

  return wrap;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = () => resolve(rd.result);
    rd.onerror = reject;
    rd.readAsDataURL(file);
  });
}

function downloadCanvas(canvas, key) {
  canvas.toBlob((blob) => {
    if (!blob) { toast("Couldn't export"); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${key}-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Saved 📸");
  }, "image/png");
}

async function shareCanvas(canvas, tpl, captionOverride) {
  if (!navigator.share) {
    downloadCanvas(canvas, tpl.key);
    toast("Share sheet not supported — downloaded instead");
    return;
  }
  canvas.toBlob(async (blob) => {
    if (!blob) return;
    const file = new File([blob], `${tpl.key}.png`, { type: "image/png" });
    const text = captionOverride || fillTemplate(tpl.caption, templateVars());
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else {
        await navigator.share({ text });
      }
    } catch {
      // user cancelled — no-op
    }
  }, "image/png");
}

// CapCut deep link: on mobile, this opens the CapCut app if installed.
// We can't pass images via URL, so we share them via the system share sheet
// first; CapCut shows up as a share target if the user has it installed.
async function openInCapcut(photos) {
  if (!photos.length) { toast("Upload photos first"); return; }
  if (!navigator.share) {
    toast("Install CapCut, then use Share from your photos");
    return;
  }
  const files = await Promise.all(photos.map(async (p) => {
    const blob = await (await fetch(p.dataUrl)).blob();
    return new File([blob], p.name || "photo.png", { type: blob.type });
  }));
  try {
    if (navigator.canShare && navigator.canShare({ files })) {
      await navigator.share({ files, text: "Edit with CapCut" });
    } else {
      toast("Your device can't share files directly — try Download then open CapCut");
    }
  } catch { /* cancelled */ }
}
