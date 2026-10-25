import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, RotateCcw } from 'lucide-react';
import type { StandardizedMedicationInput } from '@shared/types';
import { extractFromPhoto, RequestError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ProgressList, Shell, type StepInfo } from '@/components/app-shell';

const STEPS = ['Reading the product name and strength', 'Finding the NAFDAC number', 'Reading the batch and expiry'];

function readErrorMessage(e: unknown): string {
  if (e instanceof RequestError) {
    if (e.kind !== 'api') return e.message;
    if (e.status === 404) return "Photo reading isn't switched on yet. Type the details from the pack instead.";
    if (e.status === 422) return "We couldn't read the pack. Try a sharper photo with less glare, or type the details.";
    if (e.status === 429) return 'Photo reading is paused for now. Type the details from the pack instead.';
    return e.message;
  }
  return 'Something went wrong reading the photo.';
}

export function Read({
  step,
  photo,
  photoUrl,
  error,
  onRead,
  onFail,
  onBack,
  onRetake,
  onManual,
}: {
  step: StepInfo;
  photo: Blob;
  photoUrl: string;
  error: string | null;
  onRead: (input: StandardizedMedicationInput) => void;
  onFail: (msg: string) => void;
  onBack: () => void;
  onRetake: () => void;
  onManual: () => void;
}) {
  const started = useRef(false);
  const [active, setActive] = useState(0);

  const run = useCallback(() => {
    setActive(0);
    extractFromPhoto(photo)
      .then((input) => {
        setActive(STEPS.length);
        setTimeout(() => onRead(input), 350);
      })
      .catch((e) => onFail(readErrorMessage(e)));
  }, [photo, onRead, onFail]);

  useEffect(() => {
    // StrictMode mounts twice in dev; only read once.
    if (started.current) return;
    started.current = true;
    run();
  }, [run]);

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
      title={error ? "We couldn't read that photo" : 'Reading the label'}
      description={error ?? 'The AI only reads the text. You check every detail next.'}
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
                  run();
                }}
              >
                Try again
              </Button>
            </div>
          </>
        )
      }
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-stage">
        <img src={photoUrl} alt="Your photo of the pack" className={`size-full object-contain transition-opacity ${error ? 'opacity-40' : ''}`} />
        {!error && <span aria-hidden="true" className="scan-line absolute inset-x-4 top-1/2 h-px bg-white shadow-[0_0_12px_3px_rgba(255,255,255,.55)]" />}
      </div>
      <div className="pt-2" role={error ? 'alert' : undefined}>
        <ProgressList items={STEPS} active={active} failed={!!error} />
      </div>
    </Shell>
  );
}
