// Google connectors — Drive, Sheets, YouTube.
//
// How this works (honest):
//   1. She clicks a "Connect X" button. That triggers signInWithGoogleScoped()
//      with the relevant scope (drive.file / spreadsheets / youtube.upload).
//   2. Google shows a consent screen listing exactly what we'll access.
//   3. She returns to the app. Supabase puts her access_token into the
//      session as `session.provider_token`. It's valid for ~1 hour.
//   4. We call the Google REST API directly from the browser using that
//      token as a Bearer header. No backend needed for Drive/Sheets reads
//      or small writes. YouTube upload for large videos eventually wants
//      a resumable-upload helper — we keep that simple to start.
//   5. When the token expires she sees a "Reconnect Google" prompt. Phase 2
//      will run a Supabase Edge Function that refreshes server-side.
//
// Scopes we request:
//   drive.file        — only files this app creates or opens (NOT her whole Drive)
//   spreadsheets      — read + write sheets she shares with the app
//   youtube.upload    — post videos on her behalf (used when video reels land)
//
// We deliberately avoid drive.readonly or full-drive scope. Least-privilege
// = less scary consent screen = higher opt-in rate.

import { getGoogleAccessToken, signInWithGoogleScoped } from "./supabase.js";
import { state, save } from "./store.js";

export const GOOGLE_SCOPES = {
  drive:  "https://www.googleapis.com/auth/drive.file",
  sheets: "https://www.googleapis.com/auth/spreadsheets",
  youtube:"https://www.googleapis.com/auth/youtube.upload",
};

// Track which connectors she's opted into. Persisted so the settings UI
// knows what to show as connected vs not.
export function googleConnectedState() {
  if (!state.google) state.google = { connected: { drive: false, sheets: false, youtube: false }, lastConnectedAt: 0 };
  return state.google;
}

async function requireToken() {
  const token = await getGoogleAccessToken();
  if (!token) throw new Error("Google session expired. Click Reconnect Google.");
  return token;
}

// ---------- Connect flows ----------

export async function connectDrive() {
  await signInWithGoogleScoped([GOOGLE_SCOPES.drive]);
  const g = googleConnectedState();
  g.connected.drive = true;
  g.lastConnectedAt = Date.now();
  save();
}

export async function connectSheets() {
  await signInWithGoogleScoped([GOOGLE_SCOPES.drive, GOOGLE_SCOPES.sheets]);
  const g = googleConnectedState();
  g.connected.drive = true;
  g.connected.sheets = true;
  g.lastConnectedAt = Date.now();
  save();
}

export async function connectYouTube() {
  await signInWithGoogleScoped([GOOGLE_SCOPES.youtube]);
  const g = googleConnectedState();
  g.connected.youtube = true;
  g.lastConnectedAt = Date.now();
  save();
}

// Ask for everything at once — common path from Settings.
export async function connectAllGoogle() {
  await signInWithGoogleScoped([GOOGLE_SCOPES.drive, GOOGLE_SCOPES.sheets, GOOGLE_SCOPES.youtube]);
  const g = googleConnectedState();
  g.connected = { drive: true, sheets: true, youtube: true };
  g.lastConnectedAt = Date.now();
  save();
}

// ---------- Drive ----------

// Upload a file to Drive. Uses multipart upload — works for files up to
// ~5 MB. For bigger backups we'd want resumable upload; not needed yet.
// Returns the Drive file metadata.
export async function uploadToDrive(blob, filename, mimeType = "application/json") {
  const token = await requireToken();
  const metadata = { name: filename, mimeType };

  const boundary = "amanda-toolkit-" + Math.random().toString(36).slice(2);
  const delim = `\r\n--${boundary}\r\n`;
  const close = `\r\n--${boundary}--`;

  const metaPart = `${delim}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
  const bodyPart = `${delim}Content-Type: ${mimeType}\r\n\r\n`;

  const text = await blob.text();
  const body = metaPart + bodyPart + text + close;

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`Drive upload failed: ${res.status}`);
  return res.json();
}

// Convenience — back up her whole toolkit state to Drive as JSON.
export async function backupStateToDrive() {
  const exportStr = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), state }, null, 2);
  const blob = new Blob([exportStr], { type: "application/json" });
  const filename = `amanda-toolkit-backup-${new Date().toISOString().slice(0, 10)}.json`;
  return uploadToDrive(blob, filename);
}

// ---------- Sheets ----------

// Extract a sheet ID from a pasted URL or return the ID directly.
export function parseSheetId(urlOrId) {
  const m = (urlOrId || "").match(/\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : (urlOrId || "").trim();
}

// Read a range from a spreadsheet. Range uses A1 notation, e.g. "Sheet1!A1:C".
export async function readSheetRange(sheetIdOrUrl, range = "A1:Z100") {
  const token = await requireToken();
  const id = parseSheetId(sheetIdOrUrl);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Sheets read failed: ${res.status}`);
  const data = await res.json();
  return data.values || [];
}

// Append rows to a sheet. values is a 2D array of cell values.
export async function appendSheetRows(sheetIdOrUrl, range, values) {
  const token = await requireToken();
  const id = parseSheetId(sheetIdOrUrl);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) throw new Error(`Sheets append failed: ${res.status}`);
  return res.json();
}

// Convenience — push her income deposits into a user-owned sheet.
export async function syncIncomeToSheet(sheetIdOrUrl) {
  const deposits = state.income?.deposits || [];
  const bills = state.income?.bills || [];

  const depRows = [
    ["Date", "Amount", "Source"],
    ...deposits.map((d) => [d.date, d.amount, d.source || ""]),
  ];
  const billRows = [
    ["Name", "Amount", "Due", "Paid", "Priority"],
    ...bills.map((b) => [b.name, b.amount, b.due || "", b.paid ? "YES" : "", b.priority || 2]),
  ];

  const id = parseSheetId(sheetIdOrUrl);
  const token = await requireToken();

  // Use batchUpdate to clear + write in one call.
  const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchUpdate`;
  const res = await fetch(batchUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      valueInputOption: "USER_ENTERED",
      data: [
        { range: "Deposits!A1", values: depRows },
        { range: "Bills!A1",    values: billRows },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Sheet sync failed: ${res.status} — check that your sheet has tabs named "Deposits" and "Bills"`);
  return res.json();
}

// ---------- YouTube ----------

// Upload a video blob (from the Reel Studio MediaRecorder path) to YouTube.
// Simple one-shot upload — fine for clips up to ~25 MB. Larger videos want
// the resumable-upload endpoint; we'll add that when video reels ship.
export async function uploadToYouTube(videoBlob, { title, description = "", privacy = "private", tags = [] }) {
  const token = await requireToken();
  const metadata = {
    snippet: { title, description, tags, categoryId: "22" }, // 22 = People & Blogs
    status:  { privacyStatus: privacy, selfDeclaredMadeForKids: false },
  };

  const boundary = "amanda-yt-" + Math.random().toString(36).slice(2);
  const delim = `\r\n--${boundary}\r\n`;
  const close = `\r\n--${boundary}--`;

  const metaPart = `${delim}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
  // Browser fetch can send Blobs directly in a body if we construct it as an
  // ArrayBuffer, but multipart with a Blob section is simpler this way:
  const metaBlob = new Blob([metaPart + delim + `Content-Type: ${videoBlob.type}\r\n\r\n`]);
  const closeBlob = new Blob([close]);
  const body = new Blob([metaBlob, videoBlob, closeBlob]);

  const res = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) throw new Error(`YouTube upload failed: ${res.status}`);
  return res.json();
}
