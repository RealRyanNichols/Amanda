# Desktop Handoff — Picking Up Tonight

Ryan — when you fire up Claude desktop (or Claude Co-worker), paste any of these prompts to continue exactly where we left off. Each section is self-contained, so you don't have to do them in order.

Last commit on branch `claude/amanda-business-tools-RpCj8`: check `git log -1`.

## 🎯 Current state snapshot

**What's built:** Complete mobile-first PWA with 17 feature tabs, offline support, PIN lock, multi-step onboarding, BYOK Claude integration, voice dictation, full KJV Bible reader, floating Brain bubble on every page with 10 relational tones (tough-love, mama bear, dad, sister, friend, teacher, cheerleader, confidant, spiritual, childlike), Vent Mode therapist flow, social content planner with AI caption writer, Letters to Thomas with templates + voice + AI tidy + exports, Baby Year milestone tracker, Brain Wallet document vault, Habits tracker, global Search, unified Calendar with .ics export, Meals + Grocery, Academy school suite with Texas RDA course authoring, Income with AI tough-love revenue trends, Store tab with 6 micro-purchases placeholder.

**What's validated:** Amanda said "THAT'S AMAZING!!" and told Ryan she'd pay $20-30/mo.

**Pricing locked (per Ryan):** **$19/mo** (or $190/yr — 2 months free) base tier covers all 17 tabs. Micro-purchases in the Store tab for extras.

---

## The current state (quick brief for whoever picks this up)

Amanda's Toolkit is a mobile-first PWA built as a gift for Amanda Williams, owner of Premier Dental Academy of Longview. It's also a white-label platform targeting mom business owners. Amanda has validated the idea and said she'd pay $20-30/mo.

**What exists now (all in this repo):**

- Multi-step onboarding wizard with role + interest personalization
- 11 feature tabs: Home dashboard, Brain (AI chat), Income Stabilizer, Booking+Payment, Career Pathway or Academy (brand-dependent), Meals+Grocery, Organize, Leads, Social, Life (Faith+Family+Pregnancy+Love Notes+Gratitude), Settings
- PWA manifest + service worker (offline + installable)
- PIN lock, export/import JSON, data reset
- Brain: local FAQ mode + BYOK Claude mode (opus-4-7 default, adaptive thinking, prompt caching on system prompt)
- Voice dictation (Web Speech API) on Letters to Thomas + Social caption writer
- Texas RDA online course authoring with Kajabi copy/export
- GitHub Pages deploy workflow at `.github/workflows/pages.yml` — not yet enabled
- Preview URL: https://raw.githack.com/RealRyanNichols/Amanda/claude/amanda-business-tools-RpCj8/index.html
- Draft PR: https://github.com/RealRyanNichols/Amanda/pull/1

**What's NOT done (priority order for tonight):**

1. Merge the draft PR and enable GitHub Pages
2. Stand up Supabase backend (auth + real multi-device sync)
3. Stripe subscription billing
4. Simple marketing site
5. Meta/TikTok developer account setup + OAuth wiring
6. Landing page conversion flow

---

## 1. One-click start: merge and deploy

Paste this first when you sit down:

```
I'm Ryan. The repo at realryannichols/amanda has PR #1 on branch
claude/amanda-business-tools-RpCj8. Please:

1. Pull the latest from that branch.
2. Show me git log --oneline for the last 15 commits so I can see what's
   there.
3. Read DESKTOP_HANDOFF.md (this file) for the full context.
4. Mark PR #1 ready for review (it's currently draft).
5. Help me enable GitHub Pages: walk me through Settings → Pages →
   set Source to "GitHub Actions." After I do it, merge PR #1 to main.
   The existing workflow at .github/workflows/pages.yml will auto-deploy.
6. Confirm the live URL works (https://realryannichols.github.io/amanda/).
```

---

## 2. Stand up Supabase (real accounts + multi-device sync)

Paste this when you're ready to move from local-only to real SaaS:

```
I want to migrate the app from localStorage-only to Supabase-backed
with the following design:

- Users sign up with email + password, OR Google OAuth (for Amanda's
  audience that's on Google Workspace)
- Store schema mirrors the current client-side state shape — see
  js/store.js defaults() for the full schema. Start with these tables:
    profiles (user_id, first_name, partner_name, business_name, roles[],
              interests[], brand, setup_done)
    income_deposits, income_bills
    booking_appointments, booking_clients
    career_steps
    overload_tasks (with columns for text, category, due, done)
    followup_leads
    academy_programs, academy_students, academy_course_modules,
              academy_course_lessons
    meals_plan, meals_grocery, meals_recipes
    social_profiles (per user × per platform), social_posts,
              social_hashtag_sets
    life_faith_prayers, life_family_kids, life_family_supporters,
              life_pregnancy (singleton), life_pregnancy_appointments,
              life_pregnancy_letters, life_love_notes,
              life_gratitude_entries
    brain_messages (for chat history)
- Row-level security: user_id = auth.uid() on every table
- Images (sonograms) — use Supabase Storage with private buckets,
  signed URLs, user-scoped paths
- Sync strategy: offline-first. localStorage keeps working as a cache.
  On login, pull remote state → merge → push changes. When offline,
  queue mutations. When back online, flush queue.

Start by:
1. Scaffolding supabase/migrations/ with the initial schema
2. Writing js/sync.js that handles login, queue, and push/pull
3. Adding a login screen in js/auth.js (replace current welcome flow
   with: signup or sign-in → existing wizard if first time)
4. Keeping the existing PIN lock as a second factor on top of login

Don't touch Stripe yet — we'll do that after sync is working. Show
me the migration SQL first, before writing any code.
```

---

## 3. Stripe subscription billing — single tier + micro-purchases

Paste this after Supabase auth is working. **This replaces the earlier tiered plan — Ryan decided to go $19 base + IAP store.**

```
Add Stripe billing with ONE subscription + multiple one-time or
add-on subscriptions (micro-purchases). Structure:

BASE SUBSCRIPTION (required):
- "Core" — $19/mo or $190/yr (annual = 2 months free)
- 7-day free trial, no card required upfront
- Unlocks all 17 feature tabs fully
- Includes: Brain chat (30/month on Claude Haiku 4.5), AI caption
  writer (5/month), AI letter tidy-up (5/month)

MICRO-PURCHASES (from in-app Store tab, see js/tools/store.js):
- Brain Pro: $10/mo add-on — unlimited Claude Opus 4.7
- Caption Pack: $5 one-time — 50 caption generations
- Letter Tidy Pack: $3 one-time — 20 voice cleanups
- Vault 5GB: $5/mo — cloud-backed encrypted vault storage
- Family Plan: $10/mo — 4 shared seats
- Theme Pack: $4 one-time — 6 custom themes

Implementation:
1. Stripe Products + Prices in the dashboard:
   - price_core_monthly ($19), price_core_annual ($190)
   - price_brain_pro ($10/mo), price_vault_5gb ($5/mo),
     price_family_4 ($10/mo)
   - price_caption_pack ($5 one-time), price_tidy_pack ($3 one-time),
     price_theme_pack ($4 one-time)
2. Supabase Edge Function: stripe-webhook.ts handling
   checkout.session.completed (for one-time)
   customer.subscription.created/updated/deleted
   Updates two tables: users.subscription_status + user_purchases
   (a map of {price_id: { activated_at, expires_at, credits_left }}).
3. Replace the mock handlePurchase() in js/tools/store.js with real
   Stripe Checkout redirects. Preserve the current state.purchases
   local schema so existing UI keeps working.
4. Client-side usage-gating:
   - For one-time packs: decrement credits_left on each use
   - For Brain Pro: check has_active("brain_pro") before calling
     Opus; fall back to Haiku if not
5. Stripe Customer Portal link in Settings → Billing card.

Revenue math (confirm with Ryan):
- 100 subs × $19 base = $1,900/mo (+ ~30% IAP uplift = ~$2,470)
- 1,000 × $19 = $19,000/mo (+ IAP = ~$25k)
- 10,000 × $19 = $190,000/mo (+ IAP = ~$250k)
```

---

## 4. Meta (Facebook + Instagram) developer account + OAuth

This is the most annoying part of the journey. Paste this to have
Claude walk you through it methodically:

```
I need to set up a Meta for Developers account so my SaaS app can
integrate with Facebook and Instagram Business/Creator accounts. My
business is Premier Dental Academy of Longview (separate legal entity)
and the SaaS is a separate product (working name: Amanda's Toolkit —
I'll rename when I figure out a brand).

Walk me through:

1. Meta for Developers signup — what account do I use (personal FB vs
   business)? What are the trade-offs?
2. Meta Business Verification — what docs do I need? (EIN letter, utility
   bill, D-U-N-S number?). Rough timeline.
3. Creating a Meta App:
   - App type (Business vs Consumer)
   - Which products to add: Facebook Login, Instagram Graph API, Webhooks
4. App Review for these permissions:
   - pages_manage_posts, pages_read_engagement (to post to FB pages)
   - instagram_basic, instagram_content_publish (to post to IG)
   - business_management
5. What each App Review submission needs (screencast, use case
   description, data deletion callback)
6. Sandbox mode — what I CAN test with my own accounts before App
   Review approves everything

After this is set up, I'll use the Graph API to let users connect
their FB Page + connected IG Business account via OAuth, store
long-lived access tokens in Supabase (encrypted), and post content
from the planner directly. Don't write code yet — just help me get
the account infrastructure in place first.
```

---

## 5. TikTok developer account + Content Posting API

```
Walk me through setting up a TikTok for Developers account and getting
the Content Posting API approved. The use case: my users (moms who run
small businesses) will connect their TikTok account and use my app to
schedule + publish short-form video posts.

Specifically:
1. TikTok for Business vs TikTok for Developers — which do I need?
2. Sandbox app creation
3. Login Kit + Content Posting API scopes: user.info.basic,
   video.upload, video.publish
4. Review process timeline + what to submit
5. Testing flow with my own TikTok account before going live
```

---

## 6. Marketing site + domain

```
I need a simple marketing site to sell the app. One-page, mobile-first,
converts cold traffic (Instagram reels, TikTok videos) into signups.

Sections:
- Hero: "A home for your business and your life" + phone mockup +
  "Try free for 7 days" CTA
- Three feature highlights (Income Stabilizer, Life with Letters,
  Academy if running a school)
- Social proof (Amanda testimonial when she writes one)
- Pricing ($19/mo or $190/yr annual savings)
- FAQ (privacy, how Amanda's data stays hers, offline support)
- Footer with Privacy Policy + Terms of Service links

Build it as Astro (fast, SEO-friendly, free on Cloudflare Pages) OR
Next.js if you prefer. Output the files at marketing/ in this repo.

I'll buy a domain (suggest 3 options that are memorable + available
for under $20 — something like "mamatoolkit.com" or "amandaroutine.co").
```

---

## 7. Individual features to build later

Paste individually as you want each one:

```
Add a shared family calendar to the Life tab that pulls:
- Kids school events (from Family sub-view)
- Doctor visits (from Pregnancy sub-view)
- Prayer journal milestones
- Booking appointments (if business role)
- Scheduled social posts
into one timeline view for the current month.
```

```
Add a passive backup system: weekly, automatically prompt the user
to export their data as JSON AND optionally upload it to Supabase
Storage or their Google Drive (via Google Drive API). When they
haven't exported in 14+ days, show a banner.
```

```
Add push notifications via Web Push API:
- "You have a lead follow-up due today"
- "Bill due in 2 days"
- "You haven't written a letter to Thomas in a week — want to?"
User opts in from Settings. iOS 16.4+ supports this for PWAs.
Use the VAPID key on the Supabase Edge Function.
```

```
Add a "Community" section for Amanda's Premier Dental Academy
students — a private feed where they can post questions, share
externship wins, etc. Real-time with Supabase Realtime.
```

```
Add a Stripe Connect integration so Amanda's Academy students can
pay tuition directly through the app (Amanda keeps the funds). This
means Amanda becomes a Stripe Connect "Platform" — we take a small
cut (1%) and she gets the rest minus Stripe fees.
```

---

## 8. Branding + content

```
I need help coming up with a brand name, logo, and palette for this
app (separate from Premier Dental Academy). Target audience: moms
who run small businesses. Want it to feel warm, trustworthy, gentle.
Not tech-y.

Generate:
1. 10 name ideas (available .com domains preferred)
2. 3 logo concepts per favorite name (SVG, simple)
3. A color palette and typography recommendation

Don't hire a designer — I want this cheap and iterative.
```

---

## 9. Privacy Policy + Terms of Service

```
Generate a Privacy Policy and Terms of Service for my mobile SaaS
business. Key facts:

- App is called [insert final name]
- Company: [insert LLC when formed]
- Stores: user profile, business records, financial data
  (deposits/bills/payments), pregnancy data (sensitive!), faith
  content, kids info (sensitive — be clear about COPPA compliance
  since users may enter kids' info; we are NOT collecting from
  children directly, moms enter on their behalf)
- Uses: Supabase (auth, database, storage), Stripe (billing),
  Anthropic (optional, only when user connects their own key),
  GitHub Pages (static hosting)
- Data retention: kept until user deletes their account; delete
  within 30 days of account deletion
- GDPR / CCPA: I'll target US market first but these should be
  compliant from day 1
- User can export all their data anytime
- We do NOT sell data
- We do NOT train AI on user data

Generate both documents, 2000-3000 words each, plain English. Put
them at /legal/privacy.md and /legal/terms.md.
```

---

## 10. Founder milestone goals (Ryan's tracker)

Track these in a hidden founder-only view once Supabase is wired up.
Subscriber count pulled from Stripe API.

| Subs | Base MRR ($19) | With ~30% IAP uplift | Annual |
|---|---|---|---|
| 100 | $1,900 | $2,470 | $29.6k |
| 250 | $4,750 | $6,175 | $74k |
| 500 | $9,500 | $12,350 | $148k |
| **1,000** | **$19,000** | **$24,700** | **$296k** |
| 2,000 | $38,000 | $49,400 | $593k |
| **5,000** | **$95,000** | **$123,500** | **$1.48M** |
| 10,000 | $190,000 | $247,000 | $2.96M |
| 25,000 | $475,000 | $617,500 | $7.41M |
| 50,000 | $950,000 | $1.23M | $14.83M |
| 100,000 | $1.9M | $2.47M | $29.65M |
| 150,000 | $2.85M | $3.7M | $44.5M |
| 200,000 | $3.8M | $4.94M | $59.3M |
| 250,000 | $4.75M | $6.18M | $74.1M |
| 500,000 | $9.5M | $12.35M | $148.3M |
| 600,000 | $11.4M | $14.82M | $177.9M |
| 750,000 | $14.25M | $18.53M | $222.3M |
| **1,000,000** | **$19M** | **$24.7M** | **$296.5M** |

**Build a milestone celebration trigger:**

```
Add a Supabase cron (or webhook-triggered check) that runs daily
and counts active subscribers from Stripe. When we cross a milestone
(100, 250, 500, 1k, 2k, 5k, 10k, 25k, 50k, 100k, 150k, 200k, 250k,
500k, 600k, 750k, 1M), do three things:
1. Store the milestone + timestamp in a founder_milestones table
2. Send Ryan an SMS via Twilio: "We just crossed [N] subs. $X MRR."
3. Auto-post a celebratory screenshot to an internal Slack channel
   (or his choice of notification)

Then build a /founder admin route visible only to an allowlist
(ryan@...). Shows current sub count, MRR, IAP revenue, top 10
users by engagement, churn over last 30d.
```

---

## 11. Product name + domain

See `NAMES.md` in the repo root. Top 3 candidates: TendHQ, HandsFullApp,
TheBrainForHer. Ryan verifies availability on Cloudflare Registrar
and buys before launch.

Once name is chosen, run this prompt:

```
We chose the name [NAME] with domain [DOMAIN]. Please:

1. Rename the PWA manifest.webmanifest (name + short_name)
2. Update the welcome screen copy and the default branding in
   js/branding.js
3. Replace the ◆ brand mark with a simple logo SVG we'll iterate
4. Set up Cloudflare Pages to deploy the built app to the new domain
5. Point the apex record to GitHub Pages (or migrate off Pages to
   Cloudflare Pages entirely)
6. Update README and DESKTOP_HANDOFF to reference the new name
7. Generate 5 launch-post captions for IG/TikTok with the new name
```

---

## 12. Landing page (marketing site)

See `marketing/` directory in the repo (stub exists). Build it out
with Astro:

```
Replace the marketing/ stub with a complete Astro-based marketing
site deployable to Cloudflare Pages:

- Hero: "A home for your business and your life"
  + phone mockup (use a screenshot of the Home tab)
  + "Try free for 7 days — no card" CTA
- 3 feature highlights (3-column on desktop, stacked on mobile):
  * Income Stabilizer — safe-to-spend math from your deposits
  * Letters to [their baby] — voice-dictated keepsakes, AI tidies
  * Brain (AI in 10 tones) — like having a mentor, friend, mom
- Social proof placeholder (Amanda testimonial when ready)
- Pricing card: $19/mo or $190/yr — single tier, 7-day free trial
- FAQ: privacy (your data stays yours), offline support,
  cancel anytime, not medical/legal/tax advice
- Footer: Privacy Policy + Terms links
- SEO: og:image, structured data for SaaS pricing
- Mobile-first, same visual language as the app

Run it through a Core Web Vitals check before shipping — aim for
95+ Performance on mobile.
```

---

## 13. Affiliate / referral program for pediatricians + OBs

Ryan's insight: pediatricians and OB/GYN practices are a fantastic
distribution channel — their patients are moms with babies, exactly
our market. Pay them a commission for every patient who signs up.

Paste this once Supabase + Stripe are in place:

```
Build an affiliate program for healthcare practices (pediatricians,
OBs, midwives, doulas). Design:

TABLES:
- affiliates: id, name, practice_name, email, stripe_connect_id,
  payout_rate (default 20%), status ('pending'|'active'|'paused'),
  created_at
- affiliate_codes: id, affiliate_id, code (6-char human-readable
  e.g. 'DRJANE'), clicks, signups
- referrals: id, affiliate_id, code, user_id, signed_up_at,
  subscription_id, lifetime_value, commission_paid_cents, status

FLOW:
1. Affiliate signup page (/affiliates/apply) collects basic info,
   creates a pending affiliate record, I review + approve.
2. Approved affiliates get a dashboard at /affiliates/dashboard
   with their code, total signups, lifetime commissions, stats.
3. Each affiliate has a referral URL:
   tendhq.com/join?via=DRJANE (or whatever we name it)
4. When a user lands with ?via=DRJANE, set a cookie + the signup
   form stores affiliate_code on the user record.
5. When that user's Stripe subscription event fires, webhook
   calculates 20% of the monthly revenue and accrues to the
   affiliate's balance.
6. Monthly Stripe Connect payout to the affiliate (automatic).

PITCH DECK FOR PRACTICES:
- 1-pager PDF: what the app does, screenshot of Home + Letters +
  Baby Year, the 20% rev-share, QR code to their signup form.
- Physical business cards for waiting rooms with QR code to
  /join?via=[their code]

COMPLIANCE:
- This is not a medical product. No medical claims. The rev-share
  is a marketing affiliate payment, not a kickback. Still —
  consult a healthcare attorney re: Stark law / anti-kickback
  exposure before launching to practices that take Medicare.
  Out of an abundance of caution we might pay affiliates as a
  flat referral fee rather than percentage in some states.

ALSO:
- Build a parallel affiliate path for mom influencers on Insta/TikTok
  — same mechanics, different onboarding copy.
```

## 14. Bank + QuickBooks integration

```
Wire two financial integrations. Both require a backend proxy (Supabase
Edge Function holds the secrets).

PLAID (bank connections):
- Plaid Link.js flow on the frontend — opens the bank-picker modal
- Backend exchange-public-token endpoint stores the access_token
  encrypted in users.plaid_items (one row per linked bank)
- Nightly Supabase cron pulls transactions via /transactions/sync
- Each transaction auto-appears in Income tab's deposits/bills with
  a "from bank" pill
- Match incoming transactions to existing Bills by amount + date
  window, auto-mark paid
- Categorize using Plaid's category field + LLM refinement

QUICKBOOKS ONLINE (for moms who already use QBO):
- OAuth 2.0 redirect flow, backend stores refresh_token
- Sync appointments → invoices in QBO
- Sync deposits → bank deposits in QBO
- 2-way sync on a schedule

Positioning note: eventually build our own bookkeeping so users can
DROP QuickBooks entirely. For year 1, integrate rather than compete.
```

## 15. Premium Bible translations (NIV, ESV, NKJV, etc.)

```
Currently the Bible reader supports 6 free public-domain translations
via bible-api.com (KJV, ASV, WEB, BBE, YLT, Darby). State tracks
requestedTranslations[] — every user who taps "Request another
translation" and types NIV/ESV/NKJV/NASB/CSB/NLT/NRSV/AMP/MSG gets
logged.

Wire scripture.api.bible with a paid account:
1. Sign up at https://scripture.api.bible/ (American Bible Society)
2. License the premium translations you want (each has its own
   publisher agreement — expect 2-4 weeks for approval)
3. Add a Supabase Edge Function proxy: /api/bible/:translation/:book/:chapter
   — holds the API key server-side, returns chapter JSON to the client.
4. Add the new translations to TRANSLATIONS in js/tools/bible.js
5. Route calls through the proxy instead of bible-api.com when the
   translation is one of the licensed ones.

Per-translation monthly cost: $50-300 depending on the publisher.
Worth it because "Does it have NIV?" is the #1 question faith users
ask, and having 10+ translations is a marketing bullet.
```

## 16. Acquisition positioning (long game)

Ryan's thesis: build a SaaS with 1k-5k paid subscribers (in the
mom-small-biz-faith demo), get acquired by a larger SaaS or
portfolio company for $10M-$50M. Sector comps:

- **Cozi** (family organizer) acquired by Time Inc (undisclosed)
- **BabyCenter** acquired by Johnson & Johnson then spun out
- **Dubsado** / **HoneyBook** — private, rumored valuations >$100M
- **Calm / Headspace** — $1B+ each
- **Hallow** — $100M raised in 2024 (Christian audience)

For acquisition attractiveness, track these metrics from day 1 and
surface them in a founder dashboard (section 10):

- **MRR + growth rate** (month-over-month)
- **Net revenue retention** (existing cohort revenue vs 12 mo ago)
- **Churn rate** (monthly + annual)
- **CAC + payback period** (how long to pay back a customer)
- **ARPU with IAPs** (avg revenue per user including micro-purchases)
- **Engagement: DAU/MAU ratio** (stickiness)
- **Retention curves** (% of cohort still active at months 1, 3, 6, 12)

Keep metrics VC-ready from the start. Strong numbers = higher multiple.

---

## Reset notes

If something goes wrong and you want to pick up from a specific
point, these commits are key checkpoints:

- `initial static app` — just the 5 tools Amanda sketched
- `Add onboarding + Brain + Settings` — personalization + AI chat
- `Academy + Texas RDA course` — school features
- `Life tab: Faith, Family, Pregnancy...` — personal/emotional side
- `Letters to baby v2` — templates + voice + AI tidy + exports
- `Meals + Grocery` — practical mom add
- `Social tab + developer account guidance` — current state

Use `git log --oneline` to find specific hashes.

---

**Ryan: sleep well. Amanda already loves it. Tomorrow we turn the gift into a business.**
