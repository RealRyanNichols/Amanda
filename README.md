# Amanda's Toolkit

A five-in-one business & life toolkit built for **Amanda Williams**, owner of
**Premier Dental Academy of Longview** (Longview, TX · Gilmer Road) — and usable
by anyone as a white-label app.

The tools come from Amanda's own list of real pain points:

1. **💵 Income Stabilizer** — track deposits + bills with priority, and get a
   "what can I safely spend this week?" number based on your actual deposit
   history. Alerts when you're about to fall behind.
2. **📅 Smart Booking + Payment** — bookings with required deposits, balance
   tracking, rescheduling that keeps the deposit, and automatic follow-up
   prompts for unpaid balances.
3. **🧭 Career Pathway** — trade-focused (dental assisting, CDL trucking,
   cosmetology, medical assisting, welding) with step-by-step enroll →
   train → certify → hired checklists and progress tracking.
4. **🧠 Life Overload Organizer** — dump everything on your mind, the app
   auto-triages into Now / Today / This Week / Later / Feelings, and shows
   **"Handle this first"** when things get heavy.
5. **📲 Follow-Up System for Leads** — hot/warm/cold tagging, automatic next-
   contact dates, one-tap text/call, copy-ready scripts, and "don't lose this
   lead" alerts.

## Run it

No build. No server required.

```bash
# Option A: open the file directly
open index.html

# Option B: serve locally (recommended on mobile over your LAN)
python3 -m http.server 8080
# then visit http://<your-ip>:8080
```

Works offline after first load — data is stored in `localStorage`.

## Deploy it (5 minutes, free)

It's a static site, so any of these will host it for free:

- **GitHub Pages**: Settings → Pages → deploy from `main` branch, root.
- **Netlify / Vercel / Cloudflare Pages**: drop the repo in, no config needed.

## White-label vs. Premier Dental Academy branding

Toggle in the header:

- **Default** — "Amanda's Toolkit". Clean. Works for anyone.
- **PDA branding** — "Premier Dental Academy · Longview, TX · Business Suite".
  Career tool surfaces a local-program callout pointing at Amanda's school.

The branding is data-driven in `js/branding.js` — swap in a different business
to white-label the app for a new customer.

## Data ownership

- All data lives in the browser (`localStorage`). Nothing is sent anywhere.
- **Export** / **Import** buttons in the footer save / restore a JSON backup.
- Works on phone, tablet, or desktop.

## Structure

```
index.html          # shell: header, tab bar, footer
css/styles.css      # mobile-first dark theme + brand variant
js/
  app.js            # tab router, export/import wiring
  store.js          # single shared state + localStorage
  util.js           # DOM helpers, money/date formatters, toast
  branding.js       # default vs. PDA brand
  tools/
    income.js       # #1 Income Stabilizer
    booking.js      # #2 Smart Booking + Payment
    career.js       # #3 Career Pathway
    overload.js     # #4 Life Overload Organizer
    followup.js     # #5 Follow-Up System for Leads
```

Built with ♡ for Amanda.
