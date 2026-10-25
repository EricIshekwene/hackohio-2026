# Verdict rules: how code decides the colour

**The principle, set in the research and never changed:** the AI reads the pack, the person confirms what it read, and **deterministic code decides the verdict**. No model call sits between the confirmed fields and the colour. The live rules table is in [server/README.md](../../server/README.md#rules-worst-colour-wins-every-rule-that-fired-is-listed); this page explains why each rule looks the way it does and how it changed overnight.

## 1. The four tiers

Locked in [`shared/legend.ts`](../../shared/legend.ts) and imported by both server and client, so no screen can retype a colour or a label.

| Tier | Label | Means | Colours (solid / tint / text) |
|---|---|---|---|
| red | **Do not use** | An official alert names it, or the reg. no. belongs to a different product | #D32F2F / #FDECEA / #8E1B1B |
| amber | **Check before use** | Something doesn't line up, or we couldn't confirm registration | #F59E0B / #FEF3C7 / #92400E |
| unsure | **We couldn't check this** | The number is missing or unreadable, or the registry couldn't load | #6B7280 / #F3F4F6 / #374151 |
| green | **No problems found** | Every check passed. Always followed by **"Not proof of authenticity"** | #2E7D32 / #E8F5E9 / #1B5E20 |

The app never says "genuine", "authentic" or "safe". Every result carries `authenticityVerified: false` and the caveat as a literal type, so the TypeScript compiler rejects a result without it.

## 2. Why graded, not yes/no

The team meeting at 6:18 PM leaned towards "yes/no, only with very high confidence". The research had already shown why that fails: a registration check can only show that the printed details agree with NAFDAC's records. It cannot see the tablets. A binary "yes" would be a claim of authenticity we can't back. Eric chose the graded verdict with a high bar for green.

## 3. The rules and why each exists

| Rule | Fires when | Colour | Why it is shaped this way |
|---|---|---|---|
| **R2** alert | Batch or reg. no. on a human-checked NAFDAC alert, and the name and company don't contradict it | RED (AMBER if one detail differs, or the batch is on a *different* product's alert) | The only case where NAFDAC itself has said "this is fake". The batch-on-another-product case was GREEN until the end-to-end run of 10:26 PM found it. |
| **R3** mismatch (the hero) | Reg. no. exists but the product name or active ingredient differs, or the licence holder differs too | RED | The Skeptic's objection ("a counterfeiter copies a real number") turned into the product's main check. Greenbook alone would say "Active". |
| R3 partial | Only strength or dosage form differs; or only the manufacturer differs and the pack names no "marketed by" holder | AMBER | NAFDAC registers the **Nigerian licence holder**, not the foreign factory (fixed at 7:47–7:52 PM: the registry lists e.g. Novartis Nigeria, while the pack may name the factory abroad). A factory name alone is not evidence of a fake. |
| R3 near miss | A word in the name or company is 1–2 letters off (later ~45% of letters) a registry word: "Artheqet" for "Artheget" | AMBER "Spelling differs" | Counterfeiters change one letter. Spacing variants ("AstraZeneca" / "Astra Zeneca") must still match, so joined words must equal the other side's first N words joined. |
| **R4** registration | Greenbook status not Active, or registration expired | AMBER | Natrilix SR 04-8509 (our real-photo demo) is listed Inactive. A lapsed registration is a reason to ask the pharmacist, not proof of a fake. |
| **R6** pack expired | Printed expiry has passed | AMBER | Dates are valid through the end of the printed day. |
| **R1** not found | Reg. no. not in our snapshot | **AMBER** (was RED until 9:52 PM) | The snapshot is not exhaustive: Greenbook only returns registrations expiring after about a year before the download date. A real pack (AquaMal QS, B4-0910) came back RED. Calling a real medicine "Do not use" because of a gap in our data was the worst failure we could imagine, so R1 became "Unable to verify registration". |
| **U1** | No reg. no., or it couldn't be read | UNSURE | The confirm step allows an empty number on purpose; otherwise this tier could never show. |
| **U2** | A letter O was read as zero and there's still no match | UNSURE "Check the registration number" | NAFDAC numbers mix letters and digits (A4-, 04-, B4-). |
| **U3** | Registry file failed to load | UNSURE "Verification temporarily unavailable" | Never pretend to have checked. |
| **R5** | Nothing above fired | GREEN + caveat | |

**Worst colour wins** (red > amber > unsure > green), and every rule that fired is listed with its own colour, a plain-language message, the pack-vs-record rows, the source and a next step.

## 4. Picking the record

Several Greenbook rows can share one reg. no. The engine scores each candidate on name, ingredient, strength, form and holder; ties go to an Active, unexpired row. Before this fix (10:26 PM) the engine took the first row, which produced false REDs on A4-101681 and A4-2789 and 23 false "Inactive" AMBERs in the test run over the real registry.

## 5. How we tested the rules (all real-registry runs, no AI involved)

| Run | When | Result |
|---|---|---|
| Server unit tests | throughout | 24 tests at 7:30 PM → 83 at 9:30 PM → **219 passing at 404a699** (we ran `npm test` on the final commit) |
| Every Active registry row fed back in as a genuine pack | 10:26 PM | 6,186 rows: **0 false R3, 0 false R4** |
| Genuine variants + made-up fakes from the real registry | 11:12 PM | ~102k genuine variants: the realistic ones all GREEN. Made-up fakes wrongly coming back GREEN: **11,500 → 37** after the near-miss rule change. The 37 are known edge cases (a change inside an ignored word like "Pharma"; a brand word repeated in the registry name). |
| Look-alike characters | 10:26 PM | Reg. nos. normalised with NFKC; invisible/bidi marks stripped; Cyrillic/Greek look-alikes folded |

These tests measure the **rules**, given correctly confirmed fields. They do not measure how well the AI reads a real photo. That is covered in [AI use and validation](../ai-use-and-validation.md).

## 6. The three demo packs

| Pack | Input | Verdict |
|---|---|---|
| hero-cloned | "Malacure Forte", Sunrise Pharma Nig. Ltd, on real reg. no. A4-6238, batch GL2210 | **RED R3**: name and holder rows mismatch; reg. no. and strength match. (Renamed at 9:01 PM from "Lonart Forte / Greenlife": a fake pack in a video should not carry real companies' names.) |
| alert-042 | The Alert 042/2026 pack: fake reg. no. 02-3457, batch BP5203, BPPL | **RED R2** |
| real-green | Artheget EZ, Getz Pharma Nigeria Limited, A4-6238, batch AG1042 | **GREEN R5** + "Not proof of authenticity" |

A fourth, from real photos: Eric's three photos of a Natrilix SR pack came back **AMBER** (printed expiry 08/2025 passed, 04-8509 Inactive, the maker named differs).
