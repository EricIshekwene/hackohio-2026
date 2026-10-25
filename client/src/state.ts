import type { ExtractionInfo, FieldKey, StandardizedMedicationInput, VerificationResult } from '@shared/types';
import { emptyFields, type Fields } from '@/lib/fields';
import type { Photo, ShotId } from '@/lib/shots';

export type Screen = 'landing' | 'snap' | 'read' | 'confirm' | 'checking' | 'verdict' | 'report';

export interface State {
  screen: Screen;
  source: 'photo' | 'manual';
  photos: Photo[]; // the shot set; kept on the typed path so the user can copy from it
  extraction: ExtractionInfo | null; // how the read went (glare, blur…), from /api/extract
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
  photos: [],
  extraction: null,
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
  | { type: 'setPhoto'; photo: Photo }
  | { type: 'removePhoto'; shot: ShotId }
  | { type: 'readPhotos' }
  | { type: 'photoRead'; input: StandardizedMedicationInput; extraction: ExtractionInfo | null }
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
      const keep = !!action.keepPhoto;
      if (!keep) revokeAll(state.photos);
      return {
        ...state,
        screen: 'confirm',
        source: action.prefill?.source ?? 'manual',
        photos: keep ? state.photos : [],
        extraction: null,
        fields: action.prefill ? structuredClone(action.prefill.fields) : emptyFields(),
        reviewed: [],
        attested: false,
        attestCleared: false,
        result: null,
        error: null,
      };
    }
    case 'setPhoto': {
      // A retake replaces that shot only.
      const old = state.photos.find((p) => p.shot === action.photo.shot);
      if (old && old.url !== action.photo.url) URL.revokeObjectURL(old.url);
      return { ...state, photos: [...state.photos.filter((p) => p.shot !== action.photo.shot), action.photo], error: null };
    }
    case 'removePhoto': {
      const old = state.photos.find((p) => p.shot === action.shot);
      if (old) URL.revokeObjectURL(old.url);
      return { ...state, photos: state.photos.filter((p) => p.shot !== action.shot) };
    }
    case 'readPhotos':
      return state.photos.length ? { ...state, screen: 'read', source: 'photo', error: null } : state;
    case 'photoRead':
      return { ...state, screen: 'confirm', source: 'photo', fields: action.input.fields, extraction: action.extraction, reviewed: [], attested: false, attestCleared: false, error: null };
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
          // Photos exist on the typed fallback too (read failed, user typed instead): go back to them.
          return { ...state, screen: state.photos.length ? 'snap' : 'landing', error: null };
        case 'verdict':
          return reducer(state, { type: 'editDetails' });
        case 'report':
          return { ...state, screen: 'verdict' };
        default:
          return state; // landing and checking have nowhere to go back to
      }
    case 'reset':
      // Straight back to the camera: pharmacists check pack after pack.
      revokeAll(state.photos);
      return { ...initialState, fields: emptyFields(), screen: 'snap' };
  }
}

function revokeAll(photos: Photo[]) {
  for (const p of photos) URL.revokeObjectURL(p.url);
}
