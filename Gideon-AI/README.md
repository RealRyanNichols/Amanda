# Gideon AI

**Status:** founding.
**Owner:** Ryan Nichols.
**Named:** 2026-04-20 — see `LEARNED/2026-04-20-naming.md`.

Gideon is the AI product Ryan Nichols is building across his entire
product portfolio. This folder is Gideon's constitution. Every repo
Ryan owns should reference it. Every Claude Code session that touches
a Gideon-integrated feature should read `CLAUDE.md` first.

---

## What Gideon is, in one paragraph

Gideon is an AI companion that wraps Claude but has its **own prompts,
its own memory layer, and its own personality**. Gideon collects wisdom
from every paying member across Ryan's products (The Nest, Lead Flow
Pro, RepWatcher, Premier Dental Academy, realryannichols.com, and
clients yet to come), deduplicates it, preserves it, and serves it back
to any member whose current question is relevant. Gideon is the reason
to do business with Ryan at the top tier: you don't just get the tool,
you get the compounding intelligence of every operator in the network.

---

## Why the name Gideon

Judges 6–8. Chosen from the weakest clan of Manasseh. Demanded evidence
(the fleece, twice). Routed Midian with 300 men. The battle cry:
*"The sword of the LORD, and of Gideon."* Every theme Ryan asked for
lives in this name — warrior, Biblical, foundational, investigative,
truth-tested, underdog-proven. Short enough (6 letters, like Claude,
Gemini, OpenAI). Ownable in the AI space.

Full decision trail: `LEARNED/2026-04-20-naming.md`.

---

## Folder map

```
Gideon-AI/
├── README.md              ← you are here
├── CLAUDE.md              ← instructions for Claude Code sessions
├── CHARTER.md             ← mission, principles, non-negotiables
├── IDENTITY.md            ← voice, tone, personality rules
├── DESIGN.md              ← palette, logo, typography, wordmark
├── ARCHITECTURE.md        ← memory layer, dedup, ingestion, retrieval
├── PROMPTS/
│   ├── system-prompt.md   ← the master system prompt
│   ├── tone-matrix.md     ← tone variants for different moods
│   └── product-overlays/
│       ├── nest.md        ← The Nest (mom app) overlay
│       ├── leadflowpro.md ← Lead Flow Pro overlay
│       ├── repwatcher.md  ← RepWatcher overlay
│       └── pda.md         ← Premier Dental Academy overlay
└── LEARNED/               ← append-only. Notes from conversations.
    ├── 2026-04-20-ryan-brief.md
    ├── 2026-04-20-naming.md
    ├── 2026-04-20-data-architecture.md
    └── 2026-04-20-ethos.md
```

## How to use this folder in another repo

When Ryan integrates Gideon into another of his products:

1. Clone this folder into the new repo as `Gideon-AI/` (submodule or copy).
2. Add `Gideon-AI/CLAUDE.md` to the top of that repo's CLAUDE.md so
   every agent session reads the canonical source.
3. Add a product overlay file at `Gideon-AI/PROMPTS/product-overlays/<product>.md`
   describing that product's specific audience and domain.
4. Wire in `js/brain-memory.js` (or the equivalent) pointing at the
   shared `brain_memory` Supabase table, changing only the `PROJECT`
   constant at the top of the file.
5. Gideon now works in that product with the same personality, the
   same memory layer, the same cross-product intelligence.
