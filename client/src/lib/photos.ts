// /api/extract reads 1–3 photos of one pack in a single call and works out every field from the whole set
// (server/src/extract/route.ts). Any side, any order: the AI reports which side each photo shows.
export const MAX_PHOTOS = 3;

export interface Photo {
  id: string;
  blob: Blob;
  url: string; // object URL; revoked when the photo is removed or the check is reset
}

let seq = 0;
export const newPhoto = (blob: Blob): Photo => ({ id: `p${++seq}`, blob, url: URL.createObjectURL(blob) });
