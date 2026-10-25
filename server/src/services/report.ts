// Builds the NAFDAC report draft from the check result. Code only; the user edits and sends it.
import type { ReportDraft, ReportRequest } from '../../../shared/types';
import { NAFDAC_EMAIL, NAFDAC_PHONE } from '../../../shared/legend';
import { formatDate } from './dates';

export function buildReport(req: ReportRequest): ReportDraft {
  const { input, result } = req;
  const f = input.fields;
  const v = (k: keyof typeof f) => f[k]?.value?.trim() || (f[k]?.sourceText?.trim() ? "(couldn't be read from the photo)" : '(not on pack)');
  const tier = result.legend.label.toUpperCase();
  const product = f.productName?.value || 'unknown product';
  // A coverage gap is not a suspicion of falsification; don't tell NAFDAC it is.
  const unverified = ['not_found_in_snapshot', 'registry_match_historical', 'external_product_match', 'input_uncertain', 'lookup_unavailable'].includes(result.status);

  const lines = [
    'Dear NAFDAC Pharmacovigilance team,',
    '',
    unverified
      ? `I would like to ask about a medicine whose NAFDAC registration I could not verify. A MedCheck check returned: ${tier} (${result.headline}).`
      : `I would like to report a medicine that may be substandard or falsified. A MedCheck check returned: ${tier}.`,
    '',
    'Details on the pack:',
    `- Product name: ${v('productName')}`,
    `- Strength: ${v('strength')}`,
    `- NAFDAC Reg. No.: ${v('nafdacRegNo')}`,
    `- Manufacturer: ${v('manufacturer')}`,
    ...(f.marketedBy?.value ? [`- Marketed by: ${f.marketedBy.value}`] : []),
    `- Batch no.: ${v('batchNo')}`,
    `- Expiry date: ${v('expiryDate')}`,
    '',
    'Why it was flagged:',
    ...result.reasons
      .filter((r) => r.verdict !== 'green')
      .map((r) => `- ${r.rule}: ${r.title}. ${r.message} (Source: ${r.source.name}${r.source.url ? `, ${r.source.url}` : ''})`),
    '',
    `Where bought: ${req.whereBought || '(please add)'}`,
    `Location: ${req.reporter?.location || '(please add)'}`,
    ...(req.notes ? ['', `Notes: ${req.notes}`] : []),
    '',
    `Data used: NAFDAC Greenbook snapshot ${formatDate(result.dataAsOf.registrySnapshot)}; last NAFDAC alert ${formatDate(result.dataAsOf.lastAlert)}. MedCheck is not proof of authenticity; please verify.`,
    '',
    'I still have the pack and can provide photos.',
    '',
    req.reporter?.name || '(your name)',
    req.reporter?.phone || '(your phone number)',
  ];

  const subject = `${unverified ? 'Please verify registration' : 'Suspected falsified medicine'}: ${product}${f.batchNo?.value ? `, batch ${f.batchNo.value}` : ''}`;
  const body = lines.join('\n');
  return {
    to: NAFDAC_EMAIL,
    phone: NAFDAC_PHONE,
    subject,
    body,
    mailto: `mailto:${NAFDAC_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    tel: `tel:${NAFDAC_PHONE.replace(/-/g, '')}`,
  };
}
