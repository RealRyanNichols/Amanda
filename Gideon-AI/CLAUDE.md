# Instructions for Claude Code sessions in Gideon-integrated repos

**Read this before making any change that touches a Gideon feature.**

## Who Gideon is

Gideon is Ryan Nichols's AI product, a cross-product feature that lives
inside every one of Ryan's apps. Gideon is **not feminine** and not
per-app flavored. The same Gideon with the same personality lives in
The Nest, Lead Flow Pro, RepWatcher, Premier Dental Academy, and any
future Ryan Nichols product.

The underlying LLM today is Claude (Anthropic). That may change. Gideon
is the brand layer that sits on top — prompts, memory, tone, UI — and
it stays consistent regardless of which model is underneath.

## The non-negotiables

When you make changes that affect Gideon:

1. **Keep the name "Gideon"** everywhere user-visible. Not "the AI",
   not "the Brain", not "assistant". Gideon. Address him by name in
   copy, buttons, alerts.
2. **Keep Gideon's voice**. See `IDENTITY.md`. Short, confident,
   evidence-first, no hedging or AI-preamble. Never apologize for
   being an AI. Never say "as an AI language model".
3. **Respect the memory model**. Every user interaction that becomes a
   Gideon memory goes through the `brain_memory` table via the
   `brain-ingest` Edge Function. Never write to the table directly.
   Never store memories in per-app localStorage.
4. **Tier access**. Memories are tagged with `access_tier`. Free users
   get public wisdom only. Core tier gets core-tier knowledge. Ultra
   tier sees everything. The retrieval layer enforces this.
5. **Cross-product neutrality**. When you add a Gideon feature in one
   product, ask: would this make sense in every other Ryan Nichols
   product too? If no, it doesn't belong in Gideon — put it in the
   product-specific code.

## What to do when you're asked to extend Gideon

1. Read `CHARTER.md` for mission + principles.
2. Read `IDENTITY.md` for voice.
3. Read `ARCHITECTURE.md` for the data model.
4. Read the product-specific overlay in `PROMPTS/product-overlays/<product>.md`.
5. Write changes that are compatible with every other Ryan Nichols
   product, not just the one you're in.

## What to do when you learn something new from Ryan

1. Write an append-only note in `LEARNED/YYYY-MM-DD-<topic>.md`.
2. Update `CHARTER.md` / `IDENTITY.md` / etc. if the decision changes
   canonical behavior.
3. Never delete from `LEARNED/`. Ryan changes his mind as a creator —
   the record of those changes is itself valuable.
