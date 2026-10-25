import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { recordSpend } from './spend';
import { SYSTEM_PROMPT, USER_TEXT } from './prompt';

export const EXTRACT_KEYS = [
  'productName',
  'strength',
  'nafdacRegNo',
  'manufacturer',
  'batchNo',
  'expiryDate',
  'activeIngredient',
  'dosageForm',
  'marketedBy',
] as const;
export type ExtractKey = (typeof EXTRACT_KEYS)[number];

export const PHOTO_STATUSES = ['ok', 'blurry', 'glare', 'partial', 'multiple_packs', 'not_medicine'] as const;

const RawFieldSchema = z.object({
  value: z.string().nullable(),
  readText: z.string().nullable(),
  confidence: z.number(),
  sourcePhoto: z.number().int().nullable(),
  photosDisagree: z.boolean(),
});

export const RawExtractionSchema = z.object({
  photoStatus: z.enum(PHOTO_STATUSES),
  sidesSeen: z.array(
    z.object({
      photo: z.number().int(),
      side: z.enum(['front', 'back', 'side', 'top', 'bottom', 'blister', 'unknown']),
    }),
  ),
  fields: z.object(
    Object.fromEntries(EXTRACT_KEYS.map((k) => [k, RawFieldSchema])) as Record<ExtractKey, typeof RawFieldSchema>,
  ),
});
export type RawExtraction = z.infer<typeof RawExtractionSchema>;

export class ExtractError extends Error {
  constructor(
    public reason: 'not_configured' | 'refusal' | 'unparseable' | 'api_error',
    message: string,
  ) {
    super(message);
  }
}

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

export const modelName = () => process.env.CLAUDE_MODEL || 'claude-opus-5-5';
export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

/** One AI call for all photos of one pack. Images must already be prepared JPEGs. */
export async function extractFromImages(images: Buffer[]): Promise<{ raw: RawExtraction; costUsd: number; model: string }> {
  if (!aiConfigured()) throw new ExtractError('not_configured', 'ANTHROPIC_API_KEY is not set');
  let response;
  try {
    response = await getClient().beta.messages.parse({
      model: modelName(),
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(RawExtractionSchema) },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            ...images.flatMap((img, i) => [
              { type: 'text' as const, text: `Photo ${i + 1}:` },
              {
                type: 'image' as const,
                source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: img.toString('base64') },
              },
            ]),
            { type: 'text' as const, text: USER_TEXT },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) throw new ExtractError('api_error', 'rate limited');
    if (err instanceof Anthropic.APIConnectionError) throw new ExtractError('api_error', 'could not reach the AI service');
    if (err instanceof Anthropic.APIError) throw new ExtractError('api_error', `API ${err.status}: ${err.message}`);
    throw new ExtractError('api_error', err instanceof Error ? err.message : String(err));
  }

  const costUsd = recordSpend(response.model, response.usage, 'extract');
  if (response.stop_reason === 'refusal') throw new ExtractError('refusal', 'AI declined to read this image');
  if (!response.parsed_output) throw new ExtractError('unparseable', `no structured output (stop: ${response.stop_reason})`);
  return { raw: response.parsed_output, costUsd, model: response.model };
}
