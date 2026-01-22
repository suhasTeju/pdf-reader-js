# pdfjs-reader-core

A fully-featured, Next.js-compatible PDF viewer for React with annotations, highlights, search, and more.

## Features

- **PDF Rendering** - High-quality canvas-based rendering using PDF.js
- **Text Selection & Highlighting** - Select text and highlight with multiple colors
- **Annotations** - Add sticky notes, freehand drawings, and shapes (rectangles, circles, arrows, lines)
- **Search** - Full-text search across all pages with match highlighting
- **Multiple View Modes** - Single page, continuous scroll, and dual page views
- **Thumbnails & Outline** - Page thumbnails and document outline navigation
- **Theming** - Light, dark, and sepia themes
- **Mobile Support** - Touch gestures, pinch-to-zoom, responsive UI
- **Programmatic API** - Full control via React hooks

## Installation

```bash
npm install pdfjs-reader-core
# or
yarn add pdfjs-reader-core
# or
pnpm add pdfjs-reader-core
```

## Quick Start

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
      />
    </div>
  );
}
```

## Usage Examples

### Basic Viewer

```tsx
import { PDFViewerClient } from 'pdfjs-reader-core';
import 'pdfjs-reader-core/styles.css';

function BasicViewer() {
  return (
    <PDFViewerClient
      src="https://example.com/document.pdf"
      showToolbar={true}
      showSidebar={true}
      theme="light"
      onDocumentLoad={({ numPages }) => console.log(`Loaded ${numPages} pages`)}
      onError={(error) => console.error('Failed to load:', error)}
    />
  );
}
```

### With Annotations Toolbar

```tsx
import { PDFViewerClient } from 'pdfjs-reader-core';
import 'pdfjs-reader-core/styles.css';

function AnnotationViewer() {
  return (
    <PDFViewerClient
      src="/document.pdf"
      showToolbar
      showSidebar
      showAnnotationToolbar={true}  // Enables annotation tools
      viewMode="continuous"          // continuous | single | dual
      theme="dark"
    />
  );
}
```

### Programmatic Highlights

Add highlights programmatically using coordinates:

```tsx
import {
  PDFViewerProvider,
  useHighlights,
  usePDFViewer,
  DocumentContainer,
  Toolbar
} from 'pdfjs-reader-core';
import 'pdfjs-reader-core/styles.css';

function HighlightDemo() {
  const { addHighlight, allHighlights } = useHighlights();
  const { currentPage } = usePDFViewer();

  const handleAddHighlight = () => {
    addHighlight({
      pageNumber: currentPage,
      rects: [
        { x: 72, y: 100, width: 200, height: 14 },
        { x: 72, y: 116, width: 150, height: 14 },
      ],
      text: 'Highlighted text',
      color: 'yellow', // yellow | green | blue | pink | orange
      comment: 'My note',
    });
  };

  return (
    <div>
      <button onClick={handleAddHighlight}>Add Highlight</button>
      <p>Total highlights: {allHighlights.length}</p>
    </div>
  );
}

// Wrap with provider
function App() {
  return (
    <PDFViewerProvider>
      <Toolbar />
      <DocumentContainer />
      <HighlightDemo />
    </PDFViewerProvider>
  );
}
```

### Programmatic Shape Annotations

Add shapes (rectangles, circles, arrows, lines) programmatically:

```tsx
import { useAnnotations, usePDFViewer } from 'pdfjs-reader-core';

function ShapeDemo() {
  const { createShape, annotations } = useAnnotations();
  const { currentPage } = usePDFViewer();

  const addRectangle = () => {
    createShape({
      pageNumber: currentPage,
      shapeType: 'rect', // rect | circle | arrow | line
      x: 100,
      y: 200,
      width: 150,
      height: 80,
      color: '#ef4444',
      strokeWidth: 2,
    });
  };

  const addCircle = () => {
    createShape({
      pageNumber: currentPage,
      shapeType: 'circle',
      x: 300,
      y: 200,
      width: 80,
      height: 80,
      color: '#3b82f6',
      strokeWidth: 2,
    });
  };

  const addArrow = () => {
    createShape({
      pageNumber: currentPage,
      shapeType: 'arrow',
      x: 100,
      y: 350,
      width: 120,
      height: 40,
      color: '#22c55e',
      strokeWidth: 3,
    });
  };

  return (
    <div>
      <button onClick={addRectangle}>Add Rectangle</button>
      <button onClick={addCircle}>Add Circle</button>
      <button onClick={addArrow}>Add Arrow</button>
      <p>Total annotations: {annotations.length}</p>
    </div>
  );
}
```

### Search and Highlight Text

Search for text and highlight all matches:

```tsx
import { usePDFViewer, useHighlights } from 'pdfjs-reader-core';

function SearchAndHighlight() {
  const { search, searchResults, goToPage } = usePDFViewer();
  const { addHighlight } = useHighlights();
  const [query, setQuery] = useState('');

  const handleSearch = async () => {
    await search(query);
  };

  const highlightAllMatches = () => {
    for (const result of searchResults) {
      if (result.rects?.length > 0) {
        addHighlight({
          pageNumber: result.pageNumber,
          rects: result.rects,
          text: result.text,
          color: 'yellow',
        });
      }
    }
    // Navigate to first match
    if (searchResults.length > 0) {
      goToPage(searchResults[0].pageNumber);
    }
  };

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search text..."
      />
      <button onClick={handleSearch}>Search</button>
      <button onClick={highlightAllMatches}>
        Highlight All ({searchResults.length} matches)
      </button>
    </div>
  );
}
```

### Navigation and Zoom Controls

```tsx
import { usePDFViewer } from 'pdfjs-reader-core';

function CustomControls() {
  const {
    currentPage,
    numPages,
    scale,
    goToPage,
    nextPage,
    previousPage,
    zoomIn,
    zoomOut,
    setScale,
    fitToWidth,
    fitToPage,
    rotateClockwise,
  } = usePDFViewer();

  return (
    <div>
      {/* Navigation */}
      <button onClick={previousPage} disabled={currentPage <= 1}>Previous</button>
      <span>{currentPage} / {numPages}</span>
      <button onClick={nextPage} disabled={currentPage >= numPages}>Next</button>

      {/* Jump to page */}
      <input
        type="number"
        min={1}
        max={numPages}
        value={currentPage}
        onChange={(e) => goToPage(parseInt(e.target.value))}
      />

      {/* Zoom */}
      <button onClick={zoomOut}>-</button>
      <span>{Math.round(scale * 100)}%</span>
      <button onClick={zoomIn}>+</button>
      <button onClick={fitToWidth}>Fit Width</button>
      <button onClick={fitToPage}>Fit Page</button>

      {/* Rotation */}
      <button onClick={rotateClockwise}>Rotate</button>
    </div>
  );
}
```

### Theme Switching

```tsx
import { usePDFViewer } from 'pdfjs-reader-core';

function ThemeSwitcher() {
  const { theme, setTheme } = usePDFViewer();

  return (
    <select value={theme} onChange={(e) => setTheme(e.target.value)}>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
      <option value="sepia">Sepia</option>
    </select>
  );
}
```

### View Mode Switching

```tsx
import { usePDFViewer } from 'pdfjs-reader-core';

function ViewModeSwitcher() {
  const { viewMode, setViewMode } = usePDFViewer();

  return (
    <select value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
      <option value="single">Single Page</option>
      <option value="continuous">Continuous Scroll</option>
      <option value="dual">Dual Page</option>
    </select>
  );
}
```

### Export/Import Annotations

```tsx
import { useAnnotations, useHighlights } from 'pdfjs-reader-core';

function ExportImport() {
  const { exportAnnotations, importAnnotations } = useAnnotations();
  const { allHighlights } = useHighlights();

  const handleExport = () => {
    const json = exportAnnotations();
    // Save to file or send to server
    console.log(json);
  };

  const handleImport = (jsonString: string) => {
    importAnnotations(jsonString);
  };

  return (
    <div>
      <button onClick={handleExport}>Export Annotations</button>
      <button onClick={() => handleImport('[]')}>Import Annotations</button>
    </div>
  );
}
```

## API Reference

### Components

| Component | Description |
|-----------|-------------|
| `PDFViewerClient` | Full-featured viewer with built-in provider (easiest to use) |
| `PDFViewerProvider` | Context provider for using hooks |
| `DocumentContainer` | Single page view container |
| `ContinuousScrollContainer` | Continuous scroll view container |
| `DualPageContainer` | Dual page (book) view container |
| `Toolbar` | Navigation and zoom toolbar |
| `Sidebar` | Thumbnails, outline, search panel |
| `AnnotationToolbar` | Drawing and annotation tools |

### PDFViewerClient Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string \| ArrayBuffer` | required | PDF source URL or data |
| `showToolbar` | `boolean` | `true` | Show the toolbar |
| `showSidebar` | `boolean` | `true` | Show the sidebar |
| `showAnnotationToolbar` | `boolean` | `false` | Show annotation tools |
| `viewMode` | `'single' \| 'continuous' \| 'dual'` | `'single'` | Page view mode |
| `theme` | `'light' \| 'dark' \| 'sepia'` | `'light'` | Color theme |
| `initialPage` | `number` | `1` | Initial page to display |
| `initialScale` | `number` | `1` | Initial zoom scale |
| `onDocumentLoad` | `(event) => void` | - | Called when document loads |
| `onPageChange` | `(page) => void` | - | Called when page changes |
| `onScaleChange` | `(scale) => void` | - | Called when zoom changes |
| `onError` | `(error) => void` | - | Called on error |

### Hooks

#### `usePDFViewer()`

Main hook for viewer state and actions.

```tsx
const {
  // Document state
  document,        // PDFDocumentProxy
  numPages,        // Total pages
  isLoading,       // Loading state
  error,           // Error state

  // Navigation
  currentPage,     // Current page number
  goToPage,        // (page: number) => void
  nextPage,        // () => void
  previousPage,    // () => void

  // Zoom
  scale,           // Current zoom level
  setScale,        // (scale: number) => void
  zoomIn,          // () => void
  zoomOut,         // () => void
  fitToWidth,      // () => void
  fitToPage,       // () => void

  // Rotation
  rotation,        // Current rotation (0, 90, 180, 270)
  rotateClockwise, // () => void

  // Theme & UI
  theme,           // 'light' | 'dark' | 'sepia'
  setTheme,        // (theme) => void
  viewMode,        // 'single' | 'continuous' | 'dual'
  setViewMode,     // (mode) => void
  sidebarOpen,     // Sidebar visibility
  toggleSidebar,   // () => void

  // Search
  search,          // (query: string) => Promise<void>
  searchResults,   // SearchResult[]
  clearSearch,     // () => void
} = usePDFViewer();
```

#### `useHighlights(options?)`

Hook for managing text highlights.

```tsx
const {
  // State
  allHighlights,       // Highlight[]
  selectedHighlight,   // Current selection
  activeColor,         // Active highlight color

  // Actions
  addHighlight,        // Add highlight with coordinates
  createHighlightFromSelection,  // Create from text selection
  updateHighlight,     // (id, updates) => void
  deleteHighlight,     // (id) => void
  selectHighlight,     // (id) => void
  setActiveColor,      // (color) => void
  highlightsForPage,   // (pageNumber) => Highlight[]
} = useHighlights({
  onHighlightCreate: (highlight) => {},
  onHighlightUpdate: (highlight) => {},
  onHighlightDelete: (id) => {},
});
```

#### `useAnnotations(options?)`

Hook for managing annotations (notes, drawings, shapes).

```tsx
const {
  // State
  annotations,         // Annotation[]
  selectedAnnotation,  // Current selection
  activeTool,          // 'note' | 'draw' | 'shape' | null
  activeShapeType,     // 'rect' | 'circle' | 'arrow' | 'line'
  drawingColor,        // Current drawing color
  drawingStrokeWidth,  // Current stroke width

  // Tool actions
  setActiveTool,       // (tool) => void
  setActiveShapeType,  // (type) => void
  setDrawingColor,     // (color) => void
  setDrawingStrokeWidth, // (width) => void

  // Note actions
  createNote,          // (page, x, y, content?, color?) => Note
  updateNote,          // (id, updates) => void

  // Shape actions
  createShape,         // (options) => Shape
  updateShape,         // (id, updates) => void

  // Drawing actions
  startDrawing,        // (page, point) => void
  continueDrawing,     // (point) => void
  finishDrawing,       // () => Annotation | null

  // General
  selectAnnotation,    // (id) => void
  deleteAnnotation,    // (id) => void
  getAnnotationsByPage, // (page) => Annotation[]
  exportAnnotations,   // () => string (JSON)
  importAnnotations,   // (json) => void
} = useAnnotations({
  onAnnotationCreate: (annotation) => {},
  onAnnotationUpdate: (annotation) => {},
  onAnnotationDelete: (id) => {},
});
```

## Types

### Highlight

```typescript
interface Highlight {
  id: string;
  pageNumber: number;
  rects: HighlightRect[];
  text: string;
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'orange';
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface HighlightRect {
  x: number;      // PDF points from left
  y: number;      // PDF points from top
  width: number;  // Width in PDF points
  height: number; // Height in PDF points
}
```

### Annotation

```typescript
type Annotation = NoteAnnotation | DrawingAnnotation | ShapeAnnotation;

interface NoteAnnotation {
  id: string;
  type: 'note';
  pageNumber: number;
  x: number;
  y: number;
  content: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ShapeAnnotation {
  id: string;
  type: 'shape';
  pageNumber: number;
  shapeType: 'rect' | 'circle' | 'arrow' | 'line';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
  createdAt: Date;
  updatedAt: Date;
}

interface DrawingAnnotation {
  id: string;
  type: 'drawing';
  pageNumber: number;
  paths: { points: { x: number; y: number }[] }[];
  color: string;
  strokeWidth: number;
  createdAt: Date;
  updatedAt: Date;
}
```

## Coordinate System

PDF coordinates are in **points** (1 point = 1/72 inch):
- Origin (0, 0) is at the **top-left** corner
- X increases to the right
- Y increases downward
- Standard US Letter page: 612 x 792 points

Example: To place a highlight 1 inch from the left and 2 inches from the top:
```tsx
addHighlight({
  pageNumber: 1,
  rects: [{ x: 72, y: 144, width: 100, height: 14 }],
  text: 'Example',
  color: 'yellow',
});
```

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## License

MIT

## Links

- [GitHub Repository](https://github.com/suhasTeju/pdf-reader-js)
- [Report Issues](https://github.com/suhasTeju/pdf-reader-js/issues)
