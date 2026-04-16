# Tutor Mode

LLM-directed cinematic visualization for PDFs narrated by a voice AI tutor. A reactive `currentChunk` prop drives a Storyboard JSON response from a consumer-provided OpenAI-compatible endpoint; a Storyboard Engine executes timed animation steps (camera, spotlight, underline, callout, etc.) over the rendered PDF.

## Usage

```tsx
import {
  PDFViewerProvider,
  TutorModeContainer,
  createNarrationStore,
} from 'pdfjs-reader-core';

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
- `showSubtitles` — render a subtitle bar with the current chunk text (default `false`).
- `showExitButton` — render the top-right "Reset view" button (default `true`). Clicking it clears every overlay and returns the camera to fit-page.
- `onExitTutorMode` — optional callback fired AFTER the reset. Provide this only when the host app wants that same click to also leave tutor mode / navigate away. Omit for a pure reset-visuals button.
- `minOverlayDurationMs` — floor for how long each overlay stays on screen regardless of what `duration_ms` the LLM emits (default 3500ms). Bump for longer narration beats.

## Storyboard grammar

10 action types: `camera`, `spotlight`, `underline`, `highlight`, `pulse`, `callout`, `ghost_reference`, `box`, `label`, `clear`. See `StoryboardSchema` for the zod-validated shape.

## Dev playground

`apps/demo/src/app/tutor/page.tsx` — chunk composer + LLM config panel + storyboard log. Configure via `apps/demo/.env.local` (see `.env.example` for the variables). Run `pnpm dev` and visit `/tutor`.
