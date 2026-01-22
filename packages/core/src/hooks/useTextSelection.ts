import { useCallback, useEffect, useState } from 'react';
import type { TextSelection } from '../types';

export interface UseTextSelectionOptions {
  onSelect?: (selection: TextSelection) => void;
  onCopy?: (text: string) => void;
}

/**
 * Hook for handling text selection in the PDF viewer.
 */
export function useTextSelection(options: UseTextSelectionOptions = {}) {
  const { onSelect, onCopy } = options;
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const handleSelectionChange = useCallback(() => {
    const windowSelection = window.getSelection();

    if (!windowSelection || windowSelection.isCollapsed) {
      setSelection(null);
      return;
    }

    const text = windowSelection.toString().trim();
    if (!text) {
      setSelection(null);
      return;
    }

    // Find the page number from the selection's container
    const anchorNode = windowSelection.anchorNode;
    let pageElement = anchorNode?.parentElement;

    while (pageElement && !pageElement.dataset.pageNumber) {
      pageElement = pageElement.parentElement;
    }

    const pageNumber = pageElement ? parseInt(pageElement.dataset.pageNumber || '1', 10) : 1;

    // Get bounding rectangles
    const range = windowSelection.getRangeAt(0);
    const rects = Array.from(range.getClientRects());

    const newSelection: TextSelection = {
      text,
      pageNumber,
      rects,
    };

    setSelection(newSelection);
    onSelect?.(newSelection);
  }, [onSelect]);

  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }, []);

  const copySelection = useCallback(() => {
    if (selection?.text) {
      navigator.clipboard.writeText(selection.text).then(() => {
        onCopy?.(selection.text);
      });
    }
  }, [selection, onCopy]);

  // Listen for selection changes
  useEffect(() => {
    const handleMouseUp = () => {
      setIsSelecting(false);
      handleSelectionChange();
    };

    const handleMouseDown = () => {
      setIsSelecting(true);
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [handleSelectionChange]);

  // Handle Ctrl+C for copy
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selection) {
        // Let the default copy behavior work, but also trigger our callback
        onCopy?.(selection.text);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection, onCopy]);

  return {
    selection,
    isSelecting,
    clearSelection,
    copySelection,
    hasSelection: selection !== null && selection.text.length > 0,
  };
}
