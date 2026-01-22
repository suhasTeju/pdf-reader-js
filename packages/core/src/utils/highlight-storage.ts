import type { Highlight, HighlightColor } from '../types';

const STORAGE_PREFIX = 'pdf-reader-highlights';

/**
 * Generate a storage key for a document.
 * Uses documentId to uniquely identify each PDF's highlights.
 */
function getStorageKey(documentId: string): string {
  return `${STORAGE_PREFIX}:${documentId}`;
}

/**
 * Check if localStorage is available (SSR-safe).
 */
function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Serializable version of a highlight for storage.
 * Dates are stored as ISO strings.
 */
interface StoredHighlight {
  id: string;
  pageNumber: number;
  rects: Array<{ x: number; y: number; width: number; height: number }>;
  color: HighlightColor;
  text: string;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Convert a Highlight to storable format.
 */
function toStoredHighlight(highlight: Highlight): StoredHighlight {
  return {
    ...highlight,
    createdAt: highlight.createdAt.toISOString(),
    updatedAt: highlight.updatedAt.toISOString(),
  };
}

/**
 * Convert a stored highlight back to a Highlight.
 */
function fromStoredHighlight(stored: StoredHighlight): Highlight {
  return {
    ...stored,
    createdAt: new Date(stored.createdAt),
    updatedAt: new Date(stored.updatedAt),
  };
}

/**
 * Save highlights to localStorage for a specific document.
 *
 * @param documentId - Unique identifier for the document (e.g., URL hash, filename)
 * @param highlights - Array of highlights to save
 * @returns true if save succeeded, false otherwise
 */
export function saveHighlights(documentId: string, highlights: Highlight[]): boolean {
  if (!isStorageAvailable()) {
    console.warn('localStorage not available, highlights will not persist');
    return false;
  }

  try {
    const key = getStorageKey(documentId);
    const storedHighlights = highlights.map(toStoredHighlight);
    localStorage.setItem(key, JSON.stringify(storedHighlights));
    return true;
  } catch (error) {
    console.error('Failed to save highlights:', error);
    return false;
  }
}

/**
 * Load highlights from localStorage for a specific document.
 *
 * @param documentId - Unique identifier for the document
 * @returns Array of highlights, empty array if none found or error
 */
export function loadHighlights(documentId: string): Highlight[] {
  if (!isStorageAvailable()) {
    return [];
  }

  try {
    const key = getStorageKey(documentId);
    const stored = localStorage.getItem(key);

    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored) as StoredHighlight[];
    return parsed.map(fromStoredHighlight);
  } catch (error) {
    console.error('Failed to load highlights:', error);
    return [];
  }
}

/**
 * Remove all highlights for a specific document from localStorage.
 *
 * @param documentId - Unique identifier for the document
 * @returns true if removal succeeded, false otherwise
 */
export function clearHighlights(documentId: string): boolean {
  if (!isStorageAvailable()) {
    return false;
  }

  try {
    const key = getStorageKey(documentId);
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Failed to clear highlights:', error);
    return false;
  }
}

/**
 * Get all document IDs that have stored highlights.
 *
 * @returns Array of document IDs
 */
export function getAllDocumentIds(): string[] {
  if (!isStorageAvailable()) {
    return [];
  }

  const ids: string[] = [];
  const prefixLength = STORAGE_PREFIX.length + 1; // +1 for the colon

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX + ':')) {
      ids.push(key.slice(prefixLength));
    }
  }

  return ids;
}

/**
 * Export highlights as a JSON string.
 * Includes metadata for import/export portability.
 *
 * @param highlights - Array of highlights to export
 * @returns JSON string representation
 */
export function exportHighlightsAsJSON(highlights: Highlight[]): string {
  const exportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    highlights: highlights.map(toStoredHighlight),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Import highlights from a JSON string.
 *
 * @param json - JSON string to import
 * @returns Array of highlights, or null if invalid
 */
export function importHighlightsFromJSON(json: string): Highlight[] | null {
  try {
    const data = JSON.parse(json);

    // Handle both direct array format and wrapped format
    let highlights: StoredHighlight[];
    if (Array.isArray(data)) {
      highlights = data;
    } else if (data.highlights && Array.isArray(data.highlights)) {
      highlights = data.highlights;
    } else {
      return null;
    }

    return highlights.map(fromStoredHighlight);
  } catch (error) {
    console.error('Failed to import highlights:', error);
    return null;
  }
}

/**
 * Export highlights as Markdown format.
 * Groups by page and includes text, comments, and metadata.
 *
 * @param highlights - Array of highlights to export
 * @param documentTitle - Optional document title for the header
 * @returns Markdown string representation
 */
export function exportHighlightsAsMarkdown(
  highlights: Highlight[],
  documentTitle?: string
): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${documentTitle || 'PDF Highlights'}`);
  lines.push('');
  lines.push(`Exported on ${new Date().toLocaleDateString()}`);
  lines.push('');

  if (highlights.length === 0) {
    lines.push('_No highlights_');
    return lines.join('\n');
  }

  // Group by page
  const byPage = new Map<number, Highlight[]>();
  highlights.forEach((h) => {
    if (!byPage.has(h.pageNumber)) {
      byPage.set(h.pageNumber, []);
    }
    byPage.get(h.pageNumber)!.push(h);
  });

  // Sort pages
  const sortedPages = Array.from(byPage.keys()).sort((a, b) => a - b);

  // Render each page group
  sortedPages.forEach((pageNumber) => {
    lines.push(`## Page ${pageNumber}`);
    lines.push('');

    const pageHighlights = byPage.get(pageNumber)!;
    // Sort highlights by vertical position
    pageHighlights.sort((a, b) => (a.rects[0]?.y ?? 0) - (b.rects[0]?.y ?? 0));

    pageHighlights.forEach((highlight) => {
      // Color indicator as emoji
      const colorEmoji = {
        yellow: '🟡',
        green: '🟢',
        blue: '🔵',
        pink: '🩷',
        orange: '🟠',
      }[highlight.color];

      lines.push(`${colorEmoji} > ${highlight.text}`);

      if (highlight.comment) {
        lines.push('');
        lines.push(`**Note:** ${highlight.comment}`);
      }

      lines.push('');
    });
  });

  // Summary
  lines.push('---');
  lines.push(`*${highlights.length} highlight${highlights.length !== 1 ? 's' : ''} total*`);

  return lines.join('\n');
}

/**
 * Generate a document ID from a URL or file path.
 * Creates a consistent hash for the same document.
 *
 * @param source - URL or file path
 * @returns Document ID string
 */
export function generateDocumentId(source: string | ArrayBuffer | Uint8Array): string {
  if (typeof source === 'string') {
    // For URLs, use a simplified hash
    let hash = 0;
    for (let i = 0; i < source.length; i++) {
      const char = source.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `doc-${Math.abs(hash).toString(36)}`;
  }

  // For binary data, use size-based ID (not ideal but simple)
  const size = source instanceof ArrayBuffer ? source.byteLength : source.length;
  return `doc-binary-${size}`;
}
