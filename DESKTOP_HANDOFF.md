# Desktop Handoff — Picking Up Tonight

Ryan — when you fire up Claude desktop (or Claude Co-worker), paste any of these prompts to continue exactly where we left off. Each section is self-contained, so you don't have to do them in order.

Last commit on branch `claude/amanda-business-tools-RpCj8`: check `git log -1`.

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

## 3. Stripe subscription billing

Paste this after Supabase auth is working:

```
Add Stripe subscriptions with these tiers:

- Free: 7-day full-feature trial (no card needed), then read-only
- Solo: $19/mo or $190/yr — full features, single user
- Pro: $29/mo or $290/yr — full features, export everything, priority
  support (flag for now, no real support system yet)
- Academy: $49/mo or $490/yr — adds multi-instructor support for
  schools that will come in a later phase; includes everything

Use Stripe Checkout (not Elements) for simplicity. Webhook to a
Supabase Edge Function that updates users.subscription_status. Gate
premium features behind subscription_status = 'active' | 'trialing'.

Start with:
1. Stripe Products + Prices (I'll create them in the dashboard,
   paste you the price IDs after)
2. A Supabase Edge Function: stripe-webhook.ts handling
   checkout.session.completed, customer.subscription.updated,
   customer.subscription.deleted
3. Client-side: a "Subscribe" button in Settings → add a "Billing"
   card. When free-trial ends, show an in-app modal prompting upgrade.
4. Stripe Customer Portal link so users can cancel themselves
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

## 10. Reset notes

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
