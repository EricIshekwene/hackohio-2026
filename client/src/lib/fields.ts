import type { ExtractedField, FieldKey, StandardizedMedicationInput } from '@shared/types';

export interface FieldDef {
  key: FieldKey;
  label: string;
  placeholder: string;
  mono?: boolean;
  optional?: boolean;
  hint?: string;
}

// Most important first: the reg. no. drives the result, the name and maker are what R3 compares.
export const FIELD_DEFS: FieldDef[] = [
  { key: 'productName', label: 'Product name', placeholder: 'Brand name as printed' },
  {
    key: 'nafdacRegNo',
    label: 'NAFDAC reg. no.',
    placeholder: 'e.g. A4-0000',
    mono: true,
    hint: 'Often near the barcode or on the side of the pack.',
  },
  { key: 'manufacturer', label: 'Manufacturer', placeholder: 'Company name as printed' },
  { key: 'batchNo', label: 'Batch no.', placeholder: 'e.g. B0000', mono: true },
  { key: 'expiryDate', label: 'Expiry date', placeholder: 'e.g. 03/2028', mono: true },
  { key: 'strength', label: 'Strength', placeholder: 'e.g. 80 mg / 480 mg' },
  { key: 'activeIngredient', label: 'Active ingredient', placeholder: 'e.g. Artemether; Lumefantrine', optional: true },
  { key: 'dosageForm', label: 'Form (tablet, syrup…)', placeholder: 'e.g. Tablet', optional: true },
  { key: 'marketedBy', label: 'Imported by', placeholder: 'The Nigerian company on the pack, if shown', optional: true },
];

export const REQUIRED_KEYS = FIELD_DEFS.filter((f) => !f.optional).map((f) => f.key);

// Below this the AI isn't sure, so the row must be looked at before the attestation unlocks.
export const LOW_CONFIDENCE = 0.8;

// Soft format hint only. A missing or odd reg. no. is still sent (the backend answers "unsure").
const REG_NO = /^[A-Z0-9]{2,3}-\d{3,6}(?:[A-Z])?$/i;
export function regNoLooksOdd(value: string | null): boolean {
  return !!value && !REG_NO.test(value.trim());
}

export type Fields = StandardizedMedicationInput['fields'];

export function emptyFields(): Fields {
  const f = {} as Record<FieldKey, ExtractedField>;
  for (const k of REQUIRED_KEYS) f[k] = { value: null, editedByUser: false };
  return f as Fields;
}

export function isLowConfidence(f: ExtractedField | undefined): boolean {
  return !!f && typeof f.confidence === 'number' && f.confidence < LOW_CONFIDENCE && !f.editedByUser;
}

// Normalise for sending: trim, empty -> null, drop untouched empty optional fields.
export function toInput(source: 'photo' | 'manual', fields: Fields, confirmed: boolean): StandardizedMedicationInput {
  const out = {} as Record<FieldKey, ExtractedField>;
  for (const def of FIELD_DEFS) {
    const f = fields[def.key];
    const value = f?.value?.trim() || null;
    if (def.optional && !value) continue;
    out[def.key] = { ...(f ?? { editedByUser: false }), value };
  }
  return { source, fields: out as Fields, confirmedByUser: confirmed };
}
