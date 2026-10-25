import type { FieldKey, StandardizedMedicationInput, VerificationResult } from '@shared/types';
import { emptyFields, type Fields } from '@/lib/fields';

export type Screen = 'landing' | 'snap' | 'read' | 'confirm' | 'checking' | 'verdict' | 'report';

export interface State {
  screen: Screen;
  source: 'photo' | 'manual';
  photoUrl: string | null; // object URL of the resized photo, for the thumbnail
  photo: Blob | null;
  fields: Fields;
  reviewed: FieldKey[]; // low-confidence rows the user has looked at
  attested: boolean; // "These details match the pack"
  sentInput: StandardizedMedicationInput | null; // exactly what /api/check received
  result: VerificationResult | null;
  error: string | null;
}

export const initialState: State = {
  screen: 'landing',
  source: 'manual',
  photoUrl: null,
  photo: null,
  fields: emptyFields(),
  reviewed: [],
  attested: false,
  sentInput: null,
  result: null,
  error: null,
};

export type Action =
  | { type: 'go'; screen: Screen }
  | { type: 'startManual'; prefill?: StandardizedMedicationInput }
  | { type: 'photoTaken'; photo: Blob; url: string }
  | { type: 'photoRead'; input: StandardizedMedicationInput }
  | { type: 'readFailed'; error: string }
  | { type: 'editField'; key: FieldKey; value: string }
  | { type: 'reviewField'; key: FieldKey }
  | { type: 'attest'; value: boolean }
  | { type: 'checkStarted'; input: StandardizedMedicationInput }
  | { type: 'checkDone'; result: VerificationResult }
  | { type: 'checkFailed'; error: string }
  | { type: 'editDetails' }
  | { type: 'reset' };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'go':
      return { ...state, screen: action.screen, error: null };
    case 'startManual':
      return {
        ...state,
        screen: 'confirm',
        source: action.prefill?.source ?? 'manual',
        fields: action.prefill ? structuredClone(action.prefill.fields) : emptyFields(),
        reviewed: [],
        attested: false,
        result: null,
        error: null,
      };
    case 'photoTaken':
      if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
      return { ...state, screen: 'read', source: 'photo', photo: action.photo, photoUrl: action.url, error: null };
    case 'photoRead':
      return { ...state, screen: 'confirm', source: 'photo', fields: action.input.fields, reviewed: [], attested: false, error: null };
    case 'readFailed':
      return { ...state, error: action.error };
    case 'editField': {
      const prev = state.fields[action.key];
      const next = { ...(prev ?? { value: null, editedByUser: false }), value: action.value, editedByUser: true };
      // Any edit means the user has to re-confirm the whole set.
      return { ...state, fields: { ...state.fields, [action.key]: next }, attested: false };
    }
    case 'reviewField':
      return state.reviewed.includes(action.key) ? state : { ...state, reviewed: [...state.reviewed, action.key] };
    case 'attest':
      return { ...state, attested: action.value };
    case 'checkStarted':
      return { ...state, screen: 'checking', sentInput: action.input, error: null };
    case 'checkDone':
      return { ...state, screen: 'verdict', result: action.result };
    case 'checkFailed':
      return { ...state, screen: 'confirm', error: action.error };
    case 'editDetails':
      // Back from the verdict keeps the fields, but the attestation must be ticked again.
      return { ...state, screen: 'confirm', attested: false, result: null, error: null };
    case 'reset':
      if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
      return { ...initialState, fields: emptyFields(), screen: 'snap' };
  }
}
