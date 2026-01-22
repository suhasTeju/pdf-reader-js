import * as pdfjsLib from 'pdfjs-dist';

let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

export interface PDFJSInitOptions {
  /** Custom worker source URL */
  workerSrc?: string;
  /** Whether to use the fake worker (for testing) */
  useFakeWorker?: boolean;
}

/**
 * Initialize pdf.js with the worker.
 * This should be called before loading any PDFs.
 */
export async function initializePDFJS(options: PDFJSInitOptions = {}): Promise<void> {
  if (isInitialized) {
    return;
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    if (options.useFakeWorker) {
      // Use fake worker for testing
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    } else if (options.workerSrc) {
      // Use custom worker source
      pdfjsLib.GlobalWorkerOptions.workerSrc = options.workerSrc;
    } else {
      // Use the CDN worker for reliability
      const version = pdfjsLib.version;
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
    }

    isInitialized = true;
  })();

  return initializationPromise;
}

/**
 * Check if pdf.js is initialized
 */
export function isPDFJSInitialized(): boolean {
  return isInitialized;
}

/**
 * Reset initialization state (for testing)
 */
export function resetPDFJS(): void {
  isInitialized = false;
  initializationPromise = null;
}

export { pdfjsLib };
