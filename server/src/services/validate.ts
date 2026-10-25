import type { StandardizedMedicationInput } from '../../../shared/types';

const REQUIRED = ['productName', 'strength', 'nafdacRegNo', 'manufacturer', 'batchNo', 'expiryDate'] as const;
const OPTIONAL = ['activeIngredient', 'dosageForm', 'marketedBy'] as const;
const MAX_VALUE = 200;

export type ValidationResult =
  | { ok: true; input: StandardizedMedicationInput }
  | { ok: false; errors: string[] };

function checkField(name: string, f: unknown, errors: string[]) {
  if (typeof f !== 'object' || f === null) return errors.push(`fields.${name} must be an object`);
  const o = f as Record<string, unknown>;
  if (!(o.value === null || typeof o.value === 'string')) errors.push(`fields.${name}.value must be a string or null`);
  // Matching is edit-distance based, so an unbounded string would tie up the server.
  else if (typeof o.value === 'string' && o.value.length > MAX_VALUE) errors.push(`fields.${name}.value must be at most ${MAX_VALUE} characters`);
  if (o.confidence !== undefined && (typeof o.confidence !== 'number' || !(o.confidence >= 0 && o.confidence <= 1))) errors.push(`fields.${name}.confidence must be 0-1`);
  if (o.sourceText !== undefined && typeof o.sourceText !== 'string') errors.push(`fields.${name}.sourceText must be a string`);
  if (typeof o.editedByUser !== 'boolean') errors.push(`fields.${name}.editedByUser must be a boolean`);
}

export function validateInput(body: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof body !== 'object' || body === null) return { ok: false, errors: ['body must be a JSON object'] };
  const b = body as Record<string, unknown>;
  if (b.source !== 'photo' && b.source !== 'manual') errors.push('source must be "photo" or "manual"');
  if (typeof b.confirmedByUser !== 'boolean') errors.push('confirmedByUser must be a boolean');
  const fields = b.fields as Record<string, unknown> | undefined;
  if (typeof fields !== 'object' || fields === null) errors.push('fields must be an object');
  else {
    for (const k of REQUIRED) checkField(k, fields[k], errors);
    for (const k of OPTIONAL) if (fields[k] !== undefined) checkField(k, fields[k], errors);
  }
  return errors.length ? { ok: false, errors } : { ok: true, input: body as StandardizedMedicationInput };
}
