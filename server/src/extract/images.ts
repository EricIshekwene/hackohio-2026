import sharp from 'sharp';

export const ACCEPTED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIDE = 1568; // Claude's sweet spot; keeps small batch print legible

/** Apply phone rotation, strip all metadata (GPS etc.), resize, re-encode as JPEG. */
export async function prepareImage(input: Buffer): Promise<Buffer> {
  // sharp drops EXIF/GPS on output unless withMetadata() is called
  return sharp(input)
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}
