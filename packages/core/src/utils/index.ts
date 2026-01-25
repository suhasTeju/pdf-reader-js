export { cn } from './cn';
export { initializePDFJS, isPDFJSInitialized, resetPDFJS, pdfjsLib } from './pdfjs-init';
export {
  loadDocument,
  loadDocumentWithCallbacks,
  getPage,
  getPageTextContent,
  getOutline,
  getMetadata,
  clearDocumentCache,
  preloadDocument,
  type LoadDocumentOptions,
  type LoadDocumentResult,
  type LoadDocumentWithCallbacksOptions,
  type LoadDocumentWithCallbacksResult,
} from './document-loader';
export {
  saveHighlights,
  loadHighlights,
  clearHighlights,
  getAllDocumentIds,
  exportHighlightsAsJSON,
  importHighlightsFromJSON,
  exportHighlightsAsMarkdown,
  generateDocumentId,
} from './highlight-storage';
export {
  createPDFViewer,
  quickViewer,
  type PDFViewerController,
  type PDFViewerControllerOptions,
} from './convenience';

// Student Learning Utils
export {
  exportAnnotationsAsMarkdown,
  exportAnnotationsAsJSON,
  downloadAnnotationsAsMarkdown,
  downloadAnnotationsAsJSON,
  downloadFile,
  type ExportData,
} from './export-annotations';

export {
  saveStudentData,
  loadStudentData,
  clearStudentData,
  getAllStudentDataDocumentIds,
  getStorageStats,
  type StoredStudentData,
  type StudentData,
} from './student-storage';

export {
  createAgentAPI,
  type AgentAPIStores,
  type AgentAPIInstance,
} from './agent-api';

// Text Search Utilities
export {
  extractPageText,
  findTextOnPage,
  findTextInDocument,
  mergeAdjacentRects,
  getPageText,
  countTextOnPage,
  type TextMatch,
  type FindTextOptions,
  type CharPosition,
} from './text-search';

// Coordinate Utilities
export {
  pdfToViewport,
  viewportToPDF,
  percentToPDF,
  pdfToPercent,
  percentToViewport,
  viewportToPercent,
  applyRotation,
  removeRotation,
  getRotatedDimensions,
  scaleRect,
  isPointInRect,
  doRectsIntersect,
  getRectIntersection,
} from './coordinates';

// Mobile Optimizations
export {
  detectDeviceCapabilities,
  getDeviceCapabilities,
  getRenderConfig,
  getGlobalRenderConfig,
  getMemoryStatus,
  getGlobalRenderQueue,
  resetMobileConfig,
  calculateOptimalCanvasDimensions,
  throttle,
  debounce,
  requestIdleCallbackCompat,
  cancelIdleCallbackCompat,
  RenderQueue,
  type DeviceCapabilities,
  type RenderQuality,
  type RenderConfig,
  type MemoryStatus,
} from './mobile-config';
