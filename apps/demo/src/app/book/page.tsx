'use client';

import React, { useEffect } from 'react';
import {
  PDFViewerProvider,
  BookModeContainer,
  PDFLoadingScreen,
  useViewerStore,
  loadDocumentWithCallbacks,
} from '@pdf-reader/core';
const PDF_URL =
  'https://storage.googleapis.com/aria-ai/textbooks/ebcbf57e.pdf?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=vertext-ai-aria%40inspiring-hope-474607-g4.iam.gserviceaccount.com%2F20260310%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20260310T100654Z&X-Goog-Expires=3600&X-Goog-SignedHeaders=host&X-Goog-Signature=867a10eb8ff20209c2bbe297606d2a6ef66f19fc5f80ad3efb45b9d2e58337b0847ddbbfa24ec1fac01d8bef5c057d16b713ed0f4203e396cf199d3c8c34d14b5149af14e4d43793b76058f46c13a7ce9eb82a6e92607247e9a5cefef5005404e3c4983541fbeed5df38cff385987119ca26f7c7cdd234e04d22df89ef6d5d2c6e9971fcf95821e80c4eadcc23b0db887f5c8a1d5a1240a9ccd715d95b7465d687dc1e1b83ccab4659447136e779f4ea25a14991d5a85302306330cdc8f61ce7eda3d3e7de4aa46b0a5d41cc53ed189780031a115fb1c22371381a8959b5cd3b99bd3570ca421885d9c08789aff7d04b8f85aacded3fb0291e18121d9571a15f';

function BookViewer() {
  const setDocument = useViewerStore((s) => s.setDocument);
  const setLoading = useViewerStore((s) => s.setLoading);
  const setLoadingProgress = useViewerStore((s) => s.setLoadingProgress);
  const setError = useViewerStore((s) => s.setError);
  const setDocumentLoadingState = useViewerStore((s) => s.setDocumentLoadingState);
  const setFirstPageReady = useViewerStore((s) => s.setFirstPageReady);
  const setStreamingProgress = useViewerStore((s) => s.setStreamingProgress);
  const isLoading = useViewerStore((s) => s.isLoading);
  const loadingProgress = useViewerStore((s) => s.loadingProgress);
  const error = useViewerStore((s) => s.error);

  useEffect(() => {
    setLoading(true, { phase: 'initializing' });
    setDocumentLoadingState('initializing');
    setFirstPageReady(false);
    setStreamingProgress(null);

    const { promise, cancel } = loadDocumentWithCallbacks({
      src: PDF_URL,
      onProgress: ({ loaded, total }) => {
        setLoadingProgress({
          phase: 'fetching',
          percent: total > 0 ? Math.round((loaded / total) * 100) : undefined,
          bytesLoaded: loaded,
          totalBytes: total,
        });
        setStreamingProgress({ loaded, total });
        setDocumentLoadingState('loading');
      },
      onDocumentReady: (document) => {
        setDocument(document);
        setLoadingProgress({ phase: 'parsing' });
      },
      onFirstPageReady: () => {
        setLoading(false);
        setFirstPageReady(true);
        setDocumentLoadingState('ready');
      },
    });

    promise.catch((err) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err : new Error('Failed to load PDF'));
    });

    return () => cancel();
  }, [setDocument, setLoading, setLoadingProgress, setError, setDocumentLoadingState, setFirstPageReady, setStreamingProgress]);

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-red-500">Failed to load PDF: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen relative">
      <BookModeContainer />
      {isLoading && (
        <div className="absolute inset-0 z-50">
          <PDFLoadingScreen
            phase={loadingProgress?.phase ?? 'fetching'}
            progress={loadingProgress?.percent}
            bytesLoaded={loadingProgress?.bytesLoaded}
            totalBytes={loadingProgress?.totalBytes}
          />
        </div>
      )}
    </div>
  );
}

export default function BookPage() {
  return (
    <PDFViewerProvider theme="light">
      <BookViewer />
    </PDFViewerProvider>
  );
}
