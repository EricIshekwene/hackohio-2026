import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const REPO = path.resolve(ROOT, '../..');

// Where finished files go. Renders are never committed (see .gitignore).
export const OUT = path.resolve(process.env.MEDIA_OUT ?? path.join(REPO, 'media-library'));

// The real app: server/ serving the built client/dist plus the real rules engine and registry snapshot.
export const APP_URL = process.env.MEDIA_APP_URL ?? 'http://localhost:3001';

// One pinned instant for every capture, so "today", expiry notes and data dates read the same everywhere.
// 25 Oct 2026, 9:00 AM in Lagos (UTC+1): the morning of the demo.
export const CLOCK_ISO = '2026-10-25T08:00:00Z';

export const FPS = 30;

export const PHONE = { width: 390, height: 844, dpr: 3 } as const;
export const PHONE_VIDEO_DPR = 2; // 780x1688 frames, encoded at 1080 tall-ish portrait
export const DESKTOP = { width: 1440, height: 900, dpr: 2 } as const;
