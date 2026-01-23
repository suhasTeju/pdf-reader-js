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
  } = options;

  // Initialize pdf.js if not already done
  await initializePDFJS({ workerSrc });

  // Check cache for URL-based documents
  const cacheKey = typeof src === 'string' ? src : null;
  if (cacheKey && cacheDocument && documentCache.has(cacheKey)) {
    const cachedDoc = documentCache.get(cacheKey)!;
    return {
      document: cachedDoc,
      numPages: cachedDoc.numPages,
    };
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

  // Handle progress
  if (onProgress) {
    loadingTask.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
      onProgress({ loaded, total });
    };
  }

  const document = await loadingTask.promise;

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
