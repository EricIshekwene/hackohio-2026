import type { Recorder } from './lib/recorder.ts';
import { getPack, type Pack } from './lib/content.ts';
import { openLanding, photoCheck, showTab, typedCheck } from './scenes/flows.ts';

export interface Clip {
  name: string; // file suffix
  caption: string;
  from: string; // marker name, or 'start'
  to: string; // marker name, or 'end'
  poster: string; // marker name
  budget: number; // mp4 bytes
}

export interface Scene {
  id: string; // asset ID, used in every file name
  slug: string;
  title: string;
  story: string;
  pri: 'P1' | 'P2';
  pack: () => Pack;
  run: (rec: Recorder) => Promise<void>;
  clips: Clip[];
}

const MB = 1024 * 1024;

export const SCENES: Scene[] = [
  {
    id: 'V01',
    slug: 'photo-green',
    title: 'Photo to verdict: a registered pack comes back clean',
    story: 'Photograph a real Nigerian medicine pack, confirm what was read, and get "No problems found" with the caveat.',
    pri: 'P1',
    pack: () => getPack('photo-green'),
    async run(rec) {
      await openLanding(rec);
      await rec.hold(1500);
      rec.mark('start-landing');
      await photoCheck(rec, this.pack());
      await rec.hold(3200);
      rec.mark('verdict-read');
      await showTab(rec, 'Why', 2400);
      await showTab(rec, 'Checked', 2400);
      rec.mark('end-hold');
    },
    clips: [
      { name: 'scan', caption: 'Point the camera at the pack and take a photo', from: 'start-landing', to: 'reading', poster: 'camera', budget: 1.5 * MB },
      { name: 'confirm', caption: 'You check every detail the AI read', from: 'reading', to: 'checking', poster: 'confirm', budget: 1.5 * MB },
      { name: 'result', caption: 'No problems found, never "genuine"', from: 'checking', to: 'verdict-read', poster: 'verdict-read', budget: 1.5 * MB },
    ],
  },
  {
    id: 'V02',
    slug: 'typed-green',
    title: 'Type the details: a registered pack comes back clean',
    story: 'No camera needed: type what is on the pack, confirm, and get the same NAFDAC check.',
    pri: 'P1',
    pack: () => getPack('artheget-green'),
    async run(rec) {
      await openLanding(rec);
      await rec.hold(1200);
      await typedCheck(rec, this.pack());
      await rec.hold(3200);
      rec.mark('verdict-read');
      await showTab(rec, 'Why', 2400);
      await showTab(rec, 'Checked', 2600);
      rec.mark('end-hold');
    },
    clips: [{ name: 'result', caption: 'Registered, no alert, details consistent', from: 'checking', to: 'end', poster: 'verdict-read', budget: 1.5 * MB }],
  },
  {
    id: 'V03',
    slug: 'catch-cloned',
    title: 'Caught: a real NAFDAC number on the wrong product',
    story: 'A pack borrows a real registration number. MedCheck lines it up against the NAFDAC record and shows exactly which details differ.',
    pri: 'P1',
    pack: () => getPack('cloned-red'),
    async run(rec) {
      await openLanding(rec);
      await rec.hold(1200);
      await typedCheck(rec, this.pack());
      await rec.hold(3800);
      rec.mark('verdict-read');
      await showTab(rec, 'Why', 3000);
      rec.mark('why-read');
      await rec.tap(rec.page.getByRole('button', { name: 'Report to NAFDAC' }), 'Report to NAFDAC');
      await rec.waitFor(rec.page.getByText('Send email'), 'report');
      await rec.hold(2600);
      rec.mark('report-read');
    },
    clips: [
      { name: 'result', caption: 'MedCheck caught a cloned registration number', from: 'checking', to: 'verdict-read', poster: 'verdict-read', budget: 1.5 * MB },
      { name: 'report', caption: 'One tap to a ready-to-send NAFDAC report', from: 'why-read', to: 'end', poster: 'report-read', budget: 1.5 * MB },
    ],
  },
  {
    id: 'V04',
    slug: 'catch-alert',
    title: 'Caught: a batch on NAFDAC Public Alert 042/2026',
    story: 'A batch NAFDAC seized in Kano. MedCheck matches it to the alert and links the source.',
    pri: 'P1',
    pack: () => getPack('alert-042-red'),
    async run(rec) {
      await openLanding(rec);
      await rec.hold(1200);
      await typedCheck(rec, this.pack());
      await rec.hold(3800);
      rec.mark('verdict-read');
      await showTab(rec, 'Why', 3200);
      rec.mark('end-hold');
    },
    clips: [{ name: 'result', caption: 'MedCheck matched the batch to NAFDAC Alert 042/2026', from: 'checking', to: 'end', poster: 'verdict-read', budget: 1.5 * MB }],
  },
];
