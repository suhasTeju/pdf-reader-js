# ARIA Cinema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an LLM-directed cinematic visualization engine on top of the existing PDF reader so an AI tutor's speech chunks drive zoom, spotlight, underline, pulse, and callout effects in real time.

**Architecture:** New `TutorMode` view inside `packages/core` layered on top of the existing pdfjs canvas. A reactive `currentChunk` prop feeds an LLM Director (calling a consumer-provided OpenAI-compatible endpoint) that emits timed Storyboard JSON. A Storyboard Engine executes those steps against a Cinema Layer (Framer Motion + SVG primitives) driven by a new Zustand `narrationStore`. Embedding-based fallback (opt-in) keeps the viewer responsive if the LLM fails.

**Tech Stack:** React 18/19, TypeScript 5.7, Zustand 5 (vanilla), Zod (new), Framer Motion (new), pdfjs-dist 4.9, Vitest 2.1 + @testing-library/react, tsup build. Optional `@xenova/transformers` (MiniLM) for local embedding fallback.

**Spec:** `/Users/suhas/.claude/plans/fancy-mapping-bear.md` (the approved design spec this plan implements).

---

## File structure (new + modified)

### New in `packages/core/src/`
```
types/bbox.ts
types/storyboard.ts
store/narration-store.ts
utils/camera-math.ts
director/storyboard-schema.ts
director/prompts.ts
director/sse-parser.ts
director/llm-director.ts
director/storyboard-engine.ts
director/embedding-fallback.ts
components/TutorMode/TutorModeContainer.tsx
components/TutorMode/CinemaLayer.tsx
components/TutorMode/CameraView.tsx
components/TutorMode/SpotlightMask.tsx
components/TutorMode/AnimatedUnderline.tsx
components/TutorMode/Highlight.tsx
components/TutorMode/PulseOverlay.tsx
components/TutorMode/CalloutArrow.tsx
components/TutorMode/GhostReference.tsx
components/TutorMode/BoxOverlay.tsx
components/TutorMode/StickyLabel.tsx
components/TutorMode/SubtitleBar.tsx
components/TutorMode/index.ts
```

### New tests in `packages/core/tests/`
```
tests/director/storyboard-schema.test.ts
tests/director/sse-parser.test.ts
tests/director/prompts.test.ts
tests/director/storyboard-engine.test.ts
tests/director/llm-director.test.ts
tests/director/embedding-fallback.test.ts
tests/store/narration-store.test.ts
tests/utils/camera-math.test.ts
tests/components/SpotlightMask.test.tsx
tests/components/AnimatedUnderline.test.tsx
```

### Modified
- `packages/core/package.json` — add deps; bump version
- `packages/core/src/components/PDFViewer/PDFViewer.tsx` — handle `mode="tutor"`
- `packages/core/src/components/index.ts` — export TutorMode
- `packages/core/src/store/index.ts` — export narration-store
- `packages/core/src/utils/index.ts` — export camera-math
- `packages/core/src/types/index.ts` — export new types
- `packages/core/src/index.ts` — aggregate new exports

### New in `apps/demo/src/`
```
app/tutor/page.tsx
app/tutor/ChunkComposer.tsx
app/tutor/LLMConfigPanel.tsx
app/tutor/StoryboardLog.tsx
app/tutor/fixtures/joints-bbox.ts
```

### New dev files at repo root
```
apps/demo/.env.example
```

---

## Phase 0: Dev setup

### Task 1: Install dependencies and scaffold directories

**Files:**
- Modify: `packages/core/package.json`

- [ ] **Step 1.1:** Add dependencies

From repo root:
```bash
pnpm --filter pdfjs-reader-core add zod framer-motion
pnpm --filter pdfjs-reader-core add -D @xenova/transformers
```

Verify `packages/core/package.json` now contains:
```json
"dependencies": {
  "clsx": "^2.1.1",
  "framer-motion": "^11.x",
  "page-flip": "^2.0.7",
  "pdfjs-dist": "^4.9.155",
  "react-pageflip": "^2.0.3",
  "zod": "^3.x",
  "zustand": "^5.0.2"
},
"devDependencies": {
  "@xenova/transformers": "^2.x",
  ...
}
```

- [ ] **Step 1.2:** Create directory structure

From `packages/core`:
```bash
mkdir -p src/components/TutorMode src/director tests/director tests/store tests/utils tests/components
```

- [ ] **Step 1.3:** Add placeholder barrel file

Create `packages/core/src/components/TutorMode/index.ts`:
```ts
// Populated in later tasks.
export {};
```

- [ ] **Step 1.4:** Verify build still passes

```bash
pnpm --filter pdfjs-reader-core build
```

Expected: `dist/` regenerated, no TypeScript errors.

- [ ] **Step 1.5:** Commit

```bash
git add packages/core/package.json pnpm-lock.yaml packages/core/src/components/TutorMode
git commit -m "chore(tutor): add zod/framer-motion deps and tutor mode scaffolding"
```

---

## Phase 1: Foundation types and schemas

### Task 2: Types for BBox data

**Files:**
- Create: `packages/core/src/types/bbox.ts`
- Modify: `packages/core/src/types/index.ts`

- [ ] **Step 2.1:** Write `types/bbox.ts`

```ts
// packages/core/src/types/bbox.ts
export type BlockType =
  | 'heading'
  | 'paragraph'
  | 'list_item'
  | 'figure'
  | 'figure_region'
  | 'caption'
  | 'table'
  | 'mcq_option';

export type DefaultAction = 'zoom_pan' | 'spotlight' | 'underline' | 'pulse';

/** Four numbers: [x1, y1, x2, y2] in PDF coordinates (origin top-left). */
export type BBoxCoords = readonly [number, number, number, number];

export interface Block {
  block_id: string;
  bbox: BBoxCoords;
  text: string | null;
  type: BlockType;
  parent_id: string | null;
  confidence: number;
  reading_order: number;
  default_action: DefaultAction;
  semantic_unit_id: string;
}

export interface PageDimensionsDpi {
  width: number;
  height: number;
  dpi: number;
}

export interface PageBBoxData {
  id: string;
  page_number: number;
  page_text: string;
  page_dimensions: PageDimensionsDpi;
  blocks: Block[];
  created_at: string;
}

/** Lookup indexes used by the director + engine. */
export interface BBoxIndex {
  byPage: Map<number, PageBBoxData>;
  blockById: Map<string, { block: Block; pageNumber: number }>;
  crossPageFigures: Array<{
    block_id: string;
    page: number;
    type: 'figure' | 'figure_region' | 'caption';
    text: string;
  }>;
}
```

- [ ] **Step 2.2:** Re-export from `types/index.ts`

Append to `packages/core/src/types/index.ts`:
```ts
export type {
  BlockType,
  DefaultAction,
  BBoxCoords,
  Block,
  PageDimensionsDpi,
  PageBBoxData,
  BBoxIndex,
} from './bbox';
```

- [ ] **Step 2.3:** Verify typecheck

```bash
pnpm --filter pdfjs-reader-core typecheck
```

Expected: no errors.

- [ ] **Step 2.4:** Commit

```bash
git add packages/core/src/types
git commit -m "feat(tutor): add bbox type definitions"
```

---

### Task 3: Types for Storyboard

**Files:**
- Create: `packages/core/src/types/storyboard.ts`
- Modify: `packages/core/src/types/index.ts`

- [ ] **Step 3.1:** Write `types/storyboard.ts`

```ts
// packages/core/src/types/storyboard.ts
import type { BBoxCoords } from './bbox';

export type EasingName = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
export type SpotlightShape = 'rect' | 'rounded' | 'ellipse';
export type UnderlineStyle = 'straight' | 'sketch' | 'double' | 'wavy';
export type ArrowCurve = 'straight' | 'curved' | 'zigzag';
export type PulseIntensity = 'subtle' | 'normal' | 'strong';
export type BoxStyle = 'solid' | 'dashed';
export type LabelPosition = 'top' | 'bottom' | 'left' | 'right';
export type GhostPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
export type ClearTarget = 'all' | 'spotlights' | 'overlays' | string[];

export interface ActionCamera {
  type: 'camera';
  target_block?: string;
  target_bbox?: BBoxCoords;
  scale: number;
  padding: number;
  easing: EasingName;
}

export interface ActionSpotlight {
  type: 'spotlight';
  target_block: string;
  dim_opacity: number;
  feather_px: number;
  shape: SpotlightShape;
}

export interface ActionUnderline {
  type: 'underline';
  target_block: string;
  color: string;
  style: UnderlineStyle;
  draw_duration_ms: number;
}

export interface ActionHighlight {
  type: 'highlight';
  target_block: string;
  color: string;
  draw_duration_ms: number;
}

export interface ActionPulse {
  type: 'pulse';
  target_block: string;
  count: number;
  intensity: PulseIntensity;
}

export interface ActionCallout {
  type: 'callout';
  from_block: string;
  to_block: string;
  label?: string;
  curve: ArrowCurve;
}

export interface ActionGhostReference {
  type: 'ghost_reference';
  target_page: number;
  target_block: string;
  position: GhostPosition;
}

export interface ActionBox {
  type: 'box';
  target_block: string;
  color: string;
  style: BoxStyle;
}

export interface ActionLabel {
  type: 'label';
  target_block: string;
  text: string;
  position: LabelPosition;
}

export interface ActionClear {
  type: 'clear';
  targets: ClearTarget;
}

export type StoryboardAction =
  | ActionCamera
  | ActionSpotlight
  | ActionUnderline
  | ActionHighlight
  | ActionPulse
  | ActionCallout
  | ActionGhostReference
  | ActionBox
  | ActionLabel
  | ActionClear;

export interface StoryboardStep {
  at_ms: number;
  duration_ms: number;
  action: StoryboardAction;
}

export interface Storyboard {
  version: 1;
  reasoning: string;
  steps: StoryboardStep[];
}

/** Active overlay state tracked by the engine / store. */
export interface ActiveOverlay {
  id: string;
  kind: StoryboardAction['type'];
  action: StoryboardAction;
  createdAt: number;
  expiresAt: number;
}

export interface CameraState {
  scale: number;
  x: number;
  y: number;
  easing: EasingName;
}
```

- [ ] **Step 3.2:** Re-export from `types/index.ts`

Append to `packages/core/src/types/index.ts`:
```ts
export type {
  EasingName,
  SpotlightShape,
  UnderlineStyle,
  ArrowCurve,
  PulseIntensity,
  BoxStyle,
  LabelPosition,
  GhostPosition,
  ClearTarget,
  StoryboardAction,
  ActionCamera,
  ActionSpotlight,
  ActionUnderline,
  ActionHighlight,
  ActionPulse,
  ActionCallout,
  ActionGhostReference,
  ActionBox,
  ActionLabel,
  ActionClear,
  StoryboardStep,
  Storyboard,
  ActiveOverlay,
  CameraState,
} from './storyboard';
```

- [ ] **Step 3.3:** Typecheck + commit

```bash
pnpm --filter pdfjs-reader-core typecheck
git add packages/core/src/types
git commit -m "feat(tutor): add storyboard type definitions"
```

---

### Task 4: Zod schemas for storyboard

**Files:**
- Create: `packages/core/src/director/storyboard-schema.ts`

- [ ] **Step 4.1:** Write the schema file

```ts
// packages/core/src/director/storyboard-schema.ts
import { z } from 'zod';

const BBoxCoordsSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

const CameraSchema = z.object({
  type: z.literal('camera'),
  target_block: z.string().optional(),
  target_bbox: BBoxCoordsSchema.optional(),
  scale: z.number().min(0.5).max(4).default(1),
  padding: z.number().min(0).max(400).default(80),
  easing: z.enum(['linear', 'ease-in', 'ease-out', 'ease-in-out']).default('ease-in-out'),
}).refine(
  (a) => !!a.target_block || !!a.target_bbox,
  { message: 'camera requires target_block or target_bbox' }
);

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
  position: z.enum(['top-right', 'top-left', 'bottom-right', 'bottom-left']).default('top-right'),
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
  targets: z.union([
    z.enum(['all', 'spotlights', 'overlays']),
    z.array(z.string()),
  ]).default('overlays'),
});

export const StoryboardActionSchema = z.discriminatedUnion('type', [
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
  // Hand-rolled schema — zod-to-json-schema is optional. Matches the Storyboard schema above.
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
                    'camera', 'spotlight', 'underline', 'highlight',
                    'pulse', 'callout', 'ghost_reference', 'box', 'label', 'clear',
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
```

- [ ] **Step 4.2:** Typecheck + commit

```bash
pnpm --filter pdfjs-reader-core typecheck
git add packages/core/src/director/storyboard-schema.ts
git commit -m "feat(tutor): add zod storyboard schemas"
```

---

### Task 5: Storyboard schema tests + test infrastructure

**Files:**
- Modify: `packages/core/tests/setup.ts`
- Create: `packages/core/tests/director/storyboard-schema.test.ts`

- [ ] **Step 5.1:** Verify setup.ts is usable

View `packages/core/tests/setup.ts`. If empty/minimal, replace with:
```ts
// packages/core/tests/setup.ts
import '@testing-library/jest-dom/vitest';
```

If `@testing-library/jest-dom` isn't installed, install it:
```bash
pnpm --filter pdfjs-reader-core add -D @testing-library/jest-dom
```

- [ ] **Step 5.2:** Write failing schema tests

```ts
// packages/core/tests/director/storyboard-schema.test.ts
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
```

- [ ] **Step 5.3:** Run tests — verify they all pass

```bash
pnpm --filter pdfjs-reader-core test tests/director/storyboard-schema.test.ts
```

Expected: 8 tests pass.

- [ ] **Step 5.4:** Commit

```bash
git add packages/core/tests packages/core/package.json pnpm-lock.yaml
git commit -m "test(tutor): cover storyboard schema validation"
```

---

## Phase 2: NarrationStore

### Task 6: Implement `narrationStore`

**Files:**
- Create: `packages/core/src/store/narration-store.ts`

- [ ] **Step 6.1:** Write the store

```ts
// packages/core/src/store/narration-store.ts
import { createStore } from 'zustand/vanilla';
import type {
  CameraState,
  ActiveOverlay,
  Storyboard,
  StoryboardAction,
} from '../types/storyboard';

export interface ChunkHistoryEntry {
  text: string;
  pageNumber: number;
  timestamp: number;
}

export type EngineStatus = 'idle' | 'transitioning' | 'executing';
export type LlmStatus = 'idle' | 'in-flight' | 'failed';

export interface NarrationState {
  currentChunk: string | null;
  currentPage: number;
  chunkHistory: ChunkHistoryEntry[];
  camera: CameraState;
  activeOverlays: ActiveOverlay[];
  engineStatus: EngineStatus;
  llmStatus: LlmStatus;
  lastStoryboard: Storyboard | null;
  lastError: string | null;
  isPaused: boolean;
}

export interface NarrationActions {
  setCurrentChunk: (chunk: string | null) => void;
  setCurrentPage: (page: number) => void;
  pushChunkHistory: (entry: ChunkHistoryEntry) => void;
  setCamera: (camera: Partial<CameraState>) => void;
  addOverlay: (overlay: ActiveOverlay) => void;
  removeOverlay: (id: string) => void;
  clearOverlays: (predicate?: (o: ActiveOverlay) => boolean) => void;
  setEngineStatus: (s: EngineStatus) => void;
  setLlmStatus: (s: LlmStatus, error?: string | null) => void;
  setLastStoryboard: (sb: Storyboard | null) => void;
  setPaused: (paused: boolean) => void;
  reset: () => void;
}

export type NarrationStore = NarrationState & NarrationActions;

const MAX_HISTORY = 5;

const initialState: NarrationState = {
  currentChunk: null,
  currentPage: 1,
  chunkHistory: [],
  camera: { scale: 1, x: 0, y: 0, easing: 'ease-in-out' },
  activeOverlays: [],
  engineStatus: 'idle',
  llmStatus: 'idle',
  lastStoryboard: null,
  lastError: null,
  isPaused: false,
};

export function createNarrationStore(overrides: Partial<NarrationState> = {}) {
  return createStore<NarrationStore>()((set) => ({
    ...initialState,
    ...overrides,

    setCurrentChunk: (chunk) => set({ currentChunk: chunk }),
    setCurrentPage: (page) => set({ currentPage: page }),

    pushChunkHistory: (entry) =>
      set((state) => ({
        chunkHistory: [...state.chunkHistory.slice(-(MAX_HISTORY - 1)), entry],
      })),

    setCamera: (camera) =>
      set((state) => ({ camera: { ...state.camera, ...camera } })),

    addOverlay: (overlay) =>
      set((state) => ({ activeOverlays: [...state.activeOverlays, overlay] })),

    removeOverlay: (id) =>
      set((state) => ({
        activeOverlays: state.activeOverlays.filter((o) => o.id !== id),
      })),

    clearOverlays: (predicate) =>
      set((state) => ({
        activeOverlays: predicate
          ? state.activeOverlays.filter((o) => !predicate(o))
          : [],
      })),

    setEngineStatus: (s) => set({ engineStatus: s }),

    setLlmStatus: (s, error = null) =>
      set({ llmStatus: s, lastError: error }),

    setLastStoryboard: (sb) => set({ lastStoryboard: sb }),

    setPaused: (paused) => set({ isPaused: paused }),

    reset: () => set(initialState),
  }));
}

export type NarrationStoreApi = ReturnType<typeof createNarrationStore>;

/** Helper: make a unique overlay id. */
let overlayIdCounter = 0;
export function makeOverlayId(action: StoryboardAction): string {
  overlayIdCounter += 1;
  return `ov-${action.type}-${overlayIdCounter}-${Date.now()}`;
}
```

- [ ] **Step 6.2:** Add to store barrel

Append to `packages/core/src/store/index.ts`:
```ts
export {
  createNarrationStore,
  makeOverlayId,
  type NarrationStore,
  type NarrationStoreApi,
  type NarrationState,
  type NarrationActions,
  type EngineStatus,
  type LlmStatus,
  type ChunkHistoryEntry,
} from './narration-store';
```

- [ ] **Step 6.3:** Typecheck

```bash
pnpm --filter pdfjs-reader-core typecheck
```

- [ ] **Step 6.4:** Commit

```bash
git add packages/core/src/store
git commit -m "feat(tutor): add narrationStore (Zustand)"
```

---

### Task 7: NarrationStore tests

**Files:**
- Create: `packages/core/tests/store/narration-store.test.ts`

- [ ] **Step 7.1:** Write failing tests

```ts
// packages/core/tests/store/narration-store.test.ts
import { describe, it, expect } from 'vitest';
import { createNarrationStore, makeOverlayId } from '../../src/store/narration-store';
import type { ActiveOverlay } from '../../src/types/storyboard';

function makeOverlay(id: string, kind: ActiveOverlay['kind'] = 'spotlight'): ActiveOverlay {
  return {
    id,
    kind,
    action: { type: 'spotlight', target_block: 'p1_t4', dim_opacity: 0.65, feather_px: 40, shape: 'rounded' },
    createdAt: Date.now(),
    expiresAt: Date.now() + 1000,
  };
}

describe('narrationStore', () => {
  it('starts with default state', () => {
    const store = createNarrationStore();
    const s = store.getState();
    expect(s.currentChunk).toBeNull();
    expect(s.camera).toEqual({ scale: 1, x: 0, y: 0, easing: 'ease-in-out' });
    expect(s.activeOverlays).toEqual([]);
  });

  it('caps chunk history at 5', () => {
    const store = createNarrationStore();
    for (let i = 0; i < 8; i++) {
      store.getState().pushChunkHistory({ text: `chunk ${i}`, pageNumber: 1, timestamp: i });
    }
    const history = store.getState().chunkHistory;
    expect(history).toHaveLength(5);
    expect(history[0].text).toBe('chunk 3');
    expect(history[4].text).toBe('chunk 7');
  });

  it('adds and removes overlays by id', () => {
    const store = createNarrationStore();
    const o1 = makeOverlay('ov-1');
    const o2 = makeOverlay('ov-2');
    store.getState().addOverlay(o1);
    store.getState().addOverlay(o2);
    expect(store.getState().activeOverlays).toHaveLength(2);
    store.getState().removeOverlay('ov-1');
    expect(store.getState().activeOverlays.map((o) => o.id)).toEqual(['ov-2']);
  });

  it('clearOverlays with predicate removes only matching', () => {
    const store = createNarrationStore();
    store.getState().addOverlay(makeOverlay('a', 'spotlight'));
    store.getState().addOverlay(makeOverlay('b', 'underline'));
    store.getState().clearOverlays((o) => o.kind === 'spotlight');
    expect(store.getState().activeOverlays.map((o) => o.id)).toEqual(['b']);
  });

  it('clearOverlays without predicate removes all', () => {
    const store = createNarrationStore();
    store.getState().addOverlay(makeOverlay('a'));
    store.getState().addOverlay(makeOverlay('b'));
    store.getState().clearOverlays();
    expect(store.getState().activeOverlays).toEqual([]);
  });

  it('setCamera merges partial updates', () => {
    const store = createNarrationStore();
    store.getState().setCamera({ scale: 2 });
    expect(store.getState().camera).toEqual({ scale: 2, x: 0, y: 0, easing: 'ease-in-out' });
  });

  it('reset returns to initial state', () => {
    const store = createNarrationStore();
    store.getState().setCurrentChunk('hello');
    store.getState().setCamera({ scale: 3 });
    store.getState().reset();
    expect(store.getState().currentChunk).toBeNull();
    expect(store.getState().camera.scale).toBe(1);
  });

  it('makeOverlayId generates unique ids', () => {
    const a = makeOverlayId({ type: 'pulse', target_block: 'x', count: 1, intensity: 'subtle' });
    const b = makeOverlayId({ type: 'pulse', target_block: 'x', count: 1, intensity: 'subtle' });
    expect(a).not.toBe(b);
    expect(a.startsWith('ov-pulse-')).toBe(true);
  });
});
```

- [ ] **Step 7.2:** Run tests

```bash
pnpm --filter pdfjs-reader-core test tests/store/narration-store.test.ts
```

Expected: 8 tests pass.

- [ ] **Step 7.3:** Commit

```bash
git add packages/core/tests/store
git commit -m "test(tutor): cover narrationStore actions"
```

---

## Phase 3: Camera math + CameraView

### Task 8: Camera math utility

**Files:**
- Create: `packages/core/src/utils/camera-math.ts`
- Modify: `packages/core/src/utils/index.ts`

- [ ] **Step 8.1:** Write the utility

```ts
// packages/core/src/utils/camera-math.ts
import type { BBoxCoords, PageDimensionsDpi } from '../types/bbox';

export interface ViewportSize {
  width: number;
  height: number;
}

export interface CameraTarget {
  /** scale multiplier relative to fit-page scale */
  scale: number;
  /** translate in pixels (screen-space), to center the target block in the viewport */
  x: number;
  /** translate in pixels */
  y: number;
}

/** Returns the scale that makes a page fit the viewport (contain, not cover). */
export function fitPageScale(page: PageDimensionsDpi, viewport: ViewportSize): number {
  const sx = viewport.width / page.width;
  const sy = viewport.height / page.height;
  return Math.min(sx, sy);
}

/**
 * Compute a camera target that frames a block's bbox with the requested
 * scale multiplier (1 = fit the block tightly with padding; 1.5 = a little
 * smaller frame = more zoom; <1 = more context).
 *
 * Coordinates are in PDF units — padding is also in PDF units.
 */
export function computeCameraForBlock(
  bbox: BBoxCoords,
  page: PageDimensionsDpi,
  viewport: ViewportSize,
  opts: { targetScale?: number; paddingPdf?: number } = {},
): CameraTarget {
  const targetScale = opts.targetScale ?? 1.5;
  const paddingPdf = opts.paddingPdf ?? 80;

  const [x1, y1, x2, y2] = bbox;
  const blockW = Math.max(1, x2 - x1 + paddingPdf * 2);
  const blockH = Math.max(1, y2 - y1 + paddingPdf * 2);
  const blockCX = (x1 + x2) / 2;
  const blockCY = (y1 + y2) / 2;

  // Scale that makes the block+padding fit the viewport
  const fitBlock = Math.min(viewport.width / blockW, viewport.height / blockH);
  // Final scale: targetScale=1 means tight fit; >1 zooms tighter; <1 shows more context
  const scale = fitBlock * targetScale;

  // Page center in PDF coords
  const pageCX = page.width / 2;
  const pageCY = page.height / 2;

  // Screen-space translation so that block center lands in viewport center.
  // The page is assumed centered at (viewport.w/2, viewport.h/2) pre-transform.
  const x = (pageCX - blockCX) * scale;
  const y = (pageCY - blockCY) * scale;

  return { scale, x, y };
}

/** Fit-page camera target (no pan). */
export function fitPageTarget(
  page: PageDimensionsDpi,
  viewport: ViewportSize,
): CameraTarget {
  return { scale: fitPageScale(page, viewport), x: 0, y: 0 };
}

/**
 * Clamp a camera target so the page doesn't drift fully off-screen at high scale.
 * Ensures the visible area of the viewport still intersects the page.
 */
export function clampCamera(
  target: CameraTarget,
  page: PageDimensionsDpi,
  viewport: ViewportSize,
): CameraTarget {
  const pageWScreen = page.width * target.scale;
  const pageHScreen = page.height * target.scale;
  const maxOffsetX = Math.max(0, (pageWScreen - viewport.width) / 2);
  const maxOffsetY = Math.max(0, (pageHScreen - viewport.height) / 2);
  return {
    scale: target.scale,
    x: Math.max(-maxOffsetX, Math.min(maxOffsetX, target.x)),
    y: Math.max(-maxOffsetY, Math.min(maxOffsetY, target.y)),
  };
}
```

- [ ] **Step 8.2:** Export from utils barrel

Append to `packages/core/src/utils/index.ts`:
```ts
export {
  fitPageScale,
  fitPageTarget,
  computeCameraForBlock,
  clampCamera,
  type ViewportSize,
  type CameraTarget,
} from './camera-math';
```

- [ ] **Step 8.3:** Commit

```bash
pnpm --filter pdfjs-reader-core typecheck
git add packages/core/src/utils
git commit -m "feat(tutor): add camera-math utilities"
```

---

### Task 9: Camera math tests

**Files:**
- Create: `packages/core/tests/utils/camera-math.test.ts`

- [ ] **Step 9.1:** Write tests

```ts
// packages/core/tests/utils/camera-math.test.ts
import { describe, it, expect } from 'vitest';
import {
  fitPageScale,
  fitPageTarget,
  computeCameraForBlock,
  clampCamera,
} from '../../src/utils/camera-math';

const PAGE = { width: 1756, height: 2269, dpi: 200 };
const VIEW = { width: 800, height: 1000 };

describe('camera-math', () => {
  it('fitPageScale picks the smaller axis ratio', () => {
    const s = fitPageScale(PAGE, VIEW);
    expect(s).toBeCloseTo(Math.min(800 / 1756, 1000 / 2269));
  });

  it('fitPageTarget has zero pan', () => {
    const t = fitPageTarget(PAGE, VIEW);
    expect(t.x).toBe(0);
    expect(t.y).toBe(0);
  });

  it('computeCameraForBlock zooms closer than fit when targetScale > 1', () => {
    const fit = fitPageScale(PAGE, VIEW);
    const target = computeCameraForBlock(
      [939.3, 522, 1137.4, 599.7],
      PAGE,
      VIEW,
      { targetScale: 1.5, paddingPdf: 60 },
    );
    expect(target.scale).toBeGreaterThan(fit);
  });

  it('computeCameraForBlock centers the block (pan > 0 for off-center block)', () => {
    const target = computeCameraForBlock(
      [939.3, 522, 1137.4, 599.7],
      PAGE,
      VIEW,
    );
    // block is top-right on a 1756x2269 page: expect negative x offset (move page left)
    // pageCX(878) - blockCX(~1038) < 0, so x < 0 at positive scale
    expect(target.x).toBeLessThan(0);
    expect(target.y).toBeLessThan(0);
  });

  it('clampCamera bounds extreme offsets', () => {
    const s = 2;
    const extreme = { scale: s, x: 10_000, y: 10_000 };
    const clamped = clampCamera(extreme, PAGE, VIEW);
    expect(clamped.x).toBeLessThanOrEqual((PAGE.width * s - VIEW.width) / 2);
    expect(clamped.y).toBeLessThanOrEqual((PAGE.height * s - VIEW.height) / 2);
  });

  it('clampCamera allows (0,0) at fit scale', () => {
    const fit = fitPageScale(PAGE, VIEW);
    const clamped = clampCamera({ scale: fit, x: 0, y: 0 }, PAGE, VIEW);
    expect(clamped.x).toBe(0);
    expect(clamped.y).toBe(0);
  });
});
```

- [ ] **Step 9.2:** Run tests

```bash
pnpm --filter pdfjs-reader-core test tests/utils/camera-math.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 9.3:** Commit

```bash
git add packages/core/tests/utils
git commit -m "test(tutor): cover camera-math utilities"
```

---

### Task 10: CameraView component

**Files:**
- Create: `packages/core/src/components/TutorMode/CameraView.tsx`

- [ ] **Step 10.1:** Write the component

```tsx
// packages/core/src/components/TutorMode/CameraView.tsx
import React from 'react';
import { motion } from 'framer-motion';
import type { CameraState } from '../../types/storyboard';

export interface CameraViewProps {
  camera: CameraState;
  children: React.ReactNode;
  /** total duration for the tween, in ms */
  durationMs?: number;
  className?: string;
}

/**
 * Wraps page content in a Framer Motion container that animates scale+translate.
 * The origin is the center of the container.
 */
export function CameraView({
  camera,
  children,
  durationMs = 700,
  className,
}: CameraViewProps) {
  return (
    <motion.div
      className={className}
      style={{
        transformOrigin: '50% 50%',
        willChange: 'transform',
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
      animate={{
        scale: camera.scale,
        x: camera.x,
        y: camera.y,
      }}
      transition={{
        duration: durationMs / 1000,
        ease:
          camera.easing === 'linear' ? 'linear' :
          camera.easing === 'ease-in' ? [0.42, 0, 1, 1] :
          camera.easing === 'ease-out' ? [0, 0, 0.58, 1] :
          [0.42, 0, 0.58, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
```

- [ ] **Step 10.2:** Typecheck + commit

```bash
pnpm --filter pdfjs-reader-core typecheck
git add packages/core/src/components/TutorMode/CameraView.tsx
git commit -m "feat(tutor): add CameraView (Framer Motion scale+pan wrapper)"
```

---

## Phase 4: First primitive end-to-end (Spotlight)

### Task 11: SpotlightMask component

**Files:**
- Create: `packages/core/src/components/TutorMode/SpotlightMask.tsx`

- [ ] **Step 11.1:** Write the component

```tsx
// packages/core/src/components/TutorMode/SpotlightMask.tsx
import React, { useId } from 'react';
import { motion } from 'framer-motion';
import type { ActionSpotlight } from '../../types/storyboard';
import type { BBoxCoords, PageDimensionsDpi } from '../../types/bbox';

export interface SpotlightMaskProps {
  page: PageDimensionsDpi;
  bbox: BBoxCoords;
  action: ActionSpotlight;
  durationMs?: number;
}

/**
 * Full-page SVG overlay: dims the entire page with action.dim_opacity,
 * then "cuts out" a rounded/rect/ellipse hole over the target bbox so
 * the underlying page shows through. Uses an SVG mask with a feather
 * via blur filter.
 *
 * Rendered in PAGE coords (width=page.width, height=page.height). The
 * parent CameraView transform scales it along with the PDF canvas.
 */
export function SpotlightMask({ page, bbox, action, durationMs = 400 }: SpotlightMaskProps) {
  const maskId = useId();
  const filterId = `${maskId}-blur`;
  const [x1, y1, x2, y2] = bbox;
  const w = Math.max(0, x2 - x1);
  const h = Math.max(0, y2 - y1);
  const rx = action.shape === 'rounded' ? 12 : action.shape === 'ellipse' ? w / 2 : 0;
  const ry = action.shape === 'rounded' ? 12 : action.shape === 'ellipse' ? h / 2 : 0;
  const feather = action.feather_px;

  return (
    <svg
      viewBox={`0 0 ${page.width} ${page.height}`}
      width={page.width}
      height={page.height}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        width: '100%',
        height: '100%',
      }}
      data-role="spotlight-mask"
    >
      <defs>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={feather / 4} />
        </filter>
        <mask id={maskId}>
          <rect x={0} y={0} width={page.width} height={page.height} fill="white" />
          {action.shape === 'ellipse' ? (
            <ellipse
              cx={(x1 + x2) / 2}
              cy={(y1 + y2) / 2}
              rx={w / 2}
              ry={h / 2}
              fill="black"
              filter={`url(#${filterId})`}
            />
          ) : (
            <rect
              x={x1}
              y={y1}
              width={w}
              height={h}
              rx={rx}
              ry={ry}
              fill="black"
              filter={`url(#${filterId})`}
            />
          )}
        </mask>
      </defs>
      <motion.rect
        x={0}
        y={0}
        width={page.width}
        height={page.height}
        fill="black"
        mask={`url(#${maskId})`}
        initial={{ fillOpacity: 0 }}
        animate={{ fillOpacity: action.dim_opacity }}
        exit={{ fillOpacity: 0 }}
        transition={{ duration: durationMs / 1000, ease: 'easeOut' }}
      />
    </svg>
  );
}
```

- [ ] **Step 11.2:** Typecheck + commit

```bash
pnpm --filter pdfjs-reader-core typecheck
git add packages/core/src/components/TutorMode/SpotlightMask.tsx
git commit -m "feat(tutor): add SpotlightMask (SVG feathered mask)"
```

---

### Task 12: TutorModeContainer skeleton

**Files:**
- Create: `packages/core/src/components/TutorMode/TutorModeContainer.tsx`
- Create: `packages/core/src/components/TutorMode/CinemaLayer.tsx`
- Modify: `packages/core/src/components/TutorMode/index.ts`

- [ ] **Step 12.1:** Write the container

```tsx
// packages/core/src/components/TutorMode/TutorModeContainer.tsx
'use client';

import React, { useMemo, useRef } from 'react';
import { PDFPage } from '../PDFPage/PDFPage';
import type { PageBBoxData, BBoxIndex } from '../../types/bbox';
import type { NarrationStoreApi } from '../../store/narration-store';
import { CameraView } from './CameraView';
import { CinemaLayer } from './CinemaLayer';

export interface TutorModeContainerProps {
  pageNumber: number;
  bboxData: PageBBoxData[];
  narrationStore: NarrationStoreApi;
  scale: number;
  className?: string;
}

/** Build a cross-page/block index from the raw bbox list. */
export function buildBBoxIndex(bboxData: PageBBoxData[]): BBoxIndex {
  const byPage = new Map<number, PageBBoxData>();
  const blockById = new Map<string, { block: PageBBoxData['blocks'][number]; pageNumber: number }>();
  const crossPageFigures: BBoxIndex['crossPageFigures'] = [];

  for (const page of bboxData) {
    byPage.set(page.page_number, page);
    for (const block of page.blocks) {
      blockById.set(block.block_id, { block, pageNumber: page.page_number });
      if (
        (block.type === 'figure' || block.type === 'figure_region' || block.type === 'caption') &&
        typeof block.text === 'string' &&
        block.text.length > 0
      ) {
        crossPageFigures.push({
          block_id: block.block_id,
          page: page.page_number,
          type: block.type,
          text: block.text,
        });
      }
    }
  }

  return { byPage, blockById, crossPageFigures };
}

export function TutorModeContainer({
  pageNumber,
  bboxData,
  narrationStore,
  scale,
  className,
}: TutorModeContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const index = useMemo(() => buildBBoxIndex(bboxData), [bboxData]);

  const camera = narrationStore.getState().camera;
  const activeOverlays = narrationStore.getState().activeOverlays;

  const page = index.byPage.get(pageNumber);
  if (!page) {
    return <div className={className} ref={containerRef} data-tutor-mode-missing-page={pageNumber} />;
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#111',
      }}
      data-role="tutor-mode-container"
    >
      <CameraView camera={camera}>
        <div
          style={{
            position: 'relative',
            width: page.page_dimensions.width * scale,
            height: page.page_dimensions.height * scale,
            margin: '0 auto',
          }}
        >
          <PDFPage
            pageNumber={pageNumber}
            scale={scale}
            showTextLayer={false}
            showHighlightLayer={false}
            showAnnotationLayer={false}
          />
          <CinemaLayer
            page={page}
            index={index}
            overlays={activeOverlays}
            scale={scale}
          />
        </div>
      </CameraView>
    </div>
  );
}
```

- [ ] **Step 12.2:** Write the cinema layer

```tsx
// packages/core/src/components/TutorMode/CinemaLayer.tsx
'use client';

import React from 'react';
import { AnimatePresence } from 'framer-motion';
import type { ActiveOverlay, ActionSpotlight } from '../../types/storyboard';
import type { PageBBoxData, BBoxIndex, BBoxCoords } from '../../types/bbox';
import { SpotlightMask } from './SpotlightMask';

export interface CinemaLayerProps {
  page: PageBBoxData;
  index: BBoxIndex;
  overlays: ActiveOverlay[];
  scale: number;
}

function blockBbox(index: BBoxIndex, block_id: string): BBoxCoords | undefined {
  return index.blockById.get(block_id)?.block.bbox;
}

export function CinemaLayer({ page, index, overlays, scale }: CinemaLayerProps) {
  // Render the layer in PDF coordinates, scaled up to match the canvas.
  return (
    <div
      data-role="cinema-layer"
      style={{
        position: 'absolute',
        inset: 0,
        transformOrigin: '0 0',
        transform: `scale(${scale})`,
        width: page.page_dimensions.width,
        height: page.page_dimensions.height,
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence>
        {overlays.map((overlay) => {
          if (overlay.kind === 'spotlight') {
            const action = overlay.action as ActionSpotlight;
            const bbox = blockBbox(index, action.target_block);
            if (!bbox) return null;
            return (
              <SpotlightMask
                key={overlay.id}
                page={page.page_dimensions}
                bbox={bbox}
                action={action}
              />
            );
          }
          // Other overlay kinds added in later tasks.
          return null;
        })}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 12.3:** Replace placeholder barrel

Overwrite `packages/core/src/components/TutorMode/index.ts`:
```ts
export { TutorModeContainer, buildBBoxIndex, type TutorModeContainerProps } from './TutorModeContainer';
export { CinemaLayer, type CinemaLayerProps } from './CinemaLayer';
export { CameraView, type CameraViewProps } from './CameraView';
export { SpotlightMask, type SpotlightMaskProps } from './SpotlightMask';
```

- [ ] **Step 12.4:** Typecheck + commit

```bash
pnpm --filter pdfjs-reader-core typecheck
git add packages/core/src/components/TutorMode
git commit -m "feat(tutor): add TutorModeContainer + CinemaLayer skeleton"
```

---

### Task 13: Wire into PDFViewer

**Files:**
- Modify: `packages/core/src/components/PDFViewer/PDFViewer.tsx`
- Modify: `packages/core/src/components/index.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 13.1:** Read current `PDFViewer.tsx` to find the mode switch

```bash
grep -n "viewMode\|'book'\|'document'\|'dual'" packages/core/src/components/PDFViewer/PDFViewer.tsx | head -20
```

Identify where the viewer picks between `DocumentContainer`, `DualPageContainer`, `BookModeContainer`. There is usually a `switch (viewMode)` or conditional.

- [ ] **Step 13.2:** Add `tutor` case

In `packages/core/src/components/PDFViewer/PDFViewer.tsx`, locate the mode-switch block and add the new branch. Example insertion (match the surrounding style, props):
```tsx
// near the other mode branches:
if (viewMode === 'tutor' && narrationStore && bboxData) {
  return (
    <TutorModeContainer
      pageNumber={currentPage}
      bboxData={bboxData}
      narrationStore={narrationStore}
      scale={scale}
    />
  );
}
```

If `viewMode` is typed as `'document' | 'dual' | 'book'`, extend it in the same file (or in `types/index.ts` where `ViewMode` is defined):
```ts
export type ViewMode = 'document' | 'dual' | 'book' | 'tutor';
```

Also add `bboxData?: PageBBoxData[]` and `narrationStore?: NarrationStoreApi` to `PDFViewerProps` (in the same file where props are declared).

Add the imports at the top of `PDFViewer.tsx`:
```tsx
import { TutorModeContainer } from '../TutorMode/TutorModeContainer';
import type { NarrationStoreApi } from '../../store/narration-store';
import type { PageBBoxData } from '../../types/bbox';
```

- [ ] **Step 13.3:** Re-export from `components/index.ts`

Append to `packages/core/src/components/index.ts`:
```ts
export {
  TutorModeContainer,
  CinemaLayer,
  CameraView,
  SpotlightMask,
  buildBBoxIndex,
  type TutorModeContainerProps,
  type CinemaLayerProps,
  type CameraViewProps,
  type SpotlightMaskProps,
} from './TutorMode';
```

- [ ] **Step 13.4:** Re-export from top-level barrel

In `packages/core/src/index.ts`, add to the `Components` block:
```ts
TutorModeContainer,
CinemaLayer,
CameraView,
SpotlightMask,
```
and to type exports:
```ts
type TutorModeContainerProps,
type CinemaLayerProps,
type CameraViewProps,
type SpotlightMaskProps,
```

- [ ] **Step 13.5:** Build + commit

```bash
pnpm --filter pdfjs-reader-core build
git add packages/core/src
git commit -m "feat(tutor): wire TutorMode into PDFViewer + exports"
```

---

### Task 14: Smoke test — manual overlay dispatch in apps/demo

**Files:**
- Create: `apps/demo/src/app/tutor-smoke/page.tsx`

- [ ] **Step 14.1:** Create a minimal smoke page

```tsx
// apps/demo/src/app/tutor-smoke/page.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import {
  PDFViewerProvider,
  TutorModeContainer,
  createNarrationStore,
  makeOverlayId,
  loadDocumentWithCallbacks,
  useViewerStore,
} from '@pdf-reader/core';
import type { NarrationStoreApi } from '@pdf-reader/core';

// A tiny one-page fixture matching the real bbox shape.
const FIXTURE = [
  {
    id: 'smoke-1',
    page_number: 1,
    page_text: '',
    page_dimensions: { width: 1756, height: 2269, dpi: 200 },
    blocks: [
      {
        bbox: [939.3, 522, 1137.4, 599.7] as const,
        text: 'Joints',
        type: 'heading' as const,
        block_id: 'p1_t0',
        parent_id: null,
        confidence: 0.99,
        reading_order: 0,
        default_action: 'zoom_pan' as const,
        semantic_unit_id: 'su_1_0',
      },
    ],
    created_at: new Date().toISOString(),
  },
];

export default function TutorSmokePage() {
  const storeRef = useRef<NarrationStoreApi | null>(null);
  if (!storeRef.current) storeRef.current = createNarrationStore();
  const narrationStore = storeRef.current;

  const setDocument = useViewerStore((s) => s.setDocument);

  useEffect(() => {
    const { promise } = loadDocumentWithCallbacks({
      src: process.env.NEXT_PUBLIC_PDF_URL || '/sample.pdf',
      onDocumentReady: (doc) => setDocument(doc),
      onFirstPageReady: () => {},
    });
    promise.catch(() => {});
  }, [setDocument]);

  function triggerSpotlight() {
    const id = makeOverlayId({
      type: 'spotlight',
      target_block: 'p1_t0',
      dim_opacity: 0.65,
      feather_px: 40,
      shape: 'rounded',
    });
    narrationStore.getState().addOverlay({
      id,
      kind: 'spotlight',
      action: {
        type: 'spotlight',
        target_block: 'p1_t0',
        dim_opacity: 0.65,
        feather_px: 40,
        shape: 'rounded',
      },
      createdAt: Date.now(),
      expiresAt: Date.now() + 5000,
    });
  }

  function resetCamera() {
    narrationStore.getState().setCamera({ scale: 1, x: 0, y: 0 });
    narrationStore.getState().clearOverlays();
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ width: 240, padding: 16, background: '#1f2937', color: 'white' }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Tutor smoke</h2>
        <button onClick={triggerSpotlight} style={{ display: 'block', marginBottom: 8 }}>
          Add spotlight on heading
        </button>
        <button onClick={resetCamera}>Reset camera + clear</button>
      </div>
      <div style={{ flex: 1 }}>
        <PDFViewerProvider>
          <TutorModeContainer
            pageNumber={1}
            bboxData={FIXTURE}
            narrationStore={narrationStore}
            scale={0.4}
          />
        </PDFViewerProvider>
      </div>
    </div>
  );
}
```

- [ ] **Step 14.2:** Run dev server and verify manually

```bash
pnpm dev
```

Navigate to `http://localhost:3000/tutor-smoke`. Click "Add spotlight" — the PDF region around the "Joints" heading stays clear while the rest dims to ~65% black. Click reset — dimming clears.

- [ ] **Step 14.3:** Commit

```bash
git add apps/demo/src/app/tutor-smoke
git commit -m "chore(demo): add tutor smoke page for manual overlay verification"
```

---

## Phase 5: Storyboard Engine

### Task 15: Engine state machine + scheduling

**Files:**
- Create: `packages/core/src/director/storyboard-engine.ts`

- [ ] **Step 15.1:** Write the engine

```ts
// packages/core/src/director/storyboard-engine.ts
import type {
  Storyboard,
  StoryboardStep,
  StoryboardAction,
  ActiveOverlay,
  CameraState,
} from '../types/storyboard';
import type { BBoxIndex } from '../types/bbox';
import type { NarrationStoreApi } from '../store/narration-store';
import { makeOverlayId } from '../store/narration-store';
import { computeCameraForBlock, type ViewportSize } from '../utils/camera-math';

export interface EngineDeps {
  narrationStore: NarrationStoreApi;
  bboxIndex: BBoxIndex;
  /** Callback to read current viewport size (pixels). */
  getViewport: () => ViewportSize;
}

export class StoryboardEngine {
  private deps: EngineDeps;
  private pendingTimers = new Set<ReturnType<typeof setTimeout>>();
  private currentStoryboardId = 0;

  constructor(deps: EngineDeps) {
    this.deps = deps;
  }

  /**
   * Execute a new storyboard. Cancels in-flight steps from the previous storyboard
   * and smoothly transitions the camera/overlays from the current state.
   */
  execute(storyboard: Storyboard): void {
    this.cancelPending();
    this.currentStoryboardId += 1;
    const storyboardId = this.currentStoryboardId;

    const { narrationStore } = this.deps;
    narrationStore.getState().setEngineStatus('transitioning');
    narrationStore.getState().setLastStoryboard(storyboard);

    // Sort steps by at_ms (LLM is not required to order them).
    const steps = [...storyboard.steps].sort((a, b) => a.at_ms - b.at_ms);

    for (const step of steps) {
      const timer = setTimeout(() => {
        if (storyboardId !== this.currentStoryboardId) return;
        this.runStep(step);
      }, step.at_ms);
      this.pendingTimers.add(timer);
    }

    // Mark executing once the first step is scheduled.
    const markExecuting = setTimeout(() => {
      if (storyboardId !== this.currentStoryboardId) return;
      narrationStore.getState().setEngineStatus('executing');
    }, 0);
    this.pendingTimers.add(markExecuting);

    // Return to idle after the last step completes.
    const last = steps[steps.length - 1];
    const totalMs = last.at_ms + last.duration_ms;
    const markIdle = setTimeout(() => {
      if (storyboardId !== this.currentStoryboardId) return;
      narrationStore.getState().setEngineStatus('idle');
    }, totalMs + 50);
    this.pendingTimers.add(markIdle);
  }

  /** Abort all pending steps and set engine status to idle. */
  cancelPending(): void {
    for (const t of this.pendingTimers) clearTimeout(t);
    this.pendingTimers.clear();
    this.deps.narrationStore.getState().setEngineStatus('idle');
  }

  /** Reset visuals: clear overlays, fit camera back to page. */
  resetVisuals(): void {
    this.cancelPending();
    const { narrationStore } = this.deps;
    narrationStore.getState().clearOverlays();
    narrationStore.getState().setCamera({ scale: 1, x: 0, y: 0 });
  }

  /** Execute one step — dispatch to narrationStore. Returns true if applied. */
  private runStep(step: StoryboardStep): boolean {
    const action = step.action;
    const { narrationStore, bboxIndex } = this.deps;

    // Validate target_block references (unknown ids → drop silently).
    if ('target_block' in action && action.target_block) {
      if (!bboxIndex.blockById.has(action.target_block)) return false;
    }

    if (action.type === 'camera') {
      this.applyCamera(action, step.duration_ms);
      return true;
    }

    if (action.type === 'clear') {
      const targets = action.targets;
      if (targets === 'all' || targets === 'overlays') {
        narrationStore.getState().clearOverlays();
      } else if (targets === 'spotlights') {
        narrationStore.getState().clearOverlays((o) => o.kind === 'spotlight');
      } else if (Array.isArray(targets)) {
        const ids = new Set(targets);
        narrationStore.getState().clearOverlays((o) => ids.has(o.id));
      }
      return true;
    }

    // Overlay-emitting actions
    const overlay: ActiveOverlay = {
      id: makeOverlayId(action),
      kind: action.type,
      action,
      createdAt: Date.now(),
      expiresAt: Date.now() + step.duration_ms,
    };
    narrationStore.getState().addOverlay(overlay);

    // Auto-remove when expired
    const timer = setTimeout(() => {
      narrationStore.getState().removeOverlay(overlay.id);
    }, step.duration_ms);
    this.pendingTimers.add(timer);
    return true;
  }

  private applyCamera(
    action: Extract<StoryboardAction, { type: 'camera' }>,
    durationMs: number,
  ): void {
    const { narrationStore, bboxIndex, getViewport } = this.deps;
    const viewport = getViewport();

    let bbox = action.target_bbox;
    let page = null as ReturnType<typeof bboxIndex.byPage.get> | null;

    if (!bbox && action.target_block) {
      const hit = bboxIndex.blockById.get(action.target_block);
      if (!hit) return;
      bbox = hit.block.bbox;
      page = bboxIndex.byPage.get(hit.pageNumber) ?? null;
    } else if (bbox) {
      page = bboxIndex.byPage.get(narrationStore.getState().currentPage) ?? null;
    }

    if (!bbox || !page) return;

    const target = computeCameraForBlock(bbox, page.page_dimensions, viewport, {
      targetScale: action.scale,
      paddingPdf: action.padding,
    });

    const camera: CameraState = {
      scale: target.scale,
      x: target.x,
      y: target.y,
      easing: action.easing,
    };
    narrationStore.getState().setCamera(camera);
    // durationMs is consumed by the CameraView transition (not the engine itself).
    void durationMs;
  }
}
```

- [ ] **Step 15.2:** Commit

```bash
pnpm --filter pdfjs-reader-core typecheck
git add packages/core/src/director/storyboard-engine.ts
git commit -m "feat(tutor): add StoryboardEngine (queue, scheduling, abort)"
```

---

### Task 16: Engine tests

**Files:**
- Create: `packages/core/tests/director/storyboard-engine.test.ts`

- [ ] **Step 16.1:** Write tests

```ts
// packages/core/tests/director/storyboard-engine.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StoryboardEngine } from '../../src/director/storyboard-engine';
import { createNarrationStore } from '../../src/store/narration-store';
import type { BBoxIndex, PageBBoxData } from '../../src/types/bbox';
import type { Storyboard } from '../../src/types/storyboard';

function makeIndex(): BBoxIndex {
  const page: PageBBoxData = {
    id: 'p1',
    page_number: 1,
    page_text: '',
    page_dimensions: { width: 1000, height: 1400, dpi: 200 },
    blocks: [
      {
        block_id: 'p1_t0',
        bbox: [100, 100, 500, 200],
        text: 'Heading',
        type: 'heading',
        parent_id: null,
        confidence: 1,
        reading_order: 0,
        default_action: 'zoom_pan',
        semantic_unit_id: 'su_1',
      },
      {
        block_id: 'p1_t1',
        bbox: [100, 300, 900, 600],
        text: 'Paragraph',
        type: 'paragraph',
        parent_id: null,
        confidence: 1,
        reading_order: 1,
        default_action: 'spotlight',
        semantic_unit_id: 'su_2',
      },
    ],
    created_at: '',
  };
  const byPage = new Map([[1, page]]);
  const blockById = new Map(
    page.blocks.map((b) => [b.block_id, { block: b, pageNumber: 1 }] as const),
  );
  return { byPage, blockById, crossPageFigures: [] };
}

function storyboard(): Storyboard {
  return {
    version: 1,
    reasoning: 't',
    steps: [
      { at_ms: 0, duration_ms: 500, action: { type: 'camera', target_block: 'p1_t0', scale: 1.5, padding: 60, easing: 'ease-out' } },
      { at_ms: 200, duration_ms: 1000, action: { type: 'spotlight', target_block: 'p1_t1', dim_opacity: 0.65, feather_px: 40, shape: 'rounded' } },
    ],
  };
}

describe('StoryboardEngine', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('applies camera at at_ms=0 and spotlight at at_ms=200', () => {
    const store = createNarrationStore();
    const engine = new StoryboardEngine({
      narrationStore: store,
      bboxIndex: makeIndex(),
      getViewport: () => ({ width: 800, height: 1000 }),
    });
    engine.execute(storyboard());
    vi.advanceTimersByTime(0);
    const cam = store.getState().camera;
    expect(cam.scale).toBeGreaterThan(0);
    expect(store.getState().activeOverlays).toHaveLength(0);
    vi.advanceTimersByTime(200);
    expect(store.getState().activeOverlays).toHaveLength(1);
    expect(store.getState().activeOverlays[0].kind).toBe('spotlight');
  });

  it('auto-removes overlay after its duration_ms', () => {
    const store = createNarrationStore();
    const engine = new StoryboardEngine({
      narrationStore: store,
      bboxIndex: makeIndex(),
      getViewport: () => ({ width: 800, height: 1000 }),
    });
    engine.execute(storyboard());
    vi.advanceTimersByTime(200);
    expect(store.getState().activeOverlays).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(store.getState().activeOverlays).toHaveLength(0);
  });

  it('drops steps with unknown block_id', () => {
    const store = createNarrationStore();
    const engine = new StoryboardEngine({
      narrationStore: store,
      bboxIndex: makeIndex(),
      getViewport: () => ({ width: 800, height: 1000 }),
    });
    engine.execute({
      version: 1,
      reasoning: '',
      steps: [
        { at_ms: 0, duration_ms: 500, action: { type: 'spotlight', target_block: 'p1_t0', dim_opacity: 0.65, feather_px: 40, shape: 'rounded' } },
        { at_ms: 0, duration_ms: 500, action: { type: 'spotlight', target_block: 'NOPE', dim_opacity: 0.65, feather_px: 40, shape: 'rounded' } },
      ],
    });
    vi.advanceTimersByTime(0);
    expect(store.getState().activeOverlays).toHaveLength(1);
  });

  it('new storyboard cancels pending steps from the previous one', () => {
    const store = createNarrationStore();
    const engine = new StoryboardEngine({
      narrationStore: store,
      bboxIndex: makeIndex(),
      getViewport: () => ({ width: 800, height: 1000 }),
    });
    engine.execute(storyboard());
    vi.advanceTimersByTime(100);
    engine.execute({
      version: 1,
      reasoning: 'override',
      steps: [
        { at_ms: 0, duration_ms: 500, action: { type: 'clear', targets: 'all' } },
      ],
    });
    vi.advanceTimersByTime(100);
    // the second storyboard's clear runs at 0 relative to its own start
    expect(store.getState().activeOverlays).toHaveLength(0);
  });

  it('resetVisuals clears overlays and re-centers camera', () => {
    const store = createNarrationStore();
    const engine = new StoryboardEngine({
      narrationStore: store,
      bboxIndex: makeIndex(),
      getViewport: () => ({ width: 800, height: 1000 }),
    });
    engine.execute(storyboard());
    vi.advanceTimersByTime(500);
    engine.resetVisuals();
    expect(store.getState().activeOverlays).toHaveLength(0);
    expect(store.getState().camera).toEqual({ scale: 1, x: 0, y: 0, easing: 'ease-in-out' });
  });

  it('clear with array of ids removes only those', () => {
    const store = createNarrationStore();
    const engine = new StoryboardEngine({
      narrationStore: store,
      bboxIndex: makeIndex(),
      getViewport: () => ({ width: 800, height: 1000 }),
    });
    store.getState().addOverlay({
      id: 'keep-me',
      kind: 'pulse',
      action: { type: 'pulse', target_block: 'p1_t0', count: 1, intensity: 'subtle' },
      createdAt: 0, expiresAt: 10_000,
    });
    store.getState().addOverlay({
      id: 'kill-me',
      kind: 'pulse',
      action: { type: 'pulse', target_block: 'p1_t0', count: 1, intensity: 'subtle' },
      createdAt: 0, expiresAt: 10_000,
    });
    engine.execute({
      version: 1,
      reasoning: '',
      steps: [
        { at_ms: 0, duration_ms: 500, action: { type: 'clear', targets: ['kill-me'] } },
      ],
    });
    vi.advanceTimersByTime(0);
    expect(store.getState().activeOverlays.map((o) => o.id)).toEqual(['keep-me']);
  });
});
```

- [ ] **Step 16.2:** Run tests

```bash
pnpm --filter pdfjs-reader-core test tests/director/storyboard-engine.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 16.3:** Commit

```bash
git add packages/core/tests/director
git commit -m "test(tutor): cover StoryboardEngine timing + abort + drops"
```

---

## Phase 6: LLM Director

### Task 17: Prompts module

**Files:**
- Create: `packages/core/src/director/prompts.ts`

- [ ] **Step 17.1:** Write prompt builder

```ts
// packages/core/src/director/prompts.ts
import type { BBoxIndex, PageBBoxData } from '../types/bbox';
import type { CameraState, ActiveOverlay } from '../types/storyboard';
import type { ChunkHistoryEntry } from '../store/narration-store';

export const SYSTEM_PROMPT = `You are the cinematic director of an AI tutor's PDF visualization. Given what the tutor just said, emit a JSON storyboard of 1-4 visual steps so the explanation feels like a produced teaching video.

Grammar rules:
- Start with \`camera\` to bring the relevant region into view.
- Use \`spotlight\` when analyzing a paragraph (prefer it when the block's default_action is "spotlight").
- Use \`underline\` for list items / enumerations (default_action: "underline").
- Use \`pulse\` or \`callout\` for figures (default_action: "pulse").
- Use \`ghost_reference\` when the tutor mentions a figure from another page.
- Respect each block's default_action unless context suggests otherwise.
- Prefer deliberate, minimal motion. Don't flicker.
- Output ONLY valid JSON matching the provided schema.`;

export interface BuildUserPromptInput {
  chunk: string;
  pageNumber: number;
  page: PageBBoxData;
  index: BBoxIndex;
  history: ChunkHistoryEntry[];
  camera: CameraState;
  activeOverlays: ActiveOverlay[];
  maxSteps?: number;
}

/** Truncate text to ~200 chars, word-aware. */
export function truncate(text: string | null, max = 200): string {
  if (!text) return '';
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const last = slice.lastIndexOf(' ');
  return (last > 40 ? slice.slice(0, last) : slice) + '…';
}

export function buildUserPrompt(input: BuildUserPromptInput): string {
  const {
    chunk, pageNumber, page, index, history, camera, activeOverlays, maxSteps = 4,
  } = input;

  const pageBlocks = page.blocks.map((b) => ({
    block_id: b.block_id,
    type: b.type,
    text: truncate(b.text, 200),
    bbox: b.bbox,
    default_action: b.default_action,
  }));

  const xPageFigures = index.crossPageFigures
    .filter((f) => f.page !== pageNumber)
    .slice(0, 20)
    .map((f) => ({
      block_id: f.block_id,
      page: f.page,
      type: f.type,
      text: truncate(f.text, 200),
    }));

  const recent = history.slice(-3).map((h) => h.text);
  const overlaySummary = activeOverlays.map((o) => ({ id: o.id, kind: o.kind }));

  return [
    `Current chunk: ${JSON.stringify(chunk)}`,
    `Current page: ${pageNumber}`,
    `Recent chunks: ${JSON.stringify(recent)}`,
    `Current camera: ${JSON.stringify(camera)}`,
    `Active overlays: ${JSON.stringify(overlaySummary)}`,
    '',
    `Page blocks: ${JSON.stringify(pageBlocks)}`,
    '',
    `Cross-page figures index: ${JSON.stringify(xPageFigures)}`,
    '',
    `Max steps: ${maxSteps}`,
    `Output JSON storyboard.`,
  ].join('\n');
}
```

- [ ] **Step 17.2:** Commit

```bash
pnpm --filter pdfjs-reader-core typecheck
git add packages/core/src/director/prompts.ts
git commit -m "feat(tutor): add LLM prompt builder"
```

---

### Task 18: Prompt builder tests

**Files:**
- Create: `packages/core/tests/director/prompts.test.ts`

- [ ] **Step 18.1:** Write tests

```ts
// packages/core/tests/director/prompts.test.ts
import { describe, it, expect } from 'vitest';
import { buildUserPrompt, SYSTEM_PROMPT, truncate } from '../../src/director/prompts';
import type { BBoxIndex, PageBBoxData } from '../../src/types/bbox';

function makePage(): PageBBoxData {
  return {
    id: '1',
    page_number: 1,
    page_text: '',
    page_dimensions: { width: 1756, height: 2269, dpi: 200 },
    blocks: [
      {
        block_id: 'p1_t0',
        bbox: [100, 100, 500, 200],
        text: 'Joints',
        type: 'heading',
        parent_id: null,
        confidence: 1,
        reading_order: 0,
        default_action: 'zoom_pan',
        semantic_unit_id: 'su_1',
      },
    ],
    created_at: '',
  };
}

function makeIndex(): BBoxIndex {
  const page = makePage();
  return {
    byPage: new Map([[1, page]]),
    blockById: new Map([['p1_t0', { block: page.blocks[0], pageNumber: 1 }]]),
    crossPageFigures: [
      { block_id: 'p2_i4', page: 2, type: 'figure', text: 'Diagram of long bone' },
      { block_id: 'p1_i2', page: 1, type: 'figure', text: 'Sagittal suture' },
    ],
  };
}

describe('prompt builder', () => {
  it('SYSTEM_PROMPT mentions the grammar rules', () => {
    expect(SYSTEM_PROMPT).toMatch(/camera/);
    expect(SYSTEM_PROMPT).toMatch(/spotlight/);
    expect(SYSTEM_PROMPT).toMatch(/default_action/);
  });

  it('truncate shortens text and appends ellipsis', () => {
    const t = 'a'.repeat(500);
    expect(truncate(t, 100).length).toBeLessThanOrEqual(101);
    expect(truncate(t, 100).endsWith('…')).toBe(true);
  });

  it('truncate returns empty string for null/undefined', () => {
    expect(truncate(null)).toBe('');
  });

  it('buildUserPrompt includes chunk, page, and page blocks JSON', () => {
    const prompt = buildUserPrompt({
      chunk: 'A joint is a junction.',
      pageNumber: 1,
      page: makePage(),
      index: makeIndex(),
      history: [],
      camera: { scale: 1, x: 0, y: 0, easing: 'ease-in-out' },
      activeOverlays: [],
    });
    expect(prompt).toMatch(/"A joint is a junction\."/);
    expect(prompt).toMatch(/Current page: 1/);
    expect(prompt).toMatch(/"p1_t0"/);
    expect(prompt).toMatch(/"default_action":"zoom_pan"/);
  });

  it('buildUserPrompt excludes current page from cross-page index', () => {
    const prompt = buildUserPrompt({
      chunk: '…',
      pageNumber: 1,
      page: makePage(),
      index: makeIndex(),
      history: [],
      camera: { scale: 1, x: 0, y: 0, easing: 'ease-in-out' },
      activeOverlays: [],
    });
    // cross-page index should contain the page-2 figure but NOT the page-1 one
    expect(prompt).toMatch(/"p2_i4"/);
    expect(prompt).not.toMatch(/"p1_i2"/);
  });

  it('buildUserPrompt takes only the last 3 history entries', () => {
    const prompt = buildUserPrompt({
      chunk: 'x',
      pageNumber: 1,
      page: makePage(),
      index: makeIndex(),
      history: [
        { text: 'one', pageNumber: 1, timestamp: 1 },
        { text: 'two', pageNumber: 1, timestamp: 2 },
        { text: 'three', pageNumber: 1, timestamp: 3 },
        { text: 'four', pageNumber: 1, timestamp: 4 },
      ],
      camera: { scale: 1, x: 0, y: 0, easing: 'ease-in-out' },
      activeOverlays: [],
    });
    expect(prompt).toMatch(/"two"/);
    expect(prompt).toMatch(/"four"/);
    expect(prompt).not.toMatch(/"one"/);
  });
});
```

- [ ] **Step 18.2:** Run tests + commit

```bash
pnpm --filter pdfjs-reader-core test tests/director/prompts.test.ts
git add packages/core/tests/director/prompts.test.ts
git commit -m "test(tutor): cover prompt builder"
```

---

### Task 19: SSE parser

**Files:**
- Create: `packages/core/src/director/sse-parser.ts`

- [ ] **Step 19.1:** Write the parser

```ts
// packages/core/src/director/sse-parser.ts

/**
 * Parses an OpenAI-style SSE stream (event-stream with data: ... lines).
 * Yields each JSON "delta" chunk as a parsed object. Ignores [DONE] markers.
 */
export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const rawLine = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!rawLine.startsWith('data:')) continue;
        const payload = rawLine.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          yield JSON.parse(payload);
        } catch {
          // malformed SSE payload — skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Extract the assistant-message content delta from an OpenAI-compatible chunk. */
export function extractDelta(chunk: unknown): string | null {
  if (!chunk || typeof chunk !== 'object') return null;
  const choices = (chunk as { choices?: Array<{ delta?: { content?: string } }> }).choices;
  if (!choices || !choices.length) return null;
  return choices[0].delta?.content ?? null;
}
```

- [ ] **Step 19.2:** Commit

```bash
pnpm --filter pdfjs-reader-core typecheck
git add packages/core/src/director/sse-parser.ts
git commit -m "feat(tutor): add OpenAI-compatible SSE parser"
```

---

### Task 20: SSE parser tests

**Files:**
- Create: `packages/core/tests/director/sse-parser.test.ts`

- [ ] **Step 20.1:** Write tests

```ts
// packages/core/tests/director/sse-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseSse, extractDelta } from '../../src/director/sse-parser';

function mockStream(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(enc.encode(chunks[i++]));
    },
  });
}

describe('parseSse', () => {
  it('yields parsed JSON for each data: line', async () => {
    const stream = mockStream([
      'data: {"id":"1","choices":[{"delta":{"content":"a"}}]}\n',
      'data: {"id":"1","choices":[{"delta":{"content":"b"}}]}\n',
      'data: [DONE]\n',
    ]);
    const collected: unknown[] = [];
    for await (const chunk of parseSse(stream)) collected.push(chunk);
    expect(collected).toHaveLength(2);
    expect(extractDelta(collected[0])).toBe('a');
    expect(extractDelta(collected[1])).toBe('b');
  });

  it('handles chunks split across reads', async () => {
    const stream = mockStream([
      'data: {"id":"1","choic',
      'es":[{"delta":{"content":"xy"}}]}\n',
    ]);
    const collected: unknown[] = [];
    for await (const chunk of parseSse(stream)) collected.push(chunk);
    expect(collected).toHaveLength(1);
    expect(extractDelta(collected[0])).toBe('xy');
  });

  it('skips malformed lines silently', async () => {
    const stream = mockStream([
      'data: {not json}\n',
      'data: {"id":"1","choices":[{"delta":{"content":"ok"}}]}\n',
    ]);
    const collected: unknown[] = [];
    for await (const chunk of parseSse(stream)) collected.push(chunk);
    expect(collected).toHaveLength(1);
    expect(extractDelta(collected[0])).toBe('ok');
  });

  it('extractDelta returns null for non-chunks', () => {
    expect(extractDelta(null)).toBeNull();
    expect(extractDelta({})).toBeNull();
    expect(extractDelta({ choices: [] })).toBeNull();
  });
});
```

- [ ] **Step 20.2:** Run + commit

```bash
pnpm --filter pdfjs-reader-core test tests/director/sse-parser.test.ts
git add packages/core/tests/director/sse-parser.test.ts
git commit -m "test(tutor): cover SSE parser"
```

---

### Task 21: LLM Director client

**Files:**
- Create: `packages/core/src/director/llm-director.ts`

- [ ] **Step 21.1:** Write the director

```ts
// packages/core/src/director/llm-director.ts
import { StoryboardSchema, storyboardJsonSchema } from './storyboard-schema';
import { SYSTEM_PROMPT, buildUserPrompt, type BuildUserPromptInput } from './prompts';
import { parseSse, extractDelta } from './sse-parser';
import type { Storyboard } from '../types/storyboard';

export interface LlmConfig {
  endpointUrl: string;
  model: string;
  authToken?: string;
  extraBody?: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
  /** If true, include response_format: json_schema (disable if the backend doesn't support it). */
  useJsonSchema?: boolean;
}

export interface DirectorInput extends BuildUserPromptInput {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface DirectorResult {
  storyboard: Storyboard | null;
  raw: string;
  error?: string;
}

/**
 * Call the LLM, stream the response, extract a JSON storyboard, validate with zod.
 * Returns { storyboard: null } with an error string on any failure path.
 */
export async function directStoryboard(
  config: LlmConfig,
  input: DirectorInput,
): Promise<DirectorResult> {
  const {
    endpointUrl, model, authToken, extraBody,
    maxTokens = 1024, temperature = 0.3, useJsonSchema = true,
  } = config;

  const userContent = buildUserPrompt(input);

  const body: Record<string, unknown> = {
    model,
    stream: true,
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    ...(extraBody ?? {}),
  };

  if (useJsonSchema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'storyboard',
        strict: true,
        schema: storyboardJsonSchema(),
      },
    };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), input.timeoutMs ?? 2500);
  const signal = mergeSignals(input.signal, timeoutController.signal);

  try {
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok || !response.body) {
      return { storyboard: null, raw: '', error: `HTTP ${response.status}` };
    }

    let raw = '';
    for await (const chunk of parseSse(response.body)) {
      const delta = extractDelta(chunk);
      if (delta) raw += delta;
    }

    const stripped = stripCodeFences(raw).trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped);
    } catch (e) {
      return { storyboard: null, raw, error: `parse error: ${(e as Error).message}` };
    }

    const validation = StoryboardSchema.safeParse(parsed);
    if (!validation.success) {
      return { storyboard: null, raw, error: `validation failed: ${validation.error.message}` };
    }
    return { storyboard: validation.data, raw };
  } catch (e) {
    const name = (e as Error).name;
    const msg = name === 'AbortError' ? 'aborted' : (e as Error).message;
    return { storyboard: null, raw: '', error: msg };
  } finally {
    clearTimeout(timer);
  }
}

function stripCodeFences(s: string): string {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  return m ? m[1] : s;
}

function mergeSignals(a?: AbortSignal, b?: AbortSignal): AbortSignal {
  if (!a) return b as AbortSignal;
  if (!b) return a;
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  a.addEventListener('abort', onAbort);
  b.addEventListener('abort', onAbort);
  return ctrl.signal;
}
```

- [ ] **Step 21.2:** Commit

```bash
pnpm --filter pdfjs-reader-core typecheck
git add packages/core/src/director/llm-director.ts
git commit -m "feat(tutor): add LLM Director (stream + validate)"
```

---

### Task 22: Director tests (mock fetch)

**Files:**
- Create: `packages/core/tests/director/llm-director.test.ts`

- [ ] **Step 22.1:** Write tests

```ts
// packages/core/tests/director/llm-director.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { directStoryboard } from '../../src/director/llm-director';
import type { BBoxIndex, PageBBoxData } from '../../src/types/bbox';

function makeIndex(): { page: PageBBoxData; index: BBoxIndex } {
  const page: PageBBoxData = {
    id: '1',
    page_number: 1,
    page_text: '',
    page_dimensions: { width: 1000, height: 1400, dpi: 200 },
    blocks: [
      {
        block_id: 'p1_t0', bbox: [100, 100, 500, 200], text: 'H', type: 'heading',
        parent_id: null, confidence: 1, reading_order: 0, default_action: 'zoom_pan', semantic_unit_id: 's1',
      },
    ],
    created_at: '',
  };
  return {
    page,
    index: {
      byPage: new Map([[1, page]]),
      blockById: new Map([['p1_t0', { block: page.blocks[0], pageNumber: 1 }]]),
      crossPageFigures: [],
    },
  };
}

function mockSseResponse(payload: string): Response {
  const events = payload
    .split('\n')
    .filter(Boolean)
    .map((line) => `data: ${JSON.stringify({ choices: [{ delta: { content: line + '\n' } }] })}\n`)
    .join('');
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(events + 'data: [DONE]\n'));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

describe('directStoryboard', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns a validated storyboard on valid JSON', async () => {
    const { page, index } = makeIndex();
    const payload = JSON.stringify({
      version: 1,
      reasoning: 'ok',
      steps: [{ at_ms: 0, duration_ms: 500, action: { type: 'spotlight', target_block: 'p1_t0', dim_opacity: 0.6, feather_px: 30, shape: 'rounded' } }],
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockSseResponse(payload));

    const result = await directStoryboard(
      { endpointUrl: 'https://x/y', model: 'test-model', useJsonSchema: false },
      {
        chunk: 'hi', pageNumber: 1, page, index,
        history: [], camera: { scale: 1, x: 0, y: 0, easing: 'ease-in-out' }, activeOverlays: [],
        timeoutMs: 5000,
      },
    );
    expect(result.storyboard).not.toBeNull();
    expect(result.storyboard!.steps).toHaveLength(1);
  });

  it('returns error on HTTP failure', async () => {
    const { page, index } = makeIndex();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 500 }));
    const result = await directStoryboard(
      { endpointUrl: 'https://x/y', model: 'm', useJsonSchema: false },
      {
        chunk: '', pageNumber: 1, page, index, history: [],
        camera: { scale: 1, x: 0, y: 0, easing: 'ease-in-out' }, activeOverlays: [],
        timeoutMs: 5000,
      },
    );
    expect(result.storyboard).toBeNull();
    expect(result.error).toMatch(/HTTP 500/);
  });

  it('returns error on malformed JSON', async () => {
    const { page, index } = makeIndex();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockSseResponse('not { json'));
    const result = await directStoryboard(
      { endpointUrl: 'https://x/y', model: 'm', useJsonSchema: false },
      {
        chunk: '', pageNumber: 1, page, index, history: [],
        camera: { scale: 1, x: 0, y: 0, easing: 'ease-in-out' }, activeOverlays: [],
        timeoutMs: 5000,
      },
    );
    expect(result.storyboard).toBeNull();
    expect(result.error).toMatch(/parse error/);
  });

  it('strips markdown code fences', async () => {
    const { page, index } = makeIndex();
    const sb = JSON.stringify({
      version: 1,
      reasoning: 'ok',
      steps: [{ at_ms: 0, duration_ms: 500, action: { type: 'spotlight', target_block: 'p1_t0', dim_opacity: 0.6, feather_px: 30, shape: 'rounded' } }],
    });
    const fenced = '```json\n' + sb + '\n```';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockSseResponse(fenced));
    const result = await directStoryboard(
      { endpointUrl: 'https://x/y', model: 'm', useJsonSchema: false },
      {
        chunk: '', pageNumber: 1, page, index, history: [],
        camera: { scale: 1, x: 0, y: 0, easing: 'ease-in-out' }, activeOverlays: [],
        timeoutMs: 5000,
      },
    );
    expect(result.storyboard).not.toBeNull();
  });
});
```

- [ ] **Step 22.2:** Run + commit

```bash
pnpm --filter pdfjs-reader-core test tests/director/llm-director.test.ts
git add packages/core/tests/director/llm-director.test.ts
git commit -m "test(tutor): cover LLM Director with mock fetch"
```

---

## Phase 7: Wire chunk → LLM → engine → visuals

### Task 23: TutorModeContainer chunk handling

**Files:**
- Modify: `packages/core/src/components/TutorMode/TutorModeContainer.tsx`

- [ ] **Step 23.1:** Extend the container with LLM config + chunk reactive pipeline

Replace the body of `TutorModeContainer.tsx` with:

```tsx
// packages/core/src/components/TutorMode/TutorModeContainer.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { PDFPage } from '../PDFPage/PDFPage';
import type { PageBBoxData, BBoxIndex } from '../../types/bbox';
import type { NarrationStoreApi } from '../../store/narration-store';
import { CameraView } from './CameraView';
import { CinemaLayer } from './CinemaLayer';
import { StoryboardEngine } from '../../director/storyboard-engine';
import { directStoryboard, type LlmConfig } from '../../director/llm-director';

export interface TutorModeContainerProps {
  pageNumber: number;
  bboxData: PageBBoxData[];
  narrationStore: NarrationStoreApi;
  scale: number;
  currentChunk?: string | null;
  llm?: LlmConfig;
  idleTimeoutMs?: number;
  className?: string;
}

export function buildBBoxIndex(bboxData: PageBBoxData[]): BBoxIndex {
  const byPage = new Map<number, PageBBoxData>();
  const blockById = new Map<string, { block: PageBBoxData['blocks'][number]; pageNumber: number }>();
  const crossPageFigures: BBoxIndex['crossPageFigures'] = [];

  for (const page of bboxData) {
    byPage.set(page.page_number, page);
    for (const block of page.blocks) {
      blockById.set(block.block_id, { block, pageNumber: page.page_number });
      if (
        (block.type === 'figure' || block.type === 'figure_region' || block.type === 'caption') &&
        typeof block.text === 'string' && block.text.length > 0
      ) {
        crossPageFigures.push({ block_id: block.block_id, page: page.page_number, type: block.type, text: block.text });
      }
    }
  }
  return { byPage, blockById, crossPageFigures };
}

export function TutorModeContainer({
  pageNumber, bboxData, narrationStore, scale,
  currentChunk, llm, idleTimeoutMs = 5000, className,
}: TutorModeContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const index = useMemo(() => buildBBoxIndex(bboxData), [bboxData]);
  const [viewport, setViewport] = useState({ width: 800, height: 1000 });

  // Subscribe to store via useStore for re-renders on state changes.
  const camera = useStore(narrationStore, (s) => s.camera);
  const activeOverlays = useStore(narrationStore, (s) => s.activeOverlays);

  // Track viewport size so camera math has real pixels.
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const update = () => setViewport({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Engine instance tied to bbox index.
  const engineRef = useRef<StoryboardEngine | null>(null);
  useEffect(() => {
    engineRef.current = new StoryboardEngine({
      narrationStore,
      bboxIndex: index,
      getViewport: () => viewport,
    });
    return () => engineRef.current?.cancelPending();
  }, [narrationStore, index, viewport]);

  // React to currentChunk: debounce → call LLM → engine.execute
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastChunkRef = useRef<string | null>(null);

  useEffect(() => {
    if (!llm) return;
    if (!currentChunk || currentChunk === lastChunkRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const chunk = currentChunk;
      if (chunk === lastChunkRef.current) return;
      lastChunkRef.current = chunk;

      const page = index.byPage.get(pageNumber);
      if (!page) return;

      narrationStore.getState().pushChunkHistory({ text: chunk, pageNumber, timestamp: Date.now() });

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      narrationStore.getState().setLlmStatus('in-flight');
      const result = await directStoryboard(llm, {
        chunk, pageNumber, page, index,
        history: narrationStore.getState().chunkHistory,
        camera: narrationStore.getState().camera,
        activeOverlays: narrationStore.getState().activeOverlays,
        signal: abortRef.current.signal,
      });

      if (result.storyboard) {
        narrationStore.getState().setLlmStatus('idle');
        engineRef.current?.execute(result.storyboard);
      } else {
        narrationStore.getState().setLlmStatus('failed', result.error ?? 'unknown');
        // Embedding fallback is added in Phase 9.
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [currentChunk, llm, index, pageNumber, narrationStore]);

  // Idle recovery
  useEffect(() => {
    if (!currentChunk) return;
    const t = setTimeout(() => {
      if (!engineRef.current) return;
      const latest = narrationStore.getState().chunkHistory.at(-1);
      if (!latest) return;
      if (Date.now() - latest.timestamp < idleTimeoutMs) return;
      engineRef.current.resetVisuals();
    }, idleTimeoutMs + 100);
    return () => clearTimeout(t);
  }, [currentChunk, idleTimeoutMs, narrationStore]);

  const page = index.byPage.get(pageNumber);
  if (!page) {
    return <div className={className} ref={containerRef} data-tutor-mode-missing-page={pageNumber} />;
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#111' }}
      data-role="tutor-mode-container"
    >
      <CameraView camera={camera}>
        <div
          style={{
            position: 'relative',
            width: page.page_dimensions.width * scale,
            height: page.page_dimensions.height * scale,
            margin: '0 auto',
          }}
        >
          <PDFPage
            pageNumber={pageNumber}
            scale={scale}
            showTextLayer={false}
            showHighlightLayer={false}
            showAnnotationLayer={false}
          />
          <CinemaLayer
            page={page}
            index={index}
            overlays={activeOverlays}
            scale={scale}
          />
        </div>
      </CameraView>
    </div>
  );
}
```

- [ ] **Step 23.2:** Build + commit

```bash
pnpm --filter pdfjs-reader-core build
git add packages/core/src/components/TutorMode/TutorModeContainer.tsx
git commit -m "feat(tutor): wire chunk prop → LLM director → engine"
```

---

### Task 24: End-to-end integration test (mock LLM)

**Files:**
- Create: `packages/core/tests/director/e2e.test.ts`

- [ ] **Step 24.1:** Write integration test

```ts
// packages/core/tests/director/e2e.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StoryboardEngine } from '../../src/director/storyboard-engine';
import { directStoryboard } from '../../src/director/llm-director';
import { createNarrationStore } from '../../src/store/narration-store';
import type { BBoxIndex, PageBBoxData } from '../../src/types/bbox';

function makePage(): PageBBoxData {
  return {
    id: '1', page_number: 1, page_text: '',
    page_dimensions: { width: 1000, height: 1400, dpi: 200 },
    blocks: [
      { block_id: 'p1_t0', bbox: [100, 100, 500, 200], text: 'H', type: 'heading',
        parent_id: null, confidence: 1, reading_order: 0, default_action: 'zoom_pan', semantic_unit_id: 's1' },
    ],
    created_at: '',
  };
}
function makeIndex(): BBoxIndex {
  const page = makePage();
  return {
    byPage: new Map([[1, page]]),
    blockById: new Map([['p1_t0', { block: page.blocks[0], pageNumber: 1 }]]),
    crossPageFigures: [],
  };
}

function mockSse(body: string): Response {
  const events = `data: ${JSON.stringify({ choices: [{ delta: { content: body } }] })}\ndata: [DONE]\n`;
  const stream = new ReadableStream({
    start(c) { c.enqueue(new TextEncoder().encode(events)); c.close(); },
  });
  return new Response(stream, { status: 200 });
}

describe('chunk → director → engine', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('a valid LLM response produces visible overlays', async () => {
    const store = createNarrationStore();
    const index = makeIndex();
    const engine = new StoryboardEngine({
      narrationStore: store, bboxIndex: index, getViewport: () => ({ width: 800, height: 1000 }),
    });

    const sb = JSON.stringify({
      version: 1,
      reasoning: 'e2e',
      steps: [
        { at_ms: 0, duration_ms: 500, action: { type: 'camera', target_block: 'p1_t0', scale: 1.3, padding: 60, easing: 'ease-out' } },
        { at_ms: 50, duration_ms: 1000, action: { type: 'spotlight', target_block: 'p1_t0', dim_opacity: 0.65, feather_px: 40, shape: 'rounded' } },
      ],
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockSse(sb));

    const page = index.byPage.get(1)!;
    const result = await directStoryboard(
      { endpointUrl: 'x', model: 'm', useJsonSchema: false },
      { chunk: 'hi', pageNumber: 1, page, index, history: [], camera: store.getState().camera, activeOverlays: [], timeoutMs: 5000 },
    );
    expect(result.storyboard).not.toBeNull();
    engine.execute(result.storyboard!);
    vi.advanceTimersByTime(50);
    expect(store.getState().activeOverlays.some((o) => o.kind === 'spotlight')).toBe(true);
  });
});
```

- [ ] **Step 24.2:** Run + commit

```bash
pnpm --filter pdfjs-reader-core test tests/director/e2e.test.ts
git add packages/core/tests/director/e2e.test.ts
git commit -m "test(tutor): end-to-end chunk → director → engine"
```

---

## Phase 8: Remaining primitives

**Shared patterns for every primitive in this phase:**
- Rendered in PDF coordinates (the parent `CinemaLayer` is pre-scaled; never multiply by `scale` inside).
- Use Framer Motion for entrance/exit; `AnimatePresence` (in `CinemaLayer`) handles mount/unmount.
- Props: the `ActiveOverlay.action` for that kind (typed narrowly) + the resolved bbox(es) + `page` dims + `durationMs`.

### Task 25: AnimatedUnderline

**Files:**
- Create: `packages/core/src/components/TutorMode/AnimatedUnderline.tsx`

- [ ] **Step 25.1:** Write the component

```tsx
// packages/core/src/components/TutorMode/AnimatedUnderline.tsx
import React from 'react';
import { motion } from 'framer-motion';
import type { ActionUnderline } from '../../types/storyboard';
import type { BBoxCoords } from '../../types/bbox';

export interface AnimatedUnderlineProps {
  bbox: BBoxCoords;
  action: ActionUnderline;
}

function pathForStyle(x1: number, x2: number, y: number, style: ActionUnderline['style']): string {
  if (style === 'straight') return `M ${x1} ${y} L ${x2} ${y}`;
  if (style === 'double') return `M ${x1} ${y - 3} L ${x2} ${y - 3} M ${x1} ${y + 3} L ${x2} ${y + 3}`;
  if (style === 'wavy') {
    const steps = Math.max(8, Math.floor((x2 - x1) / 18));
    let d = `M ${x1} ${y}`;
    for (let i = 1; i <= steps; i++) {
      const px = x1 + ((x2 - x1) * i) / steps;
      const dy = i % 2 === 0 ? 4 : -4;
      d += ` Q ${px - (x2 - x1) / (2 * steps)} ${y + dy} ${px} ${y}`;
    }
    return d;
  }
  // sketch: slight jitter
  const segs = 6;
  let d = `M ${x1} ${y}`;
  for (let i = 1; i <= segs; i++) {
    const px = x1 + ((x2 - x1) * i) / segs;
    const jitter = (Math.random() - 0.5) * 4;
    d += ` L ${px} ${y + jitter}`;
  }
  return d;
}

export function AnimatedUnderline({ bbox, action }: AnimatedUnderlineProps) {
  const [x1, , x2, y2] = bbox;
  const y = y2 + 6;
  const d = pathForStyle(x1, x2, y, action.style);
  const duration = action.draw_duration_ms / 1000;

  return (
    <svg
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
      data-role="underline"
    >
      <motion.path
        d={d}
        fill="none"
        stroke={action.color}
        strokeWidth={4}
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration, ease: 'easeOut' }}
      />
    </svg>
  );
}
```

- [ ] **Step 25.2:** Commit

```bash
pnpm --filter pdfjs-reader-core typecheck
git add packages/core/src/components/TutorMode/AnimatedUnderline.tsx
git commit -m "feat(tutor): add AnimatedUnderline (straight/sketch/double/wavy)"
```

---

### Task 26: Highlight (marker sweep)

**Files:**
- Create: `packages/core/src/components/TutorMode/Highlight.tsx`

- [ ] **Step 26.1:** Write the component

```tsx
// packages/core/src/components/TutorMode/Highlight.tsx
import React from 'react';
import { motion } from 'framer-motion';
import type { ActionHighlight } from '../../types/storyboard';
import type { BBoxCoords } from '../../types/bbox';

export interface HighlightProps {
  bbox: BBoxCoords;
  action: ActionHighlight;
}

export function Highlight({ bbox, action }: HighlightProps) {
  const [x1, y1, x2, y2] = bbox;
  const w = x2 - x1;
  const h = y2 - y1;
  return (
    <motion.div
      style={{
        position: 'absolute',
        left: x1, top: y1, height: h,
        background: action.color,
        borderRadius: 4,
        mixBlendMode: 'multiply',
        transformOrigin: '0% 50%',
        pointerEvents: 'none',
      }}
      initial={{ width: 0, opacity: 0.9 }}
      animate={{ width: w, opacity: 0.9 }}
      exit={{ opacity: 0 }}
      transition={{ duration: action.draw_duration_ms / 1000, ease: 'easeOut' }}
      data-role="highlight"
    />
  );
}
```

- [ ] **Step 26.2:** Commit

```bash
git add packages/core/src/components/TutorMode/Highlight.tsx
git commit -m "feat(tutor): add Highlight (marker sweep)"
```

---

### Task 27: PulseOverlay

**Files:**
- Create: `packages/core/src/components/TutorMode/PulseOverlay.tsx`

- [ ] **Step 27.1:** Write the component

```tsx
// packages/core/src/components/TutorMode/PulseOverlay.tsx
import React from 'react';
import { motion } from 'framer-motion';
import type { ActionPulse } from '../../types/storyboard';
import type { BBoxCoords } from '../../types/bbox';

export interface PulseOverlayProps {
  bbox: BBoxCoords;
  action: ActionPulse;
}

const INTENSITY = {
  subtle: { scale: 1.02, border: '2px solid rgba(59,130,246,0.6)' },
  normal: { scale: 1.05, border: '3px solid rgba(59,130,246,0.8)' },
  strong: { scale: 1.10, border: '4px solid rgba(59,130,246,1.0)' },
} as const;

export function PulseOverlay({ bbox, action }: PulseOverlayProps) {
  const [x1, y1, x2, y2] = bbox;
  const { scale, border } = INTENSITY[action.intensity];
  const keyframes = [1, scale, 1];
  const total = 1.2 * action.count;
  const repeat = action.count === 1 ? 0 : action.count - 1;

  return (
    <motion.div
      style={{
        position: 'absolute',
        left: x1, top: y1, width: x2 - x1, height: y2 - y1,
        border,
        borderRadius: 8,
        pointerEvents: 'none',
        boxSizing: 'border-box',
      }}
      animate={{ scale: keyframes }}
      transition={{
        duration: 1.2,
        times: [0, 0.5, 1],
        ease: 'easeInOut',
        repeat,
        repeatType: 'loop',
      }}
      exit={{ opacity: 0 }}
      data-role="pulse"
      data-total-duration={total}
    />
  );
}
```

- [ ] **Step 27.2:** Commit

```bash
git add packages/core/src/components/TutorMode/PulseOverlay.tsx
git commit -m "feat(tutor): add PulseOverlay (rhythmic scale)"
```

---

### Task 28: CalloutArrow

**Files:**
- Create: `packages/core/src/components/TutorMode/CalloutArrow.tsx`

- [ ] **Step 28.1:** Write the component

```tsx
// packages/core/src/components/TutorMode/CalloutArrow.tsx
import React from 'react';
import { motion } from 'framer-motion';
import type { ActionCallout } from '../../types/storyboard';
import type { BBoxCoords } from '../../types/bbox';

export interface CalloutArrowProps {
  fromBbox: BBoxCoords;
  toBbox: BBoxCoords;
  action: ActionCallout;
}

function centerOf(b: BBoxCoords) {
  return { x: (b[0] + b[2]) / 2, y: (b[1] + b[3]) / 2 };
}

function arrowPath(fromBbox: BBoxCoords, toBbox: BBoxCoords, curve: ActionCallout['curve']): string {
  const a = centerOf(fromBbox);
  const b = centerOf(toBbox);
  if (curve === 'straight') return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  if (curve === 'zigzag') {
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    return `M ${a.x} ${a.y} L ${mx} ${a.y} L ${mx} ${b.y} L ${b.x} ${b.y}`;
  }
  // curved
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const cx = (a.x + b.x) / 2 - dy * 0.25;
  const cy = (a.y + b.y) / 2 + dx * 0.25;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

export function CalloutArrow({ fromBbox, toBbox, action }: CalloutArrowProps) {
  const d = arrowPath(fromBbox, toBbox, action.curve);
  const label = action.label;
  const target = centerOf(toBbox);

  return (
    <svg
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
      data-role="callout"
    >
      <defs>
        <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#3B82F6" />
        </marker>
      </defs>
      <motion.path
        d={d}
        fill="none"
        stroke="#3B82F6"
        strokeWidth={3}
        strokeLinecap="round"
        markerEnd="url(#arrowhead)"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
      {label ? (
        <motion.g
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
        >
          <rect
            x={target.x - 4}
            y={target.y - 28}
            width={label.length * 9 + 12}
            height={22}
            rx={4}
            fill="#1F2937"
          />
          <text x={target.x + 2} y={target.y - 12} fill="white" fontSize={14} fontFamily="system-ui, sans-serif">
            {label}
          </text>
        </motion.g>
      ) : null}
    </svg>
  );
}
```

- [ ] **Step 28.2:** Commit

```bash
git add packages/core/src/components/TutorMode/CalloutArrow.tsx
git commit -m "feat(tutor): add CalloutArrow (SVG arrow + label)"
```

---

### Task 29: GhostReference

**Files:**
- Create: `packages/core/src/components/TutorMode/GhostReference.tsx`

- [ ] **Step 29.1:** Write the component

```tsx
// packages/core/src/components/TutorMode/GhostReference.tsx
import React from 'react';
import { motion } from 'framer-motion';
import type { ActionGhostReference } from '../../types/storyboard';
import type { BBoxCoords, PageDimensionsDpi } from '../../types/bbox';

export interface GhostReferenceProps {
  page: PageDimensionsDpi;
  sourceBbox: BBoxCoords;
  sourceBlockText: string | null;
  sourcePageNumber: number;
  action: ActionGhostReference;
}

const POSITIONS: Record<ActionGhostReference['position'], React.CSSProperties> = {
  'top-right':    { top: 40,                      right: 40 },
  'top-left':     { top: 40,                      left: 40 },
  'bottom-right': { bottom: 40,                   right: 40 },
  'bottom-left':  { bottom: 40,                   left: 40 },
};

/**
 * Renders a floating "ghost" card referencing a block from another page.
 * We don't rasterize the other page — we show its bounding-box outline + text
 * description (from the bbox's text field).
 */
export function GhostReference({
  page, sourceBbox, sourceBlockText, sourcePageNumber, action,
}: GhostReferenceProps) {
  const width = 360;
  const height = 240;

  // Mini-map of the source page with the source bbox highlighted.
  const [x1, y1, x2, y2] = sourceBbox;
  const miniScale = Math.min(width / page.width, (height - 80) / page.height);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        width,
        background: '#111',
        color: 'white',
        borderRadius: 12,
        padding: 12,
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        pointerEvents: 'none',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        ...POSITIONS[action.position],
      }}
      data-role="ghost-reference"
    >
      <div style={{ opacity: 0.7, fontSize: 11, marginBottom: 6 }}>
        Page {sourcePageNumber} — {action.target_block}
      </div>
      <svg
        width={width - 24}
        height={height - 80}
        viewBox={`0 0 ${page.width} ${page.height}`}
        style={{ background: '#1F2937', borderRadius: 6 }}
      >
        <rect x={0} y={0} width={page.width} height={page.height} fill="#1F2937" />
        <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} fill="rgba(250,204,21,0.45)" stroke="#FBBF24" strokeWidth={8} />
      </svg>
      <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.4, opacity: 0.9 }}>
        {sourceBlockText ?? '(figure)'}
      </div>
      <div style={{ position: 'absolute', top: -1, left: -1, right: -1, bottom: -1, borderRadius: 12, border: '1px solid rgba(250,204,21,0.3)', pointerEvents: 'none' }} />
    </motion.div>
  );
}
```

- [ ] **Step 29.2:** Commit

```bash
git add packages/core/src/components/TutorMode/GhostReference.tsx
git commit -m "feat(tutor): add GhostReference (cross-page floating card)"
```

---

### Task 30: BoxOverlay

**Files:**
- Create: `packages/core/src/components/TutorMode/BoxOverlay.tsx`

- [ ] **Step 30.1:** Write the component

```tsx
// packages/core/src/components/TutorMode/BoxOverlay.tsx
import React from 'react';
import { motion } from 'framer-motion';
import type { ActionBox } from '../../types/storyboard';
import type { BBoxCoords } from '../../types/bbox';

export interface BoxOverlayProps {
  bbox: BBoxCoords;
  action: ActionBox;
}

export function BoxOverlay({ bbox, action }: BoxOverlayProps) {
  const [x1, y1, x2, y2] = bbox;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        left: x1, top: y1, width: x2 - x1, height: y2 - y1,
        border: `${action.style === 'dashed' ? '3px dashed' : '3px solid'} ${action.color}`,
        borderRadius: 6,
        pointerEvents: 'none',
        boxSizing: 'border-box',
      }}
      data-role="box"
    />
  );
}
```

- [ ] **Step 30.2:** Commit

```bash
git add packages/core/src/components/TutorMode/BoxOverlay.tsx
git commit -m "feat(tutor): add BoxOverlay"
```

---

### Task 31: StickyLabel

**Files:**
- Create: `packages/core/src/components/TutorMode/StickyLabel.tsx`

- [ ] **Step 31.1:** Write the component

```tsx
// packages/core/src/components/TutorMode/StickyLabel.tsx
import React from 'react';
import { motion } from 'framer-motion';
import type { ActionLabel } from '../../types/storyboard';
import type { BBoxCoords } from '../../types/bbox';

export interface StickyLabelProps {
  bbox: BBoxCoords;
  action: ActionLabel;
}

function position(bbox: BBoxCoords, where: ActionLabel['position']): React.CSSProperties {
  const [x1, y1, x2, y2] = bbox;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const w = x2 - x1;
  const h = y2 - y1;
  const PAD = 16;
  switch (where) {
    case 'top':    return { left: cx, top: y1 - PAD, transform: 'translate(-50%, -100%)' };
    case 'bottom': return { left: cx, top: y2 + PAD, transform: 'translate(-50%, 0)' };
    case 'left':   return { left: x1 - PAD, top: cy, transform: 'translate(-100%, -50%)' };
    case 'right':  return { left: x2 + PAD, top: cy, transform: 'translate(0, -50%)' };
    default:       return { left: cx, top: y1, transform: `translate(-50%, -${h + PAD}px)` };
  }
}

export function StickyLabel({ bbox, action }: StickyLabelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        padding: '6px 10px',
        background: '#FEF3C7',
        color: '#78350F',
        borderRadius: 6,
        boxShadow: '0 3px 10px rgba(0,0,0,0.2)',
        fontSize: 14,
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 280,
        pointerEvents: 'none',
        ...position(bbox, action.position),
      }}
      data-role="label"
    >
      {action.text}
    </motion.div>
  );
}
```

- [ ] **Step 31.2:** Commit

```bash
git add packages/core/src/components/TutorMode/StickyLabel.tsx
git commit -m "feat(tutor): add StickyLabel"
```

---

### Task 32: Full CinemaLayer composition

**Files:**
- Modify: `packages/core/src/components/TutorMode/CinemaLayer.tsx`
- Modify: `packages/core/src/components/TutorMode/index.ts`

- [ ] **Step 32.1:** Replace CinemaLayer with the full composer

```tsx
// packages/core/src/components/TutorMode/CinemaLayer.tsx
'use client';

import React from 'react';
import { AnimatePresence } from 'framer-motion';
import type {
  ActiveOverlay,
  ActionSpotlight, ActionUnderline, ActionHighlight, ActionPulse,
  ActionCallout, ActionGhostReference, ActionBox, ActionLabel,
} from '../../types/storyboard';
import type { PageBBoxData, BBoxIndex, BBoxCoords } from '../../types/bbox';
import { SpotlightMask } from './SpotlightMask';
import { AnimatedUnderline } from './AnimatedUnderline';
import { Highlight } from './Highlight';
import { PulseOverlay } from './PulseOverlay';
import { CalloutArrow } from './CalloutArrow';
import { GhostReference } from './GhostReference';
import { BoxOverlay } from './BoxOverlay';
import { StickyLabel } from './StickyLabel';

export interface CinemaLayerProps {
  page: PageBBoxData;
  index: BBoxIndex;
  overlays: ActiveOverlay[];
  scale: number;
}

function blockBbox(index: BBoxIndex, block_id: string): BBoxCoords | undefined {
  return index.blockById.get(block_id)?.block.bbox;
}

export function CinemaLayer({ page, index, overlays, scale }: CinemaLayerProps) {
  return (
    <div
      data-role="cinema-layer"
      style={{
        position: 'absolute',
        inset: 0,
        transformOrigin: '0 0',
        transform: `scale(${scale})`,
        width: page.page_dimensions.width,
        height: page.page_dimensions.height,
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence>
        {overlays.map((overlay) => {
          switch (overlay.kind) {
            case 'spotlight': {
              const a = overlay.action as ActionSpotlight;
              const b = blockBbox(index, a.target_block);
              if (!b) return null;
              return <SpotlightMask key={overlay.id} page={page.page_dimensions} bbox={b} action={a} />;
            }
            case 'underline': {
              const a = overlay.action as ActionUnderline;
              const b = blockBbox(index, a.target_block);
              if (!b) return null;
              return <AnimatedUnderline key={overlay.id} bbox={b} action={a} />;
            }
            case 'highlight': {
              const a = overlay.action as ActionHighlight;
              const b = blockBbox(index, a.target_block);
              if (!b) return null;
              return <Highlight key={overlay.id} bbox={b} action={a} />;
            }
            case 'pulse': {
              const a = overlay.action as ActionPulse;
              const b = blockBbox(index, a.target_block);
              if (!b) return null;
              return <PulseOverlay key={overlay.id} bbox={b} action={a} />;
            }
            case 'callout': {
              const a = overlay.action as ActionCallout;
              const from = blockBbox(index, a.from_block);
              const to = blockBbox(index, a.to_block);
              if (!from || !to) return null;
              return <CalloutArrow key={overlay.id} fromBbox={from} toBbox={to} action={a} />;
            }
            case 'ghost_reference': {
              const a = overlay.action as ActionGhostReference;
              const hit = index.blockById.get(a.target_block);
              if (!hit) return null;
              const targetPage = index.byPage.get(a.target_page);
              if (!targetPage) return null;
              return (
                <GhostReference
                  key={overlay.id}
                  page={targetPage.page_dimensions}
                  sourceBbox={hit.block.bbox}
                  sourceBlockText={hit.block.text}
                  sourcePageNumber={hit.pageNumber}
                  action={a}
                />
              );
            }
            case 'box': {
              const a = overlay.action as ActionBox;
              const b = blockBbox(index, a.target_block);
              if (!b) return null;
              return <BoxOverlay key={overlay.id} bbox={b} action={a} />;
            }
            case 'label': {
              const a = overlay.action as ActionLabel;
              const b = blockBbox(index, a.target_block);
              if (!b) return null;
              return <StickyLabel key={overlay.id} bbox={b} action={a} />;
            }
            case 'clear':
            case 'camera':
              return null; // handled by engine, not rendered as overlays
          }
        })}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 32.2:** Update the TutorMode barrel

Overwrite `packages/core/src/components/TutorMode/index.ts`:
```ts
export { TutorModeContainer, buildBBoxIndex, type TutorModeContainerProps } from './TutorModeContainer';
export { CinemaLayer, type CinemaLayerProps } from './CinemaLayer';
export { CameraView, type CameraViewProps } from './CameraView';
export { SpotlightMask, type SpotlightMaskProps } from './SpotlightMask';
export { AnimatedUnderline, type AnimatedUnderlineProps } from './AnimatedUnderline';
export { Highlight, type HighlightProps } from './Highlight';
export { PulseOverlay, type PulseOverlayProps } from './PulseOverlay';
export { CalloutArrow, type CalloutArrowProps } from './CalloutArrow';
export { GhostReference, type GhostReferenceProps } from './GhostReference';
export { BoxOverlay, type BoxOverlayProps } from './BoxOverlay';
export { StickyLabel, type StickyLabelProps } from './StickyLabel';
```

- [ ] **Step 32.3:** Build + commit

```bash
pnpm --filter pdfjs-reader-core build
git add packages/core/src/components/TutorMode
git commit -m "feat(tutor): compose all primitives in CinemaLayer"
```

---

### Task 33: SpotlightMask render test (sanity)

**Files:**
- Create: `packages/core/tests/components/SpotlightMask.test.tsx`

- [ ] **Step 33.1:** Write a render test

```tsx
// packages/core/tests/components/SpotlightMask.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { SpotlightMask } from '../../src/components/TutorMode/SpotlightMask';

describe('SpotlightMask', () => {
  it('renders an SVG with the expected data-role', () => {
    const { container } = render(
      <SpotlightMask
        page={{ width: 1000, height: 1400, dpi: 200 }}
        bbox={[100, 100, 500, 200]}
        action={{ type: 'spotlight', target_block: 'p1', dim_opacity: 0.65, feather_px: 40, shape: 'rounded' }}
      />,
    );
    const svg = container.querySelector('[data-role="spotlight-mask"]');
    expect(svg).not.toBeNull();
    expect(svg!.tagName.toLowerCase()).toBe('svg');
  });
});
```

- [ ] **Step 33.2:** Run + commit

```bash
pnpm --filter pdfjs-reader-core test tests/components/SpotlightMask.test.tsx
git add packages/core/tests/components
git commit -m "test(tutor): render sanity for SpotlightMask"
```

---

## Phase 9: Embedding fallback

### Task 34: Similarity scoring (pure function)

**Files:**
- Create: `packages/core/src/director/embedding-fallback.ts`

- [ ] **Step 34.1:** Write the utility (similarity only — provider abstraction at Step 34.2)

```ts
// packages/core/src/director/embedding-fallback.ts
import type { PageBBoxData, Block } from '../types/bbox';
import type { Storyboard } from '../types/storyboard';

export interface EmbeddingProvider {
  /** Return embeddings (normalized or raw — similarity function handles either). */
  embed: (texts: string[]) => Promise<Float32Array[]>;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export interface BlockMatch {
  block: Block;
  score: number;
}

export async function matchChunkToBlock(
  chunk: string,
  page: PageBBoxData,
  provider: EmbeddingProvider,
): Promise<BlockMatch | null> {
  const textBlocks = page.blocks.filter((b) => typeof b.text === 'string' && b.text.trim().length > 0);
  if (textBlocks.length === 0) return null;
  const inputs = [chunk, ...textBlocks.map((b) => b.text as string)];
  const embeds = await provider.embed(inputs);
  if (embeds.length < 2) return null;
  const chunkEmbed = embeds[0];
  let best: BlockMatch | null = null;
  for (let i = 0; i < textBlocks.length; i++) {
    const score = cosineSimilarity(chunkEmbed, embeds[i + 1]);
    if (!best || score > best.score) best = { block: textBlocks[i], score };
  }
  return best;
}

/**
 * Build a minimal safe storyboard from a matched block + its default_action.
 * Never fails — emits a plain camera-only storyboard if no match.
 */
export function storyboardFromMatch(
  match: BlockMatch | null,
): Storyboard {
  if (!match) {
    return {
      version: 1,
      reasoning: 'fallback: no match — fit to page',
      steps: [
        { at_ms: 0, duration_ms: 800, action: { type: 'clear', targets: 'overlays' } },
      ],
    };
  }
  const { block } = match;
  const camera = {
    type: 'camera' as const,
    target_block: block.block_id,
    scale: 1.5,
    padding: 60,
    easing: 'ease-out' as const,
  };

  const defaultAction = block.default_action;
  let second: Storyboard['steps'][0]['action'];
  switch (defaultAction) {
    case 'spotlight':
      second = { type: 'spotlight', target_block: block.block_id, dim_opacity: 0.65, feather_px: 40, shape: 'rounded' };
      break;
    case 'underline':
      second = { type: 'underline', target_block: block.block_id, color: '#FBBF24', style: 'sketch', draw_duration_ms: 600 };
      break;
    case 'pulse':
      second = { type: 'pulse', target_block: block.block_id, count: 2, intensity: 'normal' };
      break;
    case 'zoom_pan':
    default:
      second = { type: 'box', target_block: block.block_id, color: '#3B82F6', style: 'solid' };
  }

  return {
    version: 1,
    reasoning: `fallback: matched ${block.block_id} (${match.score.toFixed(2)})`,
    steps: [
      { at_ms: 0, duration_ms: 700, action: camera },
      { at_ms: 300, duration_ms: 1200, action: second },
    ],
  };
}
```

- [ ] **Step 34.2:** Commit

```bash
pnpm --filter pdfjs-reader-core typecheck
git add packages/core/src/director/embedding-fallback.ts
git commit -m "feat(tutor): add embedding-fallback (similarity + minimal storyboard)"
```

---

### Task 35: Embedding fallback tests

**Files:**
- Create: `packages/core/tests/director/embedding-fallback.test.ts`

- [ ] **Step 35.1:** Write tests

```ts
// packages/core/tests/director/embedding-fallback.test.ts
import { describe, it, expect } from 'vitest';
import { cosineSimilarity, matchChunkToBlock, storyboardFromMatch } from '../../src/director/embedding-fallback';
import type { PageBBoxData } from '../../src/types/bbox';

const page: PageBBoxData = {
  id: '1', page_number: 1, page_text: '',
  page_dimensions: { width: 1000, height: 1400, dpi: 200 },
  blocks: [
    { block_id: 'b1', bbox: [0, 0, 100, 100], text: 'Definition of joints', type: 'paragraph',
      parent_id: null, confidence: 1, reading_order: 0, default_action: 'spotlight', semantic_unit_id: 's' },
    { block_id: 'b2', bbox: [0, 200, 100, 300], text: 'Classification list', type: 'list_item',
      parent_id: null, confidence: 1, reading_order: 1, default_action: 'underline', semantic_unit_id: 's' },
  ],
  created_at: '',
};

describe('embedding-fallback', () => {
  it('cosineSimilarity is 1 for equal vectors', () => {
    const v = new Float32Array([0.1, 0.2, 0.3]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it('cosineSimilarity is 0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('matchChunkToBlock picks the block closest to the chunk', async () => {
    // Stub provider where chunk shares vector with the first block
    const provider = {
      embed: async (texts: string[]) => {
        const vecs: Float32Array[] = [];
        for (const t of texts) {
          if (/Definition/i.test(t) || /what is a joint/i.test(t)) {
            vecs.push(new Float32Array([1, 0, 0]));
          } else if (/Classification/i.test(t)) {
            vecs.push(new Float32Array([0, 1, 0]));
          } else {
            vecs.push(new Float32Array([1, 0, 0])); // default align with definition
          }
        }
        return vecs;
      },
    };
    const match = await matchChunkToBlock('what is a joint?', page, provider);
    expect(match).not.toBeNull();
    expect(match!.block.block_id).toBe('b1');
  });

  it('storyboardFromMatch uses the block default_action', () => {
    const match = {
      block: page.blocks[1],
      score: 0.9,
    };
    const sb = storyboardFromMatch(match);
    expect(sb.steps).toHaveLength(2);
    expect(sb.steps[0].action.type).toBe('camera');
    expect(sb.steps[1].action.type).toBe('underline');
  });

  it('storyboardFromMatch returns clear-only when no match', () => {
    const sb = storyboardFromMatch(null);
    expect(sb.steps).toHaveLength(1);
    expect(sb.steps[0].action.type).toBe('clear');
  });
});
```

- [ ] **Step 35.2:** Run + commit

```bash
pnpm --filter pdfjs-reader-core test tests/director/embedding-fallback.test.ts
git add packages/core/tests/director/embedding-fallback.test.ts
git commit -m "test(tutor): cover embedding fallback"
```

---

### Task 36: Wire fallback into the director pipeline

**Files:**
- Modify: `packages/core/src/components/TutorMode/TutorModeContainer.tsx`
- Create: `packages/core/src/director/transformers-embedding.ts`

- [ ] **Step 36.1:** Add a lazy transformers.js-based provider (opt-in)

```ts
// packages/core/src/director/transformers-embedding.ts
import type { EmbeddingProvider } from './embedding-fallback';

let loaded: Promise<EmbeddingProvider> | null = null;

/**
 * Lazily load a local MiniLM model (only on first call). The dynamic import
 * keeps `@xenova/transformers` out of the main bundle unless used.
 */
export function getLocalMiniLM(): Promise<EmbeddingProvider> {
  if (loaded) return loaded;
  loaded = (async (): Promise<EmbeddingProvider> => {
    const mod = await import('@xenova/transformers');
    const { pipeline } = mod;
    const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    return {
      async embed(texts: string[]) {
        const out: Float32Array[] = [];
        for (const t of texts) {
          const result = await extractor(t, { pooling: 'mean', normalize: true });
          out.push(new Float32Array((result.data as Float32Array).slice()));
        }
        return out;
      },
    };
  })();
  return loaded;
}
```

- [ ] **Step 36.2:** Extend TutorModeContainer props + fallback trigger

At the top of `TutorModeContainer.tsx`, add:
```ts
import { matchChunkToBlock, storyboardFromMatch, type EmbeddingProvider } from '../../director/embedding-fallback';
```

Extend `TutorModeContainerProps`:
```ts
export interface TutorModeContainerProps {
  pageNumber: number;
  bboxData: PageBBoxData[];
  narrationStore: NarrationStoreApi;
  scale: number;
  currentChunk?: string | null;
  llm?: LlmConfig;
  idleTimeoutMs?: number;
  /** Provide to enable embedding fallback when the LLM fails. */
  embeddingProvider?: EmbeddingProvider;
  className?: string;
}
```

In the effect that processes `currentChunk`, replace the failure branch:
```ts
if (result.storyboard) {
  narrationStore.getState().setLlmStatus('idle');
  engineRef.current?.execute(result.storyboard);
} else {
  narrationStore.getState().setLlmStatus('failed', result.error ?? 'unknown');
  if (embeddingProvider) {
    const match = await matchChunkToBlock(chunk, page, embeddingProvider);
    const fallbackSb = storyboardFromMatch(match);
    engineRef.current?.execute(fallbackSb);
  }
}
```

Update the effect's dependency list to include `embeddingProvider`.

- [ ] **Step 36.3:** Add the director/store exports to the top-level barrel

Append to `packages/core/src/index.ts`:
```ts
export { directStoryboard, type LlmConfig, type DirectorInput, type DirectorResult } from './director/llm-director';
export { StoryboardEngine } from './director/storyboard-engine';
export { buildUserPrompt, SYSTEM_PROMPT } from './director/prompts';
export { StoryboardSchema, StoryboardActionSchema, storyboardJsonSchema } from './director/storyboard-schema';
export { matchChunkToBlock, storyboardFromMatch, cosineSimilarity, type EmbeddingProvider, type BlockMatch } from './director/embedding-fallback';
export { getLocalMiniLM } from './director/transformers-embedding';
```

Build + commit:
```bash
pnpm --filter pdfjs-reader-core build
git add packages/core/src
git commit -m "feat(tutor): wire embedding fallback; add local MiniLM provider"
```

---

## Phase 10: Dev playground

### Task 37: Playground page shell

**Files:**
- Create: `apps/demo/src/app/tutor/page.tsx`
- Create: `apps/demo/src/app/tutor/fixtures/joints-bbox.ts`
- Create: `apps/demo/.env.example`

- [ ] **Step 37.1:** Create the fixtures file

Copy the BBox data from the design spec's brief (7 pages of the Joints chapter) into:
```ts
// apps/demo/src/app/tutor/fixtures/joints-bbox.ts
import type { PageBBoxData } from '@pdf-reader/core';

export const JOINTS_BBOX: PageBBoxData[] = [
  // Page 1 … (paste the full array from the spec's brief here)
];
```

Paste the actual JSON array from the brief under `ARGUMENTS:` — do NOT re-derive the data. Save.

- [ ] **Step 37.2:** Create `.env.example`

```
# apps/demo/.env.example
NEXT_PUBLIC_LLM_ENDPOINT=https://your-llm-endpoint/v1/chat/completions
NEXT_PUBLIC_LLM_MODEL=your-model-name
# Optional:
# NEXT_PUBLIC_LLM_TOKEN=your-auth-token
# NEXT_PUBLIC_LLM_EXTRA_BODY={"chat_template_kwargs":{"enable_thinking":false}}
# NEXT_PUBLIC_PDF_URL=https://example.com/joints.pdf
```

- [ ] **Step 37.3:** Create the page

```tsx
// apps/demo/src/app/tutor/page.tsx
'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  PDFViewerProvider,
  TutorModeContainer,
  createNarrationStore,
  loadDocumentWithCallbacks,
  useViewerStore,
  type NarrationStoreApi,
  type LlmConfig,
} from '@pdf-reader/core';
import { JOINTS_BBOX } from './fixtures/joints-bbox';
import { ChunkComposer } from './ChunkComposer';
import { LLMConfigPanel } from './LLMConfigPanel';
import { StoryboardLog } from './StoryboardLog';

export default function TutorPage() {
  const storeRef = useRef<NarrationStoreApi | null>(null);
  if (!storeRef.current) storeRef.current = createNarrationStore();
  const narrationStore = storeRef.current;

  const [currentChunk, setCurrentChunk] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [llm, setLlm] = useState<LlmConfig>(() => ({
    endpointUrl: process.env.NEXT_PUBLIC_LLM_ENDPOINT ?? '',
    model: process.env.NEXT_PUBLIC_LLM_MODEL ?? '',
    authToken: process.env.NEXT_PUBLIC_LLM_TOKEN,
    extraBody: process.env.NEXT_PUBLIC_LLM_EXTRA_BODY ? JSON.parse(process.env.NEXT_PUBLIC_LLM_EXTRA_BODY) : undefined,
    maxTokens: 1024,
    temperature: 0.3,
    useJsonSchema: true,
  }));

  const setDocument = useViewerStore((s) => s.setDocument);
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_PDF_URL;
    if (!url) return;
    const { promise, cancel } = loadDocumentWithCallbacks({
      src: url,
      onDocumentReady: (doc) => setDocument(doc),
      onFirstPageReady: () => {},
    });
    promise.catch(() => {});
    return () => cancel();
  }, [setDocument]);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <PDFViewerProvider>
          <TutorModeContainer
            pageNumber={currentPage}
            bboxData={JOINTS_BBOX}
            narrationStore={narrationStore}
            scale={0.4}
            currentChunk={currentChunk}
            llm={llm}
          />
        </PDFViewerProvider>
      </div>
      <div style={{ width: 420, borderLeft: '1px solid #333', overflowY: 'auto', background: '#0b0f1a', color: 'white' }}>
        <LLMConfigPanel llm={llm} onChange={setLlm} />
        <ChunkComposer
          bbox={JOINTS_BBOX}
          currentPage={currentPage}
          onChunk={setCurrentChunk}
          onPageChange={setCurrentPage}
        />
        <StoryboardLog narrationStore={narrationStore} />
      </div>
    </div>
  );
}
```

- [ ] **Step 37.4:** Commit

```bash
git add apps/demo/src/app/tutor apps/demo/.env.example
git commit -m "feat(demo): scaffold tutor playground page shell + fixtures"
```

---

### Task 38: ChunkComposer panel

**Files:**
- Create: `apps/demo/src/app/tutor/ChunkComposer.tsx`

- [ ] **Step 38.1:** Write the composer

```tsx
// apps/demo/src/app/tutor/ChunkComposer.tsx
'use client';

import React, { useState, useRef } from 'react';
import type { PageBBoxData } from '@pdf-reader/core';

const SCRIPTED_CHUNKS = [
  'A joint is a junction between two or more bones or cartilages.',
  'There are three structural classes of joints: fibrous, cartilaginous, and synovial.',
  'Fibrous joints include sutures, which are found only in the skull.',
  'See Fig 3.2 — the primary cartilaginous joint between epiphysis and diaphysis.',
  'Amphiarthroses are slightly movable joints, like the intervertebral discs.',
  'Diarthroses are freely movable synovial joints, the most evolved kind.',
  'Notice the sagittal suture on the skull — it dovetails two bones together.',
];

export interface ChunkComposerProps {
  bbox: PageBBoxData[];
  currentPage: number;
  onChunk: (text: string | null) => void;
  onPageChange: (page: number) => void;
}

export function ChunkComposer({ bbox, currentPage, onChunk, onPageChange }: ChunkComposerProps) {
  const [text, setText] = useState('');
  const [rate, setRate] = useState(8); // chunks per minute
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [playing, setPlaying] = useState(false);

  function send() {
    if (!text.trim()) return;
    onChunk(text);
  }

  function sendScripted(chunk: string) {
    setText(chunk);
    onChunk(chunk);
  }

  function toggleAutoplay() {
    if (playing) {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
      autoplayRef.current = null;
      setPlaying(false);
      return;
    }
    let i = 0;
    autoplayRef.current = setInterval(() => {
      const next = SCRIPTED_CHUNKS[i % SCRIPTED_CHUNKS.length];
      onChunk(next);
      setText(next);
      i += 1;
    }, Math.max(1000, (60 / rate) * 1000));
    setPlaying(true);
  }

  return (
    <div style={{ padding: 16, borderBottom: '1px solid #333' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ fontSize: 14, margin: 0 }}>Chunk composer</h3>
        <div>
          <button onClick={() => onPageChange(Math.max(1, currentPage - 1))}>◀</button>
          <span style={{ margin: '0 8px' }}>page {currentPage}/{bbox.length}</span>
          <button onClick={() => onPageChange(Math.min(bbox.length, currentPage + 1))}>▶</button>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a chunk to send"
        style={{ width: '100%', minHeight: 70, background: '#0b0f1a', color: 'white', border: '1px solid #444', padding: 8, borderRadius: 4, fontSize: 12 }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={send}>Send</button>
        <button onClick={() => { setText(''); onChunk(null); }}>Clear</button>
      </div>
      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: 12 }}>Autoplay rate: {rate} chunks/min</label>
        <input type="range" min={1} max={30} value={rate} onChange={(e) => setRate(Number(e.target.value))} style={{ width: '100%' }} />
        <button onClick={toggleAutoplay} style={{ marginTop: 4 }}>{playing ? 'Stop autoplay' : 'Start autoplay'}</button>
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4 }}>Scripted chunks:</div>
        {SCRIPTED_CHUNKS.map((c, i) => (
          <div
            key={i}
            onClick={() => sendScripted(c)}
            style={{ cursor: 'pointer', padding: '4px 8px', fontSize: 12, background: '#1a1e2e', borderRadius: 4, marginBottom: 4 }}
          >
            {c}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 38.2:** Commit

```bash
git add apps/demo/src/app/tutor/ChunkComposer.tsx
git commit -m "feat(demo): add ChunkComposer (free-form + scripted + autoplay)"
```

---

### Task 39: LLMConfigPanel

**Files:**
- Create: `apps/demo/src/app/tutor/LLMConfigPanel.tsx`

- [ ] **Step 39.1:** Write the panel

```tsx
// apps/demo/src/app/tutor/LLMConfigPanel.tsx
'use client';

import React from 'react';
import type { LlmConfig } from '@pdf-reader/core';

export interface LLMConfigPanelProps {
  llm: LlmConfig;
  onChange: (llm: LlmConfig) => void;
}

export function LLMConfigPanel({ llm, onChange }: LLMConfigPanelProps) {
  const set = (patch: Partial<LlmConfig>) => onChange({ ...llm, ...patch });
  return (
    <div style={{ padding: 16, borderBottom: '1px solid #333' }}>
      <h3 style={{ fontSize: 14, margin: 0, marginBottom: 8 }}>LLM config</h3>
      <label style={{ fontSize: 11, opacity: 0.7 }}>Endpoint</label>
      <input
        value={llm.endpointUrl}
        onChange={(e) => set({ endpointUrl: e.target.value })}
        style={{ width: '100%', marginBottom: 8, padding: 4, background: '#0b0f1a', color: 'white', border: '1px solid #444', fontSize: 12 }}
      />
      <label style={{ fontSize: 11, opacity: 0.7 }}>Model</label>
      <input
        value={llm.model}
        onChange={(e) => set({ model: e.target.value })}
        style={{ width: '100%', marginBottom: 8, padding: 4, background: '#0b0f1a', color: 'white', border: '1px solid #444', fontSize: 12 }}
      />
      <label style={{ fontSize: 11, opacity: 0.7 }}>Auth token (optional)</label>
      <input
        value={llm.authToken ?? ''}
        onChange={(e) => set({ authToken: e.target.value || undefined })}
        type="password"
        style={{ width: '100%', marginBottom: 8, padding: 4, background: '#0b0f1a', color: 'white', border: '1px solid #444', fontSize: 12 }}
      />
      <label style={{ fontSize: 11, opacity: 0.7 }}>Extra body (JSON)</label>
      <textarea
        value={llm.extraBody ? JSON.stringify(llm.extraBody, null, 2) : ''}
        onChange={(e) => {
          try { set({ extraBody: e.target.value ? JSON.parse(e.target.value) : undefined }); }
          catch { /* ignore invalid JSON while typing */ }
        }}
        style={{ width: '100%', minHeight: 60, padding: 4, background: '#0b0f1a', color: 'white', border: '1px solid #444', fontSize: 11, fontFamily: 'monospace' }}
      />
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <label style={{ fontSize: 12 }}>
          <input type="checkbox" checked={llm.useJsonSchema ?? true}
            onChange={(e) => set({ useJsonSchema: e.target.checked })} />
          &nbsp;JSON schema mode
        </label>
      </div>
    </div>
  );
}
```

- [ ] **Step 39.2:** Commit

```bash
git add apps/demo/src/app/tutor/LLMConfigPanel.tsx
git commit -m "feat(demo): add LLMConfigPanel"
```

---

### Task 40: StoryboardLog

**Files:**
- Create: `apps/demo/src/app/tutor/StoryboardLog.tsx`

- [ ] **Step 40.1:** Write the log

```tsx
// apps/demo/src/app/tutor/StoryboardLog.tsx
'use client';

import React from 'react';
import { useStore } from 'zustand';
import type { NarrationStoreApi } from '@pdf-reader/core';

export interface StoryboardLogProps {
  narrationStore: NarrationStoreApi;
}

export function StoryboardLog({ narrationStore }: StoryboardLogProps) {
  const lastStoryboard = useStore(narrationStore, (s) => s.lastStoryboard);
  const llmStatus = useStore(narrationStore, (s) => s.llmStatus);
  const engineStatus = useStore(narrationStore, (s) => s.engineStatus);
  const lastError = useStore(narrationStore, (s) => s.lastError);

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ fontSize: 14, margin: 0, marginBottom: 8 }}>Storyboard log</h3>
      <div style={{ fontSize: 12, marginBottom: 8 }}>
        <div>LLM: <span style={{ color: llmStatus === 'failed' ? '#ef4444' : '#10b981' }}>{llmStatus}</span></div>
        <div>Engine: <span>{engineStatus}</span></div>
        {lastError ? <div style={{ color: '#ef4444' }}>Error: {lastError}</div> : null}
      </div>
      {lastStoryboard ? (
        <pre style={{ fontSize: 11, background: '#0b0f1a', border: '1px solid #333', padding: 8, borderRadius: 4, overflow: 'auto', maxHeight: 340 }}>
          {JSON.stringify(lastStoryboard, null, 2)}
        </pre>
      ) : (
        <div style={{ opacity: 0.6, fontSize: 12 }}>No storyboard yet. Send a chunk.</div>
      )}
    </div>
  );
}
```

- [ ] **Step 40.2:** Commit

```bash
git add apps/demo/src/app/tutor/StoryboardLog.tsx
git commit -m "feat(demo): add StoryboardLog panel"
```

---

## Phase 11: UX polish (subtitle, idle, exit)

### Task 41: SubtitleBar

**Files:**
- Create: `packages/core/src/components/TutorMode/SubtitleBar.tsx`
- Modify: `packages/core/src/components/TutorMode/index.ts`
- Modify: `packages/core/src/components/TutorMode/TutorModeContainer.tsx`

- [ ] **Step 41.1:** Write the bar

```tsx
// packages/core/src/components/TutorMode/SubtitleBar.tsx
'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export interface SubtitleBarProps {
  text: string | null;
}

export function SubtitleBar({ text }: SubtitleBarProps) {
  return (
    <AnimatePresence>
      {text ? (
        <motion.div
          key={text}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 32,
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.75)',
            color: 'white',
            padding: '10px 18px',
            borderRadius: 8,
            maxWidth: '80%',
            fontSize: 16,
            lineHeight: 1.4,
            fontFamily: 'system-ui, sans-serif',
            pointerEvents: 'none',
            zIndex: 50,
            textAlign: 'center',
          }}
          data-role="subtitle-bar"
        >
          {text}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
```

- [ ] **Step 41.2:** Re-export + render in the container

Append to `packages/core/src/components/TutorMode/index.ts`:
```ts
export { SubtitleBar, type SubtitleBarProps } from './SubtitleBar';
```

In `TutorModeContainer.tsx`:
- Import: `import { SubtitleBar } from './SubtitleBar';`
- Add a `showSubtitles?: boolean` prop (default `true`).
- At the bottom of the JSX (inside the container div, outside `CameraView`), render:
  ```tsx
  {showSubtitles ? <SubtitleBar text={currentChunk ?? null} /> : null}
  ```

- [ ] **Step 41.3:** Commit

```bash
pnpm --filter pdfjs-reader-core build
git add packages/core/src/components/TutorMode
git commit -m "feat(tutor): add SubtitleBar"
```

---

### Task 42: Exit button + onExitTutorMode

**Files:**
- Modify: `packages/core/src/components/TutorMode/TutorModeContainer.tsx`

- [ ] **Step 42.1:** Add props

Extend `TutorModeContainerProps`:
```ts
showExitButton?: boolean;
onExitTutorMode?: () => void;
```

- [ ] **Step 42.2:** Render a small top-right button

Inside the container div (above `CameraView`), conditionally render:
```tsx
{showExitButton !== false && onExitTutorMode ? (
  <button
    onClick={() => {
      engineRef.current?.resetVisuals();
      onExitTutorMode();
    }}
    style={{
      position: 'absolute', top: 16, right: 16, zIndex: 60,
      padding: '6px 12px', border: 'none', borderRadius: 6,
      background: 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer',
    }}
    data-role="exit-tutor"
  >
    Exit tutor
  </button>
) : null}
```

- [ ] **Step 42.3:** Commit

```bash
pnpm --filter pdfjs-reader-core build
git add packages/core/src/components/TutorMode/TutorModeContainer.tsx
git commit -m "feat(tutor): add exit button + onExitTutorMode callback"
```

---

## Phase 12: Verification + docs

### Task 43: Top-level exports final pass

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 43.1:** Ensure all public API pieces are exported

Confirm these are all exported from `packages/core/src/index.ts` (add any that are missing):
- Components: `TutorModeContainer, CinemaLayer, CameraView, SpotlightMask, AnimatedUnderline, Highlight, PulseOverlay, CalloutArrow, GhostReference, BoxOverlay, StickyLabel, SubtitleBar`
- Stores: `createNarrationStore, makeOverlayId`
- Utilities: `fitPageScale, fitPageTarget, computeCameraForBlock, clampCamera, buildBBoxIndex`
- Director: `directStoryboard, StoryboardEngine, SYSTEM_PROMPT, buildUserPrompt, StoryboardSchema, StoryboardActionSchema, storyboardJsonSchema, matchChunkToBlock, storyboardFromMatch, cosineSimilarity, getLocalMiniLM`
- Types: `PageBBoxData, BBoxIndex, Block, BlockType, DefaultAction, BBoxCoords, PageDimensionsDpi, Storyboard, StoryboardStep, StoryboardAction, ActionCamera, ActionSpotlight, ActionUnderline, ActionHighlight, ActionPulse, ActionCallout, ActionGhostReference, ActionBox, ActionLabel, ActionClear, CameraState, ActiveOverlay, NarrationStore, NarrationStoreApi, NarrationState, NarrationActions, EngineStatus, LlmStatus, ChunkHistoryEntry, LlmConfig, DirectorInput, DirectorResult, EmbeddingProvider, BlockMatch, ViewportSize, CameraTarget`

- [ ] **Step 43.2:** Verify build + typecheck on the whole monorepo

```bash
pnpm --filter pdfjs-reader-core build
pnpm --filter pdfjs-reader-core typecheck
pnpm --filter demo build
```

Expected: all succeed.

- [ ] **Step 43.3:** Run the full test suite

```bash
pnpm --filter pdfjs-reader-core test
```

Expected: all tests pass.

- [ ] **Step 43.4:** Commit

```bash
git add packages/core/src/index.ts
git commit -m "chore(tutor): final export pass"
```

---

### Task 44: README + verification

**Files:**
- Create: `packages/core/src/components/TutorMode/README.md`

- [ ] **Step 44.1:** Write the README (usage only — no proprietary URLs)

```md
# Tutor Mode

LLM-directed cinematic visualization for PDFs narrated by a voice AI tutor.

## Usage

```tsx
import {
  PDFViewerProvider,
  TutorModeContainer,
  createNarrationStore,
} from '@pdf-reader/core';

const narrationStore = createNarrationStore();

<PDFViewerProvider>
  <TutorModeContainer
    pageNumber={currentPage}
    bboxData={bbox}
    narrationStore={narrationStore}
    scale={0.5}
    currentChunk={agentChunkText}
    llm={{
      endpointUrl: process.env.NEXT_PUBLIC_LLM_ENDPOINT!,
      model: process.env.NEXT_PUBLIC_LLM_MODEL!,
      authToken: process.env.NEXT_PUBLIC_LLM_TOKEN,
      maxTokens: 1024,
      temperature: 0.3,
      useJsonSchema: true,
    }}
    onExitTutorMode={() => setMode('document')}
  />
</PDFViewerProvider>
```

## Props

- `pdfUrl` / `bboxData` — PDF + per-page block data.
- `currentChunk` — reactive; update as the tutor speaks.
- `currentPage` — parent app controls page navigation.
- `llm` — consumer-provided endpoint config. Never bake a URL into the package.
- `embeddingProvider` — optional fallback provider (see `getLocalMiniLM`).

## Storyboard grammar

10 action types: `camera`, `spotlight`, `underline`, `highlight`, `pulse`, `callout`, `ghost_reference`, `box`, `label`, `clear`. See `StoryboardSchema`.
```

- [ ] **Step 44.2:** Run the end-to-end manual verification

Prepare `apps/demo/.env.local` from `.env.example` with real values. Then:

```bash
pnpm dev
```

Walk through this checklist (open `http://localhost:3000/tutor`):

1. PDF loads; camera is centered, no overlays.
2. Click scripted chunk `"A joint is a junction between two or more bones or cartilages."` — within ~500ms camera pans to the Definition area, spotlight dims rest of page, underline draws under the paragraph.
3. Click `"See Fig 3.2 — the primary cartilaginous joint…"` — a ghost-reference card floats into top-right showing page 2's figure; auto-clears after a few seconds.
4. Click `"There are three structural classes…"` — camera moves to the CLASSIFICATION section; list items underline sequentially with staggered delays.
5. In the LLM config panel, set the endpoint to an invalid URL. Click any scripted chunk — confirm `LLM: failed` appears; if embedding fallback is wired, a minimal storyboard still plays. Restore the endpoint.
6. Let the viewer idle for >5s — camera fades back toward fit-page, overlays clear.
7. Add an Exit button handler in the playground (or use the built-in exit button) — click it, confirm `resetVisuals` fires.
8. Verify in StoryboardLog that each chunk produced a valid storyboard JSON.
9. Run `pnpm --filter pdfjs-reader-core test` — all tests pass.
10. Run `pnpm --filter pdfjs-reader-core build` — clean build, no TS errors.

- [ ] **Step 44.3:** Final commit

```bash
git add packages/core/src/components/TutorMode/README.md
git commit -m "docs(tutor): add tutor mode README"
```

---

## Open questions / follow-ups (not in this plan)

- Whether the JSON-schema mode works reliably on the chosen vLLM build — measure on Day 1; `useJsonSchema: false` is the escape hatch.
- Whether to ship the MiniLM provider by default (currently opt-in; consumer wires via `embeddingProvider` prop + `getLocalMiniLM()`).
- Latency profile of the full pipeline under production chunks (needs real integration).
- Word-level karaoke is explicitly deferred — adding a per-word-timing prop is the v2 starting point.


