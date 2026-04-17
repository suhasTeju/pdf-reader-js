# TODOS

Engineering backlog for `pdfjs-reader-core`. Items here are deferred from shipped work with explicit rationale. Every item names a file/location, a user-visible value, and a context hook so whoever picks it up next month knows what they're getting into.

Last updated: 2026-04-17 (from /plan-eng-review of v0.5.3 minimal-patch plan)

---

## v0.6.0 — mobile performance (architectural)

### 1. Lazy-load pages in BookModeContainer
**What:** Replace `Promise.allSettled(pagePromises)` at `packages/core/src/components/PDFViewer/BookModeContainer.tsx:111-115` with windowed loading (current page + N prev + N next, progressively).
**Why:** User reports "initial PDF load takes much time on mobile." Current fan-out loads ALL pages before `ready` flips true, so `ready` is blocked on the slowest page resolve. On a 100-page PDF this is catastrophically slow on mobile.
**Pros:** Likely the single biggest perceived-perf win for v0.6.0. Time-to-first-flip approaches time-to-first-page (pdfjs already emits this via `onFirstPageReady`).
**Cons:** Flip-book UX depends on knowing all page dimensions — need to defer `getViewport` call per page too. Adds state complexity.
**Context:** Suspected root cause of "slow initial load" in the 2026-04-17 office-hours session. Deferred from v0.5.3 because the patch-scope call was to fix bugs not optimize. See `~/.gstack/projects/suhasTeju-pdf-reader-js/suhas-main-design-20260417-152917.md`.
**Depends on:** None.

### 2. Wire `mobile-config.detectDeviceCapabilities()` into TutorMode
**What:** `packages/core/src/utils/mobile-config.ts` exposes `detectDeviceCapabilities()` (isMobile, deviceMemory, hardwareConcurrency, isLowEnd, prefersReducedMotion, etc.). Zero calls from TutorMode today.
**Why:** On low-end devices (isLowEnd true), TutorMode should reduce overlay count, drop Spotlight Gaussian blur, shorten framer-motion durations. Adaptive quality.
**Pros:** Ship-once infrastructure is already there. Integration is the short part.
**Cons:** Introduces a conditional rendering branch per primitive. Test matrix widens.
**Context:** Identified during Explore audit of TutorMode perf on 2026-04-17.
**Depends on:** None.

### 3. Respect `prefers-reduced-motion` in storyboard engine
**What:** `packages/core/src/director/storyboard-engine.ts` currently runs all animations at full duration regardless of OS accessibility preference. Add a check: if `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, compress durations to <100ms or skip to final state.
**Why:** Accessibility. Some users have vestibular conditions where animations cause motion sickness. OS-level signal is authoritative.
**Pros:** Low effort, high value for affected users. Table stakes for library claiming production-grade.
**Cons:** Testing requires either running E2E with reduced-motion flag set or unit-test mocking `matchMedia`.
**Depends on:** None.

### 4. Selector memoization pass on Zustand subscriptions
**What:** `packages/core/src/components/TutorMode/TutorModeContainer.tsx:215-216` and similar sites use raw `useStore(s => s.slice)` without shallowEqual comparators. Every slice write triggers TutorModeContainer re-render.
**Why:** On mid-range Android V8, each TutorMode re-render diffs 15+ framer-motion components. Adds measurable ms per storyboard beat.
**Pros:** Quiet perf win with no API change.
**Cons:** Requires auditing every useStore call site in TutorMode + PDFViewer. ~20 sites.
**Depends on:** None.

### 5. Move Transformers.js embedding fallback to Web Worker
**What:** `packages/core/src/director/transformers-embedding.ts` runs `@xenova/transformers` pipeline on the main thread. On mid-range Android, this blocks UI for 500ms-2s during LLM fallback.
**Why:** Main-thread blocking is the most user-visible perf symptom when the fallback path fires. Worker offloading removes the freeze entirely.
**Pros:** Completely eliminates a category of freezes.
**Cons:** Transformers.js Worker wrapper is non-trivial — message passing for a ~400MB model loader. Tree-shaking the Worker bundle needs care.
**Depends on:** None.

### 6. Dev-mode perf instrumentation overlay
**What:** Add a library-level feature flag that shows time-to-first-page, fetch count, re-render count, and active overlay count. Opt-in via a prop or env var.
**Why:** Today we cannot diagnose perf issues on consumer devices without physical access. Instrumentation makes future mobile reports actionable.
**Pros:** Future debuggability compounds. The v0.5.3 session started because the user had no data; this prevents that gap.
**Cons:** Dev-only overlay bundle needs care so it doesn't ship in prod builds.
**Depends on:** None.

---

## v0.5.x small items (documentation, hygiene)

### 7. Document: consumers must memoize non-string `src` props
**What:** Add a JSDoc warning on `PDFViewerProps.src` and a README section explaining that `ArrayBuffer`/`Uint8Array` src values should be memoized (or stored in refs) to avoid effect re-runs on every parent render.
**Why:** `getSrcIdentifier` in `PDFViewerClient.tsx:43` computes a stable ID from binary content — but the useEffect dep array still includes `src` itself. For binary src, new identity each render triggers unnecessary effect runs even if srcId is stable. Consumers may not realize this.
**Pros:** One JSDoc line + README paragraph. Prevents subtle consumer bugs.
**Cons:** None.
**Context:** Discovered during 2026-04-17 eng-review adversarial check.
**Depends on:** None.

### 8. Investigate: slow initial PDF load on mobile (measure before fixing)
**What:** Before shipping any specific perf fix (items 1-6), add dev-mode instrumentation and measure on a real mid-range Android. Capture: time-to-first-page, time-to-all-pages, fetch count, worker cold-start time, font-subsetting time.
**Why:** The v0.5.3 office-hours session had to pivot because assumptions about what's slow were not grounded in measurement. Don't repeat that pattern.
**Pros:** Every subsequent v0.6.0 item (1-6) becomes decidable.
**Cons:** Measurement-first is a one-session delay, then everything moves faster.
**Depends on:** Item 6 (the instrumentation overlay itself).
