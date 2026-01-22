# PDF Reader JS

A fully-featured, Next.js-compatible PDF viewer for React with annotations, highlights, search, and more.

[![npm version](https://img.shields.io/npm/v/pdfjs-reader-core.svg)](https://www.npmjs.com/package/pdfjs-reader-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **PDF Rendering** - High-quality canvas-based rendering using PDF.js
- **Text Selection & Highlighting** - Select text and highlight with multiple colors (yellow, green, blue, pink, orange)
- **Annotations** - Add sticky notes, freehand drawings, and shapes (rectangles, circles, arrows, lines)
- **Search** - Full-text search across all pages with match highlighting
- **Multiple View Modes** - Single page, continuous scroll, and dual page views
- **Thumbnails & Outline** - Page thumbnails and document outline/table of contents navigation
- **Theming** - Light, dark, and sepia themes
- **Mobile Support** - Touch gestures, pinch-to-zoom, responsive UI
- **Programmatic API** - Full control via React hooks for highlights, annotations, navigation, and more

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
- Search and highlight text
- Custom controls and navigation
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

### Search and Highlight Matches

```tsx
import { usePDFViewer, useHighlights } from 'pdfjs-reader-core';

function SearchComponent() {
  const { search, searchResults } = usePDFViewer();
  const { addHighlight } = useHighlights();

  const searchAndHighlight = async (query: string) => {
    await search(query);

    for (const result of searchResults) {
      addHighlight({
        pageNumber: result.pageNumber,
        rects: result.rects,
        text: result.text,
        color: 'green',
      });
    }
  };

  return (
    <button onClick={() => searchAndHighlight('keyword')}>
      Find & Highlight
    </button>
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
