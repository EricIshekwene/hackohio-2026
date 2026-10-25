import { useRef, useState } from 'react';
import { ImageUp, Keyboard, RotateCcw, X } from 'lucide-react';
import { resizeImage } from '@/lib/image';
import { Button } from '@/components/ui/button';
import { Shell, type StepInfo } from '@/components/app-shell';
import { cn } from '@/lib/utils';

// The frame the pack goes in: white corner marks on the dark stage.
export function CaptureFrame({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-white/[0.04]', className)}>
      {children}
      {['top-3 left-3 border-t-[3px] border-l-[3px] rounded-tl-[10px]', 'top-3 right-3 border-t-[3px] border-r-[3px] rounded-tr-[10px]', 'bottom-3 left-3 border-b-[3px] border-l-[3px] rounded-bl-[10px]', 'bottom-3 right-3 border-b-[3px] border-r-[3px] rounded-br-[10px]'].map((c) => (
        <span key={c} aria-hidden="true" className={cn('pointer-events-none absolute size-7 border-white', c)} />
      ))}
    </div>
  );
}

export function Snap({
  step,
  initial,
  onBack,
  onPhoto,
  onManual,
}: {
  step: StepInfo;
  initial: { blob: Blob; url: string } | null; // the last photo, so Back shows it instead of a blank camera
  onBack: () => void;
  onPhoto: (photo: Blob, url: string) => void;
  onManual: () => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(initial);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const blob = await resizeImage(file);
      if (preview && preview.url !== initial?.url) URL.revokeObjectURL(preview.url);
      setPreview({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setError("That file isn't a photo we can read. Try another, or type the details.");
    }
  }

  return (
    <Shell
      stage
      step={step}
      onBack={onBack}
      title={preview ? 'Can you read the small print?' : 'Photograph the pack'}
      description={
        preview
          ? 'Check the NAFDAC number, batch and expiry are sharp and free of glare.'
          : 'Lay it flat in good light, with the side that shows the NAFDAC number facing up.'
      }
      footer={
        preview ? (
          <>
            <Button block className="bg-white text-ink hover:bg-white/90" onClick={() => onPhoto(preview.blob, preview.url)}>
              Use this photo
            </Button>
            <Button block variant="onStage" onClick={() => cameraRef.current?.click()}>
              <RotateCcw strokeWidth={1.75} />
              Retake
            </Button>
          </>
        ) : (
          <div className="grid grid-cols-3 items-center pb-2">
            <button type="button" onClick={() => uploadRef.current?.click()} className="flex flex-col items-center gap-1.5 text-cap text-white/75 hover:text-white">
              <span className="grid size-11 place-items-center rounded-full bg-white/12">
                <ImageUp className="size-5" strokeWidth={1.75} />
              </span>
              Upload
            </button>
            <button
              type="button"
              aria-label="Take photo"
              onClick={() => cameraRef.current?.click()}
              className="mx-auto grid size-[76px] place-items-center rounded-full border-[3px] border-white/90 transition-transform active:scale-95"
            >
              <span className="size-[60px] rounded-full bg-white" />
            </button>
            <button type="button" onClick={onManual} className="flex flex-col items-center gap-1.5 text-cap text-white/75 hover:text-white">
              <span className="grid size-11 place-items-center rounded-full bg-white/12">
                <Keyboard className="size-5" strokeWidth={1.75} />
              </span>
              Type it instead
            </button>
          </div>
        )
      }
    >
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      <div className="flex flex-1 flex-col justify-center gap-4">
        <CaptureFrame>
          {preview ? (
            <img src={preview.url} alt="Your photo of the pack" className="size-full object-contain" />
          ) : (
            <div className="grid size-full place-items-center">
              <p className="text-foot text-white/60">Fit the whole pack inside the corners</p>
            </div>
          )}
        </CaptureFrame>
        {!preview && (
          <ul className="flex flex-col gap-1.5 text-foot text-white/65">
            <li>Tilt the pack away from the light to avoid glare.</li>
            <li>The AI only reads the label. You check every detail next.</li>
          </ul>
        )}
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-md bg-white/10 p-3 text-foot text-white">
            <X className="mt-px size-4 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </Shell>
  );
}
