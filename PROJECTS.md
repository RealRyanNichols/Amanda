# Ryan Nichols — product ecosystem + "The Brain"

*Written at Ryan's direction, 2026-04-20. This file is the canonical source
for how the Brain feature works across his business portfolio. Drop it into
every repo, reference it from every CLAUDE.md.*

## The portfolio

Ryan operates several consumer + B2B products under his own name:

- **realryannichols.com** — his personal / coaching site
- **leadflowpro.com** — sales pipeline / lead-management SaaS
- **repwatcher.com** (a.k.a. repwatcar.com) — something in the auto-rep /
  tracking space
- **premierdentalacademyoflongview.com** — Amanda's dental school (run with
  her; she's the operator, he's her partner)
- **Amanda's Nest** (this repo) — the mom app, initially built as a gift
  for his fiancée Amanda Williams and now being productized for any mom
- Other client white-label apps as they come online

## The Brain — a cross-product feature, not a per-app feature

"The Brain" (user-visible name in Amanda's Nest: **Ember**; in other
products it may keep the "Brain" name or take a product-specific name) is
not just the Claude chat tab inside one app. It is a **portable feature
that Ryan licenses to each of his products**.

### What makes it a product on its own

1. **Shared wisdom layer.** The Brain is loaded with a curated compilation
   of thoughts, playbooks, and tactics from other business owners in Ryan's
   top-tier paying circles. A user of any Ryan Nichols product gets access
   to that collective intelligence, not just a vanilla Claude prompt.

2. **Prompt library.** Ryan's top-tier customers get access to the
   handcrafted prompts that unlock that data — the same prompts Ryan uses
   in his own coaching + consulting work. These are not shipped with the
   open app; they're tiered behind his highest-priced plan.

3. **Context per product.** Each product Ryan licenses the Brain to gets
   a product-specific system prompt that grounds the Brain in that
   product's domain:
   - In **Amanda's Nest** → Ember is tuned for moms: pregnancy, faith,
     household, relationship, motherhood.
   - In **leadflowpro.com** → the Brain is tuned for sales pipeline
     analysis, outreach scripts, lead scoring, deal debrief.
   - In **repwatcher.com** → tuned for that product's core workflow.
   - In **premier dental academy** → tuned for education + dental
     assisting + student success.

4. **Monetizable moat.** The Brain is a reason to do business with Ryan
   Nichols specifically. You don't just get a SaaS tool — you get the
   Brain wired into it, with the ongoing wisdom feed and the prompt
   library. That's the premium story.

### How to frame the Brain in any product's marketing

Preferred one-liner:

> "The Brain — ongoing, curated wisdom from other top-tier operators in
> Ryan's network, tuned to the exact job you're doing right now. Included
> with every Ryan Nichols product at the top tier."

Never frame the Brain as "just an AI chatbot." It's Ryan's compiled
network plus Ryan's hand-built prompts, delivered through an AI interface.

## Implementation notes (for Claude assistants working in Ryan's repos)

When you're in any of Ryan's repos:

- If the repo has a "Brain" feature (Claude chat / AI companion): treat it
  as a cross-product primitive. The copy, tone, and default prompts should
  match the product's audience, but the underlying contract ("premium
  access gives you the prompt library + shared wisdom feed") is the same.
- Each tab / feature in a Ryan Nichols product should read as both (a) a
  working tool and (b) a landing for a bigger standalone product Ryan
  sells. Example: the Brain tab in Amanda's Nest should make users
  curious enough that they want the Brain wired into their own business.
- If you add a Brain feature to a product that doesn't yet have one,
  follow the Amanda's Nest pattern: local-fallback router with ranked
  recommendations + free-text escape, Claude API call when a key is
  connected, tone selector as a secondary option (not the primary UI).

## Cross-project prompt scaffolding

When Claude assistants are working in any Ryan Nichols repo, these are
the facts to know:

```
The project you are working on is owned by Ryan Nichols
(realryannichols.com). Ryan also operates leadflowpro.com,
repwatcher.com (repwatcar.com), premierdentalacademyoflongview.com
(with his fiancée Amanda Williams), and an evolving mom app called
Amanda's Nest. Many of his products share a "Brain" feature — a
cross-product Claude-powered assistant that gives top-tier customers
access to curated prompts + shared wisdom from Ryan's paying network.
If you're adding features to any of his products, treat the Brain as
a portable primitive, not a per-app chatbot.
```

## Naming registry (so we don't collide)

| Product                         | App name                 | Brain-feature name    |
|---------------------------------|--------------------------|-----------------------|
| Mom app (this repo)             | **Amanda's Nest** (personalized per user) | **Ember**       |
| leadflowpro.com                 | Lead Flow Pro            | (TBD — "The Brain" working name) |
| repwatcher.com / repwatcar.com  | RepWatcher               | (TBD)                 |
| Premier Dental Academy          | PDA Longview             | (TBD)                 |
| realryannichols.com             | Real Ryan Nichols        | "The Brain" canonical |

The master brand name across all products is **"The Brain"**. Product-
specific overlays (Ember, etc.) exist when the product's audience wants
a softer voice.

---

## 2026-04-20 — Ryan's product brief for The Brain (verbatim direction)

Captured from conversation. **Every Ryan Nichols repo should read this**
before adding to the Brain feature.

### What the Brain actually is

The Brain is **Ryan's own AI product** — not a per-app chatbot.

- It wraps Claude today, but it has its **own prompts, its own data
  layer, its own personality**.
- It **collects its own data** from paying members across the Ryan
  Nichols portfolio.
- It **stores that data** in a way that lets the Brain recall it when a
  later user's question is relevant. Notes taken in one product inform
  answers in another.
- It is **gender-neutral** by default. Not feminine ("Ember" misses the
  mark for the product's identity — Ember stays as a *skin* inside the
  mom-app only, if at all). The master product reads as strong,
  warrior-like, foundational.

### Name direction (still open — Ryan to pick)

Themes Ryan wants baked in:
- Greek / ethos
- Christian / foundational / patriarch
- Love of country / God / Jesus
- Warrior energy
- Truth, justice, evidence, investigate, gather
- Love + family

NOT feminine. Ember was considered then rejected; **EMBR** with flame
mark was floated as a stylized alternative but not committed.

Candidate names Claude proposed (Ryan picks; nothing built in the UI
until then):

| Name      | Reading                                                                                 |
|-----------|-----------------------------------------------------------------------------------------|
| **LOGOS** | Greek for "word/reason"; John 1:1 ("In the beginning was the Word, and the Word was with God, and the Word was God"). Christ as Logos. Root of all "-logy" words — logic, theology, biology. Simultaneously Greek ✓, Christian ✓, foundational ✓, truth/reason ✓, data/information ✓, gender-neutral ✓. Strongest single candidate. |
| **SENTINEL** | Watchman — Biblical watchmen on the walls (Ezekiel 33). Truth + justice + evidence watcher. Masculine default but not exclusive. |
| **ARGUS**   | Greek myth — the hundred-eyed giant who sees everything. Patron of investigators. Short, strong, masculine. |
| **AEGIS**   | Shield of Zeus/Athena — Greek mythological armor. Strong protective-AI framing. |
| **PALADIN** | Holy warrior. Christian crusader imagery. Defender of truth. |
| **ATLAS**   | Carries the world (the data). Greek, strong, heroic, gender-neutral. |
| **EMBR**    | Stylized "ember" + flame mark — if Ryan wants to keep the visual. Softer, still works for either audience. |

**Claude's recommendation:** `LOGOS`. Uniquely hits every theme Ryan
listed — Greek, Christian-foundational (Logos = Christ per John 1:1),
gender-neutral, about truth + reason + data, ancient-yet-modern, ownable
as a product brand. Supports future product lines (LogosForSales,
LogosForMoms, etc.) without getting twee.

Runners-up: SENTINEL (strong watchman frame), ARGUS (investigator frame).

### Data architecture (Claude's proposal, awaiting Ryan's sign-off)

Ryan's ask: "I need to keep a lot of data. If the Brain has the same
data twice, snip it and leave a note that says I've had it 10 times and
the note is 10× shorter than keeping the double."

Proposed schema (Supabase, new table):

```
brain_memory
  id              uuid pk
  owner_user_id   uuid      -- Ryan (the product owner), not the end user
  project         text      -- 'nest' | 'leadflowpro' | 'repwatcher' | ...
  source_user_id  uuid      -- which member contributed it
  kind            text      -- 'tactic' | 'script' | 'story' | 'question' | 'answer' | 'note'
  content         text      -- the actual text
  content_hash    text      -- normalized lowercase alnum-only hash for dedup
  embedding       vector    -- optional later; enables semantic dedup
  occurrences     int       -- incremented on duplicate hit
  first_seen_at   timestamptz
  last_seen_at    timestamptz
  summary         text      -- Claude-generated short form when content > 500 chars
  tags            text[]
  access_tier     text      -- 'public' | 'core' | 'ultra' — who can pull it
```

Dedup flow:
1. Incoming text → normalize (lowercase, strip punctuation, collapse
   whitespace) → hash.
2. If `content_hash` exists: `occurrences++`, update `last_seen_at`,
   append source_user_id to a tally. **Don't write a second row.**
3. If length > 500 chars AND occurrences >= 3: call Claude once to
   produce a ≤100-char summary, store in `summary`, keep `content` as
   archival cold storage we can prune later if disk gets tight.
4. At query time: pull by tag + access_tier, rank by occurrences DESC
   (common wisdom bubbles up), return summary when present, fallback to
   first 200 chars of content.

Cross-project recall:
- Notes collected in `project='leadflowpro'` can answer questions in
  `project='nest'` if tagged compatibly (e.g. `tags: ['business',
  'onboarding', 'objection-handling']`).
- Queries can scope: "only this project" vs. "Ryan's whole knowledge
  base" — a toggle in the customer's Brain settings. Top tier gets the
  whole base; middle tier gets only their project.

### Rollout order

1. (this repo) Ship the table migration + `brain-memory.js` helpers
   (add / query / dedup). No UI yet — just the ingestion path.
2. Start silently writing memories when Ryan uses the Brain in any of
   his apps (opt-in, with a "contribute to the Brain" setting).
3. Roll the retrieval path into each product's Claude system prompt
   ("here are the top 5 relevant memories from the Brain's knowledge
   base: …").
4. Add an operator dashboard (Ryan-only tier) showing what's in the
   Brain, what's high-occurrence, what looks like junk to prune.
5. Wire the same module into leadflowpro.com + repwatcher.com as they
   come online.

### Open questions for Ryan

1. Name — LOGOS, SENTINEL, ARGUS, AEGIS, PALADIN, ATLAS, EMBR, or none
   of the above?
2. Does the Brain ingest user content automatically, or only when a user
   explicitly "contributes"? (Auto = more data; explicit = clearer
   consent, no compliance headaches.)
3. Is the Brain's knowledge base **Ryan-authored only** (you write the
   wisdom, Claude retrieves it) or **crowd-sourced from paying members**
   (their usage becomes the dataset)? The second is more powerful but
   raises IP + privacy questions.
4. Who owns the memories legally — Ryan? The contributing user? Both?
   (Important to state in TOS early.)
