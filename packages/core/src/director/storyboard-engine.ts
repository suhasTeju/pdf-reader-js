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
import {
  computeCameraForBlock,
  fitPageScale,
  type ViewportSize,
} from '../utils/camera-math';

export interface EngineDeps {
  narrationStore: NarrationStoreApi;
  bboxIndex: BBoxIndex;
  /** Callback to read current viewport size (pixels). */
  getViewport: () => ViewportSize;
  /**
   * Minimum time (ms) an overlay stays on screen regardless of what
   * `step.duration_ms` the LLM emitted. The schema caps duration at 5000ms
   * and recipes typically suggest 600-1200ms — too short to register
   * visually in a narration context. Default: 3500ms.
   */
  minOverlayDurationMs?: number;
}

const DEFAULT_MIN_OVERLAY_MS = 3500;

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
    let steps = [...storyboard.steps].sort((a, b) => a.at_ms - b.at_ms);

    // Camera auto-synthesis — re-centre safety net, NOT a creative choice.
    // The prompt is now allowed to omit a camera step when the target is
    // already on-screen (see prompts.ts "When to use each action"). When it
    // does omit one, we still inject a scale:1.0 camera so the viewport
    // re-centres on the focused block, but the lack of zoom keeps the beat
    // visually neutral — overlay kinds (highlight/underline/pulse/etc.) stay
    // the primary motion.
    const hasCamera = steps.some((s) => s.action.type === 'camera');
    if (!hasCamera) {
      const focus = steps.find(
        (s) =>
          s.action.type !== 'clear' &&
          'target_block' in s.action &&
          s.action.target_block,
      );
      if (focus && focus.action.type !== 'clear' && 'target_block' in focus.action) {
        steps = [
          {
            at_ms: 0,
            duration_ms: 700,
            action: {
              type: 'camera',
              target_block: focus.action.target_block as string,
              scale: 1.0,
              padding: 60,
              easing: 'ease-out',
            },
          },
          ...steps,
        ];
      }
    }

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
    if (last) {
      const totalMs = last.at_ms + last.duration_ms;
      const markIdle = setTimeout(() => {
        if (storyboardId !== this.currentStoryboardId) return;
        narrationStore.getState().setEngineStatus('idle');
      }, totalMs + 50);
      this.pendingTimers.add(markIdle);
    }
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
    const { narrationStore, bboxIndex, getViewport } = this.deps;
    narrationStore.getState().clearOverlays();

    const viewport = getViewport();
    const currentPage = narrationStore.getState().currentPage;
    const pageDims = bboxIndex.byPage.get(currentPage);
    const fit =
      pageDims && viewport.width > 0 && viewport.height > 0
        ? fitPageScale(pageDims.page_dimensions, viewport) * 0.95
        : 1;

    narrationStore
      .getState()
      .setCamera({ scale: fit, x: 0, y: 0, easing: 'ease-in-out' });
  }

  /** Execute one step — dispatch to narrationStore. Returns true if applied. */
  private runStep(step: StoryboardStep): boolean {
    const action = step.action;
    const { narrationStore, bboxIndex } = this.deps;

    // Validate target_block references. Unknown ids mean the LLM picked a
    // block_id that doesn't exist on the current page — surface it in the
    // debug log so the user can see why nothing animated.
    if ('target_block' in action && action.target_block) {
      if (!bboxIndex.blockById.has(action.target_block)) {
        narrationStore.getState().appendDebugEvent({
          kind: 'llm-error',
          summary: `dropped ${action.type} step → unknown target_block "${action.target_block}"`,
          payload: { action, validIds: [...bboxIndex.blockById.keys()] },
        });
        return false;
      }
    }
    if ('from_block' in action && action.from_block) {
      if (!bboxIndex.blockById.has(action.from_block)) {
        narrationStore.getState().appendDebugEvent({
          kind: 'llm-error',
          summary: `dropped ${action.type} step → unknown from_block "${action.from_block}"`,
          payload: { action },
        });
        return false;
      }
    }
    if ('to_block' in action && action.to_block) {
      if (!bboxIndex.blockById.has(action.to_block)) {
        narrationStore.getState().appendDebugEvent({
          kind: 'llm-error',
          summary: `dropped ${action.type} step → unknown to_block "${action.to_block}"`,
          payload: { action },
        });
        return false;
      }
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
        narrationStore
          .getState()
          .clearOverlays((o) => o.kind === 'spotlight');
      } else if (Array.isArray(targets)) {
        const ids = new Set(targets);
        narrationStore.getState().clearOverlays((o) => ids.has(o.id));
      }
      return true;
    }

    // Overlay-emitting actions. Floor the visible duration so overlays don't
    // flash past too quickly to register. LLM recipes emit ~600-1200ms; for
    // a narration-paired experience we want each beat to breathe for several
    // seconds so the student can track it.
    const minMs = this.deps.minOverlayDurationMs ?? DEFAULT_MIN_OVERLAY_MS;
    const visibleMs = Math.max(step.duration_ms, minMs);
    const overlay: ActiveOverlay = {
      id: makeOverlayId(action),
      kind: action.type,
      action,
      createdAt: Date.now(),
      expiresAt: Date.now() + visibleMs,
    };
    narrationStore.getState().addOverlay(overlay);

    // Auto-remove when expired
    const timer = setTimeout(() => {
      narrationStore.getState().removeOverlay(overlay.id);
    }, visibleMs);
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
    let pageDims: ReturnType<typeof bboxIndex.byPage.get> = undefined;

    if (!bbox && action.target_block) {
      const hit = bboxIndex.blockById.get(action.target_block);
      if (!hit) return;
      bbox = hit.block.bbox;
      pageDims = bboxIndex.byPage.get(hit.pageNumber);
    } else if (bbox) {
      pageDims = bboxIndex.byPage.get(narrationStore.getState().currentPage);
    }

    if (!bbox || !pageDims) return;

    // Camera math: interpret action.scale as "N× fit-page" (1 = fit-page,
    // 1.5 = 50% closer, 2 = 2× fit-page). Hard cap at 3× to avoid the
    // unreadably-zoomed-in pathology.
    const fit = fitPageScale(pageDims.page_dimensions, viewport);
    const requested = Math.max(0.5, Math.min(3, action.scale ?? 1));
    const finalScale = fit * requested;

    // Center the target block at the viewport center.
    const [x1, y1, x2, y2] = bbox;
    const blockCX = (x1 + x2) / 2;
    const blockCY = (y1 + y2) / 2;
    const pageCX = pageDims.page_dimensions.width / 2;
    const pageCY = pageDims.page_dimensions.height / 2;
    const x = (pageCX - blockCX) * finalScale;
    const y = (pageCY - blockCY) * finalScale;

    const camera: CameraState = {
      scale: finalScale,
      x,
      y,
      easing: action.easing,
    };
    narrationStore.getState().setCamera(camera);
    void durationMs;
    void computeCameraForBlock;
  }
}
