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
  goToPage,       // Navigate to specific page
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
goToPage(5);           // Go to page 5
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
  source?: 'user' | 'agent';  // Who created it
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

## API Reference

### PDFViewerClient Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string \| ArrayBuffer` | required | PDF source URL or data |
| `showToolbar` | `boolean` | `true` | Show the toolbar |
| `showSidebar` | `boolean` | `true` | Show the sidebar |
| `viewMode` | `'single' \| 'continuous' \| 'dual'` | `'continuous'` | Page view mode |
| `theme` | `'light' \| 'dark' \| 'sepia'` | `'light'` | Color theme |
| `initialPage` | `number` | `1` | Initial page to display |
| `initialScale` | `number` | `1` | Initial zoom scale |
| `onDocumentLoad` | `(event) => void` | - | Called when document loads |
| `onPageChange` | `(page) => void` | - | Called when page changes |
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
  goToPage: (page: number) => void;
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
