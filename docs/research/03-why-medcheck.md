# Why MedCheck, and not the Ebola Rumour Desk or the Season Planner

MedCheck and the Ebola Rumour Desk tied on the council's score (45.5/55). After the council, Eric also seriously weighed an expanded El Niño Season Planner because it looked more technically interesting. This page records both decisions honestly, including the case against MedCheck.

## 1. The tie-break: MedCheck vs Ebola Rumour Desk

| | MedCheck | Ebola Rumour Desk |
|---|---|---|
| Council mean | 45.5 | 45.5 |
| Data | **4.75** | 4.0 |
| Overnight buildability | **4.25** | 3.0 |
| 3-minute demo | **5.0** | 4.25 |
| Emotional impact | 4.0 | **5.0** |
| Breadth & Complexity | 4.0 | **5.0** |
| AI use / AI for Impact | 4.25 | **4.75** |
| Are the demo inputs real? | **Yes, all of them** | No: the core input (community rumours) would be text we wrote |

**The Rumour Desk's case was strong.** The 2026 Bundibugyo Ebola epidemic in DRC had 9,704 confirmed cases and 4,687 deaths across 66 health zones as of 20 Oct 2026, and **64% of recent deaths happened in the community**, not in treatment centres (WHO DON622, 23 Oct 2026: https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON622). OCHA's health-zone case CSV on HDX was refreshed the morning we checked. The named story was harrowing: Daniel Uyirwoth Welo, a 27-year-old Red Cross volunteer, was attacked with spades and machetes during a safe burial in Bunia by a crowd shouting that "Ebola doesn't exist" (The Star, 9 Jul 2026). The design was a good responsible-AI story: drafts only from an approved fact bank, a human approves every message, and any mention of sickness or death escalates to surveillance regardless of the classifier.

**Why it lost.** It had seven subsystems (voice, translation, map joins, retrieval, drafting, escalation, approval) for one night, so the Skeptic put the chance of a half-working demo at 35–40%. And its key input, rumours from volunteers, did not exist as open data; we would have written the rumours ourselves, so "the AI classified rumours we invented" proves little. MedCheck's demo inputs are all real: a real registry record, a real alert, a real fake number that returns zero rows.

**How MedCheck closes the gap it loses on.** Emotion: a real Kano victim (Aisha Musa) and a real Kano seizure (Alert 042). Breadth: a non-computing domain (pharmacovigilance and drug regulation) plus the 10X answer. AI for Impact: code decides, the user confirms every field, and the AI's reading is measured.

The council file said: if the team is four strong builders and wants the maximum emotional ceiling, the Rumour Desk is the alternative (text only, about 40 sourced test rumours, on-screen accuracy and 100% escalation recall). The team chose MedCheck.

## 2. The case against MedCheck, and how we answered it

The Skeptic's single most likely failure (~35%) was that judges would see "OCR plus a Greenbook lookup" and ask: *a counterfeiter copies a real registration number, what then?* Its Innovation score was the field's second lowest (3.5) and Challenge Navigation the lowest (3.25, "no pivot yet").

All four members converged on the same fix, which became the product's centre:

1. **Make the cloned-number check the hero.** A real reg. no. on the wrong product, shown side by side against NAFDAC's record. Greenbook alone says "Active" for that number.
2. **Show the last alert date**, because NAFDAC's feed had been silent since 19 Aug 2026. The app shows "Last NAFDAC alert: 19 Aug 2026" and never calls the data "live".
3. **Snapshot the registry once, server-side,** because Greenbook has no CORS and echoes debug SQL.
4. **Measure the AI's reading** on real packs and show the number. (What we actually measured, and what we did not, is in [AI use and validation](../ai-use-and-validation.md).)

## 3. The Season Planner conversation

After reading the research, Eric had a long conversation (saved to the team Drive as "Project Choice Conversation: MedCheck vs Season Planner") about whether to switch to a bigger version of the El Niño Season Planner. His worry, in his words: *"my problem with the MedChecker is that it's too easy… versus this seasonal planner, like my product brain is just doing hula hoops right now."*

The expanded idea: a farmer or advisor enters location, land size, crops and budget; the software compares historical weather and forecast scenarios with crop needs, then explains planting strategies, costs and uncertainty. The questions that came out of it:

- **Can we promise a harvest estimate with a confidence level?** Only if the confidence comes from real validation (calibration against historical yields). Weather probability ("65% chance of low rainfall") is not the same as confidence in yield, and 51 ensemble members do not by themselves give a calibrated yield probability.
- **Isn't this already a thing?** Partly: FAO Plan-T in Zambia, Netagrow and CropSuite were named as leads (not verified). The personalised "five acres and $300" angle might be new, but we could not confirm it overnight.
- **Does the rubric reward complexity?** We read the official rubric again. It rewards Breadth & Complexity as "integrating multiple technologies/domains", not difficulty for its own sake. It also rewards a working prototype (Communication 5 = "prototype with essential functional elements"), impact on a defined user, and documented pivots. No weighting is published; all six criteria score 1–5.
- **Conclusion:** the Season Planner could win on Breadth, but only if its predictions were scientifically defensible by morning, and the council had flagged model bias and uncheckable advice. MedCheck could be shown completely and honestly in three minutes.

The 6:18 PM team meeting (Notion: "Medication Verification App – Project Planning & Task Assignment") planned the medication-verification app with frontend, middleware and backend owners. **The team confirmed MedCheck at about 7:00 PM ET.**

## 4. What "too easy" turned into

Eric's worry was fair, and the build answered it with depth rather than scope. The "lookup" turned out to be the hard part:

- A registration number can be shared by several Greenbook rows; picking the right one changed 23 false "Inactive" results.
- NAFDAC registers the **Nigerian licence holder**, not the foreign factory, so "manufacturer differs" is not by itself a sign of a fake.
- One-letter brand misspellings ("Artheqet" for "Artheget") must be flagged, but genuine spacing variants ("AstraZeneca" vs "Astra Zeneca") must not.
- The registry snapshot is not exhaustive, so "not found" cannot mean "not registered".
- The AI reads 1–3 photos of crumpled packs; its confidence is capped by code checks.

These are written up in [challenges](../challenges.md).

## 5. Open decision from the team plan, and how it was resolved

The team meeting leaned towards a yes/no answer "only with very high confidence". The research said never give a binary "authentic" answer. Resolution (Eric): a **graded verdict with four tiers** and a high bar for green. Code decides the colour; AI confidence only decides whether a field needs the user's attention. See [verdict rules](../planning/02-verdict-rules.md).
