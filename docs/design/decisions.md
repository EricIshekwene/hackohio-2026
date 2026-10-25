# Design decisions, and the redesign

## 1. v1: the Decisions page (7:38 PM)

Before any client code, we put 18 design decisions on one interactive page, each with a recommended option, alternatives and a mid-fidelity mockup, so Eric could pick quickly instead of reviewing a finished build. Eric picked 15; the last three (component library, font, light/dark) went with the recommendation.

| # | Decision | v1 choice | Alternatives | Still true in v2? |
|---|---|---|---|---|
| 1 | Component approach | shadcn/ui on Base UI, only what we need | Plain Tailwind · full shadcn kit | Yes, and more components |
| 2 | Typeface | Bricolage Grotesque | Plus Jakarta Sans · IBM Plex Sans | **No: Geist** |
| 3 | Brand colours | Eric's dark greens + white | Registry blue `#2340B8` | **No: black and white, green as accent only** |
| 4 | Stepper | Snap · Read · Confirm · Result; Report separate | Capture · Confirm · Verdict | Yes, plus Type · Check · Result on the typed path |
| 5 | Laptop layout | Centred 430 px column | Two columns · phone frame | Yes |
| 6 | Snap screen | Light card with dashed pack outline | Dark viewfinder | **No: dark capture stage** (Zocdoc reference) |
| 7 | Reading state | Photo with scan line + skeleton rows | Spinner · skeletons only | Changed to a ticking step list |
| 8 | Confirming fields | One "These details match the pack" tick, but low-confidence rows must be tapped first | Attestation only · ✓ every row | Yes |
| 9 | AI confidence | AI badge + dot + amber row on low; tap shows what was read | Percentage · badge only | Yes, as a flagged row with the reason |
| 10 | Read errors | Inline card (Retake / Try again / Type it in) | Full-screen · toast | Yes |
| 11 | Verdict card | Tinted full-width card | Big centred icon · score badge | Yes |
| 12 | Comparison | 3 columns: Field / On the pack / NAFDAC record | Stacked rows · two cards | Yes, the centre of every result |
| 13 | Detail open by default | Reasons + alerts open | All open · all collapsed | Changed to tabs (Compare / Why / Checked) |
| 14 | Legend placement | Inline row of 4 chips under the verdict | Behind an ⓘ | **No: behind one ⓘ button** (UX critique #3) |
| 15 | Report | Full page with Back | Bottom sheet | Yes |
| 16 | Verdict actions | Sticky bottom bar | Inline at the end | Yes |
| 17 | Landing | Minimal + demo-pack chips | Illustration hero · no landing | Changed: headline, how it works, data strip |
| 18 | Theme | Light only | Light + dark | Yes |

v1's palette was Eric's dark greens: `#071E07`, `#0D330E`, `#2D531A`, `#477023`, `#6E8649`, Mist `#E4ECDD`, Paper `#F3F6F0`. Copy was rewritten to sound less like a form: "Show us the pack", "Does this match your pack?", "Know what NAFDAC says."

## 2. "Vibecoded" (8:10 PM)

v1 shipped at 8:04 PM (6720f18). Eric's verdict a few minutes later: it looked **"vibecoded"**. Then: **"too much green."** What he asked for:

- A clean, top-tier health-startup look built from Mobbin references.
- Full shadcn/ui on Base UI (overriding the spec's "no heavy libraries").
- Every step fits one viewport with no extra scrolling, and a guided flow.
- Mostly white and black, green as an accent; the brand mark stays green.
- The bar: Apple, Figma, Resend, Railway.

![v1 verdict screen](screens/v1-verdict-hero.webp)

A small false start is worth recording honestly: at 8:13 PM an agent committed THEME tokens for the new palette (3fe0001) and reverted them a minute later (bb1b2d8), because the feedback had been meant for a different agent working on the same repo. Two agents on one `main` with no PRs (the team's rule) means a mistaken commit is visible, and the revert is too.

## 3. v2 (8:29 PM)

We searched Mobbin again for calm, high-trust products ([references](mobbin-references.md)), wrote the [design system](design-system.md), ran a [UX critique](ux-critique.md) of the v1 flow in parallel, and rebuilt the client in 162fa91. A design audit followed at 8:37 PM (f916a13).

## 4. Later design decisions

| When | Decision | Why |
|---|---|---|
| 9:36 PM | Live camera with a guided 3-shot set (front, NAFDAC number, batch) | Packs print fields on different sides |
| 9:51 PM | **Reversed:** a generic set of 1–3 photos from any side, no guided shots | Eric: the guided sequence felt like a form; the AI can work out which side is which |
| 9:44 PM | Camera and photo library both ways, multi-pick | Eric: once the camera was used there was no way back to picking photos |
| 11:07–11:13 PM | New start screen and home page: headline first, how it works, a data strip, an example comparison with no verdict line | The start screen is the first frame of the video |
| 11:12 PM | Neutral "Not given" for empty fields; the caveat never cut off; Retake clears the set | Real-browser end-to-end run |
