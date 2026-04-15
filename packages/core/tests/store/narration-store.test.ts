import { describe, it, expect } from 'vitest';
import {
  createNarrationStore,
  makeOverlayId,
} from '../../src/store/narration-store';
import type { ActiveOverlay } from '../../src/types/storyboard';

function makeOverlay(
  id: string,
  kind: ActiveOverlay['kind'] = 'spotlight',
): ActiveOverlay {
  return {
    id,
    kind,
    action: {
      type: 'spotlight',
      target_block: 'p1_t4',
      dim_opacity: 0.65,
      feather_px: 40,
      shape: 'rounded',
    },
    createdAt: Date.now(),
    expiresAt: Date.now() + 1000,
  };
}

describe('narrationStore', () => {
  it('starts with default state', () => {
    const store = createNarrationStore();
    const s = store.getState();
    expect(s.currentChunk).toBeNull();
    expect(s.camera).toEqual({
      scale: 1,
      x: 0,
      y: 0,
      easing: 'ease-in-out',
    });
    expect(s.activeOverlays).toEqual([]);
  });

  it('caps chunk history at 5', () => {
    const store = createNarrationStore();
    for (let i = 0; i < 8; i++) {
      store.getState().pushChunkHistory({
        text: `chunk ${i}`,
        pageNumber: 1,
        timestamp: i,
      });
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
    expect(store.getState().camera).toEqual({
      scale: 2,
      x: 0,
      y: 0,
      easing: 'ease-in-out',
    });
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
    const a = makeOverlayId({
      type: 'pulse',
      target_block: 'x',
      count: 1,
      intensity: 'subtle',
    });
    const b = makeOverlayId({
      type: 'pulse',
      target_block: 'x',
      count: 1,
      intensity: 'subtle',
    });
    expect(a).not.toBe(b);
    expect(a.startsWith('ov-pulse-')).toBe(true);
  });
});
