import { useCallback, useEffect, useReducer, useRef } from 'react';
import { checkMedication, DEMO_PACKS, RequestError, USE_MOCKS, type DemoPackId } from '@/lib/api';
import { toInput } from '@/lib/fields';
import { initialState, reducer, type State } from '@/state';
import { PHOTO_STEPS, TYPED_STEPS, type StepInfo } from '@/components/app-shell';
import { Landing } from '@/screens/Landing';
import { Snap } from '@/screens/Snap';
import { Read } from '@/screens/Read';
import { Confirm } from '@/screens/Confirm';
import { Checking } from '@/screens/Checking';
import { VerdictScreen } from '@/screens/Verdict';
import { Report } from '@/screens/Report';
import type { StandardizedMedicationInput } from '@shared/types';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The photo path has four steps; the typed path skips Snap and Read.
function stepFor(state: State): StepInfo | undefined {
  const photo = state.source === 'photo';
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
  useEffect(() => {
    const onPop = () => {
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

  const onRead = useCallback((input: StandardizedMedicationInput) => dispatch({ type: 'photoRead', input }), []);
  const onReadFail = useCallback((error: string) => dispatch({ type: 'readFailed', error }), []);

  async function runCheck() {
    // Only reachable after the attestation tick, so confirmedByUser is always the user's own answer.
    if (!state.attested) return;
    if (!USE_MOCKS && !navigator.onLine) {
      dispatch({ type: 'checkFailed', error: "You're offline. Your details are kept, so try again when you're connected." });
      return;
    }
    const input = toInput(state.source, state.fields, true);
    dispatch({ type: 'checkStarted', input });
    try {
      // Hold the checklist on screen long enough to read.
      const [result] = await Promise.all([checkMedication(input), delay(1400)]);
      dispatch({ type: 'checkDone', result });
    } catch (e) {
      dispatch({ type: 'checkFailed', error: e instanceof RequestError ? e.message : "Something went wrong. Your details are kept, so try again." });
    }
  }

  function loadDemo(id: DemoPackId) {
    const pack = DEMO_PACKS.find((p) => p.id === id)!;
    dispatch({ type: 'startManual', prefill: pack.input });
  }

  const step = stepFor(state);
  const back = () => history.back();

  switch (state.screen) {
    case 'landing':
      return <Landing onStart={() => dispatch({ type: 'go', screen: 'snap' })} onManual={() => dispatch({ type: 'startManual' })} onDemo={loadDemo} />;
    case 'snap':
      return <Snap step={step!} initial={state.photo && state.photoUrl ? { blob: state.photo, url: state.photoUrl } : null} onBack={back} onPhoto={(photo, url) => dispatch({ type: 'photoTaken', photo, url })} onManual={() => dispatch({ type: 'startManual' })} />;
    case 'read':
      return (
        <Read
          step={step!}
          photo={state.photo!}
          photoUrl={state.photoUrl!}
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
          photoUrl={state.photoUrl}
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
