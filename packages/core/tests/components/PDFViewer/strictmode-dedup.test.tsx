import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';

const loadDocumentWithCallbacksMock = vi.fn();
const clearDocumentCacheMock = vi.fn();

vi.mock('../../../src/utils', async () => {
  const actual = await vi.importActual<typeof import('../../../src/utils')>(
    '../../../src/utils',
  );
  return {
    ...actual,
    loadDocumentWithCallbacks: (...args: unknown[]) =>
      loadDocumentWithCallbacksMock(...args),
    clearDocumentCache: (...args: unknown[]) =>
      clearDocumentCacheMock(...args),
  };
});

import { PDFViewerClient } from '../../../src/components/PDFViewer/PDFViewerClient';

describe('PDFViewerClient — StrictMode dedup regression', () => {
  beforeEach(() => {
    loadDocumentWithCallbacksMock.mockReset();
    clearDocumentCacheMock.mockReset();

    // Return a never-resolving promise so the load never "completes"
    // during the test window — we only care about how many times it was
    // invoked, not about what happens afterward.
    loadDocumentWithCallbacksMock.mockImplementation(() => ({
      promise: new Promise(() => {}),
      cancel: vi.fn(),
    }));
  });

  afterEach(async () => {
    cleanup();
    // Flush any deferred (setTimeout(0)) teardown handlers before the
    // next test's beforeEach resets mocks. Otherwise a previous test's
    // unmount handler can fire against the fresh mock.
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  it('does not fetch the PDF twice under React.StrictMode', async () => {
    render(
      <React.StrictMode>
        <PDFViewerClient src="/fixtures/dedup.pdf" />
      </React.StrictMode>,
    );

    // Let StrictMode's synthetic unmount+remount settle, then let the
    // deferred teardown timer fire (or be cancelled).
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Under StrictMode the effect body runs twice. The deferred teardown
    // between the two mounts should be cancelled by the remount, so the
    // load effect's `srcIdRef.current === srcId && document` short-circuit
    // holds on the second run — meaning loadDocumentWithCallbacks is
    // called exactly once.
    expect(loadDocumentWithCallbacksMock).toHaveBeenCalledTimes(1);
  });

  it('does not clear document cache during StrictMode synthetic unmount', async () => {
    render(
      <React.StrictMode>
        <PDFViewerClient src="/fixtures/cache.pdf" />
      </React.StrictMode>,
    );

    await new Promise((resolve) => setTimeout(resolve, 10));

    // The gated teardown uses setTimeout(0). StrictMode's remount happens
    // synchronously within the same tick, so the timer is cancelled before
    // the teardown (and its clearDocumentCache call) runs.
    expect(clearDocumentCacheMock).not.toHaveBeenCalled();
  });

  it('clears document cache on real unmount', async () => {
    const { unmount } = render(
      <PDFViewerClient src="/fixtures/teardown.pdf" />,
    );

    // Let the mount settle and the src ref get set.
    await new Promise((resolve) => setTimeout(resolve, 0));

    unmount();

    // Real unmount: the deferred teardown timer fires because nothing
    // cancels it.
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(clearDocumentCacheMock).toHaveBeenCalledWith('/fixtures/teardown.pdf');
  });
});
