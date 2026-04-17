# Changelog

## 0.5.4 — 2026-04-17

Mobile hotfix (iOS Safari tab-reload in TutorMode).

Root cause: `CanvasLayer.tsx` rendered every PDF canvas at
`viewport × devicePixelRatio`, which for a 200-DPI bbox on an iPhone 14
(DPR=3) allocated a ~134 MB backing store for a single US Letter page.
Combined with `will-change: transform` on the TutorMode camera wrapper
and a full-page SVG `feGaussianBlur` in SpotlightMask, one tab was
comfortably above iOS Safari's per-tab compositor/canvas budget. iOS
reaped the tab. From the user's perspective: TutorMode "crashed the app."

Fixes:
- `CanvasLayer` now uses `getRenderConfig('auto')` from `mobile-config` so
  mobile devices render canvases at a capped `canvasScaleFactor`
  (≤1.5× on mobile, ≤1.0× on low-end) with `maxCanvasDimension` clamping
  via `calculateOptimalCanvasDimensions`. CSS size is unchanged so
  overlays remain aligned; only the backing-store resolution shrinks.
  On iPhone 14 in TutorMode, canvas memory drops from ~134 MB to ~34 MB
  per page (4×). Desktop behavior unchanged (full DPR preserved).
- `TutorMode/CameraView` no longer sets `will-change: transform` on
  mobile. The compositor backing store it reserved scaled with the
  camera tween and stacked on top of the canvas memory cost; dropping
  it on mobile is a pure memory win with no visual regression.
- `TutorMode/SpotlightMask` clamps the SVG Gaussian blur `stdDeviation`
  to ≤12px on mobile. The spotlight still reads as soft-edged; the
  filter region's rasterized buffer is smaller.

Verification: high-confidence mitigation based on mechanism analysis, not
iOS-device-verified in this patch. Aria team should validate on their
iPhone test device after upgrading.

## 0.5.3 — 2026-04-17

Fixes:
- Duplicate PDF URL fetch on mount under React 18 StrictMode. Three
  coordinated changes in `PDFViewerClient`:
  1. The mount effect's teardown (cache clear + document destroy + state
     reset) now runs behind a `setTimeout(0)` timer that the synthetic
     remount cancels. Real unmount still tears down cleanly.
  2. The load effect's cleanup no longer aborts the in-flight controller.
     Abort is now owned by the deferred teardown (real unmount) and by
     the top of the load effect itself when deps change.
  3. The load effect's short-circuit guard now also checks whether a
     load is in-flight for the same srcId (non-aborted
     `AbortController`), so the synthetic remount sees the first load
     still alive and skips cleanly.
- Loader flash during initial PDF load. Same root cause as above — the
  aggressive teardown flipped `documentLoadingState` back to `idle` on
  the synthetic unmount, briefly re-showing the loading screen.
- `handleRetry` now resets the in-flight `AbortController` so that a retry
  after an error starts from a clean slate instead of reusing an aborted
  controller reference.
- The load effect dep array no longer includes `src` redundantly alongside
  the derived `srcId`. Consumers passing `ArrayBuffer` or `Uint8Array`
  inputs whose identity changes every render are no longer penalized with
  spurious load re-runs.

Pre-ship manual checks (see `docs/` and the v0.5.3 test plan in
`~/.gstack/projects/suhasTeju-pdf-reader-js/`):
- Open `/book` on a mid-range Android device via remote debug; Network tab
  shows exactly one `GET` (or one consistent range-request sequence) for
  the PDF URL.
- Loader appears once, hides once. No flicker.
