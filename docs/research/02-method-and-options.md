# How we chose the problem: the research run and the options we considered

We did not start with MedCheck. We started with a brief ("a real, current, emotionally resonant problem affecting communities across Africa, backed by free real data, buildable overnight") and ran a structured search: six parallel research agents, a hard filter, and an adversarial council per surviving idea. Humans made the final call. This page records how, how long it took, and what each option looked like.

All times are ET on Saturday 24 Oct 2026, taken from git commits and file timestamps.

## 1. The brief

The research prompt (written by the team before the run) set these constraints:

- **Goal:** one problem for a lightweight AI-powered web app, serving community members and the people who serve them (health workers, farmers, teachers, local organisers), anywhere in Africa.
- **Stack:** React + TypeScript frontend, Node backend, deployed by morning.
- **AI:** hosted model APIs only, no training. **$40 total** for in-app AI calls for the whole hackathon. Estimate cost per user session.
- **Data:** public and reachable today with no lengthy approval. **Every dataset recommended had to be fetched**, with a sample saved, or marked UNVERIFIED.
- **Users:** assume low bandwidth, mobile, local languages.
- **Rules:** cite a source for every factual claim, flag anything uncertain, be decisive, and leave the final pick to the humans.

## 2. The run, phase by phase

| Phase | Start | End | Wall-clock | What happened |
|---|---|---|---|---|
| Repo setup + council skills | 16:27 | 16:30 | ~3 min | Repo created; `llm-council` and `claude-council` skills installed |
| Read the team handoff | ~16:47 | ~16:50 | ~3 min | 944-line handoff doc (rubric, rules, full Discord digest) |
| **Phase 1: parallel research** | ~16:54 | 17:01 | **~7 min** | 6 research agents, one per domain, each 5–7.2 min |
| **Phase 2: hard filter** | 17:01 | ~17:02 | ~1 min | 28 candidates → 6 survivors, 6 merged, 16 failed |
| **Phase 3: council** | ~17:02 | ~17:05 | **~2.5 min** | 6 council runs in parallel, 1.5–2.3 min each |
| Live re-check of MedCheck data | 17:05 | 17:06 | ~1 min | Greenbook and the alerts feed re-fetched |
| **Phase 4: report** | 17:06 | 17:08:40 | ~3 min | Ranked recommendation, build plan, video outline, Q&A |
| **Total** | **16:52:58** | **17:08:40** | **≈ 16 min** | The time box was 90 minutes |

The report originally said "about 25 minutes" and gave some phases as "~5:15 PM"; the run report corrected this from the commit timestamps.

### Phase 1: six research slices

Each agent had to find current problems with 2–3 cited stats and a named human story; find datasets and **fetch a sample of each**; check incumbents and name the gap; sketch one core flow, the AI's role and the harm/human-in-the-loop design; and log its questions, dead ends and surprises.

| Slice | Duration | Tokens | Tool calls | Candidates |
|---|---|---|---|---|
| Health, maternal/child, outbreaks | 7.2 min | 91,929 | 31 | 2 (+3 rejected) |
| Food security, agriculture, climate | 6.8 min | 88,680 | 31 | 3 (+3 rejected) |
| Water, energy, infrastructure | 5.3 min | 80,032 | 24 | 3 (+3 dropped) |
| Displacement, conflict, early warning | 6.9 min | 81,801 | 27 | 2 (+1 ruled out) |
| Education, jobs, financial inclusion | 5.0 min | 99,189 | 36 | 2 (+3 not shortlisted) |
| Wildcard: all-Africa news scan | 6.9 min | 106,610 | 38 | 3 (+several scanned) |
| **Total** | | **548,241** | **187** | |

The agents saved 76 sample files (JSON, CSV, XML, HTML, each under 200 KB). Those samples stayed in the local research folder and the team Drive; they are not in this repo.

### Phase 2: the hard filter

Five dealbreakers: **(D1)** no verified, accessible data; **(D2)** can't be one complete demoable flow by 10 AM; **(D3)** AI is decoration only; **(D4)** can't be explained in 30 seconds; **(D5)** serious harm if the AI is wrong, with no sensible human-in-the-loop design.

**Survivors (to council):**

| Candidate | Slice | 30-second pitch | Verified data |
|---|---|---|---|
| Water point reporter | water-energy | Villager voice-notes "the borehole is broken"; AI makes a geo-matched repair ticket and replies with the nearest working water point | WPdx Socrata API, OSM Overpass, World Bank WASH, HDX cholera, Open-Meteo |
| Loan app checker | edu-finance | Paste a loan app name or a debt-shaming message; licence status from the regulator, which rules the message breaks, a complaint draft | CBK DCP licence PDF (29 Sep 2026, 280 lenders), FCCPC approved/watchlist/delisted tables |
| El Niño season planner | food-climate | Extension officer picks a ward and crops; code computes "7 of 10 forecast runs say drier"; AI drafts an advisory the officer approves | Open-Meteo seasonal ensemble (51 members), Open-Meteo historical, NASA POWER, FEWS NET |
| Ebola Rumour Desk | health (+ wildcard merged) | Volunteers log rumours; AI translates, classifies and maps them against live case counts; drafts responses from an approved fact bank | WHO DON API (23 Oct), OCHA/HDX DRC Ebola CSV (daily, by health zone), OSM, CLEAR Global |
| Flood alert relay | displacement (+ food-climate merged) | Village focal person sees the river forecast vs normal; AI drafts SMS/radio warnings; human approves and sends | Open-Meteo Flood API (GloFAS), GDACS |
| **MedCheck** | wildcard | Photograph a pack; AI reads the label; user confirms; code checks NAFDAC's registry and alerts; red/amber/green with sources | NAFDAC Greenbook JSON (8,946 products; fake reg. no. from Alert 042 returns 0), NAFDAC alerts feed, WHO alerts |

**Merged into a survivor:** mobile-money scam second opinion (→ loan checker), flood early-action checklists for farmers (→ flood relay), market-price "sell or store" helper (→ season planner), community Ebola alert intake (→ Rumour Desk, as the escalation branch), wildcard RumourDesk (→ Ebola Rumour Desk, which had verified data), standalone cholera chatbot (→ water point reporter).

**Failed the filter:**

| Candidate | Dealbreaker | Reason |
|---|---|---|
| Clinic solar fault triage | D1 | No open per-clinic fault data; healthsites.io returned 403 |
| Household solar purchase check | D3, D5 | AI can't detect counterfeits; false-reassurance risk |
| Load-shedding planner | D1 | EskomSePush API 410/403; SA load-shedding largely ended |
| Clean cooking advisor | D3 | Real problem (22.9% access in SSA) but no genuine AI flow |
| Services finder for displaced Sudanese | D1, D5 | No open service-status data; exposing locations to armed actors |
| Conflict warnings from ACLED | D1, D5 | Licence limits redistribution; life-safety harm |
| StillOpen (ARV clinics after aid cuts) | D1 | Facility lists exist, but hours/services were empty in all 8 OSM samples |
| AI teacher assistant | crowded | TheTeacher.AI, Kalamu, Kitso, Rori already exist |
| Remittance cost comparator | D1, D3 | Data behind Cloudflare; AI decorative |
| Youth jobs matcher | D4 | No crisp 30-second problem/data pairing |
| Crop pest photo diagnosis | crowded | PlantVillage Nuru, Plantix |
| Desert locust reporting | D1 | FAO data needs a token; eLocust3 exists |
| Cholera case tracker | D1 | Open data is country-level only |
| Maternal SMS advisor | crowded | Jacaranda Health's AI SMS reaches 3M+ mothers |
| CHW clinical copilot | D5 | PATH running large trials; clinical risk too high overnight |
| Drug stockout tracker | D1 | No free facility-level stock data |

### Phase 3: the council

Each survivor went through a `claude-council` run in full mode: **four fresh-context Opus members** with different jobs, then **anonymized peer review** where each member ranked the others' answers, then a chairman synthesis.

- **The Architect:** overnight buildability and breadth.
- **The Skeptic:** must name the single most likely reason the project fails at this hackathon, and **re-fetch the data live**.
- **The Pragmatist:** shipping, and the $40 budget.
- **The Judge:** the official rubric and the superlatives.

Each member scored 11 criteria from 1 to 5 (55 max): emotional impact, data quality (verified tonight), overnight buildability, genuine AI use + AI for Impact fit, 3-minute demo-ability, and the six official rubric criteria (Innovation, Curiosity, Communication, Breadth & Complexity, Impact, Challenge Navigation).

6 runs × 8 agents = 48 council agents, 2,699,675 tokens, 201 tool calls. With the research agents, the whole run used 54 subagents, about 3.25M tokens and 388 tool calls. This was research usage on the team's own subscription. **None of it touched the product's $40 AI budget.**

## 3. Results

Mean of the four members, 1–5 per criterion:

| Rank | Candidate | Emo | Data | Build | AI | Demo | Innov | Curio | Comm | Breadth | Impact | ChallNav | **Total /55** | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **MedCheck** | 4.0 | **4.75** | **4.25** | 4.25 | **5.0** | 3.5 | 4.0 | 4.5 | 4.0 | 4.0 | 3.25 | **45.5** | GO, pick |
| 2 | Ebola Rumour Desk | **5.0** | 4.0 | 3.0 | **4.75** | 4.25 | **3.75** | 4.0 | 4.0 | **5.0** | 4.0 | 3.75 | **45.5** | GO-conditional |
| 3 | Water point reporter | 4.0 | 3.75 | 4.0 | 4.0 | 4.75 | 3.25 | 4.0 | **4.75** | 4.25 | 4.0 | 4.0 | 44.75 | GO-conditional |
| 4 | Loan app checker | 4.0 | 3.75 | **4.5** | 4.25 | 4.75 | 3.25 | 4.0 | 4.25 | 4.0 | 4.0 | 3.75 | 44.5 | GO |
| 5 | El Niño season planner | 3.5 | **4.75** | 4.0 | 4.0 | 4.0 | 3.5 | 4.25 | 4.0 | 4.75 | 3.75 | 3.75 | 44.25 | Split (Skeptic NO-GO) |
| 6 | Flood alert relay | 4.25 | 3.75 | 4.0 | 3.75 | 4.25 | 3.0 | 4.0 | 4.0 | 4.0 | 4.0 | 4.0 | 43.0 | GO-conditional |

Member totals for MedCheck: Architect 47, Skeptic 44, Pragmatist 48, Judge 43.

These 55-point scores are the council's judgment, not ground truth: all four members are Claude agents with different personas. They are also not the official 30-point rubric.

## 4. What the Skeptics caught

This is the most useful output of the run. In every case, a member who re-fetched the data live found something our own research had got wrong or glossed over.

| Candidate | Skeptic's most likely failure | What it caught |
|---|---|---|
| **MedCheck** | ~35%: judges see "OCR + database lookup", and a counterfeiter can copy a real number | NAFDAC's alert feed had posted nothing since **19 Aug 2026**, so "active alerts" really meant "alerts up to August". Greenbook has no CORS and echoes debug SQL, so it must be snapshotted once, server-side. The fix for the main risk became the product: make the **real-number-on-the-wrong-product** check the hero. |
| Ebola Rumour Desk | 35–40%: scope sprawl leaves a half-working demo; ~25%: the rumours would be text we wrote ourselves | Uncalibrated LLM confidence numbers; escalation must not depend on the LLM (keyword backstop first); incumbents (WHO EARS, IFRC NLP trials) understated |
| Water point reporter | ~35%: "nearest working water point" is false reassurance | Fresh WPdx records are almost all broken pumps, and "functional" ones date from ~2010. Tanzania's Maji Matone got 53 of 3,000+ expected SMS reports. The hero story was in a country with 0 WPdx records. |
| Loan app checker | ~40%: "registry search + ChatGPT prompt" | The FCCPC page was last modified 3 Mar 2026; some apps sit on both the watchlist and the delisted list; Kenya's list returned "not found" for popular legal apps |
| El Niño season planner | ~45%: near-identical advice per ward that nobody can check | Comparing raw seasonal-forecast runs with ERA5 bakes in model bias |
| Flood alert relay | ~40%: nothing in Africa is flooding tonight | The research's "Niger at Lokoja rising 45%" hook was the **normal** seasonal level (forecast peak ~6,850 m³/s vs an October median of 8,932 m³/s at that grid cell). The API's mean/max/p75 fields describe forecast spread, not normal levels. |

## 5. Questions that changed direction

These are the questions logged during the run that changed a candidate, in the run's own words:

- **"Does drug registration equal authenticity?"** No. A counterfeit can copy a real registration number. So MedCheck must never say "genuine", and it must compare every field against the record for that number.
- **"Can we prove the fake number from a real alert is absent from the registry?"** Yes: 0 rows for `02-3457`, 1 row for `A4-6238`.
- **"What is the current top outbreak?"** We pulled WHO's live Disease Outbreak News instead of trusting memory. It surfaced the 2026 Bundibugyo Ebola epidemic in DRC (9,704 confirmed cases and 4,687 deaths as of 20 Oct 2026, WHO DON622), which had reached Kenya and Nigeria.
- **"Is Kenya facing drought this season?"** No: 2026 is a strong El Niño, so East Africa is wet and southern Africa faces drought. This reframed the whole food slice.
- **"Do farmers actually receive seasonal forecasts?"** Often not (one study: 24%), so the problem is explanation, not prediction.
- **"In Mokwa (206 dead), was the problem prediction or relay?"** Relay: neighbouring Rabba was warned by phone and its village head cleared the riverbank.
- **"Do regulator lender lists contain the app names people actually see?"** Nigeria's FCCPC list does. Kenya's CBK list almost never does (about 5 of 280).
- **"Is there open data on which clinics are still open after the aid cuts?"** No, so StillOpen was dropped.

## 6. Dead ends

- ReliefWeb API v1 decommissioned (410); v2 needs a pre-approved app name (403).
- IOM DTM API (401, needs a key), IPC API (401), WFP HungerMap (503), FAO locust data (token).
- OSM Overpass returned 406 until we added a User-Agent header.
- EskomSePush 410/403; healthsites.io 403; remittance data behind Cloudflare.
- A large "Africa smishing" dataset on Hugging Face turned out to be 100% synthetic (discarded, never cited).
- WHO GHO has no recent African cholera data; WHO rumour PDFs could not be parsed in the sandbox.
- Ghana FDA's registered-products URL returned 404 (so the 10X answer names Kenya's PPB, which we did verify).

## 7. Caveats on the research itself

- Facts after the model's training cutoff (the Bundibugyo epidemic, the 2026 El Niño, Alert 042/2026) come only from live fetches and searches made that evening, each with a URL.
- Some stats came only from search snippets; the raw files flag these as "unopened" or "UNVERIFIED", and we did not quote them.
- NAFDAC's Greenbook server echoes debug SQL logs in its responses. We made only normal read requests and stripped those logs from the saved samples.

Next: [why MedCheck won](03-why-medcheck.md).
