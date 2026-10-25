import { useEffect, useState } from 'react';
import { Keyboard, RotateCcw } from 'lucide-react';
import type { ExtractionInfo, StandardizedMedicationInput } from '@shared/types';
import { extractFromPhotos, RequestError } from '@/lib/api';
import { orderedPhotos, shotLabel, type Photo } from '@/lib/shots';
import { Button } from '@/components/ui/button';
import { ProgressList, Shell, type StepInfo } from '@/components/app-shell';

const STEPS = ['Reading the product name and strength', 'Finding the NAFDAC number', 'Reading the batch and expiry'];

function readErrorMessage(e: unknown): string {
  if (e instanceof RequestError) {
    if (e.kind !== 'api') return e.message;
    if (e.status === 404) return "Photo reading isn't switched on yet. Type the details from the pack instead.";
    if (e.status === 429) return 'Photo reading is paused for now. Type the details from the pack instead.';
    // 422 says which problem it was (one pack at a time, not a medicine pack, unreadable); 400/413 say what was wrong with the file.
    if (e.status === 422) return `${e.message} Retake the photos, or type the details.`;
    return e.message;
  }
  return 'Something went wrong reading the photo.';
}

export function Read({
  step,
  photos,
  error,
  onRead,
  onFail,
  onBack,
  onRetake,
  onManual,
}: {
  step: StepInfo;
  photos: Photo[];
  error: string | null;
  onRead: (input: StandardizedMedicationInput, extraction: ExtractionInfo | null) => void;
  onFail: (msg: string) => void;
  onBack: () => void;
  onRetake: () => void;
  onManual: () => void;
}) {
  const [active, setActive] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const shown = orderedPhotos(photos);

  // One read per attempt. Leaving the screen aborts it, so a late answer can't pull the user forward.
  useEffect(() => {
    const ctrl = new AbortController();
    let done: ReturnType<typeof setTimeout> | undefined;
    setActive(0);
    extractFromPhotos(photos, ctrl.signal)
      .then(({ input, extraction }) => {
        if (ctrl.signal.aborted) return;
        setActive(STEPS.length);
        done = setTimeout(() => onRead(input, extraction), 350);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) onFail(readErrorMessage(e));
      });
    return () => {
      ctrl.abort();
      clearTimeout(done);
    };
    // photos only change on Snap, which unmounts this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Tick through the list while the request runs; the last item waits for the answer.
  useEffect(() => {
    if (error || active >= STEPS.length - 1) return;
    const t = setTimeout(() => setActive((a) => a + 1), 650);
    return () => clearTimeout(t);
  }, [active, error]);

  return (
    <Shell
      step={step}
      onBack={onBack}
      title={error ? `We couldn't read ${shown.length === 1 ? 'that photo' : 'those photos'}` : 'Reading the label'}
      description={error || 'The AI only reads the text. You check every detail next.'}
      footer={
        error && (
          <>
            <Button block onClick={onManual}>
              <Keyboard strokeWidth={1.75} />
              Type the details
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={onRetake}>
                <RotateCcw strokeWidth={1.75} />
                Retake
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  onFail('');
                  setAttempt((a) => a + 1);
                }}
              >
                Try again
              </Button>
            </div>
          </>
        )
      }
    >
      <div className={`relative grid w-full gap-1 overflow-hidden rounded-lg bg-stage ${shown.length === 1 ? 'aspect-[4/3]' : 'aspect-[16/9]'}`} style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
        {shown.map((p) => (
          <img key={p.shot} src={p.url} alt={`Your photo: ${shotLabel(p.shot)}`} className={`size-full transition-opacity ${shown.length === 1 ? 'object-contain' : 'object-cover'} ${error ? 'opacity-40' : ''}`} />
        ))}
        {!error && <span aria-hidden="true" className="scan-line absolute inset-x-4 top-1/2 h-px bg-white shadow-[0_0_12px_3px_rgba(255,255,255,.55)]" />}
      </div>
      <div className="pt-2" role={error ? 'alert' : undefined}>
        <ProgressList items={STEPS} active={active} failed={!!error} />
      </div>
    </Shell>
  );
}
