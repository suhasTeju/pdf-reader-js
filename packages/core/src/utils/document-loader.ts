import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { pdfjsLib, initializePDFJS } from './pdfjs-init';

export interface LoadDocumentOptions {
  /** URL or data of the PDF */
  src: string | ArrayBuffer | Uint8Array;
  /** Custom worker source */
  workerSrc?: string;
  /** Password for encrypted PDFs */
  password?: string;
  /** Callback for loading progress */
  onProgress?: (progress: { loaded: number; total: number }) => void;
  /** Enable range requests for faster loading (default: true) */
  enableRangeRequests?: boolean;
  /** Enable streaming for progressive display (default: true) */
  enableStreaming?: boolean;
  /** Cache the document data (default: true) */
  cacheDocument?: boolean;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

export interface LoadDocumentResult {
  document: PDFDocumentProxy;
  numPages: number;
}

// Document cache to prevent duplicate loading
const documentCache = new Map<string, PDFDocumentProxy>();

/**
 * Load a PDF document from a URL or data buffer.
 *
 * Optimizations:
 * - Range requests allow loading only the parts needed (faster initial load)
 * - Streaming allows pages to render as data arrives
 * - Document caching prevents duplicate fetches
 * - Worker handles parsing off the main thread
 */
export async function loadDocument(options: LoadDocumentOptions): Promise<LoadDocumentResult> {
  const {
    src,
    workerSrc,
    password,
    onProgress,
    enableRangeRequests = true,
    enableStreaming = true,
    cacheDocument = true,
    signal,
  } = options;

  // Check if already aborted
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  // Initialize pdf.js if not already done
  await initializePDFJS({ workerSrc });

  // Check if aborted during initialization
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  // Check cache for URL-based documents
  const cacheKey = typeof src === 'string' ? src : null;
  if (cacheKey && cacheDocument && documentCache.has(cacheKey)) {
    const cachedDoc = documentCache.get(cacheKey)!;
    // Verify the cached doc is still valid (not destroyed)
    try {
      // Check if document looks valid - numPages should be > 0
      // Also check internal state if available
      const numPages = cachedDoc.numPages;
      // @ts-expect-error - checking internal destroyed state
      const isDestroyed = cachedDoc._transport?.destroyed || cachedDoc.destroyed;
      if (numPages > 0 && !isDestroyed) {
        return {
          document: cachedDoc,
          numPages,
        };
      }
      // Invalid document, remove from cache
      documentCache.delete(cacheKey);
    } catch {
      // Document was destroyed or invalid, remove from cache and reload
      documentCache.delete(cacheKey);
    }
  }

  // Prepare loading parameters
  const loadingParams: Record<string, unknown> = {
    password,
    // Performance optimizations
    isEvalSupported: false,
    useSystemFonts: true,
    // Enable range requests for faster initial load
    // This allows PDF.js to request only the parts of the PDF it needs
    disableRange: !enableRangeRequests,
    // Enable streaming for progressive rendering
    disableStream: !enableStreaming,
    // Don't fetch the entire document upfront
    disableAutoFetch: true,
  };

  // Set source based on type
  if (typeof src === 'string') {
    loadingParams.url = src;
  } else {
    loadingParams.data = src;
  }

  const loadingTask = pdfjsLib.getDocument(loadingParams);

  // Handle abort signal
  let abortHandler: (() => void) | null = null;
  if (signal) {
    abortHandler = () => {
      loadingTask.destroy();
    };
    signal.addEventListener('abort', abortHandler);
  }

  // Handle progress
  if (onProgress) {
    loadingTask.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
      onProgress({ loaded, total });
    };
  }

  let document: PDFDocumentProxy;
  try {
    document = await loadingTask.promise;
  } catch (error) {
    // Clean up abort handler
    if (signal && abortHandler) {
      signal.removeEventListener('abort', abortHandler);
    }

    // Check if this was an abort
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    // Re-throw original error
    throw error;
  }

  // Clean up abort handler
  if (signal && abortHandler) {
    signal.removeEventListener('abort', abortHandler);
  }

  // Check if aborted after loading completed
  if (signal?.aborted) {
    document.destroy();
    throw new DOMException('Aborted', 'AbortError');
  }

  // Cache the document
  if (cacheKey && cacheDocument) {
    documentCache.set(cacheKey, document);
  }

  return {
    document,
    numPages: document.numPages,
  };
}

/**
 * Get a specific page from a PDF document.
 */
export async function getPage(
  document: PDFDocumentProxy,
  pageNumber: number
): Promise<PDFPageProxy> {
  if (pageNumber < 1 || pageNumber > document.numPages) {
    throw new Error(`Invalid page number: ${pageNumber}. Document has ${document.numPages} pages.`);
  }

  return document.getPage(pageNumber);
}

/**
 * Get text content from a PDF page.
 */
export async function getPageTextContent(page: PDFPageProxy) {
  return page.getTextContent();
}

/**
 * Get the outline (table of contents) from a PDF document.
 */
export async function getOutline(document: PDFDocumentProxy) {
  return document.getOutline();
}

/**
 * Get metadata from a PDF document.
 */
export async function getMetadata(document: PDFDocumentProxy) {
  return document.getMetadata();
}

/**
 * Clear a document from cache.
 */
export function clearDocumentCache(url?: string): void {
  if (url) {
    const doc = documentCache.get(url);
    if (doc) {
      doc.destroy();
      documentCache.delete(url);
    }
  } else {
    // Clear all
    for (const doc of documentCache.values()) {
      doc.destroy();
    }
    documentCache.clear();
  }
}

/**
 * Preload a PDF document into cache without returning it.
 * Useful for prefetching documents the user might view next.
 */
export async function preloadDocument(url: string): Promise<void> {
  if (documentCache.has(url)) return;

  await loadDocument({ src: url, cacheDocument: true });
}
