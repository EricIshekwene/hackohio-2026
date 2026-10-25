import type { FieldKey, StandardizedMedicationInput, VerificationResult } from '@shared/types';
import { emptyFields, type Fields } from '@/lib/fields';

export type Screen = 'landing' | 'snap' | 'read' | 'confirm' | 'checking' | 'verdict' | 'report';

export interface State {
  screen: Screen;
  source: 'photo' | 'manual';
  photoUrl: string | null; // object URL of the resized photo; kept on the typed path so the user can copy from it
  photo: Blob | null;
  fields: Fields;
  reviewed: FieldKey[]; // low-confidence rows the user confirmed with "Looks right"
  attested: boolean; // "These details match the pack"
  attestCleared: boolean; // an edit un-ticked the attestation; say so next to the button
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
  attestCleared: false,
  sentInput: null,
  result: null,
  error: null,
};

export type Action =
  | { type: 'go'; screen: Screen }
  | { type: 'startManual'; prefill?: StandardizedMedicationInput; keepPhoto?: boolean }
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
  | { type: 'back' }
  | { type: 'reset' };

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'go':
      return { ...state, screen: action.screen, error: null };
    case 'startManual': {
      const keep = action.keepPhoto && state.photoUrl;
      if (!keep && state.photoUrl) URL.revokeObjectURL(state.photoUrl);
      return {
        ...state,
        screen: 'confirm',
        source: action.prefill?.source ?? 'manual',
        photo: keep ? state.photo : null,
        photoUrl: keep ? state.photoUrl : null,
        fields: action.prefill ? structuredClone(action.prefill.fields) : emptyFields(),
        reviewed: [],
        attested: false,
        attestCleared: false,
        result: null,
        error: null,
      };
    }
    case 'photoTaken':
      if (state.photoUrl && state.photoUrl !== action.url) URL.revokeObjectURL(state.photoUrl);
      return { ...state, screen: 'read', source: 'photo', photo: action.photo, photoUrl: action.url, error: null };
    case 'photoRead':
      return { ...state, screen: 'confirm', source: 'photo', fields: action.input.fields, reviewed: [], attested: false, attestCleared: false, error: null };
    case 'readFailed':
      return { ...state, error: action.error };
    case 'editField': {
      const prev = state.fields[action.key];
      const next = { ...(prev ?? { value: null, editedByUser: false }), value: action.value, editedByUser: true };
      // Any edit means the user has to re-confirm the whole set.
      return { ...state, fields: { ...state.fields, [action.key]: next }, attested: false, attestCleared: state.attested || state.attestCleared, error: null };
    }
    case 'reviewField':
      return state.reviewed.includes(action.key) ? state : { ...state, reviewed: [...state.reviewed, action.key] };
    case 'attest':
      return { ...state, attested: action.value, attestCleared: false };
    case 'checkStarted':
      return { ...state, screen: 'checking', sentInput: action.input, error: null };
    case 'checkDone':
      return { ...state, screen: 'verdict', result: action.result };
    case 'checkFailed':
      return { ...state, screen: 'confirm', error: action.error };
    case 'editDetails':
      // Back from the verdict keeps the fields, but the attestation must be ticked again.
      return { ...state, screen: 'confirm', attested: false, attestCleared: false, result: null, error: null };
    case 'back':
      switch (state.screen) {
        case 'snap':
          return { ...state, screen: 'landing', error: null };
        case 'read':
          return { ...state, screen: 'snap', error: null };
        case 'confirm':
          return { ...state, screen: state.source === 'photo' && state.photoUrl ? 'snap' : 'landing', error: null };
        case 'verdict':
          return reducer(state, { type: 'editDetails' });
        case 'report':
          return { ...state, screen: 'verdict' };
        default:
          return state; // landing and checking have nowhere to go back to
      }
    case 'reset':
      // Straight back to the camera: pharmacists check pack after pack.
      if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
      return { ...initialState, fields: emptyFields(), screen: 'snap' };
  }
}
