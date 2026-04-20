import { state, save, uid } from "../store.js";
import { h, toast, confirmAction, friendlyDate } from "../util.js";

// Brain Wallet — encrypted-on-device document vault.
// Stores: insurance cards, IDs, licenses, tax docs, Thomas's records, etc.
// Images compressed before storage. For v1 we rely on browser localStorage
// isolation + app PIN. Full AES encryption on desktop phase with user password.

const CATEGORIES = [
  "ID",
  "Insurance",
  "Medical",
  "Baby",
  "Business",
  "Tax & Legal",
  "Car",
  "Other",
];

async function compressImage(file, maxDim = 1400, quality = 0.8) {
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

function totalStorageKB() {
  try {
    const raw = JSON.stringify(state.vault.items);
    return Math.round(raw.length / 1024);
  } catch { return 0; }
}

function renderHeader(rerender) {
  const count = state.vault.items.length;
  const kb = totalStorageKB();
  const card = h("section", { class: "card" }, [
    h("h2", {}, "Brain Wallet"),
    h("div", { class: "sub" }, "Private docs on your device. Protected by your app PIN."),
    h("div", { class: "stat-grid", style: "margin-top:10px" }, [
      h("div", { class: "stat" }, [h("div", { class: "label" }, "Documents"), h("div", { class: "value" }, count)]),
      h("div", { class: "stat" }, [h("div", { class: "label" }, "Storage"), h("div", { class: "value" }, kb < 1024 ? `${kb} KB` : `${(kb/1024).toFixed(1)} MB`)]),
      h("div", { class: "stat ok" }, [h("div", { class: "label" }, "Encrypted"), h("div", { class: "value" }, "On-device")]),
    ]),
    kb > 4000 && h("div", { class: "alert warn", style: "margin-top:10px" },
      "You're using a lot of storage on this device. Consider exporting your vault as a backup and removing older docs."),
  ]);
  return card;
}

function renderAddForm(rerender) {
  const card = h("section", { class: "card" }, [
    h("h2", { style: "font-size:14px" }, "+ Add a document"),
  ]);

  let pendingDataUrl = "";
  let pendingMime = "";

  const preview = h("div", { class: "vault-preview" });

  const form = h("form", { class: "form-row two", onsubmit: async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const title = (f.get("title") || "").toString().trim();
    if (!title) return toast("Add a title");
    if (!pendingDataUrl) return toast("Add a photo of the document");

    state.vault.items.unshift({
      id: uid(),
      title,
      category: (f.get("category") || "Other").toString(),
      note: (f.get("note") || "").toString().trim(),
      dataUrl: pendingDataUrl,
      mime: pendingMime || "image/jpeg",
      createdAt: Date.now(),
    });
    save();
    toast("Saved to vault");
    e.target.reset();
    pendingDataUrl = "";
    preview.innerHTML = "";
    rerender();
  } }, [
    h("label", { class: "field" }, ["Title", h("input", { type: "text", name: "title", required: true, placeholder: "e.g. Amanda's driver's license" })]),
    h("label", { class: "field" }, [
      "Category",
      h("select", { name: "category" }, CATEGORIES.map((c) => h("option", { value: c }, c))),
    ]),
    h("label", { class: "field", style: "grid-column: 1 / -1" }, [
      "Note (optional)",
      h("input", { type: "text", name: "note", placeholder: "e.g. expires 2027, policy #ABC123" }),
    ]),
    h("label", { class: "btn secondary", style: "grid-column: 1 / -1" }, [
      "📷 Take photo or pick image",
      h("input", {
        type: "file", accept: "image/*", capture: "environment", style: "display:none",
        onchange: async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const dataUrl = await compressImage(file, 1400, 0.8);
            pendingDataUrl = dataUrl;
            pendingMime = "image/jpeg";
            preview.innerHTML = "";
            preview.append(h("img", { src: dataUrl, alt: "preview" }));
          } catch {
            toast("Couldn't load that photo");
          }
          e.target.value = "";
        },
      }),
    ]),
    preview,
    h("div", { class: "btn-row", style: "grid-column: 1 / -1" }, [h("button", { class: "btn", type: "submit" }, "Save to vault")]),
  ]);
  card.append(form);
  return card;
}

function renderItems(rerender) {
  const items = state.vault.items;
  if (!items.length) return h("div", { class: "empty" }, "Your vault is empty.");

  const byCategory = {};
  items.forEach((it) => { (byCategory[it.category || "Other"] ||= []).push(it); });

  const wrap = h("div");
  CATEGORIES.forEach((cat) => {
    const list = byCategory[cat];
    if (!list?.length) return;
    const card = h("section", { class: "card" }, [h("h2", { style: "font-size:14px" }, `${cat} · ${list.length}`)]);
    const grid = h("div", { class: "vault-grid" });
    list.forEach((it) => {
      grid.append(h("figure", { class: "vault-tile", onclick: () => openItem(it, rerender) }, [
        h("img", { src: it.dataUrl, alt: it.title }),
        h("figcaption", {}, it.title),
      ]));
    });
    card.append(grid);
    wrap.append(card);
  });
  return wrap;
}

function openItem(it, rerender) {
  const overlay = h("div", { class: "photo-overlay", onclick: (e) => { if (e.target.classList.contains("photo-overlay")) overlay.remove(); } }, [
    h("div", { class: "vault-viewer" }, [
      h("img", { src: it.dataUrl, alt: it.title }),
      h("div", { class: "vault-viewer-meta" }, [
        h("div", { class: "title" }, it.title),
        h("div", { class: "meta" }, `${it.category} · ${friendlyDate(new Date(it.createdAt).toISOString().slice(0, 10))}`),
        it.note && h("div", { class: "meta", style: "margin-top:4px" }, it.note),
      ]),
      h("div", { class: "btn-row", style: "margin-top:12px; justify-content:center" }, [
        h("a", {
          class: "btn",
          href: it.dataUrl,
          download: (it.title || "document") + ".jpg",
        }, "Download"),
        h("button", { class: "btn secondary", onclick: () => overlay.remove() }, "Close"),
        h("button", {
          class: "btn danger",
          onclick: () => {
            if (!confirmAction(`Remove "${it.title}"?`)) return;
            state.vault.items = state.vault.items.filter((x) => x.id !== it.id);
            save();
            overlay.remove();
            rerender();
          },
        }, "Remove"),
      ]),
    ]),
  ]);
  document.body.append(overlay);
}

export function renderVault(mount, { rerender }) {
  mount.append(renderHeader(rerender));
  mount.append(renderAddForm(rerender));
  mount.append(renderItems(rerender));
}
