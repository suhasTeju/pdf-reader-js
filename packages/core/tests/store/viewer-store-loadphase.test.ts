import { describe, it, expect } from 'vitest';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { createViewerStore } from '../../src/store/viewer-store';

function makeFakeDocument(numPages = 10): PDFDocumentProxy {
  return {
    numPages,
    destroy: () => Promise.resolve(),
  } as unknown as PDFDocumentProxy;
}

describe('viewerStore.documentLoadingState — monotonic forward invariant', () => {
  it('starts in the idle phase', () => {
    const store = createViewerStore();
    expect(store.getState().documentLoadingState).toBe('idle');
  });

  it('transitions idle → loading → ready on a successful load', () => {
    const store = createViewerStore();

    store.getState().setDocumentLoadingState('loading');
    expect(store.getState().documentLoadingState).toBe('loading');

    store.getState().setDocument(makeFakeDocument());
    expect(store.getState().documentLoadingState).toBe('ready');
  });

  it('setDocument(null) returns phase to idle for a clean reload', () => {
    const store = createViewerStore();

    store.getState().setDocument(makeFakeDocument());
    expect(store.getState().documentLoadingState).toBe('ready');

    store.getState().setDocument(null);
    expect(store.getState().documentLoadingState).toBe('idle');
  });

  it('setError flips phase to error, clearError returns to idle', () => {
    const store = createViewerStore();

    store.getState().setDocumentLoadingState('loading');
    const err = new Error('network fail');
    store.getState().setError(err);
    expect(store.getState().documentLoadingState).toBe('error');
    expect(store.getState().error).toBe(err);
    expect(store.getState().isLoading).toBe(false);

    store.getState().setError(null);
    expect(store.getState().documentLoadingState).toBe('idle');
    expect(store.getState().error).toBeNull();
  });

  it('error → loading → ready retry path lands back on ready without regressing', () => {
    const store = createViewerStore();

    store.getState().setError(new Error('boom'));
    expect(store.getState().documentLoadingState).toBe('error');

    store.getState().setError(null);
    store.getState().setDocumentLoadingState('loading');
    expect(store.getState().documentLoadingState).toBe('loading');

    store.getState().setDocument(makeFakeDocument(3));
    expect(store.getState().documentLoadingState).toBe('ready');
    expect(store.getState().numPages).toBe(3);
  });

  it('setDocument(doc) clears a stale error', () => {
    const store = createViewerStore();

    store.getState().setError(new Error('previous failure'));
    expect(store.getState().error).not.toBeNull();
    expect(store.getState().documentLoadingState).toBe('error');

    store.getState().setDocument(makeFakeDocument());
    expect(store.getState().error).toBeNull();
    expect(store.getState().documentLoadingState).toBe('ready');
  });

  it('setLoading(true) does not downgrade a ready phase through documentLoadingState', () => {
    const store = createViewerStore();

    store.getState().setDocument(makeFakeDocument());
    expect(store.getState().documentLoadingState).toBe('ready');

    // setLoading is a UI-level flag; documentLoadingState is the phase.
    // Toggling isLoading must not silently regress documentLoadingState.
    store.getState().setLoading(true);
    expect(store.getState().documentLoadingState).toBe('ready');
  });

  it('setDocumentLoadingState accepts all five phase values', () => {
    const store = createViewerStore();
    const phases = ['idle', 'initializing', 'loading', 'ready', 'error'] as const;
    for (const phase of phases) {
      store.getState().setDocumentLoadingState(phase);
      expect(store.getState().documentLoadingState).toBe(phase);
    }
  });
});
