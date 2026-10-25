import { lazy, Suspense, useCallback, useEffect, useReducer, useRef } from 'react';
import { checkMedication, DEMO_PACKS, RequestError, USE_MOCKS, type DemoPackId } from '@/lib/api';
import { toInput } from '@/lib/fields';
import { initialState, reducer, type State } from '@/state';
import { PHOTO_STEPS, TYPED_STEPS, type StepInfo } from '@/components/app-shell';
import { Landing } from '@/screens/Landing';

// The start screen loads first; the rest of the flow (and Base UI's dialog, popover and tabs) follows on idle.
const loadFlow = () =>
  Promise.all([
    import('@/screens/Snap'),
    import('@/screens/Read'),
    import('@/screens/Confirm'),
    import('@/screens/Checking'),
    import('@/screens/Verdict'),
    import('@/screens/Report'),
  ]);
const Snap = lazy(() => import('@/screens/Snap').then((m) => ({ default: m.Snap })));
const Read = lazy(() => import('@/screens/Read').then((m) => ({ default: m.Read })));
const Confirm = lazy(() => import('@/screens/Confirm').then((m) => ({ default: m.Confirm })));
const Checking = lazy(() => import('@/screens/Checking').then((m) => ({ default: m.Checking })));
const VerdictScreen = lazy(() => import('@/screens/Verdict').then((m) => ({ default: m.VerdictScreen })));
const Report = lazy(() => import('@/screens/Report').then((m) => ({ default: m.Report })));
import type { ExtractionInfo, StandardizedMedicationInput } from '@shared/types';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The photo path has four steps; the typed path skips Snap and Read.
function stepFor(state: State): StepInfo | undefined {
  // Snap and Read are always the photo path (source only flips to 'photo' once the photos are sent).
  const photo = state.source === 'photo' || state.screen === 'snap' || state.screen === 'read';
  const steps = photo ? PHOTO_STEPS : TYPED_STEPS;
  const index: Partial<Record<State['screen'], number>> = photo
    ? { snap: 0, read: 1, confirm: 2, checking: 3, verdict: 3 }
    : { confirm: 0, checking: 1, verdict: 2 };
  const current = index[state.screen];
  return current === undefined ? undefined : { steps, current };
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Browser and hardware back step back through the flow instead of leaving the app.
  const fromPop = useRef(false);
  const screenRef = useRef(state.screen);
  screenRef.current = state.screen;
  useEffect(() => {
    const onPop = () => {
      // Some back moves skip a screen (Confirm -> Snap skips Read; a new check starts from Snap), which leaves
      // spare entries behind. On the start screen there is nothing left in the app, so keep going back
      // until the browser leaves instead of making the user press Back on a screen that doesn't change.
      if (screenRef.current === 'landing') return history.back();
      fromPop.current = true;
      dispatch({ type: 'back' });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (state.screen === 'checking') return;
    if (fromPop.current) {
      fromPop.current = false;
      history.replaceState({ screen: state.screen }, '');
    } else if (history.state?.screen !== state.screen) {
      history[state.screen === 'landing' && !history.state ? 'replaceState' : 'pushState']({ screen: state.screen }, '');
    }
    window.scrollTo(0, 0);
  }, [state.screen]);

  const onRead = useCallback((input: StandardizedMedicationInput, extraction: ExtractionInfo | null) => dispatch({ type: 'photoRead', input, extraction }), []);
  const onReadFail = useCallback((error: string) => dispatch({ type: 'readFailed', error }), []);

  async function runCheck() {
    // Only reachable after the attestation tick, so confirmedByUser is always the user's own answer.
    if (!state.attested) return;
    if (!USE_MOCKS && !navigator.onLine) {
      dispatch({
        type: 'checkFailed',
        error: "You're offline. Your details are kept, so try again when you're connected.",
      });
      return;
    }
    const input = toInput(state.source, state.fields, true);
    dispatch({ type: 'checkStarted', input });
    try {
      // Hold the checklist on screen long enough to read.
      const [result] = await Promise.all([checkMedication(input), delay(1400)]);
      dispatch({ type: 'checkDone', result });
    } catch (e) {
      dispatch({
        type: 'checkFailed',
        error: e instanceof RequestError ? e.message : 'Something went wrong. Your details are kept, so try again.',
      });
    }
  }

  function loadDemo(id: DemoPackId) {
    const pack = DEMO_PACKS.find((p) => p.id === id)!;
    dispatch({ type: 'startManual', prefill: pack.input });
  }

  useEffect(() => {
    const prefetch = () => void loadFlow();
    if ('requestIdleCallback' in window) requestIdleCallback(prefetch);
    else setTimeout(prefetch, 300);
  }, []);

  return <Suspense fallback={null}>{renderScreen()}</Suspense>;

  function renderScreen() {
    const step = stepFor(state);
    const back = () => history.back();

    switch (state.screen) {
      case 'landing':
        return <Landing onStart={() => dispatch({ type: 'go', screen: 'snap' })} onManual={() => dispatch({ type: 'startManual' })} onDemo={loadDemo} />;
      case 'snap':
        return (
          <Snap
            step={step!}
            photos={state.photos}
            onBack={back}
            onAdd={(photo) => dispatch({ type: 'addPhoto', photo })}
            onRemove={(id) => dispatch({ type: 'removePhoto', id })}
            onRead={() => dispatch({ type: 'readPhotos' })}
            onManual={() => dispatch({ type: 'startManual' })}
          />
        );
      case 'read':
        return (
          <Read
            step={step!}
            photos={state.photos}
            error={state.error}
            onRead={onRead}
            onFail={onReadFail}
            onBack={back}
            onRetake={back}
            onManual={() => dispatch({ type: 'startManual', keepPhoto: true })}
          />
        );
      case 'confirm':
        return (
          <Confirm
            step={step!}
            source={state.source}
            fields={state.fields}
            reviewed={state.reviewed}
            attested={state.attested}
            attestCleared={state.attestCleared}
            photos={state.photos}
            extraction={state.extraction}
            error={state.error}
            onBack={back}
            onEdit={(key, value) => dispatch({ type: 'editField', key, value })}
            onReview={(key) => dispatch({ type: 'reviewField', key })}
            onAttest={(value) => dispatch({ type: 'attest', value })}
            onCheck={runCheck}
          />
        );
      case 'checking':
        return <Checking step={step!} input={state.sentInput!} />;
      case 'verdict':
        return (
          <VerdictScreen
            step={step!}
            result={state.result!}
            productName={state.sentInput?.fields.productName?.value ?? null}
            onReport={() => dispatch({ type: 'go', screen: 'report' })}
            onAnother={() => dispatch({ type: 'reset' })}
            onEdit={back}
          />
        );
      case 'report':
        return <Report input={state.sentInput!} result={state.result!} onBack={back} />;
    }
  }
}
