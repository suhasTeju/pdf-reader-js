import { memo, useState, useCallback } from 'react';
import { cn } from '../../utils';

export interface MobileToolbarProps {
  // Navigation
  currentPage: number;
  totalPages: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onGoToPage: (page: number) => void;

  // Zoom
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;

  // Sidebar
  onToggleSidebar: () => void;
  sidebarOpen: boolean;

  // Theme
  theme: 'light' | 'dark' | 'sepia';
  onThemeChange: (theme: 'light' | 'dark' | 'sepia') => void;

  // Position
  position?: 'top' | 'bottom';

  className?: string;
}

export const MobileToolbar = memo(function MobileToolbar({
  currentPage,
  totalPages,
  onPreviousPage,
  onNextPage,
  onGoToPage,
  scale,
  onZoomIn,
  onZoomOut,
  onToggleSidebar,
  sidebarOpen,
  theme,
  onThemeChange,
  position = 'bottom',
  className,
}: MobileToolbarProps) {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showPageInput, setShowPageInput] = useState(false);
  const [pageInputValue, setPageInputValue] = useState(String(currentPage));

  const handlePageSubmit = useCallback(() => {
    const page = parseInt(pageInputValue, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onGoToPage(page);
    }
    setShowPageInput(false);
  }, [pageInputValue, totalPages, onGoToPage]);

  const toggleMoreMenu = useCallback(() => {
    setShowMoreMenu((prev) => !prev);
  }, []);

  const buttonClasses = cn(
    'min-w-[44px] min-h-[44px]',
    'flex items-center justify-center',
    'rounded-lg transition-colors',
    'text-gray-700 dark:text-gray-300',
    'hover:bg-gray-100 dark:hover:bg-gray-700',
    'active:bg-gray-200 dark:active:bg-gray-600',
    'disabled:opacity-40 disabled:pointer-events-none'
  );

  return (
    <div
      className={cn(
        'mobile-toolbar',
        'fixed left-0 right-0 z-50',
        'bg-white dark:bg-gray-800',
        'border-gray-200 dark:border-gray-700',
        'px-2 py-1 safe-area-inset',
        position === 'top' && 'top-0 border-b',
        position === 'bottom' && 'bottom-0 border-t',
        className
      )}
    >
      <div className="flex items-center justify-between gap-1">
        {/* Sidebar toggle */}
        <button
          className={cn(buttonClasses, sidebarOpen && 'bg-blue-100 dark:bg-blue-900')}
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Navigation group */}
        <div className="flex items-center">
          <button
            className={buttonClasses}
            onClick={onPreviousPage}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Page indicator */}
          {showPageInput ? (
            <input
              type="number"
              className={cn(
                'w-16 h-10 text-center text-sm',
                'bg-gray-100 dark:bg-gray-700',
                'border border-gray-300 dark:border-gray-600',
                'rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
              )}
              value={pageInputValue}
              onChange={(e) => setPageInputValue(e.target.value)}
              onBlur={handlePageSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePageSubmit();
                if (e.key === 'Escape') setShowPageInput(false);
              }}
              min={1}
              max={totalPages}
              autoFocus
            />
          ) : (
            <button
              className={cn(
                'min-w-[60px] h-10 px-2',
                'text-sm font-medium',
                'text-gray-700 dark:text-gray-300'
              )}
              onClick={() => {
                setPageInputValue(String(currentPage));
                setShowPageInput(true);
              }}
            >
              {currentPage} / {totalPages}
            </button>
          )}

          <button
            className={buttonClasses}
            onClick={onNextPage}
            disabled={currentPage >= totalPages}
            aria-label="Next page"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Zoom group */}
        <div className="flex items-center">
          <button
            className={buttonClasses}
            onClick={onZoomOut}
            aria-label="Zoom out"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>

          <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[40px] text-center">
            {Math.round(scale * 100)}%
          </span>

          <button
            className={buttonClasses}
            onClick={onZoomIn}
            aria-label="Zoom in"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* More menu */}
        <div className="relative">
          <button
            className={cn(buttonClasses, showMoreMenu && 'bg-gray-100 dark:bg-gray-700')}
            onClick={toggleMoreMenu}
            aria-label="More options"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>

          {/* More menu dropdown */}
          {showMoreMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMoreMenu(false)}
              />
              <div
                className={cn(
                  'absolute right-0 z-50',
                  'w-48 p-2',
                  'bg-white dark:bg-gray-800',
                  'rounded-lg shadow-lg',
                  'border border-gray-200 dark:border-gray-700',
                  position === 'bottom' ? 'bottom-full mb-2' : 'top-full mt-2'
                )}
              >
                {/* Theme options */}
                <div className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Theme
                </div>
                {(['light', 'dark', 'sepia'] as const).map((t) => (
                  <button
                    key={t}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm rounded-lg',
                      'flex items-center gap-2',
                      theme === t
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                    )}
                    onClick={() => {
                      onThemeChange(t);
                      setShowMoreMenu(false);
                    }}
                  >
                    <span className="capitalize">{t}</span>
                    {theme === t && (
                      <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
