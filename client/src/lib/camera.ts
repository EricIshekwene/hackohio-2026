import { useCallback, useEffect, useRef, useState } from 'react';

// Live camera for the Snap step. getUserMedia needs a secure context (https or localhost);
// without one the screen falls back to the phone's own camera app via <input capture>.
export type CameraStatus =
  | 'idle' // permission not asked yet: show "Allow camera"
  | 'starting'
  | 'live'
  | 'denied' // the user or the browser blocked it
  | 'busy' // another app is using the camera
  | 'none' // no camera on this device
  | 'insecure' // http on a phone: no live preview possible
  | 'error';

export const canLiveCamera = () => typeof window !== 'undefined' && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;

const IDEAL = { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } };

function statusFor(err: unknown): CameraStatus {
  const name = (err as DOMException | undefined)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied';
  if (name === 'NotReadableError' || name === 'AbortError' || name === 'TrackStartError') return 'busy';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return 'none';
  return 'error';
}

async function open(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: IDEAL, audio: false });
  } catch (err) {
    // Some laptops reject the size hints; any camera beats none.
    if ((err as DOMException).name === 'OverconstrainedError') return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    throw err;
  }
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wanted = useRef(false); // the user has allowed it; restart after the tab comes back
  const [status, setStatus] = useState<CameraStatus>(() => (canLiveCamera() ? 'idle' : 'insecure'));

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const start = useCallback(async () => {
    if (!canLiveCamera()) return setStatus('insecure');
    wanted.current = true;
    setStatus('starting');
    stop();
    try {
      const stream = await open();
      if (!wanted.current) {
        // Left the screen while the prompt was up.
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (streamRef.current === stream) setStatus('busy');
      });
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
      setStatus('live');
    } catch (err) {
      setStatus(statusFor(err));
    }
  }, [stop]);

  // Already allowed on an earlier visit: go straight to the live preview, no extra tap.
  useEffect(() => {
    if (!canLiveCamera()) return;
    let cancelled = false;
    navigator.permissions
      ?.query({ name: 'camera' as PermissionName })
      .then((p) => {
        if (cancelled) return;
        if (p.state === 'granted') start();
        else if (p.state === 'denied') setStatus('denied');
      })
      .catch(() => {}); // Safari and Firefox may not know 'camera'; stay on "Allow camera"
    return () => {
      cancelled = true;
    };
  }, [start]);

  // Turn the camera off when the tab is hidden and back on when it returns; always off on leaving.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) stop();
      else if (wanted.current) start();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      wanted.current = false;
      stop();
    };
  }, [start, stop]);

  /** What's inside the visible frame (the video is object-cover), as a JPEG at most 1600 px on the long edge. */
  const capture = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const box = video.getBoundingClientRect();
    const targetRatio = box.width / box.height;
    let sw = vw;
    let sh = vh;
    if (vw / vh > targetRatio) sw = vh * targetRatio;
    else sh = vw / targetRatio;
    const sx = (vw - sw) / 2;
    const sy = (vh - sh) / 2;
    const scale = Math.min(1, 1600 / Math.max(sw, sh));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    canvas.getContext('2d')!.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85));
  }, []);

  return { videoRef, status, start, capture };
}
