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
  reasoning: z.string().max(500).default(''),
  steps: z.array(StoryboardStepSchema).min(1).max(4),
});

export type StoryboardParsed = z.infer<typeof StoryboardSchema>;

/** Converts the zod schema to JSON Schema for use with OpenAI structured outputs. */
export function storyboardJsonSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['version', 'reasoning', 'steps'],
    properties: {
      version: { const: 1 },
      reasoning: { type: 'string', maxLength: 500 },
      steps: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['at_ms', 'duration_ms', 'action'],
          properties: {
            at_ms: { type: 'number', minimum: 0, maximum: 5000 },
            duration_ms: { type: 'number', minimum: 100, maximum: 5000 },
            action: {
              type: 'object',
              required: ['type'],
              properties: {
                type: {
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
              },
            },
          },
        },
      },
    },
  };
}
