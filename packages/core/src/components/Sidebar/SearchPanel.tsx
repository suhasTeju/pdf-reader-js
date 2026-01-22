import { memo, useCallback, useState, useEffect, useRef } from 'react';
import { usePDFViewer, useSearchStore, usePDFViewerStores } from '../../hooks';
import { cn } from '../../utils';

export interface SearchPanelProps {
  className?: string;
}

export const SearchPanel = memo(function SearchPanel({ className }: SearchPanelProps) {
  const { searchStore } = usePDFViewerStores();
  const {
    searchQuery,
    searchResults,
    currentSearchResult,
    isSearching,
    search,
    clearSearch,
    nextSearchResult,
    previousSearchResult,
    goToPage,
  } = usePDFViewer();

  const caseSensitive = useSearchStore((s) => s.caseSensitive);
  const wholeWord = useSearchStore((s) => s.wholeWord);
  const toggleCaseSensitive = useSearchStore((s) => s.toggleCaseSensitive);
  const toggleWholeWord = useSearchStore((s) => s.toggleWholeWord);

  const [inputValue, setInputValue] = useState(searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = useCallback(() => {
    if (inputValue.trim()) {
      search(inputValue.trim());
    }
  }, [inputValue, search]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (e.shiftKey) {
          previousSearchResult();
        } else if (searchResults.length > 0) {
          nextSearchResult();
        } else {
          handleSearch();
        }
      } else if (e.key === 'Escape') {
        clearSearch();
        setInputValue('');
      }
    },
    [handleSearch, searchResults, nextSearchResult, previousSearchResult, clearSearch]
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const handleClear = useCallback(() => {
    clearSearch();
    setInputValue('');
    inputRef.current?.focus();
  }, [clearSearch]);

  const handleResultClick = useCallback(
    (pageNumber: number, resultIndex: number) => {
      goToPage(pageNumber);
      // Navigate to specific result
      searchStore.getState().goToResult(resultIndex);
    },
    [goToPage, searchStore]
  );

  return (
    <div className={cn('search-panel', 'flex flex-col h-full', className)}>
      {/* Search input */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Search in document..."
            className={cn(
              'w-full px-3 py-2 pr-8',
              'border rounded-md',
              'text-sm',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
              'dark:bg-gray-700 dark:border-gray-600 dark:text-white'
            )}
          />
          {inputValue && (
            <button
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Search options */}
        <div className="flex items-center gap-4 mt-2">
          <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={toggleCaseSensitive}
              className="rounded"
            />
            Match case
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={wholeWord}
              onChange={toggleWholeWord}
              className="rounded"
            />
            Whole word
          </label>
        </div>

        {/* Results navigation */}
        {searchResults.length > 0 && (
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {currentSearchResult + 1} of {searchResults.length} results
            </span>
            <div className="flex gap-1">
              <button
                onClick={previousSearchResult}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Previous result"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 15l7-7 7 7"
                  />
                </svg>
              </button>
              <button
                onClick={nextSearchResult}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Next result"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {isSearching && (
          <div className="mt-2 text-xs text-gray-500">Searching...</div>
        )}
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto">
        {searchResults.length === 0 && searchQuery && !isSearching && (
          <div className="p-4 text-sm text-gray-500 text-center">
            No results found for "{searchQuery}"
          </div>
        )}

        {searchResults.length > 0 && (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {searchResults.map((result, index) => (
              <li key={`${result.pageNumber}-${result.matchIndex}`}>
                <button
                  onClick={() => handleResultClick(result.pageNumber, index)}
                  className={cn(
                    'w-full px-3 py-2 text-left',
                    'hover:bg-gray-50 dark:hover:bg-gray-700',
                    'focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700',
                    index === currentSearchResult && 'bg-blue-50 dark:bg-blue-900/30'
                  )}
                >
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Page {result.pageNumber}
                  </div>
                  <div className="text-sm truncate">{result.text}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
});
