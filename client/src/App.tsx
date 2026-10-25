import { useCallback, useReducer } from 'react';
import { checkMedication, DEMO_PACKS, RequestError, type DemoPackId } from '@/lib/api';
import { toInput } from '@/lib/fields';
import { initialState, reducer } from '@/state';
import { Landing } from '@/screens/Landing';
import { Snap } from '@/screens/Snap';
import { Read } from '@/screens/Read';
import { Confirm } from '@/screens/Confirm';
import { VerdictScreen } from '@/screens/Verdict';
import { Report } from '@/screens/Report';
import type { StandardizedMedicationInput } from '@shared/types';

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const onRead = useCallback((input: StandardizedMedicationInput) => dispatch({ type: 'photoRead', input }), []);
  const onReadFail = useCallback((error: string) => dispatch({ type: 'readFailed', error }), []);

  async function runCheck() {
    // Only reachable after the attestation tick, so confirmedByUser is always the user's own answer.
    if (!state.attested) return;
    const input = toInput(state.source, state.fields, true);
    dispatch({ type: 'checkStarted', input });
    try {
      dispatch({ type: 'checkDone', result: await checkMedication(input) });
    } catch (e) {
      dispatch({ type: 'checkFailed', error: e instanceof RequestError ? e.message : 'Something went wrong. Your details are kept; try again.' });
    }
  }

  function loadDemo(id: DemoPackId) {
    const pack = DEMO_PACKS.find((p) => p.id === id)!;
    dispatch({ type: 'startManual', prefill: pack.input });
  }

  switch (state.screen) {
    case 'landing':
      return <Landing onStart={() => dispatch({ type: 'go', screen: 'snap' })} onManual={() => dispatch({ type: 'startManual' })} onDemo={loadDemo} />;
    case 'snap':
      return (
        <Snap
          onBack={() => dispatch({ type: 'go', screen: 'landing' })}
          onPhoto={(photo, url) => dispatch({ type: 'photoTaken', photo, url })}
          onManual={() => dispatch({ type: 'startManual' })}
        />
      );
    case 'read':
      return (
        <Read
          photo={state.photo!}
          photoUrl={state.photoUrl!}
          error={state.error}
          onRead={onRead}
          onFail={onReadFail}
          onRetake={() => dispatch({ type: 'go', screen: 'snap' })}
          onManual={() => dispatch({ type: 'startManual' })}
        />
      );
    case 'confirm':
    case 'checking':
      return (
        <Confirm
          source={state.source}
          fields={state.fields}
          reviewed={state.reviewed}
          attested={state.attested}
          photoUrl={state.photoUrl}
          error={state.error}
          checking={state.screen === 'checking'}
          onBack={() => dispatch({ type: 'go', screen: state.source === 'photo' ? 'snap' : 'landing' })}
          onEdit={(key, value) => dispatch({ type: 'editField', key, value })}
          onReview={(key) => dispatch({ type: 'reviewField', key })}
          onAttest={(value) => dispatch({ type: 'attest', value })}
          onCheck={runCheck}
        />
      );
    case 'verdict':
      return (
        <VerdictScreen
          result={state.result!}
          onReport={() => dispatch({ type: 'go', screen: 'report' })}
          onAnother={() => dispatch({ type: 'reset' })}
          onEdit={() => dispatch({ type: 'editDetails' })}
        />
      );
    case 'report':
      return <Report input={state.sentInput!} result={state.result!} onBack={() => dispatch({ type: 'go', screen: 'verdict' })} />;
  }
}
