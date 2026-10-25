import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { photoPath, type Pack } from './content.ts';

// The pack's first photo becomes Chromium's camera: a short portrait y4m loop (3:4, like a phone's back camera).
// Landscape photos are fitted whole over a blurred copy of themselves, so no printed text is cropped away.
export function cameraFile(pack: Pack | undefined, dir = os.tmpdir()): string | undefined {
  const photo = pack?.photos[0];
  if (!photo) return undefined;
  const out = path.join(dir, `camera-${pack!.id}.y4m`);
  const filter =
    '[0:v]split[a][b];' +
    '[a]scale=1080:1440:force_original_aspect_ratio=increase,crop=1080:1440,boxblur=24:2,eq=brightness=-0.08[bg];' +
    '[b]scale=1000:1360:force_original_aspect_ratio=decrease[fg];' +
    '[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p';
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-loop', '1', '-i', photoPath(photo), '-t', '1', '-r', '5', '-filter_complex', filter, out]);
  return out;
}
