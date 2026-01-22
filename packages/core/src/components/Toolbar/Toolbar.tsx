import { memo, useCallback, useState } from 'react';
import { usePDFViewer } from '../../hooks';
import { cn } from '../../utils';

export interface ToolbarProps {
  className?: string;
  showNavigation?: boolean;
  showZoom?: boolean;
  showRotation?: boolean;
  showTheme?: boolean;
  showSidebar?: boolean;
  showFullscreen?: boolean;
}

export const Toolbar = memo(function Toolbar({
  className,
  showNavigation = true,
  showZoom = true,
  showRotation = true,
  showTheme = true,
  showSidebar = true,
  showFullscreen = true,
}: ToolbarProps) {
  const {
    currentPage,
    numPages,
    scale,
    theme,
    sidebarOpen,
    goToPage,
    previousPage,
    nextPage,
    zoomIn,
    zoomOut,
    setScale,
    rotateClockwise,
    setTheme,
    toggleSidebar,
    setFullscreen,
  } = usePDFViewer();

  const [pageInput, setPageInput] = useState(String(currentPage));

  const handlePageInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPageInput(e.target.value);
    },
    []
  );

  const handlePageInputBlur = useCallback(() => {
    const page = parseInt(pageInput, 10);
    if (!isNaN(page) && page >= 1 && page <= numPages) {
      goToPage(page);
    } else {
      setPageInput(String(currentPage));
    }
  }, [pageInput, numPages, goToPage, currentPage]);

  const handlePageInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handlePageInputBlur();
      }
    },
    [handlePageInputBlur]
  );

  const handleZoomChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      if (value === 'fit-width') {
        setScale(1);
      } else if (value === 'fit-page') {
        setScale(1);
      } else {
        setScale(parseFloat(value));
      }
    },
    [setScale]
  );

  const zoomOptions = [
    { value: '0.5', label: '50%' },
    { value: '0.75', label: '75%' },
    { value: '1', label: '100%' },
    { value: '1.25', label: '125%' },
    { value: '1.5', label: '150%' },
    { value: '2', label: '200%' },
    { value: '3', label: '300%' },
  ];

  // Update page input when currentPage changes
  if (pageInput !== String(currentPage) && document.activeElement?.tagName !== 'INPUT') {
    setPageInput(String(currentPage));
  }

  return (
    <div
      className={cn(
        'pdf-toolbar',
        'flex items-center justify-between',
        'px-4 py-2',
        'bg-white border-b border-gray-200',
        'dark:bg-gray-800 dark:border-gray-700',
        className
      )}
    >
      {/* Left section */}
      <div className="flex items-center gap-2">
        {showSidebar && (
          <button
            onClick={toggleSidebar}
            className={cn(
              'p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700',
              sidebarOpen && 'bg-gray-100 dark:bg-gray-700'
            )}
            title="Toggle Sidebar"
            aria-label="Toggle Sidebar"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h7"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Center section - Navigation */}
      <div className="flex items-center gap-4">
        {showNavigation && (
          <div className="flex items-center gap-2">
            <button
              onClick={previousPage}
              disabled={currentPage <= 1}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Previous Page"
              aria-label="Previous Page"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            <div className="flex items-center gap-1 text-sm">
              <input
                type="text"
                value={pageInput}
                onChange={handlePageInputChange}
                onBlur={handlePageInputBlur}
                onKeyDown={handlePageInputKeyDown}
                className="w-12 px-2 py-1 text-center border rounded dark:bg-gray-700 dark:border-gray-600"
                aria-label="Current Page"
              />
              <span className="text-gray-500">/ {numPages}</span>
            </div>

            <button
              onClick={nextPage}
              disabled={currentPage >= numPages}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Next Page"
              aria-label="Next Page"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        )}

        {showZoom && (
          <div className="flex items-center gap-2 border-l pl-4 border-gray-200 dark:border-gray-700">
            <button
              onClick={zoomOut}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
                />
              </svg>
            </button>

            <select
              value={scale.toString()}
              onChange={handleZoomChange}
              className="px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
              aria-label="Zoom Level"
            >
              {zoomOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              onClick={zoomIn}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Zoom In"
              aria-label="Zoom In"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
                />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {showRotation && (
          <button
            onClick={rotateClockwise}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Rotate Clockwise"
            aria-label="Rotate Clockwise"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        )}

        {showTheme && (
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'sepia')}
            className="px-2 py-1 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
            aria-label="Theme"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="sepia">Sepia</option>
          </select>
        )}

        {showFullscreen && (
          <button
            onClick={() => setFullscreen(true)}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Fullscreen"
            aria-label="Fullscreen"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
});
