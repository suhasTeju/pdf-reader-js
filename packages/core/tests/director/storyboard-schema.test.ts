import { describe, it, expect } from 'vitest';
import {
  StoryboardSchema,
  StoryboardActionSchema,
} from '../../src/director/storyboard-schema';

describe('StoryboardActionSchema', () => {
  it('accepts a valid camera action with target_block', () => {
    const result = StoryboardActionSchema.safeParse({
      type: 'camera',
      target_block: 'p1_t0',
      scale: 1.5,
      padding: 60,
      easing: 'ease-out',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a camera action missing both target_block and target_bbox', () => {
    const result = StoryboardActionSchema.safeParse({
      type: 'camera',
      scale: 1.5,
      padding: 60,
      easing: 'ease-out',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a spotlight action and fills defaults', () => {
    const result = StoryboardActionSchema.safeParse({
      type: 'spotlight',
      target_block: 'p1_t4',
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.type === 'spotlight') {
      expect(result.data.dim_opacity).toBe(0.65);
      expect(result.data.feather_px).toBe(40);
      expect(result.data.shape).toBe('rounded');
    }
  });

  it('accepts a clear action with array of ids', () => {
    const result = StoryboardActionSchema.safeParse({
      type: 'clear',
      targets: ['overlay-1', 'overlay-2'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown action type', () => {
    const result = StoryboardActionSchema.safeParse({
      type: 'nope',
      target_block: 'x',
    });
    expect(result.success).toBe(false);
  });
});

describe('StoryboardSchema', () => {
  it('accepts a one-step storyboard', () => {
    const result = StoryboardSchema.safeParse({
      version: 1,
      reasoning: 'defining a joint',
      steps: [
        {
          at_ms: 0,
          duration_ms: 700,
          action: {
            type: 'camera',
            target_block: 'p1_t3',
            scale: 1.6,
            padding: 80,
            easing: 'ease-out',
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a storyboard with zero steps', () => {
    const result = StoryboardSchema.safeParse({
      version: 1,
      reasoning: '',
      steps: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a storyboard with more than four steps', () => {
    const action = {
      type: 'pulse' as const,
      target_block: 'p1_i2',
      count: 1,
      intensity: 'subtle' as const,
    };
    const step = { at_ms: 0, duration_ms: 500, action };
    const result = StoryboardSchema.safeParse({
      version: 1,
      reasoning: '',
      steps: [step, step, step, step, step],
    });
    expect(result.success).toBe(false);
  });
});
