import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { HighlightRect } from '../types';

// ============================================================================
// Text Search Utility Types
// ============================================================================

export interface TextMatch {
  /** The matched text */
  text: string;
  /** Position rects on the page */
  rects: HighlightRect[];
  /** Page number where the match was found */
  pageNumber: number;
  /** Character index where the match starts in the page text */
  startIndex: number;
}

export interface FindTextOptions {
  /** Case sensitive search (default: false) */
  caseSensitive?: boolean;
  /** Match whole words only (default: false) */
  wholeWord?: boolean;
}

export interface CharPosition {
  char: string;
  rect: HighlightRect;
}

/** Internal text item representation */
interface TextItem {
  text: string;
  transform: number[];
  width: number;
  height: number;
}

// ============================================================================
// Text Search Functions
// ============================================================================

/**
 * Extract text content with text items from a PDF page.
 * Uses proper text item tracking for accurate positioning.
 */
export async function extractPageText(
  document: PDFDocumentProxy,
  pageNumber: number
): Promise<{ fullText: string; textItems: TextItem[]; viewport: { width: number; height: number } }> {
  const page = await document.getPage(pageNumber);
  const textContent = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });

  let fullText = '';
  const textItems: TextItem[] = [];

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

  return { fullText, textItems, viewport };
}

/**
 * Calculate the bounding rectangles for a text match by tracking text item offsets.
 */
function calculateMatchRects(
  textItems: TextItem[],
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

/**
 * Find all occurrences of text on a specific page.
 */
export async function findTextOnPage(
  document: PDFDocumentProxy,
  pageNumber: number,
  query: string,
  options: FindTextOptions = {}
): Promise<TextMatch[]> {
  const { caseSensitive = false, wholeWord = false } = options;

  if (!query || pageNumber < 1 || pageNumber > document.numPages) {
    return [];
  }

  const { fullText, textItems, viewport } = await extractPageText(document, pageNumber);
  const matches: TextMatch[] = [];

  const searchText = caseSensitive ? query : query.toLowerCase();
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
      matches.push({
        text: fullText.substring(matchIndex, matchIndex + query.length),
        rects: matchRects,
        pageNumber,
        startIndex: matchIndex,
      });
    }

    startIndex = matchIndex + 1;
  }

  return matches;
}

/**
 * Find all occurrences of text across multiple pages.
 */
export async function findTextInDocument(
  document: PDFDocumentProxy,
  query: string,
  options: FindTextOptions & { pageRange?: number[] } = {}
): Promise<TextMatch[]> {
  const { pageRange, ...findOptions } = options;

  const pagesToSearch = pageRange ?? Array.from({ length: document.numPages }, (_, i) => i + 1);
  const allMatches: TextMatch[] = [];

  for (const pageNum of pagesToSearch) {
    if (pageNum < 1 || pageNum > document.numPages) continue;

    try {
      const matches = await findTextOnPage(document, pageNum, query, findOptions);
      allMatches.push(...matches);
    } catch {
      // Skip pages that fail to load
    }
  }

  return allMatches;
}

/**
 * Merge adjacent rects into larger rects.
 */
export function mergeAdjacentRects(rects: HighlightRect[]): HighlightRect[] {
  if (rects.length === 0) return [];

  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const merged: HighlightRect[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const rect = sorted[i];
    // If same line (similar y) and adjacent x
    if (Math.abs(rect.y - current.y) < 2 && rect.x <= current.x + current.width + 2) {
      // Extend current
      const newRight = Math.max(current.x + current.width, rect.x + rect.width);
      current.width = newRight - current.x;
      current.height = Math.max(current.height, rect.height);
    } else {
      merged.push(current);
      current = { ...rect };
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Get the full text content of a page as a string.
 */
export async function getPageText(
  document: PDFDocumentProxy,
  pageNumber: number
): Promise<string> {
  if (pageNumber < 1 || pageNumber > document.numPages) {
    return '';
  }

  const page = await document.getPage(pageNumber);
  const textContent = await page.getTextContent();

  return textContent.items
    .filter((item): item is (typeof textContent.items[number] & { str: string }) => 'str' in item)
    .map(item => item.str)
    .join('');
}

/**
 * Count occurrences of text on a page without extracting positions.
 */
export async function countTextOnPage(
  document: PDFDocumentProxy,
  pageNumber: number,
  query: string,
  options: FindTextOptions = {}
): Promise<number> {
  const { caseSensitive = false, wholeWord = false } = options;

  if (!query || pageNumber < 1 || pageNumber > document.numPages) {
    return 0;
  }

  const text = await getPageText(document, pageNumber);
  const searchText = caseSensitive ? query : query.toLowerCase();
  const textToSearch = caseSensitive ? text : text.toLowerCase();

  let count = 0;
  let startIndex = 0;

  while (true) {
    const matchIndex = textToSearch.indexOf(searchText, startIndex);
    if (matchIndex === -1) break;

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

    count++;
    startIndex = matchIndex + 1;
  }

  return count;
}
