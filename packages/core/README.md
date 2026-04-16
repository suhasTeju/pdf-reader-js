# pdfjs-reader-core

A React library for rendering PDFs with built-in search, highlighting, and annotation capabilities.

## Installation

```bash
npm install pdfjs-reader-core
# or
yarn add pdfjs-reader-core
# or
pnpm add pdfjs-reader-core
```

---

## 1. Rendering PDFs

### Quick Start - Full-Featured Viewer

The easiest way to render a PDF with all features enabled:

```tsx
import { PDFViewerClient } from 'pdfjs-reader-core';
import 'pdfjs-reader-core/styles.css';

function App() {
  return (
    <div style={{ height: '100vh' }}>
      <PDFViewerClient
        src="/document.pdf"
        showToolbar
        showSidebar
        onDocumentLoad={({ numPages }) => console.log(`Loaded ${numPages} pages`)}
        onError={(error) => console.error('Failed to load:', error)}
      />
    </div>
  );
}
```

### Custom Viewer with Hooks

For more control, use the provider and hooks:

```tsx
import {
  PDFViewerProvider,
  usePDFViewer,
  ContinuousScrollContainer,
  Toolbar,
  Sidebar,
} from 'pdfjs-reader-core';
import 'pdfjs-reader-core/styles.css';

function App() {
  return (
    <PDFViewerProvider>
      <MyPDFViewer />
    </PDFViewerProvider>
  );
}

function MyPDFViewer() {
  const { loadDocument, isLoading, error, numPages } = usePDFViewer();

  useEffect(() => {
    loadDocument({ src: '/document.pdf' });
  }, []);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Toolbar />
        <ContinuousScrollContainer />
      </div>
    </div>
  );
}
```

### Load PDF from Different Sources

```tsx
const { loadDocument } = usePDFViewer();

// From URL
await loadDocument({ src: 'https://example.com/document.pdf' });

// From file input
const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    const arrayBuffer = await file.arrayBuffer();
    await loadDocument({ src: arrayBuffer });
  }
};

// From base64
const base64 = 'JVBERi0xLjQK...';
const binaryString = atob(base64);
const bytes = new Uint8Array(binaryString.length);
for (let i = 0; i < binaryString.length; i++) {
  bytes[i] = binaryString.charCodeAt(i);
}
await loadDocument({ src: bytes });
```

### Navigation API

```tsx
const {
  currentPage,    // Current page number (1-indexed)
  numPages,       // Total pages
  scale,          // Current zoom level (1 = 100%)
  goToPage,       // Navigate to specific page (returns Promise)
  nextPage,       // Go to next page
  previousPage,   // Go to previous page
  setScale,       // Set zoom level
  zoomIn,         // Zoom in by preset amount
  zoomOut,        // Zoom out by preset amount
  fitToWidth,     // Fit page to container width
  fitToPage,      // Fit entire page in view
  rotateClockwise, // Rotate 90° clockwise
} = usePDFViewer();

// Examples
await goToPage(5);     // Go to page 5 (waits for scroll)
goToPage(5);           // Fire-and-forget also works
setScale(1.5);         // Set zoom to 150%
zoomIn();              // Zoom in
fitToWidth();          // Fit to width
rotateClockwise();     // Rotate
```

---

## 2. Search

Search text across all pages and navigate through results.

### Basic Search

```tsx
const {
  search,               // (query: string) => Promise<void>
  searchResults,        // Array of search results
  currentSearchResult,  // Index of current result
  nextSearchResult,     // Go to next result
  previousSearchResult, // Go to previous result
  clearSearch,          // Clear search
  goToPage,             // Navigate to page
} = usePDFViewer();

// Perform search
await search('important term');

// Navigate results
console.log(`Found ${searchResults.length} matches`);
nextSearchResult();     // Go to next match
previousSearchResult(); // Go to previous match

// Clear when done
clearSearch();
```

### Search Result Structure

```typescript
interface SearchResult {
  pageNumber: number;    // Page where match was found
  text: string;          // Matched text
  index: number;         // Index in results array
  rects?: {              // Bounding rectangles for highlighting
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
}
```

### Complete Search UI Example

```tsx
import { useState } from 'react';
import { usePDFViewer } from 'pdfjs-reader-core';

function SearchBar() {
  const [query, setQuery] = useState('');
  const {
    search,
    searchResults,
    currentSearchResult,
    nextSearchResult,
    previousSearchResult,
    clearSearch,
  } = usePDFViewer();

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (text.length >= 2) {
      await search(text);
    } else {
      clearSearch();
    }
  };

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search..."
      />

      {searchResults.length > 0 && (
        <div>
          <span>
            {currentSearchResult + 1} of {searchResults.length}
          </span>
          <button onClick={previousSearchResult}>←</button>
          <button onClick={nextSearchResult}>→</button>
          <button onClick={clearSearch}>Clear</button>
        </div>
      )}
    </div>
  );
}
```

---

## 3. Highlighting

Create persistent highlights on PDF text. Highlights are rendered as colored overlays.

### Add Highlight Programmatically

```tsx
const { addHighlight, highlights, removeHighlight } = usePDFViewer();

// Add a highlight with coordinates
const highlight = addHighlight({
  pageNumber: 1,
  text: 'The highlighted text',
  color: 'yellow',  // 'yellow' | 'green' | 'blue' | 'pink' | 'orange'
  rects: [
    { x: 72, y: 100, width: 200, height: 14 },
    { x: 72, y: 116, width: 150, height: 14 },  // Multi-line support
  ],
  comment: 'Optional note',  // Optional
});

console.log(highlight.id);  // Unique ID for the highlight

// List all highlights
highlights.forEach(h => {
  console.log(`Page ${h.pageNumber}: "${h.text}" (${h.color})`);
});

// Remove a highlight
removeHighlight(highlight.id);
```

### Highlight from Search Results

Convert search results into permanent highlights:

```tsx
const { search, searchResults, addHighlight } = usePDFViewer();

// Search for a term
await search('important');

// Highlight all matches
searchResults.forEach((result) => {
  if (result.rects && result.rects.length > 0) {
    addHighlight({
      pageNumber: result.pageNumber,
      text: result.text,
      rects: result.rects,
      color: 'yellow',
    });
  }
});
```

### Using the useHighlights Hook

For more control over highlights:

```tsx
import { useHighlights } from 'pdfjs-reader-core';

function HighlightManager() {
  const {
    allHighlights,                 // All highlights
    highlightsForPage,             // (pageNum) => highlights on that page
    addHighlight,                  // Add new highlight
    updateHighlight,               // Update existing
    deleteHighlight,               // Delete by ID
    selectedHighlight,             // Currently selected highlight
    selectHighlight,               // Select a highlight
    createHighlightFromSelection,  // Create from text selection
  } = useHighlights({
    onHighlightCreate: (h) => console.log('Created:', h),
    onHighlightUpdate: (h) => console.log('Updated:', h),
    onHighlightDelete: (id) => console.log('Deleted:', id),
  });

  // Get highlights for page 1
  const page1Highlights = highlightsForPage(1);

  // Update a highlight's color
  updateHighlight('highlight-id', { color: 'green' });

  // Add a comment to highlight
  updateHighlight('highlight-id', { comment: 'This is important!' });

  return (
    <div>
      <h3>Highlights ({allHighlights.length})</h3>
      {allHighlights.map(h => (
        <div key={h.id} onClick={() => selectHighlight(h.id)}>
          <span style={{ background: h.color }}>{h.text}</span>
          <button onClick={() => deleteHighlight(h.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
```

### Highlight Type Definition

```typescript
interface Highlight {
  id: string;
  pageNumber: number;
  rects: { x: number; y: number; width: number; height: number }[];
  text: string;
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'orange';
  comment?: string;
  source?: 'user' | 'agent' | 'search';  // Who/what created it
  createdAt: Date;
  updatedAt: Date;
}
```

### Persist Highlights

Save and restore highlights:

```tsx
import {
  saveHighlights,
  loadHighlights,
  exportHighlightsAsJSON,
  importHighlightsFromJSON,
} from 'pdfjs-reader-core';

// Save to localStorage
saveHighlights('doc-123', highlights);

// Load from localStorage
const saved = loadHighlights('doc-123');

// Export as JSON file
exportHighlightsAsJSON(highlights, 'my-highlights.json');

// Import from JSON
const imported = await importHighlightsFromJSON(jsonFile);
```

---

## 4. Annotations

Add notes, drawings, and shapes to PDFs.

### Add Sticky Notes

```tsx
import { useAnnotationStore } from 'pdfjs-reader-core';

function NoteManager() {
  const addNote = useAnnotationStore((s) => s.addNote);
  const annotations = useAnnotationStore((s) => s.annotations);
  const deleteAnnotation = useAnnotationStore((s) => s.deleteAnnotation);

  // Add a note at specific position
  const createNote = () => {
    addNote({
      pageNumber: 1,
      x: 100,        // X position in PDF points
      y: 200,        // Y position in PDF points
      content: 'This is my note',
      color: '#ffeb3b',  // Note color
    });
  };

  // List all notes
  const notes = annotations.filter(a => a.type === 'note');

  return (
    <div>
      <button onClick={createNote}>Add Note</button>
      {notes.map(note => (
        <div key={note.id}>
          Page {note.pageNumber}: {note.content}
          <button onClick={() => deleteAnnotation(note.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
```

### Add Shapes

```tsx
const addShape = useAnnotationStore((s) => s.addShape);

// Rectangle
addShape({
  pageNumber: 1,
  shapeType: 'rect',
  x: 100,
  y: 200,
  width: 150,
  height: 80,
  color: '#ef4444',
  strokeWidth: 2,
});

// Circle
addShape({
  pageNumber: 1,
  shapeType: 'circle',
  x: 300,
  y: 200,
  width: 100,
  height: 100,
  color: '#22c55e',
  strokeWidth: 2,
});

// Arrow
addShape({
  pageNumber: 1,
  shapeType: 'arrow',
  x: 100,
  y: 350,
  width: 120,
  height: 40,
  color: '#3b82f6',
  strokeWidth: 3,
});

// Line
addShape({
  pageNumber: 1,
  shapeType: 'line',
  x: 100,
  y: 450,
  width: 200,
  height: 0,
  color: '#000000',
  strokeWidth: 2,
});
```

### Freehand Drawing

```tsx
const startDrawing = useAnnotationStore((s) => s.startDrawing);
const addDrawingPoint = useAnnotationStore((s) => s.addDrawingPoint);
const finishDrawing = useAnnotationStore((s) => s.finishDrawing);
const setDrawingColor = useAnnotationStore((s) => s.setDrawingColor);
const setDrawingStrokeWidth = useAnnotationStore((s) => s.setDrawingStrokeWidth);

// Configure drawing
setDrawingColor('#ff0000');
setDrawingStrokeWidth(3);

// Start drawing on page 1 at position (100, 200)
startDrawing(1, { x: 100, y: 200 });

// Add points as user draws
addDrawingPoint({ x: 110, y: 210 });
addDrawingPoint({ x: 120, y: 205 });
addDrawingPoint({ x: 130, y: 215 });

// Finish drawing (saves the annotation)
finishDrawing();
```

### Enable Drawing Mode UI

```tsx
const setActiveAnnotationTool = useAnnotationStore((s) => s.setActiveAnnotationTool);
const activeAnnotationTool = useAnnotationStore((s) => s.activeAnnotationTool);

// Enable drawing mode
setActiveAnnotationTool('draw');

// Enable note mode (click to add notes)
setActiveAnnotationTool('note');

// Enable shape mode
setActiveAnnotationTool('shape');

// Disable annotation mode
setActiveAnnotationTool(null);

// Check current mode
if (activeAnnotationTool === 'draw') {
  console.log('Drawing mode is active');
}
```

### Annotation Type Definition

```typescript
interface Annotation {
  id: string;
  pageNumber: number;
  type: 'note' | 'drawing' | 'shape';

  // For notes
  content?: string;
  x?: number;
  y?: number;

  // For shapes
  shapeType?: 'rect' | 'circle' | 'arrow' | 'line';
  width?: number;
  height?: number;

  // For drawings
  points?: { x: number; y: number }[];

  // Common
  color: string;
  strokeWidth?: number;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 5. Complete Example

Here's a full example combining rendering, search, highlighting, and annotations:

```tsx
import { useState, useEffect } from 'react';
import {
  PDFViewerProvider,
  usePDFViewer,
  useHighlights,
  useAnnotationStore,
  ContinuousScrollContainer,
} from 'pdfjs-reader-core';
import 'pdfjs-reader-core/styles.css';

function App() {
  return (
    <PDFViewerProvider>
      <div style={{ display: 'flex', height: '100vh' }}>
        <ControlPanel />
        <div style={{ flex: 1 }}>
          <ContinuousScrollContainer />
        </div>
      </div>
    </PDFViewerProvider>
  );
}

function ControlPanel() {
  const [searchQuery, setSearchQuery] = useState('');

  // PDF viewer controls
  const {
    loadDocument,
    currentPage,
    numPages,
    goToPage,
    search,
    searchResults,
    clearSearch,
  } = usePDFViewer();

  // Highlight controls
  const { allHighlights, addHighlight, deleteHighlight } = useHighlights();

  // Annotation controls
  const addNote = useAnnotationStore((s) => s.addNote);
  const annotations = useAnnotationStore((s) => s.annotations);

  // Load PDF on mount
  useEffect(() => {
    loadDocument({ src: '/sample.pdf' });
  }, []);

  // Search handler
  const handleSearch = async () => {
    if (searchQuery.length >= 2) {
      await search(searchQuery);
    }
  };

  // Highlight all search results
  const highlightSearchResults = () => {
    searchResults.forEach((result) => {
      if (result.rects?.length) {
        addHighlight({
          pageNumber: result.pageNumber,
          text: result.text,
          rects: result.rects,
          color: 'yellow',
        });
      }
    });
    clearSearch();
    setSearchQuery('');
  };

  // Add note at center of current page
  const addNoteToCurrentPage = () => {
    addNote({
      pageNumber: currentPage,
      x: 300,
      y: 400,
      content: 'New note',
      color: '#ffeb3b',
    });
  };

  return (
    <div style={{ width: 300, padding: 16, borderRight: '1px solid #ccc' }}>
      {/* Navigation */}
      <div>
        <h3>Navigation</h3>
        <button onClick={() => goToPage(currentPage - 1)}>Previous</button>
        <span> Page {currentPage} of {numPages} </span>
        <button onClick={() => goToPage(currentPage + 1)}>Next</button>
      </div>

      {/* Search */}
      <div>
        <h3>Search</h3>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search..."
        />
        <button onClick={handleSearch}>Search</button>
        {searchResults.length > 0 && (
          <div>
            <p>Found {searchResults.length} matches</p>
            <button onClick={highlightSearchResults}>
              Highlight All
            </button>
          </div>
        )}
      </div>

      {/* Highlights */}
      <div>
        <h3>Highlights ({allHighlights.length})</h3>
        {allHighlights.map((h) => (
          <div key={h.id}>
            <span style={{ background: h.color }}>
              Page {h.pageNumber}: {h.text.slice(0, 30)}...
            </span>
            <button onClick={() => deleteHighlight(h.id)}>×</button>
          </div>
        ))}
      </div>

      {/* Annotations */}
      <div>
        <h3>Notes ({annotations.filter(a => a.type === 'note').length})</h3>
        <button onClick={addNoteToCurrentPage}>Add Note</button>
      </div>
    </div>
  );
}

export default App;
```

---

## 6. Controlled Page Navigation (v0.2.0+)

The viewer supports both controlled and uncontrolled page modes.

### Uncontrolled Mode (Default)

The viewer manages page state internally:

```tsx
<PDFViewerClient
  src="/document.pdf"
  initialPage={5}  // Start at page 5
  onPageChange={(page) => console.log('Now on page:', page)}
/>
```

### Controlled Mode

You control the page state externally:

```tsx
function ControlledViewer() {
  const [page, setPage] = useState(1);

  return (
    <div>
      <div>
        <button onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
        <span>Page {page}</span>
        <button onClick={() => setPage(p => p + 1)}>Next</button>
      </div>
      <PDFViewerClient
        src="/document.pdf"
        page={page}           // Controlled page prop
        onPageChange={setPage} // Sync back when user scrolls
      />
    </div>
  );
}
```

### Promise-Based Navigation

`goToPage()` returns a Promise that resolves when scrolling completes:

```tsx
const viewerRef = useRef<PDFViewerHandle>(null);

// Wait for scroll to complete
await viewerRef.current?.goToPage(10);
console.log('Now viewing page 10');

// With options
await viewerRef.current?.goToPage(10, { behavior: 'instant' }); // No animation
await viewerRef.current?.goToPage(10, { behavior: 'smooth' });  // Smooth scroll (default)
```

---

## 7. Search and Highlight (v0.2.0+)

The `searchAndHighlight()` method combines search and highlighting in one operation.

### Basic Usage

```tsx
const viewerRef = useRef<PDFViewerHandle>(null);

// Search and highlight all matches
const result = await viewerRef.current?.searchAndHighlight('important term');

console.log(result);
// {
//   matchCount: 15,
//   highlightIds: ['hl-1', 'hl-2', ...],
//   matches: [
//     { pageNumber: 1, text: 'important term', highlightId: 'hl-1', rects: [...] },
//     ...
//   ]
// }
```

### Advanced Options

```tsx
const result = await viewerRef.current?.searchAndHighlight('term', {
  // Highlight color
  color: 'green',  // 'yellow' | 'green' | 'blue' | 'pink' | 'orange'

  // Search specific pages only
  pageRange: [1, 2, 3],  // Array of page numbers
  // or
  pageRange: { start: 1, end: 10 },  // Range object

  // Search options
  caseSensitive: true,
  wholeWord: true,

  // Navigation
  scrollToFirst: true,   // Scroll to first match (default: true)

  // Clear previous search highlights
  clearPrevious: true,   // Remove old search highlights (default: false)
});
```

### Clear Search Highlights

```tsx
// Remove all highlights created by searchAndHighlight
viewerRef.current?.clearSearchHighlights();
```

---

## 8. Agent Tools API (v0.2.0+)

Structured API designed for AI agents with consistent response format.

### Response Format

All agent tools return a standardized response:

```typescript
interface AgentToolResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
```

### Available Tools

```tsx
const viewerRef = useRef<PDFViewerHandle>(null);
const agentTools = viewerRef.current?.agentTools;

// Navigate to page
const navResult = await agentTools?.navigateToPage(5);
// { success: true, data: { previousPage: 1, currentPage: 5 } }

// Highlight text
const hlResult = await agentTools?.highlightText('important', {
  color: 'yellow',
  pageRange: [1, 2, 3],
  caseSensitive: false,
  wholeWord: false,
});
// { success: true, data: { matchCount: 5, highlightIds: ['hl-1', ...] } }

// Get page text content
const textResult = await agentTools?.getPageContent(1);
// { success: true, data: { text: 'Full page text content...' } }

// Clear all visual annotations
const clearResult = await agentTools?.clearAllVisuals();
// { success: true, data: undefined }
```

### Error Handling

```tsx
const result = await agentTools?.navigateToPage(999);
if (!result.success) {
  console.error(result.error?.code);    // 'INVALID_PAGE'
  console.error(result.error?.message); // 'Page 999 is out of range (1-50)'
}
```

---

## 9. Coordinate Utilities (v0.2.0+)

Helper functions for coordinate conversion between different systems.

### Using the Coordinates Helper

```tsx
const viewerRef = useRef<PDFViewerHandle>(null);
const coords = viewerRef.current?.coordinates;

// Get page dimensions
const dims = coords?.getPageDimensions(1);
// { width: 612, height: 792, rotation: 0 }

// Convert percentage to pixels
const pixelPos = coords?.percentToPixels(50, 25, 1);  // 50% x, 25% y, page 1
// { x: 306, y: 198 }

// Convert pixels to percentage
const percentPos = coords?.pixelsToPercent(306, 198, 1);
// { x: 50, y: 25 }
```

### Standalone Coordinate Functions

```tsx
import {
  pdfToViewport,
  viewportToPDF,
  percentToPDF,
  pdfToPercent,
  scaleRect,
  isPointInRect,
} from 'pdfjs-reader-core';

// Convert PDF coordinates to viewport coordinates
const viewportPos = pdfToViewport(100, 200, 1.5, 792);  // x, y, scale, pageHeight

// Convert viewport to PDF coordinates
const pdfPos = viewportToPDF(150, 300, 1.5, 792);

// Check if point is inside rectangle
const inside = isPointInRect(100, 200, { x: 50, y: 150, width: 100, height: 100 });
```

---

## 10. Thumbnail Navigation (v0.2.0+)

Standalone thumbnail navigation component.

### Basic Usage

```tsx
import { PDFThumbnailNav } from 'pdfjs-reader-core';

function MyViewer() {
  return (
    <PDFViewerProvider>
      <div style={{ display: 'flex', height: '100vh' }}>
        <PDFThumbnailNav orientation="vertical" />
        <ContinuousScrollContainer />
      </div>
    </PDFViewerProvider>
  );
}
```

### Props

```tsx
<PDFThumbnailNav
  orientation="vertical"   // 'horizontal' | 'vertical'
  thumbnailScale={0.15}    // Thumbnail size (default: 0.15)
  maxVisible={10}          // Max thumbnails to show
  className="my-nav"       // Additional CSS class
  onThumbnailClick={(page) => console.log('Clicked page:', page)}
/>
```

---

## 11. Floating Zoom Controls (v0.2.0+)

Floating zoom control panel with 5% increments.

### Basic Usage

```tsx
import { FloatingZoomControls } from 'pdfjs-reader-core';

function MyViewer() {
  return (
    <PDFViewerProvider>
      <ContinuousScrollContainer />
      <FloatingZoomControls position="bottom-right" />
    </PDFViewerProvider>
  );
}
```

### Props

```tsx
<FloatingZoomControls
  position="bottom-right"  // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  showFitToWidth={true}    // Show fit-to-width button
  showFitToPage={false}    // Show fit-to-page button
  showZoomLevel={true}     // Show current zoom percentage
  className="my-controls"  // Additional CSS class
/>
```

---

## 12. Event Callbacks (v0.2.0+)

Rich callbacks for tracking viewer events.

```tsx
<PDFViewerClient
  src="/document.pdf"

  // Document events
  onDocumentLoad={({ numPages, document }) => {
    console.log(`Loaded ${numPages} pages`);
  }}
  onError={(error) => console.error('Load error:', error)}

  // Page events
  onPageChange={(pageNumber) => console.log('Page:', pageNumber)}
  onPageRenderStart={(pageNumber) => console.log('Rendering:', pageNumber)}
  onPageRenderComplete={(pageNumber) => console.log('Rendered:', pageNumber)}

  // Zoom events
  onScaleChange={(scale) => console.log('Zoom:', Math.round(scale * 100) + '%')}

  // Annotation events
  onHighlightAdded={(highlight) => console.log('Added highlight:', highlight.id)}
  onHighlightRemoved={(highlightId) => console.log('Removed:', highlightId)}
  onAnnotationAdded={(annotation) => console.log('Added:', annotation.type)}
/>
```

---

## 13. Custom Loading & Error States (v0.2.0+)

Customize loading and error UI components.

### Custom Loading Component

```tsx
<PDFViewerClient
  src="/document.pdf"
  loadingComponent={
    <div className="my-loading">
      <Spinner />
      <p>Loading document...</p>
    </div>
  }
/>
```

### Custom Error Component

```tsx
<PDFViewerClient
  src="/document.pdf"
  errorComponent={(error, retry) => (
    <div className="my-error">
      <p>Failed to load: {error.message}</p>
      <button onClick={retry}>Try Again</button>
    </div>
  )}
/>

// Or as static component
<PDFViewerClient
  src="/document.pdf"
  errorComponent={<div>Something went wrong</div>}
/>
```

---

## 14. Cinematic Tutor Mode (v0.4.0+)

Pair a voice/LLM narration agent with the PDF: as the agent speaks, the viewer
synchronises on-page visuals — spotlights, underlines, highlights, pulses,
callouts, boxes, labels, ghost references, and camera zooms — so the reader
sees the page react like a produced teaching video.

The feature is packaged as a single component, `TutorModeContainer`, that fills
its parent 100 % width and height and shows **only** the PDF plus overlays.
No sidebars, no dev toolbar, no inspector UI ships in the production bundle.

### Quick start

```tsx
import {
  PDFViewerProvider,
  TutorModeContainer,
  createNarrationStore,
  loadDocumentWithCallbacks,
  useViewerStore,
  type NarrationStoreApi,
  type LlmConfig,
  type PageBBoxData,
} from 'pdfjs-reader-core';
import 'pdfjs-reader-core/styles.css';
import { useEffect, useRef } from 'react';

function DocumentLoader({ url }: { url: string }) {
  const setDocument = useViewerStore((s) => s.setDocument);
  useEffect(() => {
    const { promise, cancel } = loadDocumentWithCallbacks({
      src: url,
      onDocumentReady: (doc) => setDocument(doc),
      onFirstPageReady: () => {},
    });
    promise.catch(() => {});
    return () => cancel();
  }, [url, setDocument]);
  return null;
}

export function TutorScene({
  pdfUrl,
  bboxData,
  currentPage,
  currentChunk,
  llm,
}: {
  pdfUrl: string;
  bboxData: PageBBoxData[];
  currentPage: number;
  /** The text the voice agent is currently speaking. Update reactively. */
  currentChunk: string | null;
  llm: LlmConfig;
}) {
  const storeRef = useRef<NarrationStoreApi | null>(null);
  if (!storeRef.current) storeRef.current = createNarrationStore();

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <PDFViewerProvider>
        <DocumentLoader url={pdfUrl} />
        <TutorModeContainer
          pageNumber={currentPage}
          bboxData={bboxData}
          narrationStore={storeRef.current}
          scale={1}
          currentChunk={currentChunk}
          llm={llm}
          minOverlayDurationMs={4000}
        />
      </PDFViewerProvider>
    </div>
  );
}
```

That's it. Whenever `currentChunk` changes, the LLM director picks the
matching block(s) on the current page and the engine plays a storyboard over
the PDF. Typical end-to-end latency is <500 ms on a fast model (sentence-level
sync is the design target; word-level TTS alignment is out of scope).

### What the visuals look like

The director can emit any combination of these effects per narration chunk:

| Effect | Typical trigger from narration |
|---|---|
| `camera` | Focus shifts to a new region (gentle re-centre + optional zoom) |
| `spotlight` | "The key idea here is …" — dim everything except one block |
| `underline` | Quoted phrase or word-by-word reading |
| `highlight` | "Notice this keyword …" — amber marker sweep |
| `pulse` | "Look at the diagram" — block scales in/out to catch the eye |
| `callout` | Captions to figures / label to region — curved arrow + label |
| `box` | "Under this section …" — blue frame around a structural region |
| `label` | "This is the definition" — sticky-note pill tag |
| `ghost_reference` | "As we saw on page 2 …" — floating card with the remote block |

Four opinionated **intent recipes** are baked into the prompt and the LLM
composes from them or mixes freely: `define`, `point_out`, `compare`,
`emphasize`.

### The bbox data contract

`bboxData: PageBBoxData[]` is a per-page list of typed blocks:

```ts
interface PageBBoxData {
  id: string;
  page_number: number;
  page_text: string;
  page_dimensions: { width: number; height: number; dpi: number };
  blocks: Block[];
  created_at: string;
}

interface Block {
  block_id: string;               // stable id — referenced by storyboards
  bbox: [x1, y1, x2, y2];         // coords in the page's native DPI space
  text: string | null;
  type:
    | 'heading' | 'paragraph' | 'list_item'
    | 'figure'  | 'figure_region' | 'caption'
    | 'table'   | 'mcq_option';
  parent_id: string | null;
  confidence: number;
  reading_order: number;
  default_action: 'zoom_pan' | 'spotlight' | 'underline' | 'pulse';
  semantic_unit_id: string;
}
```

The LLM receives this inventory per call and MUST anchor every action to a
real `block_id` — hallucinated targets are rejected by both the JSON schema
and the runtime validator.

### Salvage guarantees

Small models occasionally emit malformed JSON, out-of-range numbers, or
camera-only storyboards. The director pipeline defends against all three so
the visuals never silently stall:

- **Whitespace collapse** — runs of ≥8 whitespace characters outside string
  literals are collapsed before `JSON.parse` (fixes tab-spam in `gpt-4.1-nano`).
- **Range clamp** — `camera.scale`, `padding`, `dim_opacity`, `feather_px`,
  `draw_duration_ms`, `count`, `at_ms`, step `duration_ms` are clamped to
  their schema-legal range before zod validation.
- **Overlay-presence enforcement** — if the validated storyboard is a single
  camera step, a `pulse` on the same target is auto-appended. A lone camera
  is physically impossible to emit.

Plus an optional **embedding fallback**: if the LLM request fails entirely,
pass `embeddingProvider={getLocalMiniLM()}` and the package will match the
chunk to the closest block via local text embeddings and emit a
`block.type`-appropriate storyboard (heading → spotlight + label, paragraph →
underline, caption → callout to nearest figure, etc.).

### Overlay hold time

Per-overlay `duration_ms` can be as low as 100 ms in the schema, and recipes
often specify 600–1200 ms. For voice-narration UX that is too quick to
register. The engine applies a **minimum hold time** floor:

```tsx
<TutorModeContainer
  ...
  minOverlayDurationMs={4000}  // default 3500 ms
/>
```

A good heuristic: set it to the average spoken-chunk duration so each overlay
lives as long as the narration it accompanies.

### The Reset view button

Top-right of the PDF area, the package renders a **Reset view** button by
default. Clicking it clears every overlay and returns the camera to fit-page.

```tsx
// Pure student-facing reset (recommended)
<TutorModeContainer ... showExitButton />

// Reset + also leave tutor mode
<TutorModeContainer
  ...
  showExitButton
  onExitTutorMode={() => router.push('/library')}
/>

// No button at all
<TutorModeContainer ... showExitButton={false} />
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `pageNumber` | `number` | required | 1-indexed page to render |
| `bboxData` | `PageBBoxData[]` | required | Per-page block inventory from your ingestion backend |
| `narrationStore` | `NarrationStoreApi` | required | Store created via `createNarrationStore()` — one per tutor session |
| `scale` | `number` | `1` | Raster scale multiplier on top of the native DPI |
| `rotation` | `number` | `0` | Page rotation in degrees |
| `currentChunk` | `string \| null` | `null` | The reactive text the tutor agent is currently speaking |
| `llm` | `LlmConfig` | — | OpenAI-compatible endpoint config (URL, model, auth token, extra body) |
| `embeddingProvider` | `EmbeddingProvider` | — | Optional local fallback when the LLM fails |
| `idleTimeoutMs` | `number` | `5000` | How long with no new chunks before the camera returns to fit-page |
| `llmTimeoutMs` | `number` | `30000` | Hard timeout for the LLM call |
| `minOverlayDurationMs` | `number` | `3500` | Minimum visible hold for every overlay, regardless of the LLM's `duration_ms` |
| `showSubtitles` | `boolean` | `false` | Render a subtitle bar with the current chunk text |
| `showExitButton` | `boolean` | `true` | Render the top-right "Reset view" button |
| `onExitTutorMode` | `() => void` | — | Optional callback fired AFTER the reset — use it to also leave tutor mode |
| `className` | `string` | — | Passes through to the root container for custom theming |

### LlmConfig

```ts
interface LlmConfig {
  endpointUrl: string;              // OpenAI-compatible /v1/chat/completions
  model: string;
  authToken?: string;
  extraBody?: Record<string, unknown>;
  maxTokens?: number;               // default 1024
  temperature?: number;             // default 0.3
  useJsonSchema?: boolean;          // default true — request structured output
  stream?: boolean;                 // default false
}
```

**Never hardcode the endpoint URL into the bundle** — this package ships to
multiple consumers and each owns its own inference endpoint. Pass the URL as
a prop at the call site, sourced from an env var or runtime config.

### The integration contract in one picture

```
Aria voice agent
       │  (emits sentence text as it speaks)
       ▼
<TutorModeContainer currentChunk={utterance} … />
       │
       │  debounce 200 ms
       ▼
directStoryboard(llm, chunk, bbox blocks)
       │  ← JSON-schema-constrained response
       │  ← salvage: whitespace collapse, range clamp
       ▼
StoryboardSchema.safeParse  →  enforceOverlayPresence
       │
       ▼
StoryboardEngine.execute
       │  ← scheduled via setTimeout per step.at_ms
       ▼
narrationStore {camera, activeOverlays}
       │  ← reactive
       ▼
<CameraView><PDFPage /><CinemaLayer /></CameraView>
       │
       ▼
Student sees the PDF react in real time
```

---

## API Reference

### PDFViewerClient Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string \| ArrayBuffer` | required | PDF source URL or data |
| `showToolbar` | `boolean` | `true` | Show the toolbar |
| `showSidebar` | `boolean` | `true` | Show the sidebar |
| `viewMode` | `'single' \| 'continuous' \| 'dual'` | `'continuous'` | Page view mode |
| `theme` | `'light' \| 'dark' \| 'sepia'` | `'light'` | Color theme |
| `initialPage` | `number` | `1` | Initial page (uncontrolled mode) |
| `page` | `number` | - | Controlled page number |
| `initialScale` | `number` | `1` | Initial zoom scale |
| `loadingComponent` | `ReactNode` | - | Custom loading UI |
| `errorComponent` | `ReactNode \| (error, retry) => ReactNode` | - | Custom error UI |
| `onDocumentLoad` | `(event) => void` | - | Called when document loads |
| `onPageChange` | `(page) => void` | - | Called when page changes |
| `onScaleChange` | `(scale) => void` | - | Called when zoom changes |
| `onPageRenderStart` | `(page) => void` | - | Called when page render starts |
| `onPageRenderComplete` | `(page) => void` | - | Called when page render completes |
| `onHighlightAdded` | `(highlight) => void` | - | Called when highlight is added |
| `onHighlightRemoved` | `(id) => void` | - | Called when highlight is removed |
| `onAnnotationAdded` | `(annotation) => void` | - | Called when annotation is added |
| `onError` | `(error) => void` | - | Called on error |

### usePDFViewer() Return Value

```typescript
{
  // Document
  document: PDFDocumentProxy | null;
  numPages: number;
  isLoading: boolean;
  error: Error | null;
  loadDocument: (options: LoadOptions) => Promise<void>;

  // Navigation
  currentPage: number;
  goToPage: (page: number, options?: GoToPageOptions) => Promise<void>;
  nextPage: () => void;
  previousPage: () => void;

  // Zoom
  scale: number;
  setScale: (scale: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToWidth: () => void;
  fitToPage: () => void;

  // Rotation
  rotation: number;
  rotateClockwise: () => void;
  rotateCounterClockwise: () => void;

  // Theme
  theme: 'light' | 'dark' | 'sepia';
  setTheme: (theme: Theme) => void;

  // View mode
  viewMode: 'single' | 'continuous' | 'dual';
  setViewMode: (mode: ViewMode) => void;

  // Search
  search: (query: string) => Promise<void>;
  searchResults: SearchResult[];
  currentSearchResult: number;
  nextSearchResult: () => void;
  previousSearchResult: () => void;
  clearSearch: () => void;

  // Highlights
  highlights: Highlight[];
  addHighlight: (params: AddHighlightParams) => Highlight;
  removeHighlight: (id: string) => void;
}
```

### PDFViewerHandle (ref methods)

When using a ref with PDFViewerClient:

```typescript
interface PDFViewerHandle {
  // Navigation
  goToPage: (page: number, options?: GoToPageOptions) => Promise<void>;
  getCurrentPage: () => number;

  // Search & Highlight
  searchAndHighlight: (query: string, options?: SearchAndHighlightOptions) => Promise<SearchAndHighlightResult>;
  clearSearchHighlights: () => void;

  // Agent Tools (structured API)
  agentTools: {
    navigateToPage: (page: number) => Promise<AgentToolResult<{ previousPage: number; currentPage: number }>>;
    highlightText: (text: string, options?: HighlightOptions) => Promise<AgentToolResult<{ matchCount: number; highlightIds: string[] }>>;
    getPageContent: (page: number) => Promise<AgentToolResult<{ text: string }>>;
    clearAllVisuals: () => Promise<AgentToolResult<void>>;
  };

  // Coordinate Helpers
  coordinates: {
    getPageDimensions: (page: number) => { width: number; height: number; rotation: number } | null;
    percentToPixels: (xPercent: number, yPercent: number, page: number) => { x: number; y: number } | null;
    pixelsToPercent: (x: number, y: number, page: number) => { x: number; y: number } | null;
  };
}
```

### Coordinate System

PDF coordinates use **points** (1 point = 1/72 inch):
- Origin (0, 0) is at the **top-left** corner
- X increases to the right
- Y increases downward
- Standard US Letter: 612 × 792 points (8.5" × 11")

```tsx
// Place element 1 inch from left, 2 inches from top
const x = 72;   // 1 inch × 72 points/inch
const y = 144;  // 2 inches × 72 points/inch
```

---

## Additional Features

### Themes

```tsx
const { theme, setTheme } = usePDFViewer();

setTheme('light');  // Light background
setTheme('dark');   // Dark background
setTheme('sepia');  // Sepia/warm background
```

### View Modes

```tsx
const { viewMode, setViewMode } = usePDFViewer();

setViewMode('single');      // One page at a time
setViewMode('continuous');  // Scrollable pages (virtualized)
setViewMode('dual');        // Two pages side by side
```

### Document Outline

```tsx
import { getOutline } from 'pdfjs-reader-core';

const outline = await getOutline(document);
// Returns table of contents structure
```

### Export Annotations

```tsx
import {
  exportHighlightsAsJSON,
  exportHighlightsAsMarkdown,
  downloadAnnotationsAsMarkdown,
} from 'pdfjs-reader-core';

// Export highlights as JSON
exportHighlightsAsJSON(highlights, 'highlights.json');

// Export as readable Markdown
downloadAnnotationsAsMarkdown({
  highlights,
  documentTitle: 'My Document',
}, 'notes.md');
```

---

## Performance

The library is optimized for fast rendering:

- **Virtualization** - Only visible pages are rendered
- **Range requests** - Downloads only needed PDF data
- **Page caching** - Loaded pages are cached
- **Full quality** - Renders at device pixel ratio for crisp text

```tsx
import { loadDocument, preloadDocument, clearDocumentCache } from 'pdfjs-reader-core';

// Preload next document
await preloadDocument('/next-doc.pdf');

// Clear cache to free memory
clearDocumentCache('/doc.pdf');
```

---

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## License

MIT
