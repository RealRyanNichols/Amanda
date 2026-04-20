# Bootstrap prompt for the standalone Gideon AI project

Copy-paste everything between the two `===` rulers into Claude Code
when you open a new project folder for Gideon. This is a self-contained
brief. Claude Code will know what to build.

================================================================

I'm Ryan Nichols. I'm starting a new repo that will be the home base
for **Gideon AI** — an AI product I'm building that lives across my
entire business portfolio. You are helping me build this from scratch.

## The one-sentence pitch

Gideon is an AI companion for operators that wraps Claude, has its
own prompts + memory + voice, learns from a network of real paying
members across my products, and serves that wisdom back at the exact
moment it's relevant. Not another chatbot. A tool with receipts.

## Why "Gideon"

Named for the Biblical Gideon (Judges 6–8). Chosen from the weakest
clan of Manasseh. Demanded evidence (the fleece test, twice). Routed
135,000 Midianites with 300 men who carried **torches hidden in clay
jars** — at midnight they smashed the pitchers and the enemy turned
on each other. Every theme I care about lives in this story: warrior,
underdog, foundational, evidence-tested, truth-proven. The hidden
"AI" reading in A-I-D-E-O-N (pronounced the same, stylized G reading
as A) is the brand easter egg.

Battle cry / brand moment line: **"The sword of the LORD, and of
Gideon."**

## What exists already

I've already built the canonical docs inside an existing mom-app
repo ("The Nest"). They live in a folder called `Gideon-AI/`. You
should **clone / copy that folder into this new repo as the first
step** — it's the source of truth for everything that follows. The
folder contains:

- `README.md` — overview + folder map
- `CLAUDE.md` — working rules for any Claude Code session
- `CHARTER.md` — mission, non-negotiables, brand compass
- `IDENTITY.md` — voice rules, tone variants, sample dialogue
- `DESIGN.md` — palette (night + bronze + flame), typography,
  logo spec, motion, competitive benchmarks
- `ARCHITECTURE.md` — 4-layer diagram, brain_memory schema,
  dedup algorithm, tier gating
- `PROMPTS/system-prompt.md` — master system prompt
- `PROMPTS/product-overlays/nest.md` — Nest-specific overlay
- `LEARNED/2026-04-20-naming.md` — decision trail for the name
- `LEARNED/2026-04-20-ryan-brief.md` — my founding direction
- `LEARNED/2026-04-20-wordmark-ideas.md` — AIDEON stylized wordmark

Read **all of those** before writing any code. Treat them as the
spec.

I've also already built in the Nest repo:
- A `brain_memory` Supabase table (migration `0006_brain_memory.sql`)
  — dedup by `(project, kind, content_hash)`, occurrence counting,
  summary column for long + often-seen memories
- Two Supabase Edge Functions: `brain-ingest` and `brain-query`
- A browser-side ingestion module: `js/brain-memory.js`
- A Gideon SVG logo: `assets/gideon/logo.svg` (clay jar cracked
  open with a flame, bronze + flame gradient palette)
- A standalone marketing page: `marketing/gideon.html` (Linear /
  Vercel / Anthropic-tier quality, full custom CSS, mobile-first)

Copy these into the new repo too. The whole point of the new repo
is to make these the **canonical versions** that my other products
consume.

## What this new Gideon-AI repo IS

The central home for Gideon as a product. It serves four purposes:

1. **Canonical docs** — the `Gideon-AI/` folder is authoritative
   here. My other repos reference this.

2. **Shared JavaScript package** — `packages/brain-memory` is an
   importable module any of my product apps can depend on to
   contribute + query memories. Single source for the dedup logic,
   the tier gates, the retrieval contract.

3. **Server-side infrastructure** — the Supabase migrations + Edge
   Functions live here canonically. Deploy from here.

4. **Operator dashboard** — a private web UI I can log into to
   inspect the Brain's knowledge base, see what's high-occurrence,
   prune junk, add my own hand-authored memories, and manage
   access tiers. Think "phpMyAdmin for my wisdom layer".

It is **not** a user-facing chat product on its own. Users always
hit Gideon through one of my product apps (The Nest, Lead Flow Pro,
RepWatcher, Premier Dental Academy, realryannichols.com). This repo
is the hub; those repos are the spokes.

## The portfolio Gideon serves

- **realryannichols.com** — my personal coaching site
- **leadflowpro.com** — sales pipeline / lead management SaaS
- **repwatcher.com** (also `repwatcar.com`) — auto-rep tracking
- **premierdentalacademyoflongview.com** — dental school
  (operated with my fiancée Amanda Williams)
- **The Nest** — mom app (this is where Gideon was born)
- Future client apps white-labeled under Gideon

## Tech stack (recommended — use unless you have a strong reason
   not to)

- **Runtime:** Node.js 20+, TypeScript.
- **Monorepo:** pnpm workspaces. Structure:
  ```
  Gideon-AI/                  ← canonical docs (from The Nest repo)
  packages/
    brain-memory/             ← the shared JS package for ingest + query
    design-tokens/            ← palette + type scale as JSON/CSS vars
    ui/                       ← optional shared React components
  supabase/
    migrations/
    functions/
      brain-ingest/
      brain-query/
      brain-summarize/        ← new: summarization cron + on-demand
  apps/
    dashboard/                ← my operator dashboard (Next.js 15)
    marketing/                ← the Gideon sales site (Next.js 15)
  ```
- **Backend:** Supabase (Postgres + Edge Functions + Auth).
- **Frontend:** Next.js 15 with App Router. Tailwind for styles +
  the design-tokens package for palette. Framer Motion for
  animations.
- **LLM:** Anthropic Claude. Default `claude-sonnet-4-6`, with
  `claude-opus-4-7` for premium retrieval + summarization.
- **Deploy:** Vercel for both apps. Supabase-hosted functions.

If you want to deviate from this stack, stop and ask me first.

## First tasks for this session

1. **Initialize the repo.** `pnpm init`, set up the workspace,
   create the folder skeleton above.
2. **Copy the Gideon-AI folder** from my Nest repo (I'll paste its
   contents in a follow-up message, or you can fetch from the
   GitHub URL: `https://github.com/RealRyanNichols/Amanda/tree/claude/amanda-business-tools-RpCj8/Gideon-AI`).
3. **Copy the Supabase migration** `0006_brain_memory.sql` into
   `supabase/migrations/0001_brain_memory.sql` (it's the first
   migration in this repo's lifetime).
4. **Copy the Edge Functions** `brain-ingest` and `brain-query`
   into `supabase/functions/`.
5. **Port `js/brain-memory.js`** into `packages/brain-memory/`
   as TypeScript. Export:
   - `contributeMemory({ kind, content, tags, accessTier })`
   - `queryBrainMemory({ query, tags, limit, crossProject })`
   - `setContributeToBrain(enabled)`
   - `normalizeForHash(text)` and `hashContent(text)` utilities
   Add proper types. Add a `PROJECT` config that's set at package
   init rather than hardcoded.
6. **Copy the SVG logo** `assets/gideon/logo.svg` into
   `apps/marketing/public/brand/` and `packages/design-tokens/`.
7. **Initialize the marketing site** (`apps/marketing/`) by
   porting my existing `marketing/gideon.html` into a Next.js 15
   App Router page. Replace inline styles with Tailwind that
   matches the palette in `DESIGN.md`.
8. **Initialize the dashboard** (`apps/dashboard/`) as a Next.js
   15 App Router app with:
   - Supabase auth (email-only for now — I'll be the only user)
   - A "Memories" table view: filter by project, tag, kind,
     occurrences. Sort by occurrences desc.
   - A "Compose" page where I can hand-author memories.
   - A "Stats" page showing total memories, per-project counts,
     tier distribution.
   - All queries use the service role via a `/api/brain-query-admin`
     route (the public Edge Function is tier-gated; this one is
     full-access for me only).

## Design system quick reference

Full spec in `Gideon-AI/DESIGN.md`. Quick version for this session:

- **Palette:**
  - `--g-night` `#0A0E1A` — primary background
  - `--g-midnight` `#131826` — elevated surface
  - `--g-slate` `#1E2538` — secondary surface
  - `--g-ink` `#F4EFE4` — primary text (parchment-cream, NEVER
    pure white)
  - `--g-mist` `#9CA3B8` — dim text
  - `--g-gold` `#D4A855` — primary accent (most CTAs)
  - `--g-ember` `#C8913E` — gold's darker cousin
  - `--g-flame` `#FF6B2C` — highlight (use sparingly, one thing
    per screen)
  - `--g-truth` `#7DD3A8` — ok / affirmed
- **Typography:** Inter variable, 700 display, 400–500 body. Tight
  letter-spacing (-0.015em display, -0.005em body).
- **Wordmark:** `GIDEON` in Inter 700, uppercase, 0.08em
  letter-spacing, gold gradient to parchment.
- **Logo:** The SVG flame-in-jar mark. Never tilt. Never distort.
  Never white.
- **No pure white, no pure black.** Ever.
- **Max card radius: 28px.** Past that it's cartoonish. Gideon is
  sharp, not round.

## Voice rules quick reference

Full spec in `Gideon-AI/IDENTITY.md`. The highlights:

- Open with the answer. Short sentences. Never "I think", never
  "as an AI", never "I'm happy to help".
- Cite evidence from the network when available.
- Refuse scope (medical, legal, tax, crisis) cleanly and point to
  real humans.
- Tone dial changes register, not identity.

## Architecture quick reference

Full spec in `Gideon-AI/ARCHITECTURE.md`. The important bits:

- One Supabase table: `brain_memory`.
- Dedup on `(project, kind, content_hash)`. Duplicates increment
  `occurrences`, update `last_seen_at`. Never a second row.
- Summary generated when `occurrences >= 3` AND `length > 500`.
- Access tiers: public → core → ultra → internal.
- RLS locked — everything flows through Edge Functions.
- Cross-product retrieval gated by tier.

## What NOT to do this session

- Don't build user-facing chat UI. That belongs in the product
  apps (Nest, LFP, etc.), not here.
- Don't wire a custom LLM. Start with Claude via Anthropic SDK.
- Don't invent new design tokens. Use what's in `DESIGN.md`.
- Don't rename anything. Gideon is Gideon.
- Don't push to main without me confirming. Create a branch
  called `bootstrap/initial-scaffold` and push there. I'll review
  the diff before merging.

## Open questions (save for when I'm back)

1. Should memory ingestion be auto (classify every message with a
   cheap model) or explicit (user taps "contribute")? Lean auto
   for LFP, explicit for Nest.
2. Who owns the memories legally — me, the contributing user, or
   both? Likely: user retains ownership, licenses use to me for
   my products.
3. What's the cadence for summarization — on-write trigger,
   nightly cron, or both?

Start with steps 1–8 above. Ask if you hit anything ambiguous.

Battle cry: **The sword of the LORD, and of Gideon.**

================================================================
