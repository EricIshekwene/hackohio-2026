// Contracts between the three layers. Frontend, middleware and backend all import from here.
// Layer 2 (extract / manual entry) -> Layer 3 (check): StandardizedMedicationInput
// Layer 3 (check) -> Layer 1 (frontend): VerificationResult

// ---------- Input: same shape for photo and manual entry ----------

export interface ExtractedField {
  value: string | null;
  confidence?: number; // 0-1, photo path only
  sourceText?: string; // the text the AI read
  editedByUser: boolean;
}

export interface StandardizedMedicationInput {
  source: 'photo' | 'manual';
  fields: {
    productName: ExtractedField;
    strength: ExtractedField;
    nafdacRegNo: ExtractedField;
    manufacturer: ExtractedField;
    batchNo: ExtractedField;
    expiryDate: ExtractedField;
    // Optional extras. Sent when the pack shows them; they make R3 sharper.
    activeIngredient?: ExtractedField;
    dosageForm?: ExtractedField;
    // "Marketed by" / "Imported by" / licence holder. NAFDAC registers the Nigerian holder,
    // not the foreign factory, so this is what the registry's applicant usually matches.
    marketedBy?: ExtractedField;
  };
  confirmedByUser: boolean; // backend refuses to check unconfirmed input
}

export type FieldKey = keyof StandardizedMedicationInput['fields'];

// ---------- Output ----------

export type Verdict = 'red' | 'amber' | 'green' | 'unsure';

// R1 not registered · R2 on an alert · R3 details differ from the registered record
// R4 registration not active / expired · R5 all consistent · R6 pack past its expiry
// U1 no registration number on the pack
export type RuleId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'U1';

export interface ComparisonRow {
  field: FieldKey;
  label: string; // "Product name"
  onPack: string | null;
  inRegistry: string | null;
  match: boolean | null; // null = could not compare (missing on one side)
}

export interface Source {
  name: string; // "NAFDAC Greenbook (snapshot)" | "NAFDAC Public Alert 042/2026"
  ref?: string; // reg no. or alert no.
  url?: string;
  date?: string; // ISO date: snapshot date or alert date
}

// One rule that fired. Every non-green verdict has at least one of these, all produced by code.
export interface Finding {
  rule: RuleId;
  verdict: Verdict; // this finding's own colour; the overall verdict is the worst one
  title: string; // "Registration number belongs to a different product"
  message: string; // plain-language explanation
  evidence: ComparisonRow[]; // pack vs NAFDAC, side by side
  source: Source;
  nextStep: string;
}

export interface AlertMatch {
  alertNo: string;
  title: string;
  date: string;
  url: string;
  matchedOn: ('batchNo' | 'nafdacRegNo' | 'productName')[];
}

export interface RegistryRecord {
  regNo: string;
  productName: string;
  strength: string;
  composition?: string;
  ingredient?: string;
  applicant: string; // the manufacturer / marketing-authorisation holder
  form?: string;
  approvalDate?: string;
  expiryDate?: string; // registration expiry
  status: string; // "Active", ...
}

export interface LegendEntry {
  verdict: Verdict;
  label: string; // "Do not use"
  headline: string; // shown big on the verdict screen
  meaning: string; // one line for the legend
  nextStep: string; // default advice for this tier
  color: string; // solid colour (badge, icon)
  background: string; // tint for the card
  text: string; // readable text colour on the tint
}

export interface VerificationResult {
  verdict: Verdict;
  legend: LegendEntry; // the entry for this verdict, so the screen needs no lookup
  headline: string; // plain language
  summary: string; // one sentence; for green this is the exact caveat wording
  reasons: Finding[]; // every rule that fired, worst first
  comparison: ComparisonRow[]; // full side-by-side table for the hero screen
  registryRecord: RegistryRecord | null;
  alertMatches: AlertMatch[];
  checked: string[]; // "Registration number against 8,946 NAFDAC records"
  notChecked: string[]; // "Batch number (not on pack)"
  notes: string[]; // non-colour-changing notes, e.g. registration expiring soon
  dataAsOf: { registrySnapshot: string; lastAlert: string };
  caveat: 'Not proof of authenticity';
  checkedAt: string; // ISO timestamp
}

// ---------- Report ----------

export interface ReportRequest {
  input: StandardizedMedicationInput;
  result: VerificationResult;
  reporter?: { name?: string; phone?: string; location?: string };
  whereBought?: string;
  notes?: string;
}

export interface ReportDraft {
  to: string;
  phone: string;
  subject: string;
  body: string; // editable by the user before sending
  mailto: string; // mailto: link with subject + body prefilled
  tel: string;
}

export interface ApiError {
  error: 'invalid_input' | 'unconfirmed' | 'not_found' | 'server_error';
  message: string;
  details?: string[];
}
