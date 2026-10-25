import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, CameraOff, ImageUp, Keyboard, Plus, Trash2, X } from 'lucide-react';
import { resizeImage } from '@/lib/image';
import { useCamera, type CameraStatus } from '@/lib/camera';
import { MAX_PHOTOS, newPhoto, type Photo } from '@/lib/photos';
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

// What the frame says when there is no live picture.
const BLOCKED: Partial<Record<CameraStatus, { title: string; body: string; retry: boolean }>> = {
  denied: {
    title: 'Camera is blocked',
    body: 'To allow it, tap the icon next to the address bar, choose Camera, then Allow. Or take photos with your camera app, or choose ones you already have.',
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
  onAdd,
  onRemove,
  onRead,
  onManual,
}: {
  step: StepInfo;
  photos: Photo[]; // kept in app state, so Back from Read or Confirm shows them again
  onBack: () => void;
  onAdd: (photo: Photo) => void;
  onRemove: (id: string) => void;
  onRead: () => void;
  onManual: () => void;
}) {
  const { videoRef, status, start, capture } = useCamera();
  const nativeRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [viewing, setViewing] = useState<string | null>(null); // a photo opened from the strip
  const [flash, setFlash] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const count = photos.length;
  const full = count >= MAX_PHOTOS;
  const room = MAX_PHOTOS - count;
  const open = photos.find((p) => p.id === viewing) ?? null;
  const live = status === 'live';
  const blocked = BLOCKED[status];

  function reset() {
    setError(null);
    setNote(null);
  }

  async function shoot() {
    reset();
    if (full) return;
    if (status === 'idle') return start();
    if (!live) return nativeRef.current?.click();
    const blob = await capture();
    if (!blob) return setError("That didn't work. Try again, or choose a photo.");
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    onAdd(newPhoto(blob));
    setAnnounce(`Photo ${count + 1} added.`);
  }

  // Library or camera-app photos fill the free slots; never more than a pack takes.
  async function handleFiles(list: FileList | null) {
    const files = [...(list ?? [])];
    if (nativeRef.current) nativeRef.current.value = '';
    if (libraryRef.current) libraryRef.current.value = '';
    if (!files.length) return;
    reset();
    let added = 0;
    let unreadable = 0;
    for (const file of files) {
      if (added === room) break;
      try {
        onAdd(newPhoto(await resizeImage(file)));
        added++;
      } catch {
        unreadable++;
      }
    }
    if (unreadable) setError(`${unreadable === 1 ? "One file isn't a photo" : `${unreadable} files aren't photos`} we can open. Try another, or type the details.`);
    else if (files.length > added) setNote(`A pack takes up to ${MAX_PHOTOS} photos, so we added the first ${added}.`);
    if (added) setAnnounce(`Added ${added} photo${added === 1 ? '' : 's'}.`);
  }

  function remove(id: string) {
    reset();
    onRemove(id);
    setViewing(null);
    setAnnounce('Photo removed.');
  }

  // Desktop demos: space takes the photo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' && live && !open && !full && document.activeElement === document.body) {
        e.preventDefault();
        shoot();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const readButton = (
    <Button block className="bg-white text-ink hover:bg-white/90" onClick={onRead}>
      Read pack
      <span className="font-normal text-ink-3">
        {count} photo{count === 1 ? '' : 's'}
      </span>
    </Button>
  );

  return (
    <Shell
      stage
      step={step}
      onBack={onBack}
      title={open ? 'Can you read the small print?' : 'Photograph the pack'}
      description={
        open
          ? 'Check the text is sharp and free of glare. Remove it if not.'
          : `Take 1 to ${MAX_PHOTOS} photos from any side. Include the NAFDAC number and expiry if you can.`
      }
      className="gap-3 pt-4"
      footer={
        open ? (
          <>
            {readButton}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="onStage" onClick={() => remove(open.id)}>
                <Trash2 strokeWidth={1.75} />
                Remove
              </Button>
              <Button variant="onStage" onClick={() => setViewing(null)}>
                <Camera strokeWidth={1.75} />
                {full ? 'Done' : 'Back to camera'}
              </Button>
            </div>
          </>
        ) : full ? (
          <>
            {readButton}
            <p className="text-center text-cap text-white/65">That's the most we read at once. Tap a photo to check or remove it.</p>
          </>
        ) : (
          <div className="grid grid-cols-3 items-center pb-1">
            {/* Camera and library are always one tap apart, in both directions. */}
            <button type="button" onClick={() => libraryRef.current?.click()} className="flex flex-col items-center gap-1.5 text-cap text-white/75 hover:text-white">
              <span className="grid size-11 place-items-center rounded-full bg-white/12">
                <ImageUp className="size-5" strokeWidth={1.75} />
              </span>
              From photos
            </button>
            <button
              type="button"
              aria-label={status === 'idle' ? 'Turn on the camera' : 'Take photo'}
              onClick={shoot}
              disabled={status === 'starting'}
              className="mx-auto grid size-[76px] place-items-center rounded-full border-[3px] border-white/90 transition-transform active:scale-95 disabled:opacity-40"
            >
              <span className="grid size-[60px] place-items-center rounded-full bg-white text-ink">{status === 'idle' && <Camera className="size-6" strokeWidth={1.75} />}</span>
            </button>
            {count > 0 ? (
              <button type="button" onClick={onRead} className="flex flex-col items-center gap-1.5 text-cap text-white">
                <span className="grid size-11 place-items-center rounded-full bg-white text-ink">
                  <ArrowRight className="size-5" strokeWidth={2} />
                </span>
                Read pack
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
      <input ref={libraryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />

      <CaptureFrame>
        {/* Always mounted so the stream has somewhere to go the moment it starts. */}
        <video ref={videoRef} playsInline muted autoPlay aria-hidden="true" className={cn('absolute inset-0 size-full object-cover', (!live || open || full) && 'invisible')} />
        {open ? (
          <img src={open.url} alt="Your photo of the pack" className="absolute inset-0 size-full bg-stage object-contain" />
        ) : full ? (
          <div className="absolute inset-0 grid grid-cols-3 gap-1 bg-stage">
            {photos.map((p) => (
              <img key={p.id} src={p.url} alt="" className="size-full object-cover" />
            ))}
          </div>
        ) : (
          !live && (
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
          )
        )}
        {live && !open && !full && (
          <span className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-cap font-medium whitespace-nowrap backdrop-blur tabular">
            Photo {count + 1} of up to {MAX_PHOTOS}
          </span>
        )}
        <span aria-hidden="true" className={cn('pointer-events-none absolute inset-0 bg-white transition-opacity duration-150', flash ? 'opacity-70' : 'opacity-0')} />
      </CaptureFrame>

      {/* The photos so far: tap one to check it, × to remove it; the next empty slot adds from your photos. */}
      <div className="grid grid-cols-3 gap-2" role="group" aria-label={`Photos of the pack, ${count} of ${MAX_PHOTOS}`}>
        {Array.from({ length: MAX_PHOTOS }, (_, i) => {
          const p = photos[i];
          if (p)
            return (
              <div key={p.id} className="relative">
                <button
                  type="button"
                  aria-label={`View photo ${i + 1}`}
                  aria-pressed={viewing === p.id}
                  onClick={() => setViewing(viewing === p.id ? null : p.id)}
                  className={cn('block h-14 w-full overflow-hidden rounded-md', viewing === p.id ? 'shadow-[0_0_0_2px_white]' : 'shadow-[0_0_0_1px_rgba(255,255,255,.18)]')}
                >
                  <img src={p.url} alt="" className="size-full object-cover" />
                </button>
                <button
                  type="button"
                  aria-label={`Remove photo ${i + 1}`}
                  onClick={() => remove(p.id)}
                  className="group absolute -top-4 -right-4 z-10 grid size-11 place-items-center rounded-full outline-none"
                >
                  {/* The white dot stays small; the 44px button around it is the tap target. */}
                  <span className="grid size-6 place-items-center rounded-full bg-white text-ink shadow group-focus-visible:outline-2 group-focus-visible:outline-white">
                    <X className="size-3.5" strokeWidth={2.5} />
                  </span>
                </button>
              </div>
            );
          const next = i === count;
          return (
            <button
              key={`empty-${i}`}
              type="button"
              disabled={!next}
              aria-label={next ? 'Add from your photos' : 'Empty'}
              onClick={() => libraryRef.current?.click()}
              className={cn('grid h-14 place-items-center rounded-md border border-dashed text-white/60', next ? 'border-white/40 hover:bg-white/[0.06]' : 'border-white/15')}
            >
              {next && <Plus className="size-5" strokeWidth={1.75} />}
            </button>
          );
        })}
      </div>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {note && !error && <p className="rounded-md bg-white/10 p-3 text-foot text-white">{note}</p>}
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-white/10 p-3 text-foot text-white">
          <X className="mt-px size-4 shrink-0" />
          {error}
        </p>
      )}
    </Shell>
  );
}
