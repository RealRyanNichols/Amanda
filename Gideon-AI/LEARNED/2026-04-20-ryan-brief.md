# 2026-04-20 — Ryan's founding brief for Gideon

## What Ryan said (paraphrased + direct quotes)

> "The Brain is not a feminine product. The Brain is an actual AI.
> I'm trying to build my own AI within all of this system that uses
> you [Claude], but like it builds its own version with its own
> prompts, its own thing, collects its own data from its own people,
> but it stores it in a specific way to where it can call upon that
> should somebody need it."

> "It has it, and maybe if it starts getting too much data, or if it
> says you know what I already have this overlapping data right here,
> I could actually snip it, put a note in here that says I've had it
> twice — and that note is 10 times shorter than keeping the double."

> "I need to keep a lot of data. The Brain is not just feminine.
> Think of another name. Something stronger, more warrior-like — Greek,
> ethos, Christian, old school, foundational, patriarch. Love of
> country, God, Jesus. All of those go into this AI name."

> "This AI is gonna be used across multiple platforms, not just this
> platform. The Brain is going to be its own thing. I'm gonna build
> out The Brain and hold of the program."

> "These are gonna be notes that will be used for that along with
> other notes that are taken on other platforms on other projects
> that I'm doing just like this one. So keep the notes stored. The
> notes, put them together."

## On the counter-narrative

> "People [are] saying AI is demonic. I think it could be used for a
> lot of great good if you use it for good. So let's pick a name out
> of the bible that fits me best. Fits my vision best."

## On visual quality

> "I want my AI to be sharp. Really sharp. And when you look at it,
> you're like, man, like, that's sharp. That's a $100 million, a
> billion dollar right there — because I'm trying to sell this thing.
> So it can't be no regular app with no square buttons. Like, this
> has gotta be state of the art type tech."

> "Make sure everything is mobile view. Desktop view secondary, but
> also if it's viewed on a desktop, it can be viewed perfectly on a
> desktop, but I want the mobile version to be sharp. Perfect, crisp,
> clean. I want it to look like some top tech websites out there —
> go look and research some of the top 10 tech websites for what
> we're trying to do and make it look like there's a combo of theirs,
> but better. Edge or different."

Benchmarks named + implied: Linear, Vercel, OpenAI, Anthropic,
Raycast, Stripe, Cursor, Figma, Notion, Framer.

## On naming + branding follow-through

> "I like Gideon. Now is there a cool thing that we could do with
> Gideon? Is there a cool name that we could do with it? Like,
> shorter than what it looks? What's the color concept, what is the
> logo concept, what is the wording concept? I like four-letter names.
> Gideon six, that'll do — Gemini is six, ChatGPT is seven, so
> Gideon would be fine."

## Portfolio Gideon will serve

Captured across this conversation:

- realryannichols.com
- leadflowpro.com
- repwatcher.com (also spelled repwatcar.com)
- premierdentalacademyoflongview.com
- Amanda's Nest (mom app — this repo)
- Future: couples apps, other client apps

## On the data architecture

Ryan's ask: memory + dedup + cross-project recall. See
`ARCHITECTURE.md` for the design Claude proposed:

- `brain_memory` table, deduped on `(project, kind, content_hash)`.
- Occurrence counting — "seen 10 times" is a pointer, not 10 rows.
- Summarization when content is long + seen often.
- Cross-project retrieval gated by subscription tier.

## What was decided in this session

- **Name**: Gideon (final — see `LEARNED/2026-04-20-naming.md`).
- **Folder**: `Gideon-AI/` (this folder). Canonical source for all
  Ryan's repos.
- **Palette**: night + bronze + flame (see `DESIGN.md`).
- **Visual benchmark**: Linear × Anthropic × Vercel — sharp, warm,
  evidence-led.
- **Voice**: operator. Direct. Evidence over opinion. No hedging.
- **Data model**: Supabase `brain_memory` with content-hash dedup +
  tier-gated retrieval via Edge Functions.
- **Cross-product**: every Ryan Nichols product links here via
  `Gideon-AI/CLAUDE.md`.

## Open questions still on Ryan's desk

1. Auto ingestion vs. explicit contribute? (recommended: Mode B /
   explicit for The Nest, Mode A for Lead Flow Pro. See ARCHITECTURE.md.)
2. IP ownership of contributed memories? (recommended: user retains
   ownership, licenses use to Ryan's products.)
3. When does Gideon get his own dedicated domain + marketing site?
   (recommended: after The Nest's first 100 subscribers prove the
   moat works in-product.)
