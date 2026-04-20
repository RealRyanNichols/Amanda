# Google connectors — setup (one-time, ~15 min)

Ryan — you need to do this once so users can connect Drive, Sheets, and
YouTube from inside the app. Everything in the code is already wired; the
only missing piece is flipping Google on in Supabase with the right OAuth
app credentials.

## What you're setting up

One Google Cloud OAuth app. It lets Supabase hand your users over to Google
for login, ask for their consent to Drive/Sheets/YouTube, and return with an
access token we can use from the browser.

## Step 1 — Google Cloud Console

1. Go to https://console.cloud.google.com
2. Create a new project (or reuse an existing one). Name it
   **"Amanda's Toolkit"**.
3. In the sidebar, go to **APIs & Services → Enabled APIs & Services** and
   enable:
   - Google Drive API
   - Google Sheets API
   - YouTube Data API v3
   - People API (powers basic profile info)

## Step 2 — OAuth consent screen

1. **APIs & Services → OAuth consent screen.**
2. User type: **External** (you want real users, not just your org).
3. Fill in:
   - App name: **Amanda's Toolkit**
   - User support email: your email
   - Developer contact: your email
   - App logo: upload `assets/icon-512.png` from this repo
   - App home page: `https://amanda-toolkit.vercel.app` (or whatever your
     Vercel URL is — grab it from Vercel dashboard)
   - App privacy policy: `https://amanda-toolkit.vercel.app/marketing/privacy.html`
     (we'll add this — flag me if you haven't created one yet)
   - Authorized domain: `vercel.app`
4. **Scopes** — click "Add or remove scopes" and select:
   - `openid`
   - `email`
   - `profile`
   - `.../auth/drive.file` (NOT full drive — least privilege)
   - `.../auth/spreadsheets`
   - `.../auth/youtube.upload`
5. **Test users** — add your Gmail + Amanda's. (Until the app is "verified"
   by Google — a multi-week review — only test users can log in with the
   sensitive YouTube scope.)
6. Save and continue.

## Step 3 — Create OAuth client

1. **APIs & Services → Credentials → Create credentials → OAuth client ID.**
2. Application type: **Web application.**
3. Name: **Amanda's Toolkit – Supabase.**
4. **Authorized redirect URIs** — add exactly these two:
   - `https://mccjgijnbstduhyuvwwo.supabase.co/auth/v1/callback`
   - `http://localhost:3000/auth/v1/callback` (for dev, optional)
5. Click **Create**. Copy the **Client ID** and **Client Secret** — you'll
   paste them into Supabase next.

## Step 4 — Supabase dashboard

1. Go to https://supabase.com/dashboard → your project → **Authentication →
   Providers → Google.**
2. Toggle **Enable Sign in with Google** on.
3. Paste the Client ID and Client Secret from step 3.
4. Skip "Additional Authorized Client IDs" (mobile apps — later).
5. Save.

## Step 5 — Test

1. Deploy to Vercel (push to the branch auto-deploys).
2. Open the app on your phone, go to **Settings → Google connectors →
   Connect Google (all)**.
3. You'll get bounced to the Google consent screen showing the four
   scopes. Accept.
4. You land back in the app. The Drive/Sheets/YouTube rows should all
   flip to "✓ connected."
5. Tap **Back up to Drive** — check your Google Drive, you should see a
   file named `amanda-toolkit-backup-<today>.json`.

## Scope rationale (why we ask for what we ask for)

| Scope | Why | Consent wording user sees |
|-------|-----|---------------------------|
| `openid email profile` | Sign in | "See your primary Google Account email" |
| `drive.file` | Backups + reel exports that WE create | "See, edit, create files THIS APP opens or creates" — doesn't touch the rest of her Drive |
| `spreadsheets` | Import/export income to her sheets | "See, edit, create, and delete spreadsheets" (required to write) |
| `youtube.upload` | Post video reels | "Upload YouTube videos" |

We deliberately do NOT ask for `drive.readonly` or full-drive scope. Less
scary consent screen + Google is less likely to require verification.

## Publishing (later)

When we cross ~100 users, Google will require the app to be "verified"
before anyone outside the test-user list can use the YouTube scope. That
review takes 2–6 weeks and requires:
- A deployed privacy policy page.
- A 30-second YouTube screencast demonstrating the OAuth flow.
- Proof of domain ownership (TXT record in DNS).

I'll flag when we're ready. For MVP / beta, test-users list is fine.

## If something breaks

**"redirect_uri_mismatch" error** — you have a typo in the redirect URI in
step 3. It must be EXACTLY `https://mccjgijnbstduhyuvwwo.supabase.co/auth/v1/callback`.

**"access_blocked: this app is not verified"** — the user isn't on the
test-user list. Add them, or finish Google's verification process.

**"session expired" after 1 hour** — expected. The access token Google
gives us is short-lived; she taps Reconnect Google. Phase 2 adds a server-
side refresh flow via a Supabase Edge Function.

— Claude, 2026-04-19
