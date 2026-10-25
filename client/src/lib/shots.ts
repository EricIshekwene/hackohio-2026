// The photo set /api/extract reads in one go (server/src/extract/route.ts: 1–3 photos of one pack).
// Each shot targets the fields that live on that part of a typical Nigerian pack.
export type ShotId = 'front' | 'regno' | 'batch';

export interface Shot {
  id: ShotId;
  label: string; // thumbnail caption
  title: string; // what to point the camera at
  hint: string;
}

export const SHOTS: Shot[] = [
  { id: 'front', label: 'Front', title: 'Front of the pack', hint: 'The brand name and strength, filling the frame.' },
  { id: 'regno', label: 'NAFDAC no.', title: 'The NAFDAC number', hint: 'Usually on the back or side, near the barcode.' },
  { id: 'batch', label: 'Batch, expiry', title: 'Batch and expiry', hint: 'Often stamped on an end flap. Get close so the print is sharp.' },
];

export interface Photo {
  shot: ShotId;
  blob: Blob;
  url: string; // object URL; revoked when the photo is replaced or the check is reset
}

export const shotLabel = (id: ShotId) => SHOTS.find((s) => s.id === id)!.label;

// Photos in shot order, which is the order the server numbers them.
export const orderedPhotos = (photos: Photo[]) => SHOTS.map((s) => photos.find((p) => p.shot === s.id)).filter((p): p is Photo => !!p);
