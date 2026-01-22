import { createRoot, Root } from 'react-dom/client';
import { createElement } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PDFViewer } from '../components/PDFViewer';
import { createViewerStore } from '../store/viewer-store';
import { createAnnotationStore } from '../store/annotation-store';
import { loadDocument } from './document-loader';
import type {
  Highlight,
  Annotation,
  Theme,
  ViewMode,
  SidebarPanel,
  PDFViewerProps,
  PDFDocumentLoadedEvent,
} from '../types';

export interface PDFViewerControllerOptions {
  /** Initial page number */
  initialPage?: number;
  /** Initial scale/zoom level */
  initialScale?: number;
  /** Theme mode */
  theme?: Theme;
  /** Whether to show the toolbar */
  showToolbar?: boolean;
  /** Whether to show the sidebar */
  showSidebar?: boolean;
  /** Custom onDocumentLoad callback */
  onDocumentLoad?: (doc: PDFDocumentProxy) => void;
  /** Custom onPageChange callback */
  onPageChange?: (page: number) => void;
  /** Custom onScaleChange callback */
  onScaleChange?: (scale: number) => void;
  /** Custom onError callback */
  onError?: (error: Error) => void;
  /** PDF source - URL, ArrayBuffer, or Uint8Array */
  src?: string | ArrayBuffer | Uint8Array;
}

export interface PDFViewerController {
  // Document operations
  loadDocument(src: string | ArrayBuffer | Uint8Array): Promise<void>;
  getDocument(): PDFDocumentProxy | null;

  // Navigation
  goToPage(page: number): void;
  nextPage(): void;
  previousPage(): void;
  getCurrentPage(): number;
  getTotalPages(): number;

  // Zoom
  setZoom(scale: number): void;
  zoomIn(): void;
  zoomOut(): void;
  fitToWidth(): void;
  fitToPage(): void;
  getZoom(): number;

  // Rotation
  setRotation(rotation: number): void;
  rotateClockwise(): void;
  rotateCounterClockwise(): void;
  getRotation(): number;

  // Theme & View
  setTheme(theme: Theme): void;
  getTheme(): Theme;
  setViewMode(mode: ViewMode): void;
  getViewMode(): ViewMode;

  // Sidebar
  toggleSidebar(): void;
  setSidebarPanel(panel: SidebarPanel): void;
  isSidebarOpen(): boolean;

  // Highlights
  getHighlights(): Highlight[];
  addHighlight(highlight: Omit<Highlight, 'id' | 'createdAt' | 'updatedAt'>): Highlight;
  removeHighlight(id: string): void;
  exportHighlights(): string;
  importHighlights(json: string): void;

  // Annotations
  getAnnotations(): Annotation[];
  addAnnotation(annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>): Annotation;
  removeAnnotation(id: string): void;
  exportAnnotations(): string;
  importAnnotations(json: string): void;

  // Events
  on<K extends keyof PDFViewerEventHandlers>(
    event: K,
    handler: PDFViewerEventHandlers[K]
  ): () => void;

  // Lifecycle
  destroy(): void;
}

interface PDFViewerEventHandlers {
  pagechange: (page: number) => void;
  scalechange: (scale: number) => void;
  documentload: (doc: PDFDocumentProxy) => void;
  error: (error: Error) => void;
}

type EventType = keyof PDFViewerEventHandlers;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventHandler = (data: any) => void;

/**
 * Create a PDF viewer instance for non-React usage
 */
export function createPDFViewer(
  container: HTMLElement,
  options: PDFViewerControllerOptions = {}
): PDFViewerController {
  // Create stores
  const viewerStore = createViewerStore();
  const annotationStore = createAnnotationStore();

  // Event handlers
  const eventHandlers: Map<EventType, Set<EventHandler>> = new Map();

  // React root
  let root: Root | null = null;
  let isDestroyed = false;

  // Helper to emit events
  const emit = (event: EventType, data: unknown) => {
    const handlers = eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  };

  // Render the viewer
  const render = (src?: string | ArrayBuffer | Uint8Array) => {
    if (isDestroyed) return;

    if (!root) {
      root = createRoot(container);
    }

    const props: PDFViewerProps = {
      src: src || '',
      initialPage: options.initialPage,
      initialScale: options.initialScale,
      theme: options.theme,
      showToolbar: options.showToolbar,
      showSidebar: options.showSidebar,
      onDocumentLoad: (event: PDFDocumentLoadedEvent) => {
        options.onDocumentLoad?.(event.document);
        emit('documentload', event.document);
      },
      onPageChange: (page: number) => {
        options.onPageChange?.(page);
        emit('pagechange', page);
      },
      onScaleChange: (scale: number) => {
        options.onScaleChange?.(scale);
        emit('scalechange', scale);
      },
      onError: (error: Error) => {
        options.onError?.(error);
        emit('error', error);
      },
    };

    root.render(createElement(PDFViewer, props));
  };

  // Initialize with empty render if no src provided
  if (options.src) {
    render(options.src);
  }

  // Controller implementation
  const controller: PDFViewerController = {
    // Document operations
    async loadDocument(src: string | ArrayBuffer | Uint8Array) {
      render(src);
      // Wait for document to load
      const result = await loadDocument({ src });
      viewerStore.getState().setDocument(result.document);
    },

    getDocument() {
      return viewerStore.getState().document;
    },

    // Navigation
    goToPage(page: number) {
      viewerStore.getState().goToPage(page);
    },

    nextPage() {
      viewerStore.getState().nextPage();
    },

    previousPage() {
      viewerStore.getState().previousPage();
    },

    getCurrentPage() {
      return viewerStore.getState().currentPage;
    },

    getTotalPages() {
      return viewerStore.getState().numPages;
    },

    // Zoom
    setZoom(scale: number) {
      viewerStore.getState().setScale(scale);
    },

    zoomIn() {
      viewerStore.getState().zoomIn();
    },

    zoomOut() {
      viewerStore.getState().zoomOut();
    },

    fitToWidth() {
      viewerStore.getState().fitToWidth();
    },

    fitToPage() {
      viewerStore.getState().fitToPage();
    },

    getZoom() {
      return viewerStore.getState().scale;
    },

    // Rotation
    setRotation(rotation: number) {
      viewerStore.getState().setRotation(rotation);
    },

    rotateClockwise() {
      viewerStore.getState().rotateClockwise();
    },

    rotateCounterClockwise() {
      viewerStore.getState().rotateCounterClockwise();
    },

    getRotation() {
      return viewerStore.getState().rotation;
    },

    // Theme & View
    setTheme(theme: Theme) {
      viewerStore.getState().setTheme(theme);
    },

    getTheme() {
      return viewerStore.getState().theme;
    },

    setViewMode(mode: ViewMode) {
      viewerStore.getState().setViewMode(mode);
    },

    getViewMode() {
      return viewerStore.getState().viewMode;
    },

    // Sidebar
    toggleSidebar() {
      viewerStore.getState().toggleSidebar();
    },

    setSidebarPanel(panel: SidebarPanel) {
      viewerStore.getState().setSidebarPanel(panel);
    },

    isSidebarOpen() {
      return viewerStore.getState().sidebarOpen;
    },

    // Highlights
    getHighlights() {
      return annotationStore.getState().highlights;
    },

    addHighlight(highlight) {
      return annotationStore.getState().addHighlight(highlight);
    },

    removeHighlight(id: string) {
      annotationStore.getState().removeHighlight(id);
    },

    exportHighlights() {
      return annotationStore.getState().exportHighlights();
    },

    importHighlights(json: string) {
      annotationStore.getState().importHighlights(json);
    },

    // Annotations
    getAnnotations() {
      return annotationStore.getState().annotations;
    },

    addAnnotation(annotation) {
      return annotationStore.getState().addAnnotation(annotation);
    },

    removeAnnotation(id: string) {
      annotationStore.getState().removeAnnotation(id);
    },

    exportAnnotations() {
      return annotationStore.getState().exportAnnotations();
    },

    importAnnotations(json: string) {
      annotationStore.getState().importAnnotations(json);
    },

    // Events
    on<K extends keyof PDFViewerEventHandlers>(event: K, handler: PDFViewerEventHandlers[K]) {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set());
      }
      eventHandlers.get(event)!.add(handler as EventHandler);

      // Return unsubscribe function
      return () => {
        eventHandlers.get(event)?.delete(handler as EventHandler);
      };
    },

    // Lifecycle
    destroy() {
      if (isDestroyed) return;
      isDestroyed = true;

      // Clear event handlers
      eventHandlers.clear();

      // Unmount React
      if (root) {
        root.unmount();
        root = null;
      }

      // Reset stores
      viewerStore.getState().reset();
      annotationStore.getState().clearAll();
    },
  };

  return controller;
}

/**
 * Initialize a PDF viewer with minimal configuration
 */
export async function quickViewer(
  container: HTMLElement | string,
  src: string | ArrayBuffer | Uint8Array,
  options: Partial<PDFViewerControllerOptions> = {}
): Promise<PDFViewerController> {
  // Resolve container
  const element =
    typeof container === 'string'
      ? document.querySelector<HTMLElement>(container)
      : container;

  if (!element) {
    throw new Error(`Container element not found: ${container}`);
  }

  // Create and load
  const viewer = createPDFViewer(element, { ...options, src });
  return viewer;
}
