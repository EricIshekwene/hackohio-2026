# Data sources

Every dataset MedCheck uses is public and free, and every one was fetched and checked the evening of Sat 24 Oct 2026, before we committed to building. This page lists what each source is, how we got it, what's in the repo, and what it can't tell us.

## 1. In the product

| Source | What it gives | How we use it | In the repo |
|---|---|---|---|
| **NAFDAC Greenbook** — https://greenbook.nafdac.gov.ng/ | Nigeria's registry of registered medicines: reg. no., product name, strength, ingredient, form, applicant (licence holder), approval and expiry dates, status | Snapshotted once, server-side, by a GitHub Action ([`snapshot-registry.yml`](../../.github/workflows/snapshot-registry.yml)). The rules engine compares every confirmed field against the record for that number. | [`data/registry.json`](../../data/registry.json): **8,943 products**, snapshot of 25 Oct 2026 (first snapshot 24 Oct, 3f138b7; second 25 Oct, 1c87855). The live site reported 8,946; 3 rows had no reg. no. |
| **NAFDAC recalls and alerts** — https://nafdac.gov.ng/category/recalls-and-alerts/feed/ | Public alerts on falsified and substandard products, with batch numbers | `npm run fetch:alerts` writes candidates to `data/raw/` (gitignored); **a person reads each alert page and copies it across by hand.** No alert reaches the rules unchecked. | [`data/alerts.json`](../../data/alerts.json): Alert **042/2026** (19 Aug 2026). The newest alert in the feed when we checked was dated 19 Aug 2026, so the app shows "Last NAFDAC alert: 19 Aug 2026" and never calls the data live. |
| **Sourced references** (GS1 Nigeria, official NAFDAC documents, manufacturer catalogues) | Evidence that a number existed when it is missing from Greenbook | Only consulted when Greenbook has no row. Can lift "not in our snapshot" to "product listing found" or "historical record found"; never becomes a registry row and never gets a current status. | [`data/references.json`](../../data/references.json): 1 record, **B4-0910 Aquamal QS 80/480 mg** (GS1 Nigeria), added after reading the source |
| NAFDAC reporting line | Where users report a suspicious pack | The report draft is addressed to `pharmacovigilance@nafdac.gov.ng` and the toll-free line 0800-162-3322; the user sends it themselves | `server/` report code |

### How the Greenbook snapshot works

- The site's table loads from `GET https://greenbook.nafdac.gov.ng/?draw=1&start=0&length=N&search[value]=<q>` with the header `X-Requested-With: XMLHttpRequest`, which returns JSON.
- It sends **no CORS headers** (a browser can't call it), and the server runs in debug mode, echoing SQL logs in its responses. So we made the decision on the first evening: **snapshot once, from a server, about 18 polite paged requests; never from the browser, never during the demo, never probe it.** The saved data strips the debug output.
- A guard (82b4c0d) refuses to replace `registry.json` with a partial scrape: it needs ≥98% of the reported rows, ≥95% of rows mapped, and no more than a 10% drop from the last snapshot.
- Values are cleaned on load: `##` and `**` padding and editor notes like "** (duplicate NRN)" are stripped.

### What the registry can't tell us

- **Coverage.** Greenbook only returns registrations expiring on or after about a year before the download date (about 27 Oct 2025 for our snapshot). Older lapsed or renumbered registrations are missing. We found this when a real pack, **AquaMal QS (B4-0910)**, came back "not in registry", which is why "not found" is AMBER, not RED.
- **Holder, not factory.** The applicant is the Nigerian licence holder (e.g. Novartis Nigeria), not the factory that made the pack.
- **Shared numbers.** Several rows can share one reg. no.; the engine picks the best fit to the pack.
- **Not authenticity.** A matching record shows the printed details agree with NAFDAC's records, nothing more.

## 2. Checked for the research, not used in the product

| Source | Status when we checked | Why not used |
|---|---|---|
| WHO Medical Product Alerts — https://www.who.int/teams/regulation-prequalification/incidents-and-SF/full-list-of-who-medical-product-alerts | Reachable | Planned as a second alert source; first on the cut list, cut |
| Kenya Pharmacy and Poisons Board register | Verified reachable | The "10X" answer: the same rules work on any country that publishes a registry |
| Ghana FDA registered products | 404 | |
| WHO Disease Outbreak News API | Reachable (DON622, 23 Oct 2026) | Used for the Ebola Rumour Desk candidate |
| OCHA / HDX DRC Ebola health-zone CSV | Reachable, refreshed that morning | Rumour Desk candidate |
| Open-Meteo seasonal (51-member ensemble), historical, flood (GloFAS); NASA POWER | Reachable | El Niño planner and flood relay candidates |
| WPdx water points (Socrata), OSM Overpass | Reachable (Overpass needed a User-Agent) | Water point candidate |
| CBK digital credit provider list (PDF, 29 Sep 2026); FCCPC approved / watchlist / delisted tables | Reachable | Loan app candidate |

Dead ends are in the [research method](02-method-and-options.md#6-dead-ends).

## 3. Stats sources

Every statistic in the pitch, with its exact wording and URL, is in [the problem](01-problem.md#1-scale).

## 4. Raw research samples

The research agents saved 76 small samples (JSON, CSV, XML, HTML) on the night. They live in the team's research folder and were never pushed to this repo, mainly because many are copies of third-party pages.
