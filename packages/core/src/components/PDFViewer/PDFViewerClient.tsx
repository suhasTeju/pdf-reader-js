import {
  useEffect,
  useCallback,
  memo,
  useRef,
  useState,
  forwardRef,
} from 'react';
import { PDFViewerProvider, usePDFViewerStores, useViewerStore } from '../../hooks';
import { loadDocument, clearDocumentCache } from '../../utils';
import { Toolbar } from '../Toolbar';
import { Sidebar } from '../Sidebar';
import { AnnotationToolbar } from '../AnnotationToolbar';
import { DocumentContainer } from './DocumentContainer';
import { ContinuousScrollContainer } from './ContinuousScrollContainer';
import { DualPageContainer } from './DualPageContainer';
import { FloatingZoomControls } from '../FloatingZoomControls';
import { PDFLoadingScreen } from '../PDFLoadingScreen';
import { cn } from '../../utils';
import type {
  PDFViewerProps,
  PDFViewerHandle,
  HighlightTextOptions,
  DrawRectOptions,
  DrawCircleOptions,
  AddNoteOptions,
  SearchOptions,
  HighlightRect,
  GoToPageOptions,
  SearchAndHighlightOptions,
  SearchAndHighlightResult,
  ViewerState,
} from '../../types';

interface PDFViewerInnerProps extends PDFViewerProps {
  onReady?: (handle: PDFViewerHandle) => void;
}

/**
 * Generate a stable identifier for the src prop.
 */
function getSrcIdentifier(src: string | ArrayBuffer | Uint8Array): string {
  if (typeof src === 'string') {
    return src;
  }

  const data = src instanceof ArrayBuffer ? new Uint8Array(src) : src;
  const len = data.byteLength;

  if (len === 0) return 'empty';

  const first = Array.from(data.slice(0, 4))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const last = Array.from(data.slice(-4))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `binary:${len}:${first}:${last}`;
}


const PDFViewerInner = memo(function PDFViewerInner({
  src,
  initialPage = 1,
  page: controlledPage,
  initialScale = 'auto',
  showToolbar = true,
  showSidebar = true,
  showAnnotationToolbar = false,
  showFloatingZoom = true,
  viewMode = 'single',
  onDocumentLoad,
  onPageChange,
  onScaleChange,
  onZoomChange,
  onError,
  onPageRenderStart,
  onPageRenderComplete,
  onHighlightAdded,
  onHighlightRemoved,
  onAnnotationAdded,
  workerSrc,
  className,
  loadingComponent,
  errorComponent,
  onReady,
}: PDFViewerInnerProps) {
  const { viewerStore, annotationStore, searchStore } = usePDFViewerStores();

  // Track mount state
  const mountedRef = useRef(true);
  const [, setLoadState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');

  // Store callbacks in refs
  const onDocumentLoadRef = useRef(onDocumentLoad);
  const onErrorRef = useRef(onError);
  const onPageChangeRef = useRef(onPageChange);
  const onScaleChangeRef = useRef(onScaleChange);
  const onZoomChangeRef = useRef(onZoomChange);
  const onPageRenderStartRef = useRef(onPageRenderStart);
  const onPageRenderCompleteRef = useRef(onPageRenderComplete);
  const onHighlightAddedRef = useRef(onHighlightAdded);
  const onHighlightRemovedRef = useRef(onHighlightRemoved);
  const onAnnotationAddedRef = useRef(onAnnotationAdded);
  const onReadyRef = useRef(onReady);

  onDocumentLoadRef.current = onDocumentLoad;
  onErrorRef.current = onError;
  onPageChangeRef.current = onPageChange;
  onScaleChangeRef.current = onScaleChange;
  onZoomChangeRef.current = onZoomChange;
  onPageRenderStartRef.current = onPageRenderStart;
  onPageRenderCompleteRef.current = onPageRenderComplete;
  onHighlightAddedRef.current = onHighlightAdded;
  onHighlightRemovedRef.current = onHighlightRemoved;
  onAnnotationAddedRef.current = onAnnotationAdded;
  onReadyRef.current = onReady;

  // Controlled mode tracking
  const isControlled = controlledPage !== undefined;
  const prevControlledPageRef = useRef(controlledPage);

  const srcIdRef = useRef<string | null>(null);

  const currentPage = useViewerStore((s) => s.currentPage);
  const scale = useViewerStore((s) => s.scale);
  const theme = useViewerStore((s) => s.theme);
  const isLoading = useViewerStore((s) => s.isLoading);
  const loadingProgress = useViewerStore((s) => s.loadingProgress);
  const error = useViewerStore((s) => s.error);
  const sidebarOpen = useViewerStore((s) => s.sidebarOpen);

  const srcId = getSrcIdentifier(src);

  // ============================================================================
  // Imperative Handle Implementation
  // ============================================================================

  const handleRef = useRef<PDFViewerHandle | null>(null);

  // Create the imperative handle
  useEffect(() => {
    const handle: PDFViewerHandle = {
      // ==================== Text Highlighting ====================
      highlightText: async (text: string, options?: HighlightTextOptions) => {
        const doc = viewerStore.getState().document;
        if (!doc) return [];

        const color = options?.color ?? 'yellow';
        const targetPage = options?.page;
        const caseSensitive = options?.caseSensitive ?? false;
        const scrollTo = options?.scrollTo ?? true;

        const highlightIds: string[] = [];
        const searchText = caseSensitive ? text : text.toLowerCase();

        // Search through pages
        const pagesToSearch = targetPage
          ? [targetPage]
          : Array.from({ length: doc.numPages }, (_, i) => i + 1);

        for (const pageNum of pagesToSearch) {
          try {
            const page = await doc.getPage(pageNum);
            const textContent = await page.getTextContent();
            const viewport = page.getViewport({ scale: 1 });

            // Build text items array with proper tracking
            let fullText = '';
            const textItems: Array<{ text: string; transform: number[]; width: number; height: number }> = [];

            for (const item of textContent.items) {
              if ('str' in item && item.str) {
                textItems.push({
                  text: item.str,
                  transform: item.transform as number[],
                  width: (item.width as number) ?? 0,
                  height: (item.height as number) ?? 12,
                });
                fullText += item.str;
              }
            }

            // Find matches
            const textToSearch = caseSensitive ? fullText : fullText.toLowerCase();
            let startIndex = 0;

            while (true) {
              const matchIndex = textToSearch.indexOf(searchText, startIndex);
              if (matchIndex === -1) break;

              // Calculate rects by finding which text items contain the match
              const matchRects = calculateMatchRects(textItems, matchIndex, text.length, viewport);

              if (matchRects.length > 0) {
                // Create highlight
                const highlight = annotationStore.getState().addHighlight({
                  pageNumber: pageNum,
                  rects: matchRects,
                  color,
                  text: fullText.substring(matchIndex, matchIndex + text.length),
                });

                highlightIds.push(highlight.id);
              }
              startIndex = matchIndex + 1;
            }
          } catch {
            // Skip pages that fail
          }
        }

        // Scroll to first match
        if (scrollTo && highlightIds.length > 0) {
          const firstHighlight = annotationStore.getState().highlights.find(h => h.id === highlightIds[0]);
          if (firstHighlight) {
            viewerStore.getState().goToPage(firstHighlight.pageNumber);
          }
        }

        return highlightIds;
      },

      removeHighlight: (id: string) => {
        annotationStore.getState().removeHighlight(id);
      },

      clearHighlights: () => {
        const highlights = annotationStore.getState().highlights;
        for (const h of highlights) {
          annotationStore.getState().removeHighlight(h.id);
        }
      },

      // ==================== Annotations ====================
      drawRect: (options: DrawRectOptions) => {
        const annotation = annotationStore.getState().addAnnotation({
          type: 'shape',
          shapeType: 'rect',
          pageNumber: options.page,
          x: options.x,
          y: options.y,
          width: options.width,
          height: options.height,
          color: options.color ?? 'blue',
          strokeWidth: options.strokeWidth ?? 2,
        } as Omit<import('../../types').ShapeAnnotation, 'id' | 'createdAt' | 'updatedAt'>);
        return annotation.id;
      },

      drawCircle: (options: DrawCircleOptions) => {
        const annotation = annotationStore.getState().addAnnotation({
          type: 'shape',
          shapeType: 'circle',
          pageNumber: options.page,
          x: options.x,
          y: options.y,
          width: options.radius * 2,
          height: options.radius * 2,
          color: options.color ?? 'blue',
          strokeWidth: options.strokeWidth ?? 2,
        } as Omit<import('../../types').ShapeAnnotation, 'id' | 'createdAt' | 'updatedAt'>);
        return annotation.id;
      },

      addNote: (options: AddNoteOptions) => {
        const annotation = annotationStore.getState().addAnnotation({
          type: 'note',
          pageNumber: options.page,
          x: options.x,
          y: options.y,
          content: options.content,
          color: options.color ?? 'yellow',
        } as Omit<import('../../types').NoteAnnotation, 'id' | 'createdAt' | 'updatedAt'>);
        return annotation.id;
      },

      removeAnnotation: (id: string) => {
        annotationStore.getState().removeAnnotation(id);
      },

      clearAnnotations: () => {
        const annotations = annotationStore.getState().annotations;
        for (const a of annotations) {
          annotationStore.getState().removeAnnotation(a.id);
        }
      },

      // ==================== Navigation ====================
      goToPage: async (page: number, options?: GoToPageOptions) => {
        const behavior = options?.behavior ?? 'smooth';
        await viewerStore.getState().requestScrollToPage(page, behavior);
      },

      nextPage: () => {
        viewerStore.getState().nextPage();
      },

      previousPage: () => {
        viewerStore.getState().previousPage();
      },

      getCurrentPage: () => {
        return viewerStore.getState().currentPage;
      },

      getNumPages: () => {
        return viewerStore.getState().numPages;
      },

      // ==================== Zoom ====================
      setZoom: (scale: number) => {
        viewerStore.getState().setScale(scale);
      },

      getZoom: () => {
        return viewerStore.getState().scale;
      },

      zoomIn: () => {
        viewerStore.getState().zoomIn();
      },

      zoomOut: () => {
        viewerStore.getState().zoomOut();
      },

      // ==================== Search ====================
      search: async (query: string, options?: SearchOptions) => {
        const doc = viewerStore.getState().document;
        if (!doc) return [];

        searchStore.getState().setQuery(query);
        if (options?.caseSensitive !== undefined) {
          searchStore.getState().setCaseSensitive(options.caseSensitive);
        }
        if (options?.wholeWord !== undefined) {
          searchStore.getState().setWholeWord(options.wholeWord);
        }

        await searchStore.getState().search(doc);
        return searchStore.getState().results;
      },

      nextSearchResult: () => {
        searchStore.getState().nextResult();
        const results = searchStore.getState().results;
        const index = searchStore.getState().currentResultIndex;
        if (results[index]) {
          viewerStore.getState().goToPage(results[index].pageNumber);
        }
      },

      previousSearchResult: () => {
        searchStore.getState().previousResult();
        const results = searchStore.getState().results;
        const index = searchStore.getState().currentResultIndex;
        if (results[index]) {
          viewerStore.getState().goToPage(results[index].pageNumber);
        }
      },

      clearSearch: () => {
        searchStore.getState().clearSearch();
      },

      // ==================== Combined Search & Highlight ====================
      searchAndHighlight: async (query: string, options?: SearchAndHighlightOptions): Promise<SearchAndHighlightResult> => {
        const doc = viewerStore.getState().document;
        if (!doc) {
          return { matchCount: 0, highlightIds: [], matches: [] };
        }

        const color = options?.color ?? 'yellow';
        const caseSensitive = options?.caseSensitive ?? false;
        const wholeWord = options?.wholeWord ?? false;
        const scrollToFirst = options?.scrollToFirst ?? true;
        const clearPrevious = options?.clearPrevious ?? true;

        // Clear previous search highlights if requested
        if (clearPrevious) {
          const existingHighlights = annotationStore.getState().highlights;
          for (const h of existingHighlights) {
            if (h.source === 'search') {
              annotationStore.getState().removeHighlight(h.id);
            }
          }
        }

        // Determine which pages to search
        let pagesToSearch: number[];
        if (options?.pageRange) {
          if (Array.isArray(options.pageRange)) {
            pagesToSearch = options.pageRange;
          } else {
            const { start, end } = options.pageRange;
            pagesToSearch = Array.from({ length: end - start + 1 }, (_, i) => start + i);
          }
        } else {
          pagesToSearch = Array.from({ length: doc.numPages }, (_, i) => i + 1);
        }

        const result: SearchAndHighlightResult = {
          matchCount: 0,
          highlightIds: [],
          matches: [],
        };

        const searchText = caseSensitive ? query : query.toLowerCase();

        for (const pageNum of pagesToSearch) {
          if (pageNum < 1 || pageNum > doc.numPages) continue;

          try {
            const page = await doc.getPage(pageNum);
            const textContent = await page.getTextContent();
            const viewport = page.getViewport({ scale: 1 });

            // Build text items array with proper tracking
            let fullText = '';
            const textItems: Array<{ text: string; transform: number[]; width: number; height: number }> = [];

            for (const item of textContent.items) {
              if ('str' in item && item.str) {
                textItems.push({
                  text: item.str,
                  transform: item.transform as number[],
                  width: (item.width as number) ?? 0,
                  height: (item.height as number) ?? 12,
                });
                fullText += item.str;
              }
            }

            // Find matches
            const textToSearch = caseSensitive ? fullText : fullText.toLowerCase();
            let startIndex = 0;

            while (true) {
              const matchIndex = textToSearch.indexOf(searchText, startIndex);
              if (matchIndex === -1) break;

              // Check whole word if required
              if (wholeWord) {
                const beforeChar = matchIndex > 0 ? textToSearch[matchIndex - 1] : ' ';
                const afterChar = matchIndex + query.length < textToSearch.length
                  ? textToSearch[matchIndex + query.length]
                  : ' ';

                if (/\w/.test(beforeChar) || /\w/.test(afterChar)) {
                  startIndex = matchIndex + 1;
                  continue;
                }
              }

              // Calculate rects by finding which text items contain the match
              const matchRects = calculateMatchRects(textItems, matchIndex, query.length, viewport);

              if (matchRects.length > 0) {
                // Create highlight with source marker
                const highlight = annotationStore.getState().addHighlight({
                  pageNumber: pageNum,
                  rects: matchRects,
                  color,
                  text: fullText.substring(matchIndex, matchIndex + query.length),
                  source: 'search',
                });

                result.matchCount++;
                result.highlightIds.push(highlight.id);
                result.matches.push({
                  pageNumber: pageNum,
                  text: fullText.substring(matchIndex, matchIndex + query.length),
                  highlightId: highlight.id,
                  rects: matchRects,
                });
              }

              startIndex = matchIndex + 1;
            }
          } catch {
            // Skip pages that fail to load
          }
        }

        // Scroll to first match if requested
        if (scrollToFirst && result.matches.length > 0) {
          const firstMatch = result.matches[0];
          await viewerStore.getState().requestScrollToPage(firstMatch.pageNumber, 'smooth');
        }

        return result;
      },

      // ==================== Agent Tools ====================
      agentTools: {
        navigateToPage: async (page: number) => {
          try {
            const { currentPage, numPages } = viewerStore.getState();
            if (numPages === 0) {
              return {
                success: false,
                error: { code: 'NO_DOCUMENT', message: 'No document is loaded' },
              };
            }
            if (page < 1 || page > numPages) {
              return {
                success: false,
                error: { code: 'INVALID_PAGE', message: `Page ${page} is out of range (1-${numPages})` },
              };
            }

            const previousPage = currentPage;
            await viewerStore.getState().requestScrollToPage(page, 'smooth');

            return {
              success: true,
              data: { previousPage, currentPage: page },
            };
          } catch (err) {
            return {
              success: false,
              error: { code: 'NAVIGATION_FAILED', message: err instanceof Error ? err.message : 'Unknown error' },
            };
          }
        },

        highlightText: async (text: string, options?: HighlightTextOptions) => {
          try {
            const highlightIds = await handle.highlightText(text, options);
            return {
              success: true,
              data: { matchCount: highlightIds.length, highlightIds },
            };
          } catch (err) {
            return {
              success: false,
              error: { code: 'HIGHLIGHT_FAILED', message: err instanceof Error ? err.message : 'Unknown error' },
            };
          }
        },

        getPageContent: async (page: number) => {
          try {
            const doc = viewerStore.getState().document;
            if (!doc) {
              return {
                success: false,
                error: { code: 'NO_DOCUMENT', message: 'No document is loaded' },
              };
            }
            if (page < 1 || page > doc.numPages) {
              return {
                success: false,
                error: { code: 'INVALID_PAGE', message: `Page ${page} is out of range (1-${doc.numPages})` },
              };
            }

            const pageObj = await doc.getPage(page);
            const textContent = await pageObj.getTextContent();
            const text = textContent.items
              .filter((item): item is (typeof textContent.items[number] & { str: string }) => 'str' in item)
              .map(item => item.str)
              .join('');

            return {
              success: true,
              data: { text },
            };
          } catch (err) {
            return {
              success: false,
              error: { code: 'CONTENT_FETCH_FAILED', message: err instanceof Error ? err.message : 'Unknown error' },
            };
          }
        },

        clearAllVisuals: async () => {
          try {
            const highlights = annotationStore.getState().highlights;
            for (const h of highlights) {
              annotationStore.getState().removeHighlight(h.id);
            }

            const annotations = annotationStore.getState().annotations;
            for (const a of annotations) {
              annotationStore.getState().removeAnnotation(a.id);
            }

            return { success: true };
          } catch (err) {
            return {
              success: false,
              error: { code: 'CLEAR_FAILED', message: err instanceof Error ? err.message : 'Unknown error' },
            };
          }
        },
      },

      // ==================== Coordinate Helpers ====================
      coordinates: {
        getPageDimensions: (page: number) => {
          const doc = viewerStore.getState().document;
          if (!doc || page < 1 || page > doc.numPages) {
            return null;
          }

          // Note: This is synchronous, so we return cached dimensions if available
          // For a full implementation, you might want to cache page dimensions
          // This returns null if dimensions aren't immediately available
          try {
            // PDF.js viewport gives us the actual dimensions
            // We can't access this synchronously, so we return a placeholder
            // In practice, components should use async methods or subscribe to page loads
            return {
              width: 612, // Default US Letter width
              height: 792, // Default US Letter height
              rotation: viewerStore.getState().rotation,
            };
          } catch {
            return null;
          }
        },

        percentToPixels: (xPercent: number, yPercent: number, page: number) => {
          const dimensions = handle.coordinates.getPageDimensions(page);
          if (!dimensions) return null;

          const scale = viewerStore.getState().scale;
          return {
            x: (xPercent / 100) * dimensions.width * scale,
            y: (yPercent / 100) * dimensions.height * scale,
          };
        },

        pixelsToPercent: (x: number, y: number, page: number) => {
          const dimensions = handle.coordinates.getPageDimensions(page);
          if (!dimensions) return null;

          const scale = viewerStore.getState().scale;
          return {
            x: (x / (dimensions.width * scale)) * 100,
            y: (y / (dimensions.height * scale)) * 100,
          };
        },
      },

      // ==================== Document ====================
      getDocument: () => {
        return viewerStore.getState().document;
      },

      isLoaded: () => {
        return viewerStore.getState().document !== null;
      },
    };

    handleRef.current = handle;
    onReadyRef.current?.(handle);
  }, [viewerStore, annotationStore, searchStore]);

  // Retry handler
  const handleRetry = useCallback(() => {
    srcIdRef.current = null;
    viewerStore.getState().setError(null);
    setLoadState('idle');
  }, [viewerStore]);

  // AbortController for cancelling document loading
  const abortControllerRef = useRef<AbortController | null>(null);

  // Track the current src for cleanup
  const currentSrcRef = useRef<string | ArrayBuffer | Uint8Array | null>(null);

  // Mount tracking
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Cancel any in-progress loading
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // Clear the document from cache if it's a URL (so next load gets fresh copy)
      if (currentSrcRef.current && typeof currentSrcRef.current === 'string') {
        clearDocumentCache(currentSrcRef.current);
      }

      // Reset srcIdRef so reopening the modal will reload
      srcIdRef.current = null;
      currentSrcRef.current = null;

      // Destroy the document and reset loading state to allow clean reload
      const currentDoc = viewerStore.getState().document;
      if (currentDoc) {
        try {
          currentDoc.destroy();
        } catch {
          // Ignore errors if already destroyed
        }
      }
      viewerStore.getState().setDocument(null);
      viewerStore.getState().setLoading(false);
      viewerStore.getState().setError(null);
    };
  }, [viewerStore]);

  // Load document
  useEffect(() => {
    if (srcIdRef.current === srcId && viewerStore.getState().document) {
      return;
    }

    const loadId = srcId;
    srcIdRef.current = srcId;
    currentSrcRef.current = src;

    // Cancel any previous loading task
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this load
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const currentDoc = viewerStore.getState().document;
    if (currentDoc) {
      try {
        currentDoc.destroy();
      } catch {
        // Ignore if already destroyed
      }
    }

    // Set loading state in a single update
    viewerStore.setState({
      document: null,
      isLoading: true,
      loadingProgress: { phase: 'fetching' },
      error: null,
    });
    setLoadState('loading');

    // Throttle progress updates to reduce re-renders
    let lastProgressUpdate = 0;
    let lastPercent = -1;
    const PROGRESS_THROTTLE_MS = 100;
    const PROGRESS_MIN_CHANGE = 5;

    const loadDoc = async () => {
      if (!mountedRef.current || abortController.signal.aborted) return;

      try {
        const { document, numPages } = await loadDocument({
          src,
          workerSrc,
          signal: abortController.signal,
          onProgress: ({ loaded, total }) => {
            if (!mountedRef.current || srcIdRef.current !== loadId || abortController.signal.aborted) {
              return;
            }

            const now = Date.now();
            const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;

            // Only update if enough time passed AND percent changed significantly
            const timePassed = now - lastProgressUpdate >= PROGRESS_THROTTLE_MS;
            const percentChanged = Math.abs(percent - lastPercent) >= PROGRESS_MIN_CHANGE;
            const isComplete = percent >= 100;

            if ((timePassed && percentChanged) || isComplete) {
              lastProgressUpdate = now;
              lastPercent = percent;
              viewerStore.getState().setLoadingProgress({
                phase: 'fetching',
                percent,
                bytesLoaded: loaded,
                totalBytes: total,
              });
            }
          },
        });

        if (mountedRef.current && srcIdRef.current === loadId && !abortController.signal.aborted) {
          // Set document and clear loading in one update
          viewerStore.getState().setDocument(document);
          setLoadState('loaded');

          // Handle initial page and scale if needed (batched)
          if (initialPage !== 1 || typeof initialScale === 'number' || initialScale === 'page-fit') {
            const updates: Partial<ViewerState> = {};
            if (initialPage !== 1) {
              updates.currentPage = Math.max(1, Math.min(initialPage, numPages));
            }
            if (typeof initialScale === 'number') {
              updates.scale = initialScale;
            } else if (initialScale === 'page-fit') {
              updates.scale = 0.75;
            }
            if (Object.keys(updates).length > 0) {
              viewerStore.setState(updates);
            }
          }

          onDocumentLoadRef.current?.({ document, numPages });
        } else {
          document.destroy();
        }
      } catch (err) {
        // Ignore abort errors - component is unmounting or loading was cancelled
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }

        // Ignore network errors caused by abort
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (abortController.signal.aborted ||
            errorMessage.includes('network error') ||
            errorMessage.includes('aborted')) {
          return;
        }

        if (mountedRef.current && srcIdRef.current === loadId) {
          const error = err instanceof Error ? err : new Error('Failed to load document');
          viewerStore.getState().setError(error);
          setLoadState('error');
          onErrorRef.current?.(error);
        }
      }
    };

    loadDoc();

    return () => {
      abortController.abort();
    };
  }, [srcId, src, workerSrc, initialPage, initialScale, viewerStore]);

  // Page change notifications
  const prevPageRef = useRef(currentPage);
  useEffect(() => {
    if (prevPageRef.current !== currentPage) {
      prevPageRef.current = currentPage;
      onPageChangeRef.current?.(currentPage);
    }
  }, [currentPage]);

  // Scale change notifications
  const prevScaleRef = useRef(scale);
  useEffect(() => {
    if (prevScaleRef.current !== scale) {
      prevScaleRef.current = scale;
      onScaleChangeRef.current?.(scale);
      onZoomChangeRef.current?.(scale);
    }
  }, [scale]);

  // Controlled mode: sync viewer to controlled page prop
  useEffect(() => {
    if (!isControlled || controlledPage === undefined) return;
    if (prevControlledPageRef.current === controlledPage) return;

    prevControlledPageRef.current = controlledPage;
    const { numPages, currentPage } = viewerStore.getState();

    // Only navigate if document is loaded and page is different
    if (numPages > 0 && controlledPage !== currentPage) {
      viewerStore.getState().requestScrollToPage(controlledPage, 'smooth');
    }
  }, [controlledPage, isControlled, viewerStore]);

  const themeClass = theme === 'dark' ? 'dark' : '';

  if (error) {
    // Use custom error component if provided
    if (errorComponent) {
      const errorContent = typeof errorComponent === 'function'
        ? errorComponent(error, handleRetry)
        : errorComponent;

      return (
        <div
          className={cn(
            'pdf-viewer pdf-viewer-error',
            'flex flex-col h-full',
            'bg-white dark:bg-gray-900',
            themeClass,
            className
          )}
        >
          {errorContent}
        </div>
      );
    }

    return (
      <div
        className={cn(
          'pdf-viewer pdf-viewer-error',
          'flex flex-col h-full',
          'bg-white dark:bg-gray-900',
          themeClass,
          className
        )}
      >
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <div className="text-red-500 text-lg font-semibold mb-2">
              Failed to load PDF
            </div>
            <div className="text-gray-500 text-sm">{error.message}</div>
            <button
              onClick={handleRetry}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderContainer = () => {
    switch (viewMode) {
      case 'continuous':
        return <ContinuousScrollContainer />;
      case 'dual':
        return <DualPageContainer />;
      case 'single':
      default:
        return <DocumentContainer />;
    }
  };

  return (
    <div
      className={cn(
        'pdf-viewer',
        'flex flex-col h-full relative',
        'bg-white dark:bg-gray-900',
        'text-gray-900 dark:text-gray-100',
        themeClass,
        className
      )}
    >
      {showToolbar && <Toolbar />}
      {showAnnotationToolbar && <AnnotationToolbar />}

      <div className="flex flex-1 overflow-hidden">
        {showSidebar && sidebarOpen && <Sidebar />}
        {renderContainer()}
      </div>

      {/* Floating Zoom Controls */}
      {showFloatingZoom && <FloatingZoomControls position="bottom-right" />}

      {isLoading && (
        <div className="absolute inset-0 z-50">
          {loadingComponent ?? (
            <PDFLoadingScreen
              phase={loadingProgress?.phase ?? 'fetching'}
              progress={loadingProgress?.percent}
              bytesLoaded={loadingProgress?.bytesLoaded}
              totalBytes={loadingProgress?.totalBytes}
            />
          )}
        </div>
      )}
    </div>
  );
});

/**
 * Calculate the bounding rectangles for a text match by tracking text item offsets.
 * This is the correct approach - it finds which text items contain the match
 * and calculates the proper rect position from each item's transform.
 */
function calculateMatchRects(
  textItems: Array<{ text: string; transform: number[]; width: number; height: number }>,
  startOffset: number,
  length: number,
  viewport: { width: number; height: number }
): HighlightRect[] {
  const rects: HighlightRect[] = [];
  let currentOffset = 0;

  for (const item of textItems) {
    const itemStart = currentOffset;
    const itemEnd = currentOffset + item.text.length;

    // Check if this item overlaps with our match
    if (itemEnd > startOffset && itemStart < startOffset + length) {
      const [, , c, d, tx, ty] = item.transform;

      // Convert PDF coordinates to viewport coordinates
      const x = tx;
      const y = viewport.height - ty;

      // Approximate height from transform matrix
      const height = Math.sqrt(c * c + d * d);

      // Calculate the portion of this item that's part of the match
      const matchStartInItem = Math.max(0, startOffset - itemStart);
      const matchEndInItem = Math.min(item.text.length, startOffset + length - itemStart);
      const charWidth = item.text.length > 0 ? item.width / item.text.length : item.width;
      const matchWidth = charWidth * (matchEndInItem - matchStartInItem);
      const matchX = x + charWidth * matchStartInItem;

      // Adjust Y position: ty is the baseline, we need to position highlight
      // lower to align with the actual text glyphs (not the baseline)
      const yOffset = height * 0.30; // Shift down by 30% of height

      rects.push({
        x: matchX,
        y: y - height + yOffset,
        width: matchWidth,
        height: height,
      });
    }

    currentOffset = itemEnd;
  }

  return rects;
}

// ============================================================================
// Inner component with ref forwarding
// ============================================================================

interface InnerWithRefProps extends PDFViewerProps {}

const PDFViewerInnerWithRef = forwardRef<PDFViewerHandle, InnerWithRefProps>(
  function PDFViewerInnerWithRef(props, ref) {
    const handleRef = useRef<PDFViewerHandle | null>(null);

    // Forward the handle when ready
    const handleReady = useCallback((handle: PDFViewerHandle) => {
      handleRef.current = handle;
      if (typeof ref === 'function') {
        ref(handle);
      } else if (ref) {
        ref.current = handle;
      }
    }, [ref]);

    return <PDFViewerInner {...props} onReady={handleReady} />;
  }
);

// ============================================================================
// Public Component
// ============================================================================

/**
 * PDF Viewer component with imperative API.
 *
 * @example
 * ```tsx
 * const viewerRef = useRef<PDFViewerHandle>(null);
 *
 * <PDFViewerClient
 *   ref={viewerRef}
 *   src="/document.pdf"
 *   onDocumentLoad={() => {
 *     // Highlight text when document loads
 *     viewerRef.current?.highlightText("important", { color: "yellow" });
 *   }}
 * />
 *
 * // Call methods anytime
 * viewerRef.current?.goToPage(5);
 * viewerRef.current?.drawRect({ page: 1, x: 10, y: 20, width: 30, height: 10 });
 * ```
 */
export const PDFViewerClient = memo(
  forwardRef<PDFViewerHandle, PDFViewerProps>(function PDFViewerClient(props, ref) {
    return (
      <PDFViewerProvider
        theme={props.theme}
        defaultSidebarPanel={props.defaultSidebarPanel}
      >
        <PDFViewerInnerWithRef ref={ref} {...props} />
      </PDFViewerProvider>
    );
  })
);
