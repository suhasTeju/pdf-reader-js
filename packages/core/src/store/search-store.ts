import { createStore } from 'zustand/vanilla';
import type { SearchState, SearchResult, HighlightRect } from '../types';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// Define local text item interface to avoid pdfjs-dist type issues
interface TextContentItem {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
}

export interface SearchActions {
  setQuery: (query: string) => void;
  search: (document: PDFDocumentProxy) => Promise<void>;
  clearSearch: () => void;
  nextResult: () => void;
  previousResult: () => void;
  goToResult: (index: number) => void;
  toggleCaseSensitive: () => void;
  toggleWholeWord: () => void;
  getCurrentResult: () => SearchResult | null;
}

export type SearchStore = SearchState & SearchActions;

const initialState: SearchState = {
  query: '',
  results: [],
  currentResultIndex: -1,
  isSearching: false,
  caseSensitive: false,
  wholeWord: false,
};

function isTextItem(item: TextContentItem): item is TextContentItem & { str: string; transform: number[]; width: number; height: number } {
  return typeof item.str === 'string';
}

export function createSearchStore(initialOverrides: Partial<SearchState> = {}) {
  return createStore<SearchStore>()((set, get) => ({
    ...initialState,
    ...initialOverrides,

    setQuery: (query) => {
      set({ query });
    },

    search: async (document) => {
      const { query, caseSensitive, wholeWord } = get();

      if (!query.trim()) {
        set({ results: [], currentResultIndex: -1, isSearching: false });
        return;
      }

      set({ isSearching: true, results: [], currentResultIndex: -1 });

      const results: SearchResult[] = [];
      const numPages = document.numPages;

      // Prepare search pattern
      const searchText = caseSensitive ? query : query.toLowerCase();

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          const page = await document.getPage(pageNum);
          const textContent = await page.getTextContent();
          const viewport = page.getViewport({ scale: 1 });

          // Combine all text items on the page
          let pageText = '';
          const textItems: Array<{ text: string; transform: number[]; width: number; height: number }> = [];

          for (const item of textContent.items as TextContentItem[]) {
            if (isTextItem(item)) {
              textItems.push({
                text: item.str,
                transform: item.transform,
                width: item.width,
                height: item.height,
              });
              pageText += item.str;
            }
          }

          // Search in page text
          const textToSearch = caseSensitive ? pageText : pageText.toLowerCase();
          let matchIndex = 0;
          let startIndex = 0;

          while ((startIndex = textToSearch.indexOf(searchText, startIndex)) !== -1) {
            // Check whole word condition
            if (wholeWord) {
              const before = startIndex > 0 ? textToSearch[startIndex - 1] : ' ';
              const after = startIndex + searchText.length < textToSearch.length
                ? textToSearch[startIndex + searchText.length]
                : ' ';

              if (/\w/.test(before) || /\w/.test(after)) {
                startIndex++;
                continue;
              }
            }

            // Find the text items that contain this match
            const matchText = pageText.substring(startIndex, startIndex + query.length);
            const rects = calculateMatchRects(textItems, startIndex, query.length, viewport);

            results.push({
              pageNumber: pageNum,
              matchIndex: matchIndex++,
              text: matchText,
              rects,
            });

            startIndex++;
          }
        } catch (error) {
          console.error(`Error searching page ${pageNum}:`, error);
        }
      }

      set({
        results,
        currentResultIndex: results.length > 0 ? 0 : -1,
        isSearching: false,
      });
    },

    clearSearch: () => {
      set(initialState);
    },

    nextResult: () => {
      const { results, currentResultIndex } = get();
      if (results.length === 0) return;

      const nextIndex = (currentResultIndex + 1) % results.length;
      set({ currentResultIndex: nextIndex });
    },

    previousResult: () => {
      const { results, currentResultIndex } = get();
      if (results.length === 0) return;

      const prevIndex = currentResultIndex <= 0 ? results.length - 1 : currentResultIndex - 1;
      set({ currentResultIndex: prevIndex });
    },

    goToResult: (index) => {
      const { results } = get();
      if (index >= 0 && index < results.length) {
        set({ currentResultIndex: index });
      }
    },

    toggleCaseSensitive: () => {
      set((state) => ({ caseSensitive: !state.caseSensitive }));
    },

    toggleWholeWord: () => {
      set((state) => ({ wholeWord: !state.wholeWord }));
    },

    getCurrentResult: () => {
      const { results, currentResultIndex } = get();
      if (currentResultIndex >= 0 && currentResultIndex < results.length) {
        return results[currentResultIndex];
      }
      return null;
    },
  }));
}

/**
 * Calculate the bounding rectangles for a text match.
 * This is a simplified implementation that may need refinement for complex layouts.
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
      const matchWidth = (item.width / item.text.length) * (matchEndInItem - matchStartInItem);
      const matchX = x + (item.width / item.text.length) * matchStartInItem;

      rects.push({
        x: matchX,
        y: y - height,
        width: matchWidth,
        height: height,
      });
    }

    currentOffset = itemEnd;
  }

  return rects;
}

export type SearchStoreApi = ReturnType<typeof createSearchStore>;
