// Contracts between the three layers. Frontend, middleware and backend all import from here.
// Layer 2 (extract / manual entry) -> Layer 3 (check): StandardizedMedicationInput
// Layer 3 (check) -> Layer 1 (frontend): VerificationResult

// ---------- Input: same shape for photo and manual entry ----------

export interface ExtractedField {
  value: string | null;
  confidence?: number; // 0-1, photo path only
  sourceText?: string; // the text the AI read
  notes?: string[]; // photo path only: why confidence is low, e.g. "changed letter O to digit 0"
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

// /api/extract returns the input plus how the photos went. /api/check ignores the extra key.
export type PhotoStatus = 'ok' | 'blurry' | 'glare' | 'partial' | 'multiple_packs' | 'not_medicine';
export type PackSide = 'front' | 'back' | 'side' | 'top' | 'bottom' | 'blister' | 'unknown';
export interface ExtractionInfo {
  photoStatus: PhotoStatus;
  sidesSeen: { photo: number; side: PackSide }[]; // 1-based, in the order the photos were sent
  model: string;
  costUsd: number;
}
export type ExtractResponse = StandardizedMedicationInput & { extraction: ExtractionInfo };

// ---------- Output ----------

export type Verdict = 'red' | 'amber' | 'green' | 'unsure';

// R1 not in the local registry snapshot (unable to verify; never "not registered")
// R2 on an alert · R3 details differ from the registered (or reference) record
// R4 registration not active / expired · R5 all consistent · R6 pack past its expiry
// U1 no registration number on the pack · U2 number needed a character correction and has no match
// U3 registry data unavailable
export type RuleId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'U1' | 'U2' | 'U3';

// What the evidence actually supports. The colour (Verdict) is derived from this, never the other way round.
// "Not in our data" is a statement about coverage, not proof that a registration never existed.
export type DecisionStatus =
  | 'registry_match_current' // current NAFDAC Greenbook record, pack consistent
  | 'registry_match_historical' // earlier official NAFDAC record only; current status unknown
  | 'external_product_match' // GS1 / manufacturer listing only; official status unknown
  | 'record_mismatch' // a trusted record has this number but different pack details
  | 'confirmed_regulatory_alert' // an official alert names this batch or number
  | 'confirmed_inactive_or_cancelled' // Greenbook lists the registration as not Active, or expired
  | 'not_found_in_snapshot' // no match in the data we hold; that data is not exhaustive
  | 'lookup_unavailable' // registry data could not be loaded
  | 'input_uncertain'; // the number is missing or was not read reliably

export type Severity = 'high' | 'warning' | 'caution' | 'none';

export type ReasonCode =
  | 'REGISTRY_MATCH_CURRENT'
  | 'NOT_IN_LOCAL_SNAPSHOT'
  | 'HISTORICAL_RECORD_FOUND'
  | 'EXTERNAL_PRODUCT_RECORD_FOUND'
  | 'CURRENT_STATUS_UNVERIFIED'
  | 'REGULATORY_ALERT'
  | 'SIMILAR_PRODUCT_ALERT'
  | 'FIELD_MISMATCH'
  | 'REFERENCE_FIELD_MISMATCH'
  | 'NAME_NEAR_MISS'
  | 'REGISTRATION_INACTIVE'
  | 'REGISTRATION_EXPIRED'
  | 'PACK_EXPIRED'
  | 'NO_REG_NO'
  | 'REG_NO_CHARACTER_CORRECTED'
  | 'LOOKUP_UNAVAILABLE';

// Where a record came from. Only Greenbook rows carry an authoritative current status.
export type SourceType =
  | 'nafdac_greenbook'
  | 'nafdac_historical_document'
  | 'nafdac_alert'
  | 'who_alert'
  | 'gs1_listing'
  | 'manufacturer_catalog';

// One source we looked in, and what (if anything) it says about this number. Kept separate from the decision.
export interface EvidenceRecord {
  sourceType: SourceType;
  sourceName: string; // "NAFDAC Greenbook", "GS1 Nigeria product registry"
  recordType: string; // "Current registry snapshot", "Barcode product listing"
  official: boolean; // published by NAFDAC
  found: boolean; // false = we looked and this source has no record for the number
  sourceUrl?: string;
  sourcePublishedAt?: string; // ISO date the source itself was published, when known
  retrievedAt?: string; // ISO date we downloaded / read it
  registrationNumber: string | null;
  productName?: string;
  activeIngredients?: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  registrationStatus: string; // "Active" | "Inactive" | "unknown" (only Greenbook is authoritative)
  registrationStatusVerifiedAt?: string;
  evidenceLimitations: string[];
}

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
  code: ReasonCode; // machine-readable reason
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
  status: DecisionStatus; // what the evidence supports; verdict is its colour
  severity: Severity;
  verdict: Verdict;
  registrationNumber: string | null; // normalised, as looked up
  productName: string | null; // from the record we matched, else the pack
  currentRegistrationStatus: 'active' | 'inactive' | 'expired' | 'unknown'; // from Greenbook only
  authenticityVerified: false; // a records check can never establish this
  evidence: EvidenceRecord[]; // every source consulted, including ones with no record
  comparisonSource: string; // header for the right-hand column of the comparison ("NAFDAC record", "GS1 listing")
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
