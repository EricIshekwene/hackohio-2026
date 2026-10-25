import type { LegendEntry, Verdict } from './types';

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
    meaning: 'Not registered, on a NAFDAC alert, or the number belongs to a different product.',
    nextStep: `Don't take or sell it. Keep the pack, show it to a pharmacist, and report it to NAFDAC (${NAFDAC_PHONE}).`,
    color: '#D32F2F',
    background: '#FDECEA',
    text: '#8E1B1B',
  },
  amber: {
    verdict: 'amber',
    label: 'Check before use',
    headline: 'Check before you use this medicine',
    meaning: 'Registered, but something does not line up: strength, form, registration status or expiry.',
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

// App theme (decided 2026-10-25): black-and-white base, green only as a MedCheck accent.
// Verdict colours above appear ONLY on the verdict card, verdict badges and reason-card edges.
// The brand green is the olive Fern from the MedCheck palette, a different shade from the GREEN verdict
// (#2E7D32), and is never used on the verdict screen's buttons, so "MedCheck green" can't read as "this pack passed".
export const THEME = {
  background: '#FFFFFF',
  surface: '#FAFAFA', // cards, inputs
  border: '#E5E5E5',
  ink: '#0A0A0A', // body text, primary buttons (black)
  muted: '#6B6B6B', // secondary text
  brand: '#477023', // MedCheck accent (Fern): links, focus rings, active step, "AI" badge outline
  brandDeep: '#0D330E', // logo wordmark only (Pakistan Green)
  brandTint: '#EEF3E9', // subtle brand highlight (selected field, progress)
  onBrand: '#FFFFFF',
  danger: '#D32F2F', // form errors only (same hue as RED verdict)
} as const;
