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

/**
 * Animation phases:
 * - idle: No turn happening. Current page is displayed flat.
 * - dragging: User is swiping. Page follows finger.
 * - animating-forward: CSS animates the page turning from current position to fully flipped.
 * - animating-backward: CSS animates the page turning backward.
 * - settling: CSS animates the page snapping back to flat (cancelled drag).
 */
type AnimPhase = 'idle' | 'dragging' | 'animating-forward' | 'animating-backward' | 'settling';

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

  // Page proxy objects
  const [currentPageObj, setCurrentPageObj] = useState<PDFPageProxy | null>(null);
  const [prevPageObj, setPrevPageObj] = useState<PDFPageProxy | null>(null);
  const [nextPageObj, setNextPageObj] = useState<PDFPageProxy | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const documentRef = useRef<PDFDocumentProxy | null>(null);

  // Animation state
  const [phase, setPhase] = useState<AnimPhase>('idle');
  const [turnDirection, setTurnDirection] = useState<TurnDirection>('forward');
  const [dragAngle, setDragAngle] = useState(0); // 0..180 degrees
  const phaseRef = useRef<AnimPhase>('idle');
  phaseRef.current = phase;

  // Track which page number is "display" (the page shown flat while idle)
  const [displayPage, setDisplayPage] = useState(currentPage);

  // Drag tracking
  const dragStartXRef = useRef(0);
  const containerWidthRef = useRef(0);
  const hasDraggedRef = useRef(false);

  // Page dimensions (for sizing the book wrapper)
  const [pageDims, setPageDims] = useState({ width: 612, height: 792 });

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

  // ─── Page loading ───────────────────────────────────────────────────

  useEffect(() => {
    if (document !== documentRef.current) {
      documentRef.current = document;
      setCurrentPageObj(null);
      setPrevPageObj(null);
      setNextPageObj(null);
    }
  }, [document]);

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

          // Compute page dimensions from the current page
          if (current) {
            const vp = current.getViewport({ scale, rotation });
            setPageDims({ width: Math.floor(vp.width), height: Math.floor(vp.height) });
          }

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

          if (scrollToPageRequest && scrollToPageRequest.page === currentPage) {
            requestAnimationFrame(() => {
              viewerStore.getState().completeScrollRequest(scrollToPageRequest.requestId);
            });
          }
        }
      } catch {
        // silently handle
      } finally {
        if (!cancelled) setIsLoadingPage(false);
      }
    };

    loadPages();
    return () => { cancelled = true; };
  }, [document, currentPage, numPages, scale, rotation, scrollToPageRequest, viewerStore]);

  // Keep displayPage in sync when idle
  useEffect(() => {
    if (phase === 'idle') {
      setDisplayPage(currentPage);
    }
  }, [currentPage, phase]);

  // Update page dims on scale/rotation change
  useEffect(() => {
    if (currentPageObj) {
      const vp = currentPageObj.getViewport({ scale, rotation });
      setPageDims({ width: Math.floor(vp.width), height: Math.floor(vp.height) });
    }
  }, [currentPageObj, scale, rotation]);

  // ─── Core turn logic ──────────────────────────────────────────────

  const startAnimatedTurn = useCallback((direction: TurnDirection) => {
    if (phaseRef.current !== 'idle' && phaseRef.current !== 'dragging') return;
    if (direction === 'forward' && currentPage >= numPages) return;
    if (direction === 'backward' && currentPage <= 1) return;

    setTurnDirection(direction);
    setPhase(direction === 'forward' ? 'animating-forward' : 'animating-backward');
    if (enableSound) playPageTurnSound(soundVolume);
  }, [currentPage, numPages, enableSound, soundVolume]);

  // When CSS animation ends, commit the page change and go back to idle
  const handleAnimationEnd = useCallback(() => {
    if (phase === 'animating-forward' || phase === 'animating-backward') {
      const dir = phase === 'animating-forward' ? 'forward' : 'backward';
      if (dir === 'forward') {
        nextPage();
      } else {
        previousPage();
      }
      setDragAngle(0);
      setPhase('idle');
    } else if (phase === 'settling') {
      setDragAngle(0);
      setPhase('idle');
    }
  }, [phase, nextPage, previousPage]);

  // ─── Pointer / swipe handlers ─────────────────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (phaseRef.current !== 'idle') return;
    const container = containerRef.current;
    if (!container) return;

    containerWidthRef.current = container.offsetWidth;
    dragStartXRef.current = e.clientX;
    hasDraggedRef.current = false;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (phaseRef.current !== 'idle' && phaseRef.current !== 'dragging') return;

    const dx = e.clientX - dragStartXRef.current;
    const absDx = Math.abs(dx);

    // Only start dragging after 8px threshold to avoid accidental triggers
    if (phaseRef.current === 'idle' && absDx < 8) return;

    const width = containerWidthRef.current || 1;

    // Determine direction from drag
    let dir: TurnDirection;
    if (dx < 0) {
      dir = 'forward';  // swiping left → next page
      if (currentPage >= numPages) return;
    } else {
      dir = 'backward'; // swiping right → prev page
      if (currentPage <= 1) return;
    }

    if (phaseRef.current === 'idle') {
      setTurnDirection(dir);
      setPhase('dragging');
    }

    hasDraggedRef.current = true;

    // Map drag distance to 0-180 degrees
    const progress = Math.min(absDx / (width * 0.6), 1);
    const angle = progress * 180;
    setDragAngle(angle);
  }, [currentPage, numPages]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (phaseRef.current === 'dragging') {
      const threshold = 45; // degrees
      if (dragAngle >= threshold) {
        // Complete the turn with CSS animation from current angle
        setPhase(turnDirection === 'forward' ? 'animating-forward' : 'animating-backward');
        if (enableSound) playPageTurnSound(soundVolume);
      } else {
        // Snap back
        setPhase('settling');
      }
    }
    // If idle (no drag happened), don't do anything - let click handler deal with it
  }, [dragAngle, turnDirection, enableSound, soundVolume]);

  // ─── Click navigation (left/right zones) ──────────────────────────

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Don't trigger if we just finished a drag
    if (hasDraggedRef.current) return;
    if (phaseRef.current !== 'idle') return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const zone = rect.width / 3;

    if (x < zone) {
      startAnimatedTurn('backward');
    } else if (x > rect.width - zone) {
      startAnimatedTurn('forward');
    }
  }, [startAnimatedTurn]);

  // ─── Keyboard navigation ──────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        startAnimatedTurn('forward');
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        startAnimatedTurn('backward');
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      return () => container.removeEventListener('keydown', handleKeyDown);
    }
  }, [startAnimatedTurn]);

  // ─── Highlight handlers ────────────────────────────────────────────

  const getPageElement = useCallback((): HTMLElement | null => {
    return containerRef.current?.querySelector(`[data-page-number="${currentPage}"]`) as HTMLElement | null;
  }, [currentPage]);

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

  const handleCopySelection = useCallback(() => { copySelection(); }, [copySelection]);

  const handleColorChange = useCallback(
    (id: string, color: HighlightColor) => { updateHighlight(id, { color }); },
    [updateHighlight]
  );

  const handleCommentChange = useCallback(
    (id: string, comment: string) => { updateHighlight(id, { comment: comment || undefined }); },
    [updateHighlight]
  );

  const handleClosePopover = useCallback(() => { selectHighlight(null); }, [selectHighlight]);

  // ─── Compute styles for the turning page ──────────────────────────

  const getTurningPageStyle = (): React.CSSProperties => {
    if (phase === 'dragging') {
      // Page follows the finger - rotate from the right edge (forward) or left edge (backward)
      const angle = turnDirection === 'forward' ? -dragAngle : dragAngle;
      return {
        transform: `rotateY(${angle}deg)`,
        transition: 'none',
      };
    }
    // For CSS animation phases, styles are handled by CSS classes
    return {};
  };

  // The shadow intensity grows as the page turns
  const getShadowOpacity = (): number => {
    if (phase === 'dragging') return (dragAngle / 180) * 0.5;
    return 0;
  };

  // ─── Determine which pages to show ────────────────────────────────

  const isTurning = phase !== 'idle';
  const showNextUnderneath = isTurning && turnDirection === 'forward' && nextPageObj;
  const showPrevUnderneath = isTurning && turnDirection === 'backward' && prevPageObj;

  // ─── Theme ────────────────────────────────────────────────────────

  const themeStyles = {
    light: 'bg-gray-100',
    dark: 'bg-gray-900',
    sepia: 'bg-amber-50',
  };

  const themeClass = theme === 'dark' ? 'dark' : theme === 'sepia' ? 'sepia' : '';

  if (!document) {
    return (
      <div className={cn('document-container', 'flex-1', themeStyles[theme], className)}>
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
        themeStyles[theme],
        themeClass,
        className
      )}
      onClick={handleContainerClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ perspective: '1800px' }}
    >
      {/* Book wrapper - sized to the PDF page */}
      <div
        className="book-wrapper"
        style={{
          width: pageDims.width,
          height: pageDims.height,
          perspective: '1800px',
        }}
      >
        {/* Page stack edges (depth illusion) */}
        <div className="book-page-edges" />

        {/* Layer 1: The page revealed underneath during a turn */}
        {showNextUnderneath && (
          <div className="book-layer-under">
            <PDFPage
              pageNumber={currentPage + 1}
              page={nextPageObj}
              scale={scale}
              rotation={rotation}
            />
            {/* Inner shadow on the revealed page */}
            <div
              className="book-reveal-shadow"
              style={{ opacity: getShadowOpacity() }}
            />
          </div>
        )}
        {showPrevUnderneath && (
          <div className="book-layer-under">
            <PDFPage
              pageNumber={currentPage - 1}
              page={prevPageObj}
              scale={scale}
              rotation={rotation}
            />
            <div
              className="book-reveal-shadow book-reveal-shadow-right"
              style={{ opacity: getShadowOpacity() }}
            />
          </div>
        )}

        {/* Layer 2: The current page (turns via 3D transform) */}
        <div
          className={cn(
            'book-turning-page',
            turnDirection === 'forward' ? 'book-origin-right' : 'book-origin-left',
            phase === 'animating-forward' && 'book-anim-flip-forward',
            phase === 'animating-backward' && 'book-anim-flip-backward',
            phase === 'settling' && 'book-anim-settle',
          )}
          style={{
            ...getTurningPageStyle(),
            // Pass current drag angle as CSS var for animation start point
            ...(phase === 'animating-forward' || phase === 'animating-backward' || phase === 'settling'
              ? { '--book-drag-angle': `${dragAngle}deg` } as React.CSSProperties
              : {}),
          }}
          onAnimationEnd={handleAnimationEnd}
          onTransitionEnd={phase === 'settling' ? handleAnimationEnd : undefined}
        >
          {/* Front face */}
          <div className="book-face book-face-front">
            <PDFPage
              pageNumber={displayPage}
              page={currentPageObj}
              scale={scale}
              rotation={rotation}
            />
            {/* Gradient shadow that darkens as page lifts */}
            <div
              className="book-lift-shadow"
              style={{
                opacity: phase === 'dragging'
                  ? (dragAngle / 180) * 0.4
                  : undefined,
              }}
            />
          </div>

          {/* Back face (mirrored, visible when page is >90 degrees) */}
          <div className="book-face book-face-back">
            {turnDirection === 'forward' && nextPageObj && (
              <PDFPage
                pageNumber={currentPage + 1}
                page={nextPageObj}
                scale={scale}
                rotation={rotation}
              />
            )}
            {turnDirection === 'backward' && prevPageObj && (
              <PDFPage
                pageNumber={currentPage - 1}
                page={prevPageObj}
                scale={scale}
                rotation={rotation}
              />
            )}
          </div>
        </div>

        {/* Fold shadow that appears along the turning edge */}
        {isTurning && (
          <div
            className={cn(
              'book-fold-shadow',
              turnDirection === 'forward' ? 'book-fold-shadow-left' : 'book-fold-shadow-right',
            )}
            style={{
              opacity: phase === 'dragging'
                ? Math.min(dragAngle / 90, 1) * 0.3
                : undefined,
            }}
          />
        )}
      </div>

      {/* Page number indicator */}
      <div className="book-page-indicator">
        {currentPage} / {numPages}
      </div>

      {/* Navigation arrow hints */}
      {currentPage > 1 && phase === 'idle' && (
        <div className="book-nav-hint book-nav-hint-left">
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </div>
      )}
      {currentPage < numPages && phase === 'idle' && (
        <div className="book-nav-hint book-nav-hint-right">
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
