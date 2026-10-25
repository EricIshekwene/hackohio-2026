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
  {
    id: 'V05',
    slug: 'photo-natrilix',
    title: 'Three photos of a real pack: Natrilix SR flagged',
    story: 'Front, back and end flap of a real Natrilix SR pack. The user confirms the two details the reader was unsure of, and MedCheck flags it: expired in Aug 2025, NAFDAC lists 04-8509 as Inactive, and the maker differs from the registered holder.',
    pri: 'P1',
    pack: () => getPack('photo-natrilix'),
    async run(rec) {
      await openLanding(rec);
      await rec.hold(1200);
      rec.mark('start-landing');
      await photoCheck(rec, this.pack());
      await rec.hold(3500);
      rec.mark('verdict-read');
      await showTab(rec, 'Why', 3400);
      rec.mark('end-hold');
    },
    clips: [
      { name: 'photos', caption: 'One to three photos, any side of the pack', from: 'start-landing', to: 'reading', poster: 'snapped', budget: 1.5 * MB },
      { name: 'confirm', caption: 'The user confirms the details the reader was unsure of', from: 'reading', to: 'checking', poster: 'confirm', budget: 1.5 * MB },
      { name: 'result', caption: 'MedCheck flagged an expired pack with an inactive registration', from: 'checking', to: 'end', poster: 'verdict-read', budget: 1.5 * MB },
    ],
  },
];
