import { memo, useEffect, useState, useRef, useCallback } from 'react';
import type { PDFPageProxy, PDFDocumentProxy } from 'pdfjs-dist';
import { PDFPage } from '../PDFPage';
import { PDFLoadingScreen } from '../PDFLoadingScreen';
import { usePDFViewer, usePDFViewerStores, useTextSelection, useViewerStore } from '../../hooks';
import { useHighlights } from '../../hooks/useHighlights';
import { SelectionToolbar } from '../SelectionToolbar';
import { HighlightPopover } from '../HighlightPopover';
import { cn } from '../../utils';
import { playPageTurnSound } from '../../utils/page-turn-sound';
import type { HighlightColor } from '../../types';

export interface BookModeContainerProps {
  className?: string;
  /** Enable page turn sound effects (default: true) */
  enableSound?: boolean;
  /** Sound volume 0-1 (default: 0.3) */
  soundVolume?: number;
}

type TurnDirection = 'forward' | 'backward';
type TurnState = 'idle' | 'turning';

export const BookModeContainer = memo(function BookModeContainer({
  className,
  enableSound = true,
  soundVolume = 0.3,
}: BookModeContainerProps) {
  const {
    document,
    currentPage,
    numPages,
    scale,
    rotation,
    theme,
    isLoading,
    nextPage,
    previousPage,
  } = usePDFViewer();

  const scrollToPageRequest = useViewerStore((s) => s.scrollToPageRequest);
  const { viewerStore } = usePDFViewerStores();
  const [currentPageObj, setCurrentPageObj] = useState<PDFPageProxy | null>(null);
  const [prevPageObj, setPrevPageObj] = useState<PDFPageProxy | null>(null);
  const [nextPageObj, setNextPageObj] = useState<PDFPageProxy | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const documentRef = useRef<PDFDocumentProxy | null>(null);

  // Animation state
  const [turnState, setTurnState] = useState<TurnState>('idle');
  const [turnDirection, setTurnDirection] = useState<TurnDirection>('forward');
  const [displayPage, setDisplayPage] = useState(currentPage);
  const animatingRef = useRef(false);

  // Drag state for interactive page turning
  const [dragProgress, setDragProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartXRef = useRef(0);
  const containerWidthRef = useRef(0);

  // Text selection handling
  const { selection, clearSelection, copySelection } = useTextSelection();

  // Highlight management
  const {
    createHighlightFromSelection,
    updateHighlight,
    deleteHighlight,
    selectedHighlight,
    selectHighlight,
    activeColor,
  } = useHighlights();

  // Clear page when document changes
  useEffect(() => {
    if (document !== documentRef.current) {
      documentRef.current = document;
      setCurrentPageObj(null);
      setPrevPageObj(null);
      setNextPageObj(null);
    }
  }, [document]);

  // Load current, previous, and next pages for smooth transitions
  useEffect(() => {
    if (!document) {
      setCurrentPageObj(null);
      setPrevPageObj(null);
      setNextPageObj(null);
      return;
    }

    let cancelled = false;

    const loadPages = async () => {
      setIsLoadingPage(true);

      try {
        const pagesToLoad: Promise<PDFPageProxy>[] = [document.getPage(currentPage)];
        if (currentPage > 1) pagesToLoad.push(document.getPage(currentPage - 1));
        if (currentPage < numPages) pagesToLoad.push(document.getPage(currentPage + 1));

        const results = await Promise.allSettled(pagesToLoad);

        if (!cancelled && document === documentRef.current) {
          const r0 = results[0];
          const current = r0.status === 'fulfilled' ? r0.value : null;
          setCurrentPageObj(current);

          let idx = 1;
          if (currentPage > 1) {
            const r = results[idx];
            setPrevPageObj(r?.status === 'fulfilled' ? r.value : null);
            idx++;
          } else {
            setPrevPageObj(null);
          }

          if (currentPage < numPages) {
            const r = results[idx];
            setNextPageObj(r?.status === 'fulfilled' ? r.value : null);
          } else {
            setNextPageObj(null);
          }

          // Complete scroll request
          if (scrollToPageRequest && scrollToPageRequest.page === currentPage) {
            requestAnimationFrame(() => {
              viewerStore.getState().completeScrollRequest(scrollToPageRequest.requestId);
            });
          }
        }
      } catch {
        // Silently handle errors
      } finally {
        if (!cancelled) {
          setIsLoadingPage(false);
        }
      }
    };

    loadPages();

    return () => {
      cancelled = true;
    };
  }, [document, currentPage, numPages, scrollToPageRequest, viewerStore]);

  // Handle page turn animation
  const animatePageTurn = useCallback(
    (direction: TurnDirection) => {
      if (animatingRef.current) return;
      if (direction === 'forward' && currentPage >= numPages) return;
      if (direction === 'backward' && currentPage <= 1) return;

      animatingRef.current = true;
      setTurnDirection(direction);
      setTurnState('turning');

      if (enableSound) {
        playPageTurnSound(soundVolume);
      }

      // After animation completes, update the page
      setTimeout(() => {
        if (direction === 'forward') {
          nextPage();
        } else {
          previousPage();
        }
        setTurnState('idle');
        setDragProgress(0);
        animatingRef.current = false;
      }, 600); // Match CSS animation duration
    },
    [currentPage, numPages, nextPage, previousPage, enableSound, soundVolume]
  );

  // Update display page after state settles
  useEffect(() => {
    if (turnState === 'idle') {
      setDisplayPage(currentPage);
    }
  }, [currentPage, turnState]);

  // Mouse/touch drag for interactive page turning
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (animatingRef.current) return;
      const container = containerRef.current;
      if (!container) return;

      containerWidthRef.current = container.offsetWidth;
      dragStartXRef.current = e.clientX;
      setIsDragging(true);
      setDragProgress(0);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || animatingRef.current) return;

      const dx = e.clientX - dragStartXRef.current;
      const width = containerWidthRef.current || 1;
      const progress = Math.max(-1, Math.min(1, dx / (width * 0.5)));
      setDragProgress(progress);
    },
    [isDragging]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      setIsDragging(false);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);

      const threshold = 0.25;
      if (dragProgress < -threshold && currentPage < numPages) {
        animatePageTurn('forward');
      } else if (dragProgress > threshold && currentPage > 1) {
        animatePageTurn('backward');
      } else {
        setDragProgress(0);
      }
    },
    [isDragging, dragProgress, currentPage, numPages, animatePageTurn]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        animatePageTurn('forward');
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        animatePageTurn('backward');
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      return () => container.removeEventListener('keydown', handleKeyDown);
    }
  }, [animatePageTurn]);

  // Click zones for page turning (left/right thirds)
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) return;
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const zoneWidth = rect.width / 3;

      if (x < zoneWidth) {
        animatePageTurn('backward');
      } else if (x > rect.width - zoneWidth) {
        animatePageTurn('forward');
      }
    },
    [isDragging, animatePageTurn]
  );

  // Page element getter for coordinate calculations
  const getPageElement = useCallback((): HTMLElement | null => {
    return containerRef.current?.querySelector(`[data-page-number="${currentPage}"]`) as HTMLElement | null;
  }, [currentPage]);

  // Highlight handlers
  const handleCreateHighlight = useCallback(
    (color: HighlightColor) => {
      if (!selection) return;
      const pageElement = getPageElement();
      if (!pageElement) return;
      createHighlightFromSelection(selection, pageElement, scale, color);
      clearSelection();
    },
    [selection, getPageElement, createHighlightFromSelection, scale, clearSelection]
  );

  const handleCopySelection = useCallback(() => {
    copySelection();
  }, [copySelection]);

  const handleColorChange = useCallback(
    (id: string, color: HighlightColor) => {
      updateHighlight(id, { color });
    },
    [updateHighlight]
  );

  const handleCommentChange = useCallback(
    (id: string, comment: string) => {
      updateHighlight(id, { comment: comment || undefined });
    },
    [updateHighlight]
  );

  const handleClosePopover = useCallback(() => {
    selectHighlight(null);
  }, [selectHighlight]);

  // Calculate turn angle from drag progress
  const getTurnAngle = (): number => {
    if (turnState === 'turning') return 0; // CSS animation handles it
    if (isDragging) {
      if (dragProgress < 0) {
        // Dragging left = turning forward
        return Math.abs(dragProgress) * 180;
      } else if (dragProgress > 0) {
        // Dragging right = turning backward
        return dragProgress * 180;
      }
    }
    return 0;
  };

  const turnAngle = getTurnAngle();

  // Theme-based background
  const themeStyles = {
    light: 'bg-gray-100',
    dark: 'bg-gray-900',
    sepia: 'bg-amber-50',
  };

  if (!document) {
    return (
      <div
        className={cn(
          'document-container',
          'flex-1',
          themeStyles[theme],
          className
        )}
      >
        <PDFLoadingScreen phase={isLoading ? 'fetching' : 'initializing'} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={cn(
        'book-mode-container',
        'flex-1 overflow-hidden',
        'flex items-center justify-center',
        'select-none',
        themeStyles[theme],
        className
      )}
      onClick={handleContainerClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ perspective: '2000px' }}
    >
      {/* Book wrapper */}
      <div className="book-wrapper" style={{ perspective: '2000px' }}>
        {/* Book spine shadow */}
        <div className="book-spine" />

        {/* Page stack (gives depth illusion) */}
        <div className="book-page-stack" />

        {/* Previous page (visible when turning backward) */}
        {prevPageObj && (turnState === 'turning' && turnDirection === 'backward' || (isDragging && dragProgress > 0)) && (
          <div className="book-page book-page-under">
            <PDFPage
              pageNumber={currentPage - 1}
              page={prevPageObj}
              scale={scale}
              rotation={rotation}
            />
          </div>
        )}

        {/* Next page (visible when turning forward - underneath) */}
        {nextPageObj && (turnState === 'turning' && turnDirection === 'forward' || (isDragging && dragProgress < 0)) && (
          <div className="book-page book-page-under">
            <PDFPage
              pageNumber={currentPage + 1}
              page={nextPageObj}
              scale={scale}
              rotation={rotation}
            />
          </div>
        )}

        {/* Current page (the one that turns) */}
        <div
          className={cn(
            'book-page book-page-current',
            turnState === 'turning' && turnDirection === 'forward' && 'book-turn-forward',
            turnState === 'turning' && turnDirection === 'backward' && 'book-turn-backward',
          )}
          style={
            isDragging && turnAngle > 0
              ? {
                  transform: dragProgress < 0
                    ? `rotateY(-${turnAngle}deg)`
                    : `rotateY(${turnAngle}deg)`,
                  transition: 'none',
                }
              : undefined
          }
        >
          <div className="book-page-front">
            <PDFPage
              pageNumber={displayPage}
              page={currentPageObj}
              scale={scale}
              rotation={rotation}
            />
            {/* Page curl shadow overlay */}
            <div
              className="book-page-shadow-overlay"
              style={
                isDragging && dragProgress < 0
                  ? { opacity: Math.abs(dragProgress) * 0.4 }
                  : undefined
              }
            />
          </div>
          <div className="book-page-back">
            {/* Back of the turning page shows next/prev page */}
            {turnDirection === 'forward' && nextPageObj ? (
              <PDFPage
                pageNumber={currentPage + 1}
                page={nextPageObj}
                scale={scale}
                rotation={rotation}
              />
            ) : turnDirection === 'backward' && prevPageObj ? (
              <PDFPage
                pageNumber={currentPage - 1}
                page={prevPageObj}
                scale={scale}
                rotation={rotation}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Page indicator */}
      <div className="book-page-indicator">
        {currentPage} / {numPages}
      </div>

      {/* Navigation hints */}
      {currentPage > 1 && (
        <div className="book-nav-hint book-nav-hint-left">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </div>
      )}
      {currentPage < numPages && (
        <div className="book-nav-hint book-nav-hint-right">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}

      {/* Selection toolbar */}
      <SelectionToolbar
        selection={selection}
        onCreateHighlight={handleCreateHighlight}
        onCopy={handleCopySelection}
        activeColor={activeColor}
      />

      {/* Highlight popover */}
      <HighlightPopover
        highlight={selectedHighlight}
        scale={scale}
        pageElement={getPageElement()}
        onColorChange={handleColorChange}
        onCommentChange={handleCommentChange}
        onDelete={deleteHighlight}
        onClose={handleClosePopover}
      />

      {/* Loading indicator */}
      {isLoadingPage && !currentPageObj && (
        <div className="fixed bottom-4 right-4 px-3 py-2 bg-black/75 text-white text-sm rounded-lg">
          Loading...
        </div>
      )}
    </div>
  );
});
