# CapCut — what's actually possible, what isn't

**Short version:** CapCut does not expose a way to embed their editor, their
login, or their rendering engine in a web app. I investigated it before
committing any code so we don't build on a fantasy.

## What Ryan asked for

> "I want CapCut to be able to be uploaded and for them to be able to use
> CapCut's integration API and put it right on our website so they can log in
> to CapCut using their Facebook, TikTok, or Instagram. And if not, they can
> use CapCut using Apple ID or however they need but I want them to be able
> to make their reels all inside the app."
>
> "And I kind of want if they upload baby photos and their child photos, I
> want ours to be able to create a template style video for them or an edited
> photo collage of them and their baby or their family and the things that
> they have inside of there based on what it looks like and what they
> uploaded and what they've said."

Two requests: **(a) embed CapCut**, and **(b) auto-generate reels/collages
from the photos she uploads**.

## Reality check on CapCut (April 2026)

I searched CapCut's developer docs, partner program, and third-party
integration guides. Here is the honest landscape:

| Thing                                    | Available?                    | Notes |
|------------------------------------------|-------------------------------|-------|
| Public web API                           | ❌ No                          | ByteDance has never shipped one. |
| Browser SDK / embeddable editor          | ❌ No                          | "CapCut Web" exists as their own product, not as an iframe-able SDK. |
| Native mobile SDK (iOS/Android)          | ⚠️ Partner-only                | Requires B2B agreement with ByteDance. Designed for native apps, not PWAs. We'd need native wrappers. |
| CapCut "Open Platform"                   | ✅ But backwards               | Lets you build plugins that run **inside** CapCut. The opposite of what we want. |
| OAuth: log into CapCut from our site     | ❌ No                          | CapCut auth isn't OAuth-embeddable. No "Sign in with CapCut" button exists. |
| Deep-link hand-off (share sheet → CapCut)| ✅ Yes                         | iOS/Android share sheet lists CapCut as a target if she has the app. This works today. |
| Unofficial "CapCut API" projects on GitHub (CapCutAPI, VectCutAPI) | ⚠️ Third-party, no auth | They generate a CapCut draft file she'd open in the desktop app. Fragile, may break any time CapCut updates their format. Not safe to depend on for a paid product. |

**Conclusion:** We can't embed CapCut. We can hand photos to CapCut via the
native share sheet on mobile.

## What we ship instead

**`js/tools/reels.js` — Reel Studio**, wired into the Social tab as a new
sub-view. What it does today:

1. She uploads photos (baby, family, business). Stored as data URLs in
   `state.reels.photos` — never sent to a server unless she shares.
2. She picks a template: **Baby month milestone**, **Pregnancy countdown**,
   **Family collage**, **Business highlight reel**.
3. We render a 1080×1350 (IG portrait) collage on `<canvas>`. Captions
   auto-fill from her state (baby's week, business name, etc.) or she
   overrides.
4. Three actions:
   - **Download** — saves PNG locally.
   - **Share** — Web Share API → iOS/Android native share sheet → IG,
     TikTok, Messages, anywhere.
   - **Open in CapCut** — shares the raw photo files; CapCut appears in the
     share sheet if installed.

Zero dependencies, zero vendor lock-in, works offline (the service worker
already caches the module).

## Roadmap — in priority order

1. **Video reels via MediaRecorder** (the real "reel" part). Canvas stills →
   Ken-Burns pans → `.webm`/`.mp4`. All browser-native. ~200 lines of code,
   no libraries needed. Gated behind a "Generate reel" button so we don't
   burn battery on load.
2. **Music library** — royalty-free stems. WebAudio mixed in during recording.
3. **Captions + beat-sync** — timed overlays. Still pure Canvas.
4. **Template marketplace** — power users build + share templates; we take a
   cut. Genuine moat, since we own the format.
5. **Native wrapper (phase 2)** — if we ever decide video quality demands
   CapCut's actual engine, we wrap the PWA in a Capacitor/Expo shell and
   license the real CapCut mobile SDK via partner program. $$$ and months of
   work — only worth it once we've proven demand with the web version.

## Why this is a better outcome than a CapCut embed would have been

- **We own the format.** Users can't be held hostage by CapCut pricing, TOS
  changes, or a rug-pull (ByteDance has pulled the rug on third parties
  before).
- **Works offline.** CapCut web requires a connection; our Canvas path doesn't.
- **Zero auth friction.** No "log in with TikTok to edit a photo" dead-end.
- **Faith + family context.** Our templates speak to moms specifically — 
  "pregnancy countdown", "baby month milestone" — not generic TikTok templates.
- **Monetizable.** Premium template packs become a micro-purchase add-on.

## If Ryan still wants the CapCut route

We can try for the ByteDance partner SDK program. Honest expectations:

- 6–12 weeks of back-and-forth with ByteDance biz dev.
- Requires native iOS + Android apps — kills the PWA-only strategy.
- Revenue share or per-minute rendering fees, depending on contract.
- We'd still own zero of it.

I'd recommend shipping our Reel Studio first, earning the first 100–500
subscribers, then deciding.

— Claude, 2026-04-19
