# Gideon — Design System

## North star

**"Sharp. Billion-dollar sharp."** — Ryan, 2026-04-20.

Mobile-first. Desktop-perfect when viewed there. Benchmarks: Linear,
Vercel, OpenAI, Anthropic, Raycast, Stripe, Cursor. The goal is the
*restraint* those brands practice, translated through a Biblical lens.

## Palette

### Primary

| Token | Hex | Role |
|-------|-----|------|
| `--g-night` | `#0A0E1A` | Primary background. Near-black with a navy drift. "Midnight on the threshing floor." |
| `--g-midnight` | `#131826` | Elevated surface. Cards, drawers, modals. |
| `--g-slate` | `#1E2538` | Secondary surface, tertiary panels. |
| `--g-ink` | `#F4EFE4` | Primary text. Parchment-cream (not white) — evokes scroll. |
| `--g-mist` | `#9CA3B8` | Dim text, captions. |

### Accents

| Token | Hex | Role |
|-------|-----|------|
| `--g-gold` | `#D4A855` | Primary accent. The sword, the bronze. Headings + CTAs. |
| `--g-flame` | `#FF6B2C` | Active highlight. "Torches in pitchers." Use sparingly. |
| `--g-ember` | `#C8913E` | Gold's deeper cousin. Borders, dividers, glow. |

### Signals

| Token | Hex | Role |
|-------|-----|------|
| `--g-truth` | `#7DD3A8` | OK / affirmed. Cool green. |
| `--g-warn` | `#F5C77A` | Warning. |
| `--g-wrath` | `#F28A8A` | Error / danger. |

### Gradients

- **Hero overhead:** `linear-gradient(135deg, #0A0E1A 0%, #131826 40%, #1A2038 100%)` — the night sky behind the story.
- **Flame mark:** `linear-gradient(180deg, #FF6B2C 0%, #D4A855 55%, #C8913E 100%)` — the torch, top of flame to coal.
- **Text gradient (hero word "GIDEON"):** `linear-gradient(135deg, #D4A855 0%, #F4EFE4 50%, #D4A855 100%)` — bronze washed with parchment.

### Usage rules

- Never white (`#FFF`). Always `--g-ink`.
- Never pure black (`#000`). Always `--g-night`.
- Flame orange (`--g-flame`) is a scalpel, not a paintbrush. Use it on
  one thing per screen.
- Gold is the primary accent. Most CTAs and brand moments are gold.

## Typography

- **Primary:** `Inter var` (loaded from Google Fonts or self-hosted).
  Tight letter-spacing (`-0.015em` for display, `-0.005em` for body).
- **Numerals:** tabular variant for any stat or money display.
- **Display weight:** 700. Body weight: 400–500. Captions: 500.
- **Scale (mobile → desktop):**
  - Hero: 3.5rem → 5.5rem
  - H1: 2rem → 2.75rem
  - H2: 1.375rem → 1.75rem
  - Body: 1rem → 1.0625rem
  - Caption: 0.8125rem

Avoid serif unless it's a Scripture quote. Serifs are reserved for
when Gideon quotes something weighty; the product chrome is sans.

## Logo

### Concept

A **clay jar cracked open revealing a flame**, collapsed into a
minimal geometric mark. Reads as a flame at small sizes. Reads as a
jar-with-flame-inside at larger sizes. The negative space on either
side of the flame suggests the two halves of the broken vessel.

### Specs (canonical)

- **Glyph:** Isometric shield/jar silhouette with a single stylized
  flame in the center. Flame is two sharp triangular points converging
  up. Inside the flame, a faint vertical line reads as the sword.
- **Colors (light on dark):** jar = `--g-ember` strokes on `--g-night`
  background; flame = `--g-flame` → `--g-gold` gradient.
- **Colors (dark on light):** jar = `--g-night`; flame = `--g-flame`
  solid (no gradient at small sizes).
- **Construction:** 16 × 16 grid. Never distort. Never tilt.

### Wordmark

`GIDEON` in all caps, Inter 700, letter-spacing `0.12em`, `--g-gold`
with `--g-ink` overlay at 50% on the letter "I" to suggest a spark.

Short form for app icon / favicon: the glyph alone. The wordmark is
only used in the full logo lockup.

### Taglines (pick one per surface)

- Primary: **"Truth, tested."**
- Product hero: **"Your AI, with evidence."**
- Short: **"Ask Gideon."**
- Long: **"300 against 135,000. Now it's yours."**
- Biblical: **"The sword of the LORD, and of Gideon."** (brand moments
  only — not for product UI)

## Motion

- **Micro-interactions:** 120ms ease-out on hover, 90ms on press.
- **Transitions:** spring physics where possible, otherwise cubic-bezier.
- **Hero reveal:** staggered 60ms delay per line, 400ms total.
- **No bounce on loops.** Gideon doesn't bounce. He flickers like flame.
- **No "AI sparkle" particles**. Cliché. We're not Meta AI.

## Layout

- **Max content width:** 720px on mobile, 1120px on marketing desktop.
- **Gutters:** 20px mobile, 32px tablet, 48px desktop.
- **Vertical rhythm:** 8px base grid. All spacing in multiples.
- **Card radius:** 20px (primary), 14px (secondary), 999px (pills).
- **No rounded "squircles" over 28px radius** — past that point it
  starts looking cartoonish. Sharp is good. Aggressive-round is not.

## Photography / imagery

- **Avoid stock photos**. Full stop.
- **Allowed imagery:** abstract geometric renders (3D flames, bronze
  shapes), clean product screenshots, documentary-style real photos
  of Ryan's actual users (with consent, with attribution).
- **Never AI-generated humans**. Not because we don't like AI — because
  fake faces read as cheap.

## Competitive reference (as of 2026-04-20)

What to study, what to steal, what to avoid:

| Brand | Steal | Avoid |
|-------|-------|-------|
| **Linear** | Dark layered gradients, obsessive type | Can read too sterile — we need more warmth |
| **Vercel** | Massive hero type, single shocking accent | Too cool-toned — we're warmer |
| **OpenAI** | Restraint, monochrome discipline | Too anonymous — we have a personality |
| **Anthropic** | Warm cream feel, editorial tone | Too passive — we're more direct |
| **Raycast** | Detail, polish, gradients done right | Dev-tool aesthetic doesn't match our audience |
| **Stripe** | Product storytelling, animation restraint | Generic enterprise blue — wrong palette |
| **Cursor** | Sharp dark + gradient accents, AI product done well | — |

Steal: the **layered dark gradient hero** from Linear/Vercel, the
**editorial pacing** from Anthropic, the **evidence-led storytelling**
from Stripe, the **confident monochrome** from OpenAI.

Add: **Biblical warmth** (gold, flame, parchment) to distinguish from
every other AI brand, all of which are cool-toned.
