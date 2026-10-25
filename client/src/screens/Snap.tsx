import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, CameraOff, Check, ImageUp, Keyboard, RotateCcw, X } from 'lucide-react';
import { resizeImage } from '@/lib/image';
import { useCamera, type CameraStatus } from '@/lib/camera';
import { SHOTS, type Photo } from '@/lib/shots';
import { Button } from '@/components/ui/button';
import { Shell, type StepInfo } from '@/components/app-shell';
import { cn } from '@/lib/utils';

const CORNERS = [
  'top-3 left-3 border-t-[3px] border-l-[3px] rounded-tl-[10px]',
  'top-3 right-3 border-t-[3px] border-r-[3px] rounded-tr-[10px]',
  'bottom-3 left-3 border-b-[3px] border-l-[3px] rounded-bl-[10px]',
  'bottom-3 right-3 border-b-[3px] border-r-[3px] rounded-br-[10px]',
];

// The frame the pack goes in: white corner marks on the dark stage. It fills the space left, and the
// shutter keeps exactly what's inside it.
export function CaptureFrame({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('relative min-h-[240px] w-full flex-1 overflow-hidden rounded-lg bg-white/[0.04]', className)}>
      {children}
      {CORNERS.map((c) => (
        <span key={c} aria-hidden="true" className={cn('pointer-events-none absolute size-7 border-white', c)} />
      ))}
    </div>
  );
}

// What the frame says when there is no live picture, and the one action that moves things on.
const BLOCKED: Partial<Record<CameraStatus, { title: string; body: string; retry: boolean }>> = {
  denied: {
    title: 'Camera is blocked',
    body: 'To allow it, tap the icon next to the address bar, choose Camera, then Allow. Or take it with your camera app, or choose photos you already have.',
    retry: true,
  },
  busy: { title: 'The camera is busy', body: 'Another app is using it. Close that app, then try again.', retry: true },
  none: { title: 'No camera found', body: 'Choose photos of the pack you already have, or type the details.', retry: false },
  insecure: {
    title: 'Use your camera app',
    body: 'The live preview needs a secure (https) link. Tap the shutter to take the photo with your camera app instead.',
    retry: false,
  },
  error: { title: "The camera didn't start", body: 'Try again, or choose photos of the pack you already have.', retry: true },
};

export function Snap({
  step,
  photos,
  onBack,
  onPhoto,
  onRead,
  onManual,
}: {
  step: StepInfo;
  photos: Photo[]; // kept in app state, so Back from Read or Confirm shows them again
  onBack: () => void;
  onPhoto: (photo: Photo) => void;
  onRead: () => void;
  onManual: () => void;
}) {
  const { videoRef, status, start, capture } = useCamera();
  const nativeRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const has = (i: number) => photos.some((p) => p.shot === SHOTS[i].id);
  const firstEmpty = () => SHOTS.findIndex((_, i) => !has(i));
  const [current, setCurrent] = useState(() => {
    const i = firstEmpty();
    return i === -1 ? 0 : i;
  });
  const [retake, setRetake] = useState(false);
  const [flash, setFlash] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [error, setError] = useState<string | null>(null);

  const shot = SHOTS[current];
  const taken = photos.find((p) => p.shot === shot.id);
  const showTaken = !!taken && !retake;
  const live = status === 'live';
  const blocked = BLOCKED[status];
  const allTaken = photos.length === SHOTS.length;

  // After a shot, move to the next empty one; when the set is full, stay and show the last photo.
  function advance(from: number, justTaken: Set<number>) {
    const next = SHOTS.findIndex((_, i) => i !== from && !has(i) && !justTaken.has(i));
    setRetake(false);
    if (next !== -1) setCurrent(next);
  }

  function keep(blob: Blob, index: number) {
    onPhoto({ shot: SHOTS[index].id, blob, url: URL.createObjectURL(blob) });
  }

  async function shoot() {
    setError(null);
    if (status === 'idle') return start();
    if (!live) return nativeRef.current?.click();
    const blob = await capture();
    if (!blob) return setError("That didn't work. Try again, or choose a photo.");
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    keep(blob, current);
    const next = SHOTS.findIndex((_, i) => i !== current && !has(i));
    setAnnounce(`${shot.label} photo taken.${next !== -1 ? ` Next: ${SHOTS[next].title}.` : ''}`);
    advance(current, new Set([current]));
  }

  // Upload or camera-app photos fill the current shot first, then the empty ones after it.
  async function handleFiles(list: FileList | null) {
    const files = [...(list ?? [])].slice(0, SHOTS.length);
    if (!files.length) return;
    setError(null);
    const order = [current, ...SHOTS.map((_, i) => i).filter((i) => i !== current && !has(i)), ...SHOTS.map((_, i) => i).filter((i) => i !== current && has(i))];
    const filled = new Set<number>();
    for (const [n, file] of files.entries()) {
      try {
        const blob = await resizeImage(file);
        keep(blob, order[n]);
        filled.add(order[n]);
      } catch {
        setError("One of those files isn't a photo we can open. Try another, or type the details.");
      }
    }
    if (filled.size) advance(current, filled);
    if (nativeRef.current) nativeRef.current.value = '';
    if (uploadRef.current) uploadRef.current.value = '';
  }

  // Hardware keyboards and desktop demos: space or enter takes the photo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' && live && !showTaken && document.activeElement === document.body) {
        e.preventDefault();
        shoot();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const count = photos.length;
  const readLabel = `Read ${count} photo${count === 1 ? '' : 's'}`;

  return (
    <Shell
      stage
      step={step}
      onBack={onBack}
      title={showTaken ? 'Can you read the small print?' : shot.title}
      description={
        showTaken
          ? 'Check the text is sharp and free of glare. Retake it if not.'
          : `Photo ${current + 1} of 3${current > 0 ? ', optional' : ''}. ${shot.hint}`
      }
      className="gap-3 pt-4"
      footer={
        showTaken ? (
          <>
            <Button block className="bg-white text-ink hover:bg-white/90" onClick={onRead}>
              {allTaken ? readLabel : `${readLabel} now`}
            </Button>
            {/* Camera and library are always one tap apart, in both directions. */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="onStage" onClick={() => setRetake(true)}>
                <RotateCcw strokeWidth={1.75} />
                Retake
              </Button>
              <Button variant="onStage" onClick={() => uploadRef.current?.click()}>
                <ImageUp strokeWidth={1.75} />
                Choose photo
              </Button>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-3 items-center pb-1">
            <button type="button" onClick={() => uploadRef.current?.click()} className="flex flex-col items-center gap-1.5 text-cap text-white/75 hover:text-white">
              <span className="grid size-11 place-items-center rounded-full bg-white/12">
                <ImageUp className="size-5" strokeWidth={1.75} />
              </span>
              From photos
            </button>
            <button
              type="button"
              aria-label={status === 'idle' ? 'Turn on the camera' : `Take photo: ${shot.title}`}
              onClick={shoot}
              disabled={status === 'starting'}
              className="mx-auto grid size-[76px] place-items-center rounded-full border-[3px] border-white/90 transition-transform active:scale-95 disabled:opacity-40"
            >
              <span className="grid size-[60px] place-items-center rounded-full bg-white text-ink">{status === 'idle' && <Camera className="size-6" strokeWidth={1.75} />}</span>
            </button>
            {count > 0 ? (
              <button type="button" onClick={onRead} className="flex flex-col items-center gap-1.5 text-cap text-white hover:text-white">
                <span className="grid size-11 place-items-center rounded-full bg-white text-ink">
                  <ArrowRight className="size-5" strokeWidth={2} />
                </span>
                {readLabel}
              </button>
            ) : (
              <button type="button" onClick={onManual} className="flex flex-col items-center gap-1.5 text-cap text-white/75 hover:text-white">
                <span className="grid size-11 place-items-center rounded-full bg-white/12">
                  <Keyboard className="size-5" strokeWidth={1.75} />
                </span>
                Type it instead
              </button>
            )}
          </div>
        )
      }
    >
      <input ref={nativeRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      <input ref={uploadRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />

      <CaptureFrame>
        {/* Always mounted so the stream has somewhere to go the moment it starts. */}
        <video ref={videoRef} playsInline muted autoPlay aria-hidden="true" className={cn('absolute inset-0 size-full object-cover', (!live || showTaken) && 'invisible')} />
        {showTaken && <img src={taken.url} alt={`Your photo: ${shot.title}`} className="absolute inset-0 size-full bg-stage object-contain" />}
        {!showTaken && !live && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            {status === 'idle' ? (
              <>
                <span className="grid size-12 place-items-center rounded-full bg-white/12">
                  <Camera className="size-6" strokeWidth={1.75} />
                </span>
                <p className="text-body font-medium">Use your camera to photograph the pack</p>
                <p className="text-foot text-white/65">Your browser will ask first. Photos are only used to read the label and are never stored.</p>
                <Button className="mt-1 bg-white text-ink hover:bg-white/90" onClick={start}>
                  Allow camera
                </Button>
              </>
            ) : status === 'starting' ? (
              <>
                <span className="size-6 animate-spin rounded-full border-2 border-white/25 border-t-white" aria-hidden="true" />
                <p className="text-foot text-white/75">Starting the camera…</p>
              </>
            ) : (
              blocked && (
                <>
                  <span className="grid size-12 place-items-center rounded-full bg-white/12">
                    <CameraOff className="size-6" strokeWidth={1.75} />
                  </span>
                  <p className="text-body font-medium">{blocked.title}</p>
                  <p className="text-foot text-white/65">{blocked.body}</p>
                  {blocked.retry && (
                    <Button variant="onStage" className="mt-1" onClick={start}>
                      Try again
                    </Button>
                  )}
                </>
              )
            )}
          </div>
        )}
        {live && !showTaken && (
          <span className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-cap font-medium whitespace-nowrap backdrop-blur">
            {shot.title}
          </span>
        )}
        <span aria-hidden="true" className={cn('pointer-events-none absolute inset-0 bg-white transition-opacity duration-150', flash ? 'opacity-70' : 'opacity-0')} />
      </CaptureFrame>

      {/* The set: tap a shot to take it or look at it again. */}
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Photos of the pack">
        {SHOTS.map((s, i) => {
          const p = photos.find((x) => x.shot === s.id);
          const selected = i === current;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={selected}
              aria-label={`${s.title}${p ? ', taken' : i > 0 ? ', optional' : ''}`}
              onClick={() => {
                setCurrent(i);
                setRetake(false);
              }}
              className={cn('flex items-center gap-2 rounded-md p-1.5 text-left transition-colors', selected ? 'bg-white/14 shadow-[inset_0_0_0_1.5px_rgba(255,255,255,.9)]' : 'bg-white/[0.06] hover:bg-white/10')}
            >
              <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-[6px] bg-white/10 text-cap font-semibold">
                {p ? (
                  <>
                    <img src={p.url} alt="" className="size-full object-cover" />
                    <span className="absolute right-0.5 bottom-0.5 grid size-3.5 place-items-center rounded-full bg-white text-ink">
                      <Check className="size-2.5" strokeWidth={3} />
                    </span>
                  </>
                ) : (
                  i + 1
                )}
              </span>
              <span className={cn('min-w-0 text-cap leading-[14px]', selected ? 'text-white' : 'text-white/70')}>{s.label}</span>
            </button>
          );
        })}
      </div>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-white/10 p-3 text-foot text-white">
          <X className="mt-px size-4 shrink-0" />
          {error}
        </p>
      )}
    </Shell>
  );
}
