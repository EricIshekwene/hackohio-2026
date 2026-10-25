import type { DecisionStatus, LegendEntry, Verdict } from './types';

// The verdict legend. Decided by Eric on 2026-10-24. The backend sends the matching entry
// with every result and serves the whole list at GET /api/legend; the frontend may import it directly.

export const CAVEAT = 'Not proof of authenticity' as const;

export const GREEN_SUMMARY =
  'Registered, no active alert, details consistent. Not proof of authenticity.';

export const NAFDAC_PHONE = '0800-162-3322';
export const NAFDAC_EMAIL = 'pharmacovigilance@nafdac.gov.ng';

export const LEGEND: Record<Verdict, LegendEntry> = {
  red: {
    verdict: 'red',
    label: 'Do not use',
    headline: 'Do not use this medicine',
    meaning: 'On a NAFDAC alert, or the registration number belongs to a different product.',
    nextStep: `Don't take or sell it. Keep the pack, show it to a pharmacist, and report it to NAFDAC (${NAFDAC_PHONE}).`,
    color: '#D32F2F',
    background: '#FDECEA',
    text: '#8E1B1B',
  },
  amber: {
    verdict: 'amber',
    label: 'Check before use',
    headline: 'Check before you use this medicine',
    meaning: "We couldn't verify the registration, or something does not line up: strength, form, registration status or expiry.",
    nextStep: 'Ask a pharmacist to look at the pack before you use it. Report it to NAFDAC if the details stay wrong.',
    color: '#F59E0B',
    background: '#FEF3C7',
    text: '#92400E',
  },
  green: {
    verdict: 'green',
    label: 'No problems found',
    headline: 'No problems found',
    meaning: 'Registered, no active alert, and the pack matches NAFDAC\'s record. Not proof of authenticity.',
    nextStep: 'Still check the seal, the print quality and the expiry date yourself. Report anything unusual.',
    color: '#2E7D32',
    background: '#E8F5E9',
    text: '#1B5E20',
  },
  unsure: {
    verdict: 'unsure',
    label: "We couldn't check this",
    headline: "We couldn't check this pack",
    meaning: 'A key detail is missing, so we cannot say either way.',
    nextStep:
      "Look for the NAFDAC Reg. No. on the pack (often near the barcode or on the side) and check again, or ask a pharmacist.",
    color: '#6B7280',
    background: '#F3F4F6',
    text: '#374151',
  },
};

// Worst first. The overall verdict is the worst colour among the findings.
export const VERDICT_ORDER: Verdict[] = ['red', 'amber', 'unsure', 'green'];

export const LEGEND_LIST: LegendEntry[] = VERDICT_ORDER.map((v) => LEGEND[v]);

// Headline per decision status, so a coverage gap never reads like a counterfeit finding.
// null = use the colour's own headline (alerts and mismatches keep the strong wording).
export const STATUS_HEADLINE: Record<DecisionStatus, string | null> = {
  registry_match_current: null,
  registry_match_historical: 'Historical registration record found',
  external_product_match: 'Product listing found, registration unverified',
  record_mismatch: null,
  confirmed_regulatory_alert: null,
  confirmed_inactive_or_cancelled: null,
  not_found_in_snapshot: 'Unable to verify registration',
  lookup_unavailable: 'Verification temporarily unavailable',
  input_uncertain: null,
};

export const NOT_FOUND_REASON = "We couldn't find this number in the registration data currently available to MedCheck.";
export const NOT_FOUND_EXPLANATION =
  'This does not establish that the medicine is fake or that its registration never existed. Check the printed number and verify with NAFDAC or a licensed pharmacist before relying on the product.';
export const HISTORICAL_EXPLANATION =
  'We found an earlier official record associated with this medicine. We have not confirmed whether its registration is currently active.';
export const EXTERNAL_EXPLANATION =
  "We found a product listing for this number outside NAFDAC's registry. It is not an official registration record, so we have not confirmed the registration or whether it is currently active.";
