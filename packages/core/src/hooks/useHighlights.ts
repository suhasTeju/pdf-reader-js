import { useCallback, useRef } from 'react';
import { useAnnotationStore } from './PDFViewerContext';
import type { TextSelection, HighlightRect, HighlightColor, Highlight } from '../types';

export interface UseHighlightsOptions {
  /** Callback when a highlight is created */
  onHighlightCreate?: (highlight: Highlight) => void;
  /** Callback when a highlight is updated */
  onHighlightUpdate?: (highlight: Highlight) => void;
  /** Callback when a highlight is deleted */
  onHighlightDelete?: (id: string) => void;
}

export interface UseHighlightsReturn {
  /** Create a highlight from the current text selection */
  createHighlightFromSelection: (
    selection: TextSelection,
    pageElement: HTMLElement,
    scale: number,
    color?: HighlightColor
  ) => Highlight | null;
  /**
   * Add a highlight programmatically with coordinates.
   * Coordinates should be in PDF points (not scaled).
   *
   * @example
   * ```tsx
   * addHighlight({
   *   pageNumber: 1,
   *   rects: [{ x: 100, y: 200, width: 150, height: 20 }],
   *   text: "Highlighted text",
   *   color: "yellow"
   * });
   * ```
   */
  addHighlight: (highlight: {
    pageNumber: number;
    rects: HighlightRect[];
    text: string;
    color?: HighlightColor;
    comment?: string;
  }) => Highlight;
  /** Update an existing highlight */
  updateHighlight: (id: string, updates: Partial<Pick<Highlight, 'color' | 'comment'>>) => void;
  /** Delete a highlight */
  deleteHighlight: (id: string) => void;
  /** Get highlights for a specific page */
  highlightsForPage: (pageNumber: number) => Highlight[];
  /** Get all highlights */
  allHighlights: Highlight[];
  /** Get the currently selected highlight */
  selectedHighlight: Highlight | null;
  /** Select a highlight by ID */
  selectHighlight: (id: string | null) => void;
  /** Get the active highlight color */
  activeColor: HighlightColor;
  /** Set the active highlight color */
  setActiveColor: (color: HighlightColor) => void;
}

/**
 * Convert DOMRect from browser selection to HighlightRect for storage.
 * Normalizes coordinates relative to page container and adjusts for scale.
 */
function domRectToHighlightRect(
  domRect: DOMRect,
  pageElement: HTMLElement,
  scale: number
): HighlightRect {
  const pageRect = pageElement.getBoundingClientRect();
  return {
    x: (domRect.left - pageRect.left) / scale,
    y: (domRect.top - pageRect.top) / scale,
    width: domRect.width / scale,
    height: domRect.height / scale,
  };
}

/**
 * Merge overlapping or adjacent rects to reduce the number of highlight rects.
 * This helps when selections span multiple lines.
 */
function mergeRects(rects: HighlightRect[]): HighlightRect[] {
  if (rects.length <= 1) return rects;

  // Sort by y position, then x position
  const sorted = [...rects].sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) < 2) return a.x - b.x;
    return yDiff;
  });

  const merged: HighlightRect[] = [];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const sameRow = Math.abs(current.y - next.y) < 2 && Math.abs(current.height - next.height) < 2;
    const overlapsOrAdjacent = current.x + current.width >= next.x - 2;

    if (sameRow && overlapsOrAdjacent) {
      // Merge the rects
      const right = Math.max(current.x + current.width, next.x + next.width);
      current = {
        x: Math.min(current.x, next.x),
        y: Math.min(current.y, next.y),
        width: right - Math.min(current.x, next.x),
        height: Math.max(current.height, next.height),
      };
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Hook for creating and managing highlights from text selections.
 */
export function useHighlights(options: UseHighlightsOptions = {}): UseHighlightsReturn {
  const { onHighlightCreate, onHighlightUpdate, onHighlightDelete } = options;

  // Store refs for callbacks to avoid stale closures
  const callbacksRef = useRef({ onHighlightCreate, onHighlightUpdate, onHighlightDelete });
  callbacksRef.current = { onHighlightCreate, onHighlightUpdate, onHighlightDelete };

  // Get store actions
  const addHighlightStore = useAnnotationStore((s) => s.addHighlight);
  const updateHighlightStore = useAnnotationStore((s) => s.updateHighlight);
  const removeHighlight = useAnnotationStore((s) => s.removeHighlight);
  const getHighlightsByPage = useAnnotationStore((s) => s.getHighlightsByPage);
  const highlights = useAnnotationStore((s) => s.highlights);
  const selectedHighlightId = useAnnotationStore((s) => s.selectedHighlightId);
  const selectHighlightStore = useAnnotationStore((s) => s.selectHighlight);
  const activeHighlightColor = useAnnotationStore((s) => s.activeHighlightColor);
  const setActiveHighlightColor = useAnnotationStore((s) => s.setActiveHighlightColor);

  const createHighlightFromSelection = useCallback(
    (
      selection: TextSelection,
      pageElement: HTMLElement,
      scale: number,
      color?: HighlightColor
    ): Highlight | null => {
      if (!selection.text || selection.rects.length === 0) {
        return null;
      }

      // Convert DOMRects to HighlightRects
      const highlightRects = selection.rects.map((domRect) =>
        domRectToHighlightRect(domRect, pageElement, scale)
      );

      // Merge adjacent rects
      const mergedRects = mergeRects(highlightRects);

      // Filter out any invalid rects
      const validRects = mergedRects.filter(
        (rect) => rect.width > 0 && rect.height > 0
      );

      if (validRects.length === 0) {
        return null;
      }

      // Create the highlight
      const highlight = addHighlightStore({
        pageNumber: selection.pageNumber,
        rects: validRects,
        color: color ?? activeHighlightColor,
        text: selection.text,
      });

      callbacksRef.current.onHighlightCreate?.(highlight);
      return highlight;
    },
    [addHighlightStore, activeHighlightColor]
  );

  // Programmatic highlight creation with coordinates
  const addHighlightWithCoords = useCallback(
    (data: {
      pageNumber: number;
      rects: HighlightRect[];
      text: string;
      color?: HighlightColor;
      comment?: string;
    }): Highlight => {
      const highlight = addHighlightStore({
        pageNumber: data.pageNumber,
        rects: data.rects,
        text: data.text,
        color: data.color ?? activeHighlightColor,
        comment: data.comment,
      });

      callbacksRef.current.onHighlightCreate?.(highlight);
      return highlight;
    },
    [addHighlightStore, activeHighlightColor]
  );

  const updateHighlight = useCallback(
    (id: string, updates: Partial<Pick<Highlight, 'color' | 'comment'>>) => {
      updateHighlightStore(id, updates);
      const updated = highlights.find((h) => h.id === id);
      if (updated) {
        callbacksRef.current.onHighlightUpdate?.({ ...updated, ...updates });
      }
    },
    [updateHighlightStore, highlights]
  );

  const deleteHighlight = useCallback(
    (id: string) => {
      removeHighlight(id);
      callbacksRef.current.onHighlightDelete?.(id);
    },
    [removeHighlight]
  );

  const highlightsForPage = useCallback(
    (pageNumber: number) => {
      return getHighlightsByPage(pageNumber);
    },
    [getHighlightsByPage]
  );

  const selectedHighlight = selectedHighlightId
    ? highlights.find((h) => h.id === selectedHighlightId) ?? null
    : null;

  return {
    createHighlightFromSelection,
    addHighlight: addHighlightWithCoords,
    updateHighlight,
    deleteHighlight,
    highlightsForPage,
    allHighlights: highlights,
    selectedHighlight,
    selectHighlight: selectHighlightStore,
    activeColor: activeHighlightColor,
    setActiveColor: setActiveHighlightColor,
  };
}
