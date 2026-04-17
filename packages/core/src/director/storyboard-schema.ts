import { z } from 'zod';

const BBoxCoordsSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

const CameraSchema = z
  .object({
    type: z.literal('camera'),
    target_block: z.string().optional(),
    target_bbox: BBoxCoordsSchema.optional(),
    scale: z.number().min(0.5).max(4).default(1),
    padding: z.number().min(0).max(400).default(80),
    easing: z
      .enum(['linear', 'ease-in', 'ease-out', 'ease-in-out'])
      .default('ease-in-out'),
  })
  .refine((a) => !!a.target_block || !!a.target_bbox, {
    message: 'camera requires target_block or target_bbox',
  });

const SpotlightSchema = z.object({
  type: z.literal('spotlight'),
  target_block: z.string(),
  dim_opacity: z.number().min(0).max(1).default(0.65),
  feather_px: z.number().min(0).max(200).default(40),
  shape: z.enum(['rect', 'rounded', 'ellipse']).default('rounded'),
});

const UnderlineSchema = z.object({
  type: z.literal('underline'),
  target_block: z.string(),
  color: z.string().default('#FBBF24'),
  style: z.enum(['straight', 'sketch', 'double', 'wavy']).default('sketch'),
  draw_duration_ms: z.number().min(100).max(3000).default(600),
});

const HighlightSchema = z.object({
  type: z.literal('highlight'),
  target_block: z.string(),
  color: z.string().default('rgba(250, 204, 21, 0.35)'),
  draw_duration_ms: z.number().min(100).max(3000).default(500),
});

const PulseSchema = z.object({
  type: z.literal('pulse'),
  target_block: z.string(),
  count: z.number().int().min(1).max(5).default(2),
  intensity: z.enum(['subtle', 'normal', 'strong']).default('normal'),
});

const CalloutSchema = z.object({
  type: z.literal('callout'),
  from_block: z.string(),
  to_block: z.string(),
  label: z.string().max(120).optional(),
  curve: z.enum(['straight', 'curved', 'zigzag']).default('curved'),
});

const GhostReferenceSchema = z.object({
  type: z.literal('ghost_reference'),
  target_page: z.number().int().min(1),
  target_block: z.string(),
  position: z
    .enum(['top-right', 'top-left', 'bottom-right', 'bottom-left'])
    .default('top-right'),
});

const BoxSchema = z.object({
  type: z.literal('box'),
  target_block: z.string(),
  color: z.string().default('#3B82F6'),
  style: z.enum(['solid', 'dashed']).default('solid'),
});

const LabelSchema = z.object({
  type: z.literal('label'),
  target_block: z.string(),
  text: z.string().min(1).max(120),
  position: z.enum(['top', 'bottom', 'left', 'right']).default('top'),
});

const ClearSchema = z.object({
  type: z.literal('clear'),
  targets: z
    .union([z.enum(['all', 'spotlights', 'overlays']), z.array(z.string())])
    .default('overlays'),
});

// Note: CameraSchema uses .refine() so it isn't directly usable in
// discriminatedUnion. Use z.union for the full action set; performance
// impact is negligible for storyboards of up to 4 steps.
export const StoryboardActionSchema = z.union([
  CameraSchema,
  SpotlightSchema,
  UnderlineSchema,
  HighlightSchema,
  PulseSchema,
  CalloutSchema,
  GhostReferenceSchema,
  BoxSchema,
  LabelSchema,
  ClearSchema,
]);

export const StoryboardStepSchema = z.object({
  at_ms: z.number().min(0).max(5000).default(0),
  duration_ms: z.number().min(100).max(5000).default(800),
  action: StoryboardActionSchema,
});

export const StoryboardSchema = z.object({
  version: z.literal(1),
  // `reasoning` was required in 0.4.x as a model-generated explanation used
  // by DebugLog. It carries no visual effect and costs 50–150 output tokens
  // per call, so from 0.5.1 it's optional (default empty). Consumers who
  // still send it (from cached prompts or older directors) keep working —
  // the field is still accepted, just not required.
  reasoning: z.string().max(500).optional().default(''),
  steps: z.array(StoryboardStepSchema).min(1).max(4),
});

export type StoryboardParsed = z.infer<typeof StoryboardSchema>;

/** Converts the zod schema to JSON Schema for use with OpenAI structured outputs.
 *
 * OpenAI's structured outputs validator requires:
 * - Every property has a `type` (no bare `const`/`enum` without `type`)
 * - All properties listed in `required`
 * - `additionalProperties: false` on every object
 *
 * We model the action union as a single object with all possible fields optional
 * at the schema level (validated strictly later by zod). This keeps the schema
 * compatible across providers; field-level required-ness is enforced post-parse.
 */
export interface StoryboardJsonSchemaOptions {
  /** Block IDs valid for the CURRENT page. Constrains target_block / from_block / to_block. */
  validBlockIds?: string[];
  /** Block IDs valid for cross-page references (e.g., figures on other pages). */
  validCrossPageBlockIds?: string[];
}

export function storyboardJsonSchema(
  opts: StoryboardJsonSchemaOptions = {},
): Record<string, unknown> {
  const { validBlockIds, validCrossPageBlockIds } = opts;

  // When we have a concrete set of IDs, constrain the target to that enum so
  // the LLM can't hallucinate IDs that don't exist on the page. Include null
  // because OpenAI strict mode requires every declared field to be settable.
  const blockIdSchema: Record<string, unknown> =
    validBlockIds && validBlockIds.length > 0
      ? { type: ['string', 'null'], enum: [...validBlockIds, null] }
      : { type: ['string', 'null'] };

  const crossPageBlockIdSchema: Record<string, unknown> =
    validCrossPageBlockIds && validCrossPageBlockIds.length > 0
      ? {
          type: ['string', 'null'],
          enum: [...validCrossPageBlockIds, ...(validBlockIds ?? []), null],
        }
      : blockIdSchema;

  const actionSchema = {
    type: 'object',
    additionalProperties: false,
    required: [
      'type',
      'target_block',
      'target_bbox',
      'scale',
      'padding',
      'easing',
      'dim_opacity',
      'feather_px',
      'shape',
      'color',
      'style',
      'draw_duration_ms',
      'count',
      'intensity',
      'from_block',
      'to_block',
      'label',
      'curve',
      'target_page',
      'position',
      'text',
      'targets',
    ],
    properties: {
      type: {
        type: 'string',
        enum: [
          'camera',
          'spotlight',
          'underline',
          'highlight',
          'pulse',
          'callout',
          'ghost_reference',
          'box',
          'label',
          'clear',
        ],
      },
      target_block: blockIdSchema,
      target_bbox: {
        type: ['array', 'null'],
        items: { type: 'number' },
        minItems: 4,
        maxItems: 4,
      },
      scale: { type: ['number', 'null'] },
      padding: { type: ['number', 'null'] },
      easing: {
        type: ['string', 'null'],
        enum: ['linear', 'ease-in', 'ease-out', 'ease-in-out', null],
      },
      dim_opacity: { type: ['number', 'null'] },
      feather_px: { type: ['number', 'null'] },
      shape: {
        type: ['string', 'null'],
        enum: ['rect', 'rounded', 'ellipse', null],
      },
      color: { type: ['string', 'null'] },
      style: {
        type: ['string', 'null'],
        enum: ['straight', 'sketch', 'double', 'wavy', 'solid', 'dashed', null],
      },
      draw_duration_ms: { type: ['number', 'null'] },
      count: { type: ['integer', 'null'] },
      intensity: {
        type: ['string', 'null'],
        enum: ['subtle', 'normal', 'strong', null],
      },
      from_block: blockIdSchema,
      to_block: crossPageBlockIdSchema,
      label: { type: ['string', 'null'] },
      curve: {
        type: ['string', 'null'],
        enum: ['straight', 'curved', 'zigzag', null],
      },
      target_page: { type: ['integer', 'null'] },
      position: {
        type: ['string', 'null'],
        enum: [
          'top',
          'bottom',
          'left',
          'right',
          'top-right',
          'top-left',
          'bottom-right',
          'bottom-left',
          null,
        ],
      },
      text: { type: ['string', 'null'] },
      targets: {
        type: ['string', 'null'],
        enum: ['all', 'spotlights', 'overlays', null],
      },
    },
  };

  return {
    type: 'object',
    additionalProperties: false,
    // `reasoning` intentionally omitted from `required` — the field is still
    // accepted when present but the model doesn't need to generate it,
    // which saves 50–150 output tokens per call. See zod schema above.
    required: ['version', 'steps'],
    properties: {
      version: { type: 'integer', enum: [1] },
      reasoning: { type: 'string' },
      steps: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['at_ms', 'duration_ms', 'action'],
          properties: {
            at_ms: { type: 'number' },
            duration_ms: { type: 'number' },
            action: actionSchema,
          },
        },
      },
    },
  };
}
