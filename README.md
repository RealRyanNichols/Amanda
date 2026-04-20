# Amanda's Toolkit

A complete mobile-first PWA built as a gift for **Amanda Williams**, owner of
**Premier Dental Academy of Longview** (Longview, TX) — and designed to
white-label as a SaaS for any mom who runs a business.

Every feature runs 100% in the browser. Works offline. Installable as a PWA.
Optional Claude API integration for AI features.

---

## Features (17 tabs)

### Core
- **🏠 Home dashboard** — smart reminders scanning your data, safe-to-spend
  math, revenue trends, upcoming appointments, pipeline, pregnancy countdown,
  verse of the day, love-note peek, academy stats
- **✨ The Brain** — AI chat with 10 relational tones (best friend, mama bear,
  strong dad, big sister, tough-love coach, teacher, cheerleader, confidant,
  spiritual friend, childlike wonder). Includes **Vent Mode** — a full-screen
  push-to-talk therapist flow that transcribes + reflects + gently pushes back
- **🗓️ Calendar** — unified month + upcoming view pulling bookings, bills,
  doctor visits, social posts, lead follow-ups, family events. Per-event
  .ics export to iPhone/Google Calendar in one tap
- **🔎 Search** — global search across every piece of data in the app with
  voice dictation
- **🎯 Habits** — daily habit tracker with streaks, 30-day completion rates,
  week grid
- **🔐 Brain Wallet** — on-device document vault (insurance cards, IDs,
  baby records, tax docs) with camera capture and JPG compression
- **🛍️ Store** — in-app micro-purchase catalog (Brain Pro, Caption Pack,
  Letter Tidy Pack, Vault 5GB, Family Plan, Theme Pack)

### Business
- **💵 Income Stabilizer** — deposits, priority-tagged bills, safe-to-spend
  calculator derived from recent deposit history, overdue alerts, revenue
  trends with optional AI tough-love analysis
- **📅 Smart Booking + Payment** — bookings with required deposits, balance
  tracking, reschedule-keeps-deposit, auto follow-up prompts for unpaid
  balances
- **🎓 Academy (PDA-branded) or 🧭 Career (default)** — school features:
  cohorts, students with Texas RDA readiness checklist, hours tracking,
  tuition payments, daily attendance, and a pre-seeded 11-module Texas RDA
  online course authoring tool with Kajabi copy/export
- **📲 Leads** — hot/warm/cold CRM with auto next-contact dates, one-tap
  text/call, context-aware AI-generated scripts, overdue alerts
- **📣 Social** — profile handle storage, content planner with multi-platform
  scheduling, AI caption writer (three variants), hashtag sets

### Personal
- **🍽️ Meals + Grocery** — weekly meal plan, grocery list grouped by
  category with check-off, saved recipes with one-tap grocery push
- **🗂 Organize (Overload)** — brain-dump textarea with auto-triage into
  Now/Today/This Week/Later/Feelings, "Handle this first" emergency card
- **🌿 Life** — faith (verse of day + prayer journal), family (kids +
  supporter rolodex), pregnancy (due date, doctor visits with sonogram photo
  upload, kick counter, hospital bag, **Letters to your baby** with
  templates + voice + AI tidy + exports), love notes envelopes, gratitude
- **🍼 Baby Year** — forward-looking first-year milestone tracker with
  24 pre-seeded milestones, camera capture, well-baby visit schedule,
  growth log
- **✝️ Bible** — full KJV (via bible-api.com + local cache), 66-book
  navigator, verse highlighting, bookmarks, A−/A+ font scaling, reading
  progress

### Settings
- **⚙️ Settings** — profile editing, role/tab selection, Claude API key,
  PIN lock, data export/import, erase everything, PWA install instructions

### The Floating Brain
A persistent ✨ bubble bottom-right on EVERY page. Tap or press `/` to open
a chat drawer with tone switcher + mic + quick actions ("I'm overwhelmed",
"Focus me on [current tab]", "Full Brain →"). Works with or without a
Claude key.

---

## Pricing model

**Base subscription: $19/mo or $190/yr (2 months free).**

Covers all 17 feature tabs with included AI limits.

**Micro-purchases (via in-app Store):**
- Brain Pro — $10/mo — unlimited Claude Opus 4.7
- Caption Pack — $5 one-time — 50 AI captions
- Letter Tidy Pack — $3 one-time — 20 cleanups
- Vault 5GB — $5/mo — cloud-backed encrypted storage
- Family Plan — $10/mo — 4 seats
- Theme Pack — $4 one-time — 6 custom themes

**7-day free trial, no card required.**

---

## First-run experience

5-step onboarding wizard:
1. Welcome + your first name + (optional) partner's name
2. Roles: pick all that apply (Mom, Business owner, Academy owner, Career
   explorer, Pregnant, Faith matters) — drives which tabs you see
3. Interests: what matters most right now (money, time, family, growth,
   calm, encouragement)
4. Business name + brand preset (Default / Premier Dental Academy)
5. Optional 4–6 digit PIN

Everything changeable any time in Settings.

---

## Running it

No build. No server required.

```bash
# Just open it
open index.html

# Or serve locally (for mobile testing over LAN)
python3 -m http.server 8080
```

After first load, the service worker caches everything for offline use.

---

## Deploy

A GitHub Actions workflow at `.github/workflows/pages.yml` auto-deploys on
push to `main` or the feature branch. One-time setup:

1. Settings → Pages → Source → **GitHub Actions**
2. Push anything.

Lives at `https://realryannichols.github.io/amanda/`.

Alternatives: Netlify, Vercel, Cloudflare Pages — all work out of the box.

---

## Install as a PWA

- **iOS Safari:** Share → Add to Home Screen
- **Android Chrome:** the browser offers "Install app" automatically, or
  use Settings → Install card for the in-app button
- **Desktop Chrome/Edge:** the install icon appears in the address bar

Installed, it launches fullscreen like a native app.

---

## AI integration (optional)

Settings → Brain card → paste your Anthropic API key.

- Default model: `claude-opus-4-7` with adaptive thinking
- Sonnet 4.6 and Haiku 4.5 also selectable
- Key stored in `localStorage`, sent directly from your device to
  api.anthropic.com — no proxy, no middleman
- Prompt caching on system prompt for ~90% cost savings on repeat turns
- Opt-in data-awareness: when enabled, a short anonymized summary of your
  stats is included with each Brain message for smarter answers

Without a key, the Brain still works in local mode (FAQ + app-data search).

---

## Data ownership

- Everything stored in `localStorage` on the device
- **Export / Import** JSON backup from the footer
- No server logs, no telemetry, no tracking
- When desktop phase ships Supabase sync: you opt in, your data stays in
  your workspace, never sold, never used for training

---

## Repo layout

```
index.html                 # app shell (header, tab bar, footer)
manifest.webmanifest       # PWA manifest
sw.js                      # service worker (offline + cache)
css/styles.css             # mobile-first dark theme + brand variant
assets/                    # icons + PDA logo
js/
  app.js                   # tab router, boot flow, export/import
  store.js                 # single shared state + localStorage
  util.js                  # DOM helpers, formatters
  branding.js              # default vs PDA brand data
  auth.js                  # onboarding wizard + PIN + tab visibility
  voice.js                 # Web Speech API wrapper (push-to-talk)
  floating-brain.js        # persistent chat bubble on every page
  tools/
    dashboard.js           # Home
    brain.js               # Brain chat + tones + Vent Mode
    calendar.js            # unified calendar + .ics export
    bible.js               # KJV reader
    search.js              # global search
    habits.js              # habit tracker
    vault.js               # Brain Wallet (document vault)
    baby-year.js           # Thomas's first-year tracker
    store.js               # micro-purchase catalog
    settings.js            # profile, key, PIN, data
    income.js              # Income Stabilizer + AI trends
    booking.js             # Smart Booking + Payment
    academy.js             # School features + RDA course authoring
    career.js              # Career pathways (default brand)
    meals.js               # Meal plan + grocery + recipes
    overload.js            # Organize (brain dump + triage)
    followup.js            # Leads CRM
    social.js              # Social planner + AI captions
    life.js                # Faith/Family/Pregnancy/Love/Gratitude
    life-seeds.js          # KJV verses + hospital bag + love notes + baby size
    rda-seed.js            # Texas RDA requirements + course outline
    reminders.js           # smart data-driven reminders for Home
.github/workflows/pages.yml # auto-deploy to GitHub Pages
marketing/index.html        # landing page stub
```

Reference docs:
- **DESKTOP_HANDOFF.md** — ready-to-paste Claude prompts for desktop phase
  (Supabase, Stripe, Meta/TikTok developer accounts, domains, etc.)
- **NAMES.md** — product name + domain shortlist with live availability
  research

---

Built with ♡ for Amanda.
