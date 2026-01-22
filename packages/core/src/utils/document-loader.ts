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
}

export interface LoadDocumentResult {
  document: PDFDocumentProxy;
  numPages: number;
}

/**
 * Load a PDF document from a URL or data buffer.
 */
export async function loadDocument(options: LoadDocumentOptions): Promise<LoadDocumentResult> {
  const { src, workerSrc, password, onProgress } = options;

  // Initialize pdf.js if not already done
  await initializePDFJS({ workerSrc });

  // Prepare loading parameters
  const loadingTask = pdfjsLib.getDocument({
    url: typeof src === 'string' ? src : undefined,
    data: typeof src !== 'string' ? src : undefined,
    password,
    useWorkerFetch: true,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  // Handle progress
  if (onProgress) {
    loadingTask.onProgress = ({ loaded, total }: { loaded: number; total: number }) => {
      onProgress({ loaded, total });
    };
  }

  const document = await loadingTask.promise;

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
