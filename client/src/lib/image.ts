// Resize a photo to 1,000 px on the long edge and re-encode as JPEG before upload.
const MAX_EDGE = 1000;

export async function resizeImage(file: File, quality = 0.8): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('not_an_image');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode_failed'))), 'image/jpeg', quality),
  );
}
