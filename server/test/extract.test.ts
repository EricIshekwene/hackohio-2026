import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RawExtraction } from '../src/extract/claude';

process.env.SPEND_FILE = path.join(os.tmpdir(), `medcheck-spend-${process.pid}.json`);

const ai = vi.hoisted(() => ({ next: null as null | (() => Promise<unknown>) }));
vi.mock('../src/extract/claude', async (orig) => {
  const real = await orig<typeof import('../src/extract/claude')>();
  return {
    ...real,
    extractFromImages: vi.fn(async (images: Buffer[]) => {
      // the BFF must send processed JPEGs, never the raw upload
      for (const img of images) {
        const m = await sharp(img).metadata();
        if (m.format !== 'jpeg' || Math.max(m.width!, m.height!) > 1568) throw new Error('image not prepared');
      }
      return ai.next!();
    }),
  };
});

const { createApp } = await import('../src/app');
const { ExtractError } = await import('../src/extract/claude');
const { clean, toExtractedField } = await import('../src/extract/fields');
const { prepareImage } = await import('../src/extract/images');
const { validateInput } = await import('../src/services/validate');

const f = (value: string | null, readText: string | null = value, confidence = 0.95) => ({
  value, readText, confidence, sourcePhoto: 1, photosDisagree: false,
});
// The hero demo pack as the AI might read it: messy, with labels and an O-for-0 slip.
const heroReading = (): RawExtraction => ({
  photoStatus: 'ok',
  sidesSeen: [{ photo: 1, side: 'front' }],
  fields: {
    productName: f('Lonart Forte', 'LONART FORTE Tablets'),
    strength: f('80/480mg'),
    nafdacRegNo: f('A4-62З8', 'NAFDAC Reg. No: A4-62З8', 0.9), // Cyrillic З
    manufacturer: f('Greenlife Pharmaceuticals Ltd', 'Manufactured by: Greenlife Pharmaceuticals Ltd'),
    batchNo: f('GL22I0', 'B.No: GL22I0', 0.7),
    expiryDate: f('09/2027', 'EXP: 09/2027'),
    activeIngredient: f('Artemether; Lumefantrine'),
    dosageForm: f(null),
    marketedBy: f(null),
  },
});

const png = (w = 3000, h = 2000) =>
  sharp({ create: { width: w, height: h, channels: 3, background: '#fff' } }).png().toBuffer();

let app: ReturnType<typeof createApp>;
beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  app = createApp();
  ai.next = async () => ({ raw: heroReading(), costUsd: 0, model: 'claude-opus-5-5' });
});
afterEach(() => vi.clearAllMocks());

describe('field cleanup', () => {
  it('reg no: look-alikes, labels, O->0, missing hyphen', () => {
    expect(clean('nafdacRegNo', 'a4 62З8')).toMatchObject({ value: 'A4-6238', formatOk: true, changedChars: true });
    expect(clean('nafdacRegNo', 'NAFDAC Reg. No: A4-6238')).toMatchObject({ value: 'A4-6238', changedChars: false });
    expect(clean('nafdacRegNo', 'O4-1234')).toMatchObject({ value: '04-1234', changedChars: true });
    expect(clean('nafdacRegNo', 'A46238').value).toBe('A4-6238');
    expect(clean('nafdacRegNo', 'HELLO').formatOk).toBe(false);
  });
  it('strength', () => {
    expect(clean('strength', '80mg/480mg').value).toBe('80 mg / 480 mg');
    expect(clean('strength', '80/480 mg').value).toBe('80 mg / 480 mg');
    expect(clean('strength', '500').formatOk).toBe(false);
  });
  it('batch strips printed labels but never turns letters into digits', () => {
    expect(clean('batchNo', 'B.No: bp 5203').value).toBe('BP5203');
    expect(clean('batchNo', 'GL22I0').value).toBe('GL22I0');
  });
  it('expiry keeps the printed date, checks it parses', () => {
    expect(clean('expiryDate', 'EXP DATE: 03/2027')).toMatchObject({ value: '03/2027', formatOk: true });
    expect(clean('expiryDate', 'see crimp').formatOk).toBe(false);
  });
});

describe('confidence = min(AI estimate, code checks)', () => {
  it('keeps clean values', () => expect(toExtractedField('nafdacRegNo', f('A4-6238', 'A4-6238', 0.9)).confidence).toBe(0.9));
  it('caps bad formats at 0.5', () => expect(toExtractedField('nafdacRegNo', f('XYZ', 'XYZ', 0.95)).confidence).toBe(0.5));
  it('penalises character swaps and says why', () => {
    const x = toExtractedField('nafdacRegNo', f('O4-1234', 'O4-1234', 0.9));
    expect(x.confidence).toBe(0.72);
    expect(x.notes?.join()).toMatch(/O to digit 0/);
  });
  it('caps when value and printed text disagree', () =>
    expect(toExtractedField('nafdacRegNo', f('A4-6238', 'A4-6288', 0.95)).confidence).toBe(0.6));
  it('allows label words around free text', () => {
    expect(toExtractedField('manufacturer', f('Greenlife Pharmaceuticals Ltd', 'Manufactured by: Greenlife Pharmaceuticals Ltd')).confidence).toBe(0.95);
    expect(toExtractedField('productName', f('Lonart Forte', 'LONART FORTE Tablets')).confidence).toBe(0.95);
  });
  it('still flags a misspelled brand', () =>
    expect(toExtractedField('productName', f('Artheget', 'ARTHEQET 80/480', 0.9)).confidence).toBe(0.6));
  it('zero when nothing found', () => expect(toExtractedField('batchNo', f(null, null, 0.8)).confidence).toBe(0));
  it('photos disagree caps at 0.3', () =>
    expect(toExtractedField('batchNo', { ...f('GL2210'), photosDisagree: true }).confidence).toBe(0.3));
});

describe('prepareImage', () => {
  it('applies rotation and strips metadata including GPS', async () => {
    const withExif = await sharp({ create: { width: 400, height: 200, channels: 3, background: '#f00' } })
      .withExif({ IFD0: { Make: 'TestPhone' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '12/1 0/1 0/1' } })
      .jpeg()
      .toBuffer();
    const rotated = await sharp(withExif).withMetadata({ orientation: 6 }).toBuffer();
    expect((await sharp(rotated).metadata()).exif).toBeDefined();
    const after = await sharp(await prepareImage(rotated)).metadata();
    expect(after.exif).toBeUndefined();
    expect([after.width, after.height]).toEqual([200, 400]);
  });
  it('shrinks to 1568 px, never enlarges', async () => {
    const m = await sharp(await prepareImage(await png(4000, 3000))).metadata();
    expect([m.width, m.height]).toEqual([1568, 1176]);
    const s = await sharp(await prepareImage(await png(300, 200))).metadata();
    expect([s.width, s.height]).toEqual([300, 200]);
  });
});

describe('POST /api/extract', () => {
  it('photo -> StandardizedMedicationInput that /api/check accepts once confirmed', async () => {
    const ex = await request(app).post('/api/extract').attach('image', await png(), 'pack.png');
    expect(ex.status).toBe(200);
    expect(ex.body.source).toBe('photo');
    expect(ex.body.confirmedByUser).toBe(false);
    const fields = ex.body.fields;
    expect(fields.nafdacRegNo).toMatchObject({ value: 'A4-6238', sourceText: 'NAFDAC Reg. No: A4-62З8', editedByUser: false });
    expect(fields.nafdacRegNo.confidence).toBeLessThan(0.8); // look-alike swap -> client asks for review
    expect(fields.strength.value).toBe('80 mg / 480 mg');
    expect(fields.batchNo.value).toBe('GL22I0'); // kept as read; low confidence makes the user look
    expect(fields.batchNo.confidence).toBeLessThan(0.8);
    expect(fields.expiryDate.value).toBe('09/2027');
    expect(fields.activeIngredient.value).toBe('Artemether; Lumefantrine');
    expect(fields).not.toHaveProperty('dosageForm'); // optional + not found -> omitted
    expect(validateInput(ex.body).ok).toBe(true);

    // unconfirmed is refused by the backend
    expect((await request(app).post('/api/check').send(ex.body)).status).toBe(422);

    // user fixes the batch (I -> 1) and confirms: real rules run on it
    const confirmed = {
      ...ex.body,
      confirmedByUser: true,
      fields: { ...fields, batchNo: { ...fields.batchNo, value: 'GL2210', editedByUser: true } },
    };
    const ck = await request(app).post('/api/check').send(confirmed);
    expect(ck.status).toBe(200);
    expect(ck.body.verdict).toBe('red');
    expect(ck.body.reasons[0].rule).toBe('R3'); // the hero: real number on the wrong product
  });

  it('accepts up to 3 photos as "photos"', async () => {
    const r = await request(app).post('/api/extract').attach('photos', await png(), 'a.png').attach('photos', await png(), 'b.png');
    expect(r.status).toBe(200);
  });

  it('400 without a photo, for non-images and for 4 photos', async () => {
    expect((await request(app).post('/api/extract')).status).toBe(400);
    expect((await request(app).post('/api/extract').attach('image', Buffer.from('hello'), { filename: 'a.txt', contentType: 'text/plain' })).status).toBe(400);
    let req = request(app).post('/api/extract');
    for (let i = 0; i < 4; i++) req = req.attach('photos', await png(50, 50), `${i}.png`);
    expect((await req).status).toBe(400);
  });

  it('404 when no API key (client shows "type it in")', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect((await request(app).post('/api/extract').attach('image', await png(), 'p.png')).status).toBe(404);
  });

  it('422 for not-medicine and multiple packs', async () => {
    ai.next = async () => ({ raw: { ...heroReading(), photoStatus: 'not_medicine' }, costUsd: 0, model: 'm' });
    const r = await request(app).post('/api/extract').attach('image', await png(), 'p.png');
    expect(r.status).toBe(422);
    expect(r.body.message).toMatch(/medicine/);
  });

  it('503 when the AI service fails, 422 when it refuses', async () => {
    ai.next = async () => { throw new ExtractError('api_error', 'down'); };
    expect((await request(app).post('/api/extract').attach('image', await png(), 'p.png')).status).toBe(503);
    ai.next = async () => { throw new ExtractError('refusal', 'no'); };
    expect((await request(app).post('/api/extract').attach('image', await png(), 'p.png')).status).toBe(422);
  });

  it('429 once the spend limit is reached', async () => {
    process.env.SPEND_LIMIT_USD = '0';
    try {
      expect((await request(app).post('/api/extract').attach('image', await png(), 'p.png')).status).toBe(429);
    } finally {
      delete process.env.SPEND_LIMIT_USD;
    }
  });
});
