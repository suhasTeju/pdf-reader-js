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
  type ViewportSize,
} from '../utils/camera-math';

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
    const { narrationStore } = this.deps;
    narrationStore.getState().clearOverlays();
    narrationStore
      .getState()
      .setCamera({ scale: 1, x: 0, y: 0, easing: 'ease-in-out' });
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
        narrationStore
          .getState()
          .clearOverlays((o) => o.kind === 'spotlight');
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

    const target = computeCameraForBlock(
      bbox,
      pageDims.page_dimensions,
      viewport,
      {
        targetScale: action.scale,
        paddingPdf: action.padding,
      },
    );

    const camera: CameraState = {
      scale: target.scale,
      x: target.x,
      y: target.y,
      easing: action.easing,
    };
    narrationStore.getState().setCamera(camera);
    void durationMs;
  }
}
