# Tutor Mode

LLM-directed cinematic visualization for PDFs narrated by a voice AI tutor. A reactive `currentChunk` prop drives a Storyboard JSON response from a consumer-provided OpenAI-compatible endpoint; a Storyboard Engine executes timed animation steps (camera, spotlight, underline, callout, etc.) over the rendered PDF.

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
</PDFViewerProvider>;
```

## Props

- `pageNumber`, `bboxData` — which page is shown + per-page block data (from ARIA backend).
- `narrationStore` — a Zustand store (`createNarrationStore()`) the engine writes to.
- `currentChunk` — reactive; update as the tutor speaks. Debounced 200ms.
- `llm` — consumer-provided endpoint config. **Never** bake a URL into the package; provide via env var at the call site.
- `embeddingProvider` — optional fallback (see `getLocalMiniLM()` for a bundled-lazy MiniLM).
- `showSubtitles`, `showExitButton`, `onExitTutorMode` — UX opt-outs and callbacks.

## Storyboard grammar

10 action types: `camera`, `spotlight`, `underline`, `highlight`, `pulse`, `callout`, `ghost_reference`, `box`, `label`, `clear`. See `StoryboardSchema` for the zod-validated shape.

## Dev playground

`apps/demo/src/app/tutor/page.tsx` — chunk composer + LLM config panel + storyboard log. Configure via `apps/demo/.env.local` (see `.env.example` for the variables). Run `pnpm dev` and visit `/tutor`.
