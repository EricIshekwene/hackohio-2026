# UX critique of v1

At about 8:15 PM, while the visual redesign was starting, we reviewed the v1 flow screen by screen as a first-time user on a phone would meet it, and wrote down everything that would confuse or stall them. 19 items, ranked. The top 12 went to the build at about 8:20 PM; the rest followed. **18 of 19 were done in v2.** The 19th (pack orientation) was later covered by letting people send 1–3 photos from any side.

The "Fix" column summarises the v2 build; the client code in `client/src/screens/` is the exact record.

## P0: would make someone misread the answer

| # | Problem | Fix in v2 |
|---|---|---|
| 1 | The next step wasn't in the verdict card; you had to scroll to learn what to do | The tier's next step sits inside the verdict card |
| 2 | Evidence was shown twice (reasons and the table said the same thing) | One comparison table; reasons in their own tab |
| 3 | The 4-colour legend sat right under the verdict and competed with the answer | The legend moved behind one ⓘ button next to the verdict |
| 4 | On "We couldn't check this", the primary button was the wrong action | Primary becomes "Add the NAFDAC number", which focuses that field |
| 5 | Focusing a low-confidence field counted as reviewing it | Only "Looks right" or an actual edit clears a flag |

## P1: would stall or strand someone

| # | Problem | Fix in v2 |
|---|---|---|
| 6 | The Check button looked tappable but did nothing until the tick | Button state and the reason it's disabled are explicit |
| 7 | Check errors appeared out of view | Errors show next to the action |
| 8 | Switching to the typed fallback lost the photo | Photos kept so they can be copied from |
| 9 | Back was fragile | Back always goes to the previous meaningful step (fully specified in the [hardening pass](../planning/04-hardening.md)) |
| 10 | The stepper "lied" on the typed path (showed Snap and Read) | Typed path shows Type · Check · Result |
| 11 | The manual form gave no orientation (which field is where on a pack) | Hints on each field |
| 12 | The report took too many steps | One screen: editable draft, Send email / Call / Share |

## P2: polish

| # | Problem | Fix in v2 |
|---|---|---|
| 13 | Jargon ("R3", "applicant") | Plain words: "licence holder", "Spelling differs from NAFDAC's record" |
| 14 | Small text | Body 15 px, caption 12 px minimum |
| 15 | "Not proof of authenticity" with no explanation | The same ⓘ explains what the four colours mean and why green is not proof |
| 16 | Waits looked frozen | A step list that ticks off while reading and checking |
| 17 | A pharmacist checking many packs had to restart each time | "Check another pack" goes straight to Snap |
| 18 | The landing had 4 competing entry points | Two: Scan, or Type it |
| 19 | No help with which side of the pack to photograph | Later: 1–3 photos from any side |

## The colour rule that came out of it

Colour is only for verdicts. Buttons are black. The brand green is only the logo, progress and focus. Before this rule, a green button on a page with a green verdict read as "safe".
