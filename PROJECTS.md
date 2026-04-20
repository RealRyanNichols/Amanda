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
