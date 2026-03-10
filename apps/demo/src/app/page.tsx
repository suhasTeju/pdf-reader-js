'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  PDFViewerProvider,
  useHighlights,
  useAnnotations,
  usePDFViewer,
  useViewerStore,
  Toolbar,
  Sidebar,
  AnnotationToolbar,
  DocumentContainer,
  ContinuousScrollContainer,
  DualPageContainer,
  BookModeContainer,
  loadDocument,
} from '@pdf-reader/core';
import type { PDFDocumentLoadedEvent, ViewMode, HighlightColor, ShapeType } from '@pdf-reader/core';

// Demo API Panel - This component has access to the PDF viewer context
function DemoAPIPanel() {
  const { currentPage, search, searchResults, goToPage, isSearching } = usePDFViewer();
  const { addHighlight, allHighlights } = useHighlights();
  const { createShape, annotations } = useAnnotations();
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'quick' | 'search' | 'custom'>('quick');

  // Search and highlight state
  const [searchText, setSearchText] = useState('');
  const [highlightColor, setHighlightColor] = useState<HighlightColor>('yellow');

  // Custom coordinate state
  const [customX, setCustomX] = useState('100');
  const [customY, setCustomY] = useState('100');
  const [customWidth, setCustomWidth] = useState('200');
  const [customHeight, setCustomHeight] = useState('20');
  const [customShapeType, setCustomShapeType] = useState<ShapeType>('rect');

  // Quick add highlight at fixed position
  const handleQuickHighlight = (color: HighlightColor) => {
    const yOffset = allHighlights.length * 20;
    const highlight = addHighlight({
      pageNumber: currentPage,
      rects: [{ x: 72, y: 100 + yOffset, width: 200, height: 14 }],
      text: `Highlight #${allHighlights.length + 1}`,
      color,
    });
    setLastAction(`Added ${color} highlight: ${highlight.id.slice(-6)}`);
  };

  // Quick add shape at fixed position
  const handleQuickShape = (shapeType: ShapeType) => {
    const offset = annotations.length * 30;
    const shape = createShape({
      pageNumber: currentPage,
      shapeType,
      x: 300 + offset,
      y: 150 + offset,
      width: shapeType === 'circle' ? 60 : 100,
      height: shapeType === 'circle' ? 60 : shapeType === 'arrow' ? 30 : 60,
      color: shapeType === 'rect' ? '#ef4444' : shapeType === 'circle' ? '#3b82f6' : '#22c55e',
      strokeWidth: 2,
    });
    setLastAction(`Added ${shapeType}: ${shape.id.slice(-6)}`);
  };

  // Search text and highlight all matches
  const [isSearchingForHighlight, setIsSearchingForHighlight] = useState(false);
  const [pendingSearchText, setPendingSearchText] = useState('');

  const handleSearchAndHighlight = async () => {
    if (!searchText.trim()) return;

    setLastAction('Searching...');
    setPendingSearchText(searchText);
    setIsSearchingForHighlight(true);
    await search(searchText);
  };

  // Effect to highlight search results when they arrive
  useEffect(() => {
    // Wait for search to complete (isSearching becomes false)
    if (isSearchingForHighlight && !isSearching && pendingSearchText) {
      if (searchResults.length > 0) {
        let highlightCount = 0;
        for (const result of searchResults) {
          if (result.rects && result.rects.length > 0) {
            addHighlight({
              pageNumber: result.pageNumber,
              rects: result.rects,
              text: result.text,
              color: highlightColor,
              comment: `Search: "${pendingSearchText}"`,
            });
            highlightCount++;
          }
        }

        // Go to first result page
        goToPage(searchResults[0].pageNumber);
        setLastAction(`Highlighted ${highlightCount} matches for "${pendingSearchText}"`);
      } else {
        setLastAction(`No matches found for "${pendingSearchText}"`);
      }

      setIsSearchingForHighlight(false);
      setPendingSearchText('');
    }
  }, [searchResults, isSearching, isSearchingForHighlight, pendingSearchText, addHighlight, highlightColor, goToPage]);

  // Add highlight at custom coordinates
  const handleCustomHighlight = () => {
    const x = parseFloat(customX);
    const y = parseFloat(customY);
    const width = parseFloat(customWidth);
    const height = parseFloat(customHeight);

    if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) {
      setLastAction('Invalid coordinates');
      return;
    }

    const highlight = addHighlight({
      pageNumber: currentPage,
      rects: [{ x, y, width, height }],
      text: 'Custom highlight',
      color: highlightColor,
    });
    setLastAction(`Highlight at (${x}, ${y}): ${highlight.id.slice(-6)}`);
  };

  // Add shape at custom coordinates
  const handleCustomShape = () => {
    const x = parseFloat(customX);
    const y = parseFloat(customY);
    const width = parseFloat(customWidth);
    const height = parseFloat(customHeight);

    if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) {
      setLastAction('Invalid coordinates');
      return;
    }

    const shape = createShape({
      pageNumber: currentPage,
      shapeType: customShapeType,
      x,
      y,
      width,
      height,
      color: '#3b82f6',
      strokeWidth: 2,
    });
    setLastAction(`${customShapeType} at (${x}, ${y}): ${shape.id.slice(-6)}`);
  };

  return (
    <div className="absolute bottom-4 left-4 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-80">
      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
        API Demo (Page {currentPage})
      </h3>

      {/* Tabs */}
      <div className="flex gap-1 mb-3 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('quick')}
          className={`px-3 py-1.5 text-xs font-medium rounded-t ${
            activeTab === 'quick' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Quick Add
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={`px-3 py-1.5 text-xs font-medium rounded-t ${
            activeTab === 'search' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Search & Highlight
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`px-3 py-1.5 text-xs font-medium rounded-t ${
            activeTab === 'custom' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Custom
        </button>
      </div>

      {/* Quick Add Tab */}
      {activeTab === 'quick' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 mb-2">
            Add annotations at preset positions:
          </p>
          <div className="flex gap-1">
            <button onClick={() => handleQuickHighlight('yellow')} className="flex-1 px-2 py-1.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200">Yellow</button>
            <button onClick={() => handleQuickHighlight('green')} className="flex-1 px-2 py-1.5 text-xs font-medium bg-green-100 text-green-800 rounded hover:bg-green-200">Green</button>
            <button onClick={() => handleQuickHighlight('blue')} className="flex-1 px-2 py-1.5 text-xs font-medium bg-blue-100 text-blue-800 rounded hover:bg-blue-200">Blue</button>
            <button onClick={() => handleQuickHighlight('pink')} className="flex-1 px-2 py-1.5 text-xs font-medium bg-pink-100 text-pink-800 rounded hover:bg-pink-200">Pink</button>
          </div>
          <div className="flex gap-1">
            <button onClick={() => handleQuickShape('rect')} className="flex-1 px-2 py-1.5 text-xs font-medium bg-red-100 text-red-800 rounded hover:bg-red-200">Rect</button>
            <button onClick={() => handleQuickShape('circle')} className="flex-1 px-2 py-1.5 text-xs font-medium bg-blue-100 text-blue-800 rounded hover:bg-blue-200">Circle</button>
            <button onClick={() => handleQuickShape('arrow')} className="flex-1 px-2 py-1.5 text-xs font-medium bg-green-100 text-green-800 rounded hover:bg-green-200">Arrow</button>
            <button onClick={() => handleQuickShape('line')} className="flex-1 px-2 py-1.5 text-xs font-medium bg-gray-100 text-gray-800 rounded hover:bg-gray-200">Line</button>
          </div>
        </div>
      )}

      {/* Search & Highlight Tab */}
      {activeTab === 'search' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 mb-2">
            Search for text and highlight all matches:
          </p>
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Enter text to find..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleSearchAndHighlight()}
          />
          <div className="flex gap-2 items-center">
            <select
              value={highlightColor}
              onChange={(e) => setHighlightColor(e.target.value as HighlightColor)}
              className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="yellow">Yellow</option>
              <option value="green">Green</option>
              <option value="blue">Blue</option>
              <option value="pink">Pink</option>
              <option value="orange">Orange</option>
            </select>
            <button
              onClick={handleSearchAndHighlight}
              className="px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Search & Highlight
            </button>
          </div>
        </div>
      )}

      {/* Custom Coordinates Tab */}
      {activeTab === 'custom' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 mb-2">
            Add annotations at specific PDF coordinates:
          </p>
          <div className="grid grid-cols-4 gap-1">
            <div>
              <label className="text-xs text-gray-500">X</label>
              <input type="number" value={customX} onChange={(e) => setCustomX(e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Y</label>
              <input type="number" value={customY} onChange={(e) => setCustomY(e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Width</label>
              <input type="number" value={customWidth} onChange={(e) => setCustomWidth(e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
            </div>
            <div>
              <label className="text-xs text-gray-500">Height</label>
              <input type="number" value={customHeight} onChange={(e) => setCustomHeight(e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 rounded" />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={highlightColor}
              onChange={(e) => setHighlightColor(e.target.value as HighlightColor)}
              className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded"
            >
              <option value="yellow">Yellow</option>
              <option value="green">Green</option>
              <option value="blue">Blue</option>
              <option value="pink">Pink</option>
            </select>
            <button onClick={handleCustomHighlight} className="px-3 py-1.5 text-xs font-medium bg-yellow-500 text-white rounded hover:bg-yellow-600">
              Add Highlight
            </button>
          </div>
          <div className="flex gap-2">
            <select
              value={customShapeType}
              onChange={(e) => setCustomShapeType(e.target.value as ShapeType)}
              className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded"
            >
              <option value="rect">Rectangle</option>
              <option value="circle">Circle</option>
              <option value="arrow">Arrow</option>
              <option value="line">Line</option>
            </select>
            <button onClick={handleCustomShape} className="px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600">
              Add Shape
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4 text-xs text-gray-500">
        <span>Highlights: {allHighlights.length}</span>
        <span>Annotations: {annotations.length}</span>
      </div>

      {/* Last action */}
      {lastAction && (
        <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 font-mono truncate">
          {lastAction}
        </div>
      )}
    </div>
  );
}

// Inner viewer component that shares context with DemoAPIPanel
// Uses PDFViewer components directly without PDFViewerClient to avoid nested providers
function PDFViewerWithDemo({
  src,
  viewMode,
  showAnnotationToolbar,
  showDemoPanel,
  onDocumentLoad,
  onError,
}: {
  src: string;
  viewMode: ViewMode;
  showAnnotationToolbar: boolean;
  showDemoPanel: boolean;
  onDocumentLoad: (event: PDFDocumentLoadedEvent) => void;
  onError: (error: Error) => void;
}) {
  const setDocument = useViewerStore((s) => s.setDocument);
  const setLoading = useViewerStore((s) => s.setLoading);
  const setError = useViewerStore((s) => s.setError);
  const isLoading = useViewerStore((s) => s.isLoading);
  const error = useViewerStore((s) => s.error);
  const sidebarOpen = useViewerStore((s) => s.sidebarOpen);

  // Load document on src change
  useEffect(() => {
    if (!src) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const { document, numPages } = await loadDocument({ src });
        if (!cancelled) {
          setDocument(document);
          onDocumentLoad({ document, numPages });
        }
      } catch (err) {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error('Failed to load');
          setError(error);
          onError(error);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [src, setDocument, setLoading, setError, onDocumentLoad, onError]);

  // Render the appropriate container based on view mode
  const renderContainer = () => {
    switch (viewMode) {
      case 'continuous':
        return <ContinuousScrollContainer />;
      case 'dual':
        return <DualPageContainer />;
      case 'book':
        return <BookModeContainer />;
      case 'single':
      default:
        return <DocumentContainer />;
    }
  };

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-red-500 text-lg font-semibold mb-2">
            Failed to load PDF
          </div>
          <div className="text-gray-500 text-sm">{error.message}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col">
      <Toolbar />
      {showAnnotationToolbar && viewMode !== 'book' && <AnnotationToolbar />}

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && <Sidebar />}
        {renderContainer()}
      </div>

      {showDemoPanel && <DemoAPIPanel />}

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <div className="mt-2 text-sm text-gray-500">Loading PDF...</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [docInfo, setDocInfo] = useState<{ numPages: number } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [showAnnotationToolbar, setShowAnnotationToolbar] = useState(false);
  const [showDemoPanel, setShowDemoPanel] = useState(false);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
    }
  }, []);

  const handleDocumentLoad = useCallback((event: PDFDocumentLoadedEvent) => {
    setDocInfo({ numPages: event.numPages });
    console.log('Document loaded:', event.numPages, 'pages');
  }, []);

  const handleError = useCallback((error: Error) => {
    console.error('PDF Error:', error);
    alert('Failed to load PDF: ' + error.message);
  }, []);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">PDF Reader Demo</h1>
            <p className="text-sm text-gray-500">
              A Next.js-compatible PDF renderer with annotations and search
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* View Mode Selector */}
            {pdfUrl && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">View:</span>
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as ViewMode)}
                  className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="single">Single Page</option>
                  <option value="continuous">Continuous Scroll</option>
                  <option value="dual">Dual Page</option>
                  <option value="book">Book Mode</option>
                </select>
              </div>
            )}

            {/* Annotation Toolbar Toggle (hidden in book mode) */}
            {pdfUrl && viewMode !== 'book' && (
              <button
                onClick={() => setShowAnnotationToolbar(!showAnnotationToolbar)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  showAnnotationToolbar
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                }`}
                title="Toggle annotation tools"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
                Annotate
              </button>
            )}

            {/* API Demo Toggle */}
            {pdfUrl && (
              <button
                onClick={() => setShowDemoPanel(!showDemoPanel)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  showDemoPanel
                    ? 'bg-purple-100 text-purple-700 border border-purple-300'
                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                }`}
                title="Toggle API demo panel"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
                API Demo
              </button>
            )}

            {docInfo && (
              <span className="text-sm text-gray-500">
                {docInfo.numPages} pages
              </span>
            )}

            <label className="cursor-pointer">
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <span className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                Open PDF
              </span>
            </label>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {pdfUrl ? (
          <PDFViewerProvider theme="light">
            <PDFViewerWithDemo
              src={pdfUrl}
              viewMode={viewMode}
              showAnnotationToolbar={showAnnotationToolbar}
              showDemoPanel={showDemoPanel}
              onDocumentLoad={handleDocumentLoad}
              onError={handleError}
            />
          </PDFViewerProvider>
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <svg
                className="mx-auto h-16 w-16 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h2 className="mt-4 text-lg font-medium text-gray-900">No PDF loaded</h2>
              <p className="mt-2 text-sm text-gray-500">
                Click the &quot;Open PDF&quot; button to select a PDF file
              </p>
              <div className="mt-6">
                <button
                  onClick={() => {
                    setPdfUrl('https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf');
                  }}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  Or load sample PDF
                </button>
              </div>

              {/* Feature list */}
              <div className="mt-8 text-left max-w-md mx-auto">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Features to try:</h3>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">•</span>
                    <span><strong>View Modes:</strong> Single page, continuous scroll, or dual page view</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">•</span>
                    <span><strong>Annotations:</strong> Add sticky notes, draw freehand, create shapes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">•</span>
                    <span><strong>Highlights:</strong> Select text and highlight with different colors</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">•</span>
                    <span><strong>Search:</strong> Find text across all pages</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">•</span>
                    <span><strong>Themes:</strong> Light, dark, and sepia modes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">•</span>
                    <span><strong>API Demo:</strong> Click &quot;API Demo&quot; to test programmatic annotations</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
