# The problem: falsified and substandard medicines in Nigeria

**Short version.** In Nigeria, people mostly buy antimalarials and antibiotics from chemists and patent-medicine vendors, and nobody at the counter has a practical way to check a pack. NAFDAC publishes a registry (the Greenbook) and a feed of falsified-medicine alerts, but these are separate tools. Neither catches the most common trick: a *real* registration number printed on the *wrong* product. MedCheck joins the registry and the alerts, reads the pack from a photo, compares every field, and shows the evidence.

Every number on this page has a source. Where we only saw a figure second-hand, we say so. More rows from the verification table we built for the pitch are in [§6](#6-verification-table-used-for-the-pitch).

## 1. Scale

| Claim | Figure (exact wording) | Source | Status |
|---|---|---|---|
| Deaths in sub-Saharan Africa from trafficked medical products | "kill **almost half a million** sub-Saharan Africans every year" | UN News on the UNODC report *Trafficking in Medical Products in the Sahel*, Feb 2023: https://news.un.org/en/story/2023/02/1133062 | Verified (page opened) |
| Of which, antimalarials | "as many as **267,000** deaths per year are linked to falsified and substandard antimalarial medicines" | same | Verified |
| Of which, child pneumonia antibiotics | "up to **169,271**" deaths linked to falsified and substandard antibiotics for severe childhood pneumonia | same | Verified |
| Quality failures in Africa | About **1 in 5** medicines sampled failed quality tests (1,639 of 7,508 samples, 27 studies, Bahir Dar University meta-analysis) | https://africa.com/study-reveals-that-one-in-five-african-medicines-are-fake-or-ineffective (original reporting: The Guardian) | Secondary source |
| Global estimate | "An estimated **1 in 10** medical products circulating in low- and middle-income countries is either substandard or falsified"; **42%** of reports come from the WHO African Region | WHO, 28 Nov 2017: https://www.who.int/news/item/28-11-2017-1-in-10-medical-products-in-developing-countries-is-substandard-or-falsified | Verified. WHO says these figures show scale, not precise counts, so we use "up to" / "as many as" wording. |
| Nigeria | NAFDAC estimates **13–15%** of medicines in circulation are substandard or falsified; the Association of Community Pharmacists says it may be **over 50%** | Daily Trust, 18 Apr 2026: https://dailytrust.com/when-treatment-turns-dangerous-nigerians-battle-with-counterfeit-medicines | Verified |
| Alert frequency | "At least seven NAFDAC public alerts this year have involved antimalarials or antibiotics" (2025) | BusinessDay, 26 Sep 2025: https://premium.businessday.ng/article/ysot/Fake-drugs-are-stealing-the-lives-of-Nigerias-children | Verified |
| Cloned packs | Over 10 million doses of fake malaria drugs and cosmetics (N3bn) seized at Trade Fair Market, Lagos. NAFDAC: the drugs "were clone and it was quite difficult for the authorised manufacturers to identify the original and fake drugs" | Premium Times via allAfrica, 10 Feb 2026: https://allafrica.com/stories/202602110135.html | Verified |

**A correction we made.** The research run first wrote the UNODC figure as "up to 500,000 deaths a year", taken from secondary sources. When we opened the UN News page for the pitch, the wording was "almost half a million". Every later document uses the exact wording.

## 2. The current event: NAFDAC Public Alert 042/2026

On **19 Aug 2026** NAFDAC published Public Alert 042/2026: falsified artemether/lumefantrine 80 mg/480 mg, batch **BP5203**, intercepted at the Coordinated Wholesale Centre in **Kano**. The pack carried registration number "02-3457", which NAFDAC says "is fake and does not exist in the Agency's registration database". The purported maker was "Bandaram Pharma Packleh Ltd" (BPPL).

- Alert page: https://nafdac.gov.ng/public-alert-no-042-2026-alert-on-the-seizure-of-suspected-substandard-and-falsified-bppl-artemether-lumefantrine-80mg-480mg/
- Press coverage: https://brandspurng.com/2026/09/18/nafdac-seizes-fake-antimalarial-drug-with-fraudulent-registration-number-in-kano/ (18 Sep 2026)

We checked this ourselves, live, on Saturday evening: searching the Greenbook for `02-3457` returns **0 rows**, and a real number, `A4-6238`, returns exactly **1 row** (Artheget, 80 mg; 480 mg, Getz Pharma Nigeria Limited, Active, registration expires 2026-12-01). The check was done twice, by the research run at about 5:06 PM ET and again by the team at about 7 PM ET.

## 3. The human story

**Aisha Musa, 28, of Kano**, bought cheaper malaria tablets from a local chemist. Three days later she was vomiting and weak, and doctors confirmed the drugs were counterfeit. *"It was not just the money, but the thought that I almost lost my life."* (Daily Trust, 18 Apr 2026, link above.)

The Alert 042 seizure happened in the same city, with the same class of drug and the same channel (a cheap antimalarial from a chemist). That is why the pitch opens with her: the alert shows exactly the kind of pack she could have bought, and MedCheck catches it in seconds.

Other stories we found and why we did not lead with them are in [§6](#6-verification-table-used-for-the-pitch). The strongest alternative (the Gambia cough-syrup deaths of 2022) is a contamination case that a photo check cannot detect until an alert names the product, so it would have overclaimed what MedCheck does.

## 4. Who the user is

- **Patent and proprietary medicine vendors (PPMVs) and community pharmacists.** PPMVs are "the first source of care for up to **55%** of under-five child illnesses" and "35% to 55% of adult malaria treatment", with an "estimated **200,000** PPMVs operating in Nigeria" (Prach et al., *BMC Health Services Research*, 2015: https://bmchealthservres.biomedcentral.com/articles/10.1186/s12913-015-0895-z, PDF opened).
- **Community health workers**, and **caregivers** buying for children as a secondary user.
- **Phones and bandwidth.** Nigeria had **188.01 million** active mobile subscriptions in April 2026 (NCC data via Leadership NG, 17 Jul 2026: https://leadership.ng/nigerias-active-mobile-lines-rise-to-188-01m-ncc/). KPMG's 2026 smartphone study notes that more than a third of mobile subscribers were still on 2G in May 2026 (https://kpmg.com/ng/en/insights/2026/09/nigeria-smartphone-study.html). This is why the client resizes photos before upload, and why a typed path exists for every failure.

## 5. What already exists, and the gap

| Existing | What it does | Why it is not enough |
|---|---|---|
| **NAFDAC Greenbook** (web and app, launched Jan 2024) | Type a name or reg. no., get its registration status | English only, exact typing, **not linked to the alerts feed**, and it cannot tell you that a real number belongs to a different product, strength or maker. Source: https://www.itedgenews.africa/nafdac-intensifies-war-on-fake-drugs-with-greenbook-database/ |
| **Scratch codes** (MAS: Sproxil, mPedigree) | SMS a code under a scratch panel | Only participating brands. Studies found low awareness, SMS failures and copyable codes; one found "no impact on the distribution and consumption of fake drugs". https://ideas.repec.org/a/ibn/gjhsjl/v11y2019i5p87.html |
| **GS1 / Scan-to-Verify** (Traceability Regulations 2024) | Scan a serialised barcode | Works only on serialised packs; the rollout is partial. https://dubawa.org/four-ways-nafdac-wants-you-to-verify-authenticity-of-medicine-before-purchase/ |
| **NAFDAC alerts** (RSS and web) | Published notices of seized or falsified products | A list to read, not a check. Newest items when we looked were 042/2026 and 043/2026, both dated 19 Aug 2026. |

**The gap.** No tool takes a phone photo of an ordinary pack, reads the printed registration number, name, strength, maker, batch and expiry, checks them **together** against the registry **and** the alerts, shows the evidence side by side, and routes a suspicious pack to NAFDAC's reporting line.

**The hero case this gap creates.** A counterfeiter prints a real, active registration number (`A4-6238`) on a fake product. Greenbook, asked about the number, says "Active". MedCheck compares the pack with the record for that number and shows that the product name and the licence holder do not match.

**What MedCheck cannot do,** and says so on every result: it checks printed details against records. It cannot see the tablets, the seal or the print quality, and it cannot detect contamination inside a correctly labelled product. That is why green always reads "Not proof of authenticity" and the app never says "genuine" or "safe".

## 6. Verification table used for the pitch

The full table (claims, exact wording, sources, dates, status, and the named-victim options we considered) is kept with the pitch materials. Rows marked UNVERIFIED were not used. Highlights not already above:

- Fake cancer drugs (counterfeit Avastin and Tecentriq, Mar 2026) and a pharmacist's line, "There is hardly any class of drug that has not been counterfeited" (NY Amsterdam News, 20 Jul 2026: https://amsterdamnews.com/news/2026/07/20/inside-nigerias-counterfeit-medicine-crisis/).
- Named-victim options considered: Ebrima Sagnia and his son Lamin (Gambia, 2022; Al Jazeera), Wuri Bailo Keita and his daughter (Gambia, 2022; AP), and Evelyn Imo (Lagos, expired antimalarials; Guardian NG). We chose Aisha Musa because her case is the closest match to what MedCheck actually catches.

See also: [data sources](04-data-sources.md), [why MedCheck](03-why-medcheck.md).
