import { useCallback, useEffect, useRef } from 'react';
import { extractFromPhoto, RequestError } from '@/lib/api';
import type { StandardizedMedicationInput } from '@shared/types';
import { Button, Card } from '@/components/ui';
import { Shell } from '@/components/Shell';

function readErrorMessage(e: unknown): string {
  if (e instanceof RequestError) {
    if (e.kind !== 'api') return e.message;
    if (e.status === 404) return "Photo reading isn't switched on yet. Type the details from the pack instead.";
    if (e.status === 422) return "We couldn't read the pack. Try a sharper photo with less glare, or type it in.";
    if (e.status === 429) return 'Photo reading is paused for now. Type the details from the pack instead.';
    return e.message;
  }
  return 'Something went wrong reading the photo.';
}

export function Read({
  photo,
  photoUrl,
  error,
  onRead,
  onFail,
  onRetake,
  onManual,
}: {
  photo: Blob;
  photoUrl: string;
  error: string | null;
  onRead: (input: StandardizedMedicationInput) => void;
  onFail: (msg: string) => void;
  onRetake: () => void;
  onManual: () => void;
}) {
  const started = useRef(false);
  const run = useCallback(() => {
    extractFromPhoto(photo).then(onRead).catch((e) => onFail(readErrorMessage(e)));
  }, [photo, onRead, onFail]);

  useEffect(() => {
    // StrictMode mounts twice in dev; only read once.
    if (started.current) return;
    started.current = true;
    run();
  }, [run]);

  return (
    <Shell step={1} title={error ? "We couldn't read that" : 'Reading the pack…'} subtitle={error ? undefined : 'The AI only reads the text. You check every detail next.'}>
      <div className="relative overflow-hidden rounded-card bg-[#1b2a1b]">
        <img src={photoUrl} alt="Your photo of the pack" className={`aspect-[4/3.2] w-full object-contain ${error ? 'opacity-50' : ''}`} />
        {!error && <span className="scan-line absolute inset-x-0 top-[40%] h-0.5 bg-sprout shadow-[0_0_14px_5px_rgba(169,201,138,.6)]" aria-hidden="true" />}
      </div>
      {error ? (
        <Card className="grid gap-3" >
          <p role="alert" className="text-[15px] font-medium">{error}</p>
          <div className="grid gap-2">
            <Button onClick={onManual}>Type it in</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={onRetake}>Retake</Button>
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
          </div>
        </Card>
      ) : (
        <div className="grid gap-3" aria-busy="true" aria-label="Reading fields">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="grid gap-2 rounded-[10px] border border-line bg-white p-3">
              <span className="skeleton h-2.5 w-24 rounded" />
              <span className="skeleton h-3.5 rounded" style={{ width: `${55 + ((i * 17) % 35)}%` }} />
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
