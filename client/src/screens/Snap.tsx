import { useRef, useState } from 'react';
import { resizeImage } from '@/lib/image';
import { Button, Card } from '@/components/ui';
import { Shell } from '@/components/Shell';

export function Snap({ onBack, onPhoto, onManual }: { onBack: () => void; onPhoto: (photo: Blob, url: string) => void; onManual: () => void }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const blob = await resizeImage(file);
      if (preview) URL.revokeObjectURL(preview.url);
      setPreview({ blob, url: URL.createObjectURL(blob) });
    } catch {
      setError("That file isn't a photo we can read. Try another, or type the details.");
    }
  }

  const inputs = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
    </>
  );

  if (preview) {
    return (
      <Shell
        step={0}
        onBack={() => setPreview(null)}
        title="Is your photo clear?"
        subtitle="Check you can read the NAFDAC number, batch and expiry."
        footer={
          <>
            <Button onClick={() => onPhoto(preview.blob, preview.url)}>Use this photo</Button>
            <Button variant="secondary" onClick={() => cameraRef.current?.click()}>
              Retake
            </Button>
          </>
        }
      >
        {inputs}
        <img src={preview.url} alt="Your photo of the pack" className="w-full rounded-card border border-line object-contain" />
      </Shell>
    );
  }

  return (
    <Shell
      step={0}
      onBack={onBack}
      title="Show us the pack"
      subtitle="Lay it flat in good light, with the side that has the NAFDAC number facing up."
      footer={
        <>
          <Button onClick={() => cameraRef.current?.click()}>
            <span aria-hidden="true">📷</span> Take photo
          </Button>
          <Button variant="secondary" onClick={() => uploadRef.current?.click()}>
            Upload from gallery
          </Button>
        </>
      }
    >
      {inputs}
      <div className="grid aspect-[4/3.2] place-items-center rounded-[14px] border-2 border-dashed border-reseda bg-[repeating-linear-gradient(45deg,#E8EFE2_0_10px,#F3F6F0_10px_20px)] p-6 text-center">
        <div className="grid justify-items-center gap-3">
          <div className="grid h-24 w-40 content-center justify-items-start gap-1 rounded-md border border-[#cdd5e2] bg-white px-3 text-left text-[10px] text-[#26324a] shadow-sm">
            <b className="text-[12px] text-primary">Medicine name 500 mg</b>
            <span className="font-mono">NAFDAC Reg. No. A4-0000</span>
            <span className="font-mono">Batch AB123 · EXP 03/2028</span>
          </div>
          <p className="text-[14px] font-semibold text-muted">Fit the whole pack in the frame</p>
        </div>
      </div>
      <Card className="grid gap-1.5 text-[14px]">
        <p className="font-bold">Tips for a good read</p>
        <ul className="grid gap-1 text-muted">
          <li>• No glare: tilt the pack away from the light.</li>
          <li>• Hold steady, close enough to read the small print.</li>
          <li>• AI only reads the pack. You check every detail next.</li>
        </ul>
      </Card>
      {error && <p className="rounded-lg bg-white p-3 text-[14px] font-semibold text-ink ring-1 ring-line">{error}</p>}
      <button type="button" onClick={onManual} className="min-h-11 text-[15px] font-semibold text-moss underline underline-offset-4">
        Type it instead
      </button>
    </Shell>
  );
}
