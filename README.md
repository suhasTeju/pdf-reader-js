# PDF Reader JS

A fully-featured, Next.js-compatible PDF viewer for React with annotations, highlights, search, and more.

[![npm version](https://img.shields.io/npm/v/pdfjs-reader-core.svg)](https://www.npmjs.com/package/pdfjs-reader-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **PDF Rendering** - High-quality canvas-based rendering using PDF.js
- **Text Selection & Highlighting** - Select text and highlight with multiple colors (yellow, green, blue, pink, orange)
- **Annotations** - Add sticky notes, freehand drawings, and shapes (rectangles, circles, arrows, lines)
- **Search** - Full-text search across all pages with match highlighting
- **Search & Highlight API** - Combined `searchAndHighlight()` method for one-step text finding and marking
- **Multiple View Modes** - Single page, continuous scroll, and dual page views
- **Controlled Navigation** - Controlled `page` prop with Promise-based `goToPage()` for reliable navigation
- **Thumbnails & Outline** - Page thumbnails and document outline/table of contents navigation
- **Theming** - Light, dark, and sepia themes
- **Mobile Support** - Touch gestures, pinch-to-zoom, responsive UI
- **Programmatic API** - Full control via React hooks for highlights, annotations, navigation, and more
- **Agent-Ready API** - Structured `agentTools` API designed for AI agent integration

## Installation

```bash
npm install pdfjs-reader-core
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
        showAnnotationToolbar
      />
    </div>
  );
}
```

## Documentation

See the full documentation in the [package README](./packages/core/README.md) for:

- Detailed usage examples
- Programmatic highlight and annotation APIs
- Search and highlight text (`searchAndHighlight()` API)
- Controlled page navigation with Promise-based `goToPage()`
- Agent tools API for AI integration
- Coordinate conversion utilities
- Thumbnail navigation component
- Floating zoom controls
- Custom loading and error components
- Rich event callbacks
- Theme and view mode switching
- Export/import annotations
- Complete API reference
- TypeScript types

## Demo

Run the demo application to see all features in action:

```bash
# Clone the repo
git clone https://github.com/suhasTeju/pdf-reader-js.git
cd pdf-reader-js

# Install dependencies
pnpm install

# Build the core package
pnpm --filter pdfjs-reader-core build

# Run the demo
pnpm --filter demo dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Demo Features

- **Open PDF** - Load any PDF file from your computer or use the sample PDF
- **View Modes** - Switch between single page, continuous scroll, and dual page views
- **Annotate** - Toggle annotation toolbar to draw, add shapes, and sticky notes
- **API Demo** - Test programmatic APIs for adding highlights and shapes with custom coordinates
- **Search** - Use the search panel in the sidebar to find text
- **Themes** - Switch between light, dark, and sepia themes

## Project Structure

```
pdf-reader-js/
├── packages/
│   └── core/                 # Main package (pdfjs-reader-core)
│       ├── src/
│       │   ├── components/   # React components
│       │   ├── hooks/        # React hooks (usePDFViewer, useHighlights, etc.)
│       │   ├── store/        # Zustand stores
│       │   ├── types/        # TypeScript types
│       │   └── utils/        # Utility functions
│       └── README.md         # Package documentation
├── apps/
│   └── demo/                 # Next.js demo application
└── README.md                 # This file
```

## Development

### Prerequisites

- Node.js 18+
- pnpm 8+

### Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run development mode (watches for changes)
pnpm dev
```

### Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm build` | Build all packages |
| `pnpm dev` | Run in development mode |
| `pnpm --filter pdfjs-reader-core build` | Build core package only |
| `pnpm --filter demo dev` | Run demo app |
| `pnpm --filter pdfjs-reader-core test` | Run tests |
| `pnpm --filter pdfjs-reader-core typecheck` | Type check |

## Examples

### Add Highlights Programmatically

```tsx
import { useHighlights, usePDFViewer } from 'pdfjs-reader-core';

function MyComponent() {
  const { addHighlight } = useHighlights();
  const { currentPage } = usePDFViewer();

  const highlightText = () => {
    addHighlight({
      pageNumber: currentPage,
      rects: [{ x: 72, y: 100, width: 200, height: 14 }],
      text: 'Important text',
      color: 'yellow',
    });
  };

  return <button onClick={highlightText}>Highlight</button>;
}
```

### Add Shape Annotations

```tsx
import { useAnnotations, usePDFViewer } from 'pdfjs-reader-core';

function MyComponent() {
  const { createShape } = useAnnotations();
  const { currentPage } = usePDFViewer();

  const addBox = () => {
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

  return <button onClick={addBox}>Add Box</button>;
}
```

### Search and Highlight (v0.2.0+)

The new `searchAndHighlight()` method combines search and highlighting in one operation:

```tsx
import { useRef } from 'react';
import { PDFViewerClient, PDFViewerHandle } from 'pdfjs-reader-core';

function SearchComponent() {
  const viewerRef = useRef<PDFViewerHandle>(null);

  const handleSearch = async () => {
    const result = await viewerRef.current?.searchAndHighlight('keyword', {
      color: 'yellow',
      scrollToFirst: true,
    });
    console.log(`Found ${result?.matchCount} matches`);
  };

  return (
    <>
      <button onClick={handleSearch}>Find & Highlight</button>
      <PDFViewerClient ref={viewerRef} src="/document.pdf" />
    </>
  );
}
```

### Controlled Page Navigation (v0.2.0+)

Control page state externally with Promise-based navigation:

```tsx
import { useState, useRef } from 'react';
import { PDFViewerClient, PDFViewerHandle } from 'pdfjs-reader-core';

function ControlledViewer() {
  const viewerRef = useRef<PDFViewerHandle>(null);
  const [page, setPage] = useState(1);

  const goToPageFive = async () => {
    await viewerRef.current?.goToPage(5);
    console.log('Now on page 5');
  };

  return (
    <>
      <button onClick={goToPageFive}>Go to Page 5</button>
      <PDFViewerClient
        ref={viewerRef}
        src="/document.pdf"
        page={page}           // Controlled mode
        onPageChange={setPage}
      />
    </>
  );
}
```

### Agent Tools API (v0.2.0+)

Structured API designed for AI agent integration:

```tsx
import { useRef } from 'react';
import { PDFViewerClient, PDFViewerHandle } from 'pdfjs-reader-core';

function AgentIntegration() {
  const viewerRef = useRef<PDFViewerHandle>(null);

  const handleAgentAction = async () => {
    const tools = viewerRef.current?.agentTools;

    // Navigate with structured response
    const navResult = await tools?.navigateToPage(5);
    if (navResult?.success) {
      console.log('Moved from page', navResult.data?.previousPage, 'to', navResult.data?.currentPage);
    }

    // Highlight text with structured response
    const hlResult = await tools?.highlightText('important term', { color: 'yellow' });
    if (hlResult?.success) {
      console.log('Created', hlResult.data?.matchCount, 'highlights');
    }

    // Get page content
    const textResult = await tools?.getPageContent(1);
    console.log('Page text:', textResult?.data?.text);
  };

  return (
    <>
      <button onClick={handleAgentAction}>Run Agent Actions</button>
      <PDFViewerClient ref={viewerRef} src="/document.pdf" />
    </>
  );
}
```

## Tech Stack

- **React 18/19** - UI framework
- **PDF.js** - PDF rendering engine
- **Zustand** - State management
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **tsup** - Build tool
- **Next.js** - Demo app framework

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**Suhas** - [suhasrdev@gmail.com](mailto:suhasrdev@gmail.com)

## Links

- [npm Package](https://www.npmjs.com/package/pdfjs-reader-core)
- [GitHub Repository](https://github.com/suhasTeju/pdf-reader-js)
- [Report Issues](https://github.com/suhasTeju/pdf-reader-js/issues)
