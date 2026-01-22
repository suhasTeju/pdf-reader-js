import { memo, useCallback, useRef, useEffect, useState } from 'react';
import { cn } from '../../utils';
import type { SidebarPanel } from '../../types';

export interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activePanel: SidebarPanel;
  onPanelChange: (panel: SidebarPanel) => void;
  children: React.ReactNode;
  className?: string;
}

const SWIPE_THRESHOLD = 50;

export const MobileSidebar = memo(function MobileSidebar({
  isOpen,
  onClose,
  activePanel,
  onPanelChange,
  children,
  className,
}: MobileSidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  }, []);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;

    const currentX = e.touches[0].clientX;
    const diff = currentX - startXRef.current;

    // Only allow dragging to the left (to close)
    if (diff < 0) {
      setTranslateX(diff);
    }
  }, [isDragging]);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);

    // If dragged past threshold, close the sidebar
    if (translateX < -SWIPE_THRESHOLD) {
      onClose();
    }

    setTranslateX(0);
  }, [translateX, onClose]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const panels: { id: SidebarPanel; label: string; icon: React.ReactNode }[] = [
    {
      id: 'thumbnails',
      label: 'Pages',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      id: 'search',
      label: 'Search',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      id: 'outline',
      label: 'Outline',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      ),
    },
    {
      id: 'annotations',
      label: 'Notes',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar drawer */}
      <div
        ref={sidebarRef}
        className={cn(
          'mobile-sidebar',
          'fixed inset-y-0 left-0 z-50',
          'w-[85vw] max-w-[320px]',
          'bg-white dark:bg-gray-800',
          'shadow-2xl',
          'transform transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          className
        )}
        style={{
          transform: isOpen
            ? `translateX(${translateX}px)`
            : 'translateX(-100%)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {panels.find((p) => p.id === activePanel)?.label || 'Menu'}
          </h2>
          <button
            className={cn(
              'p-2 -mr-2 rounded-lg',
              'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
              'hover:bg-gray-100 dark:hover:bg-gray-700',
              'min-w-[44px] min-h-[44px] flex items-center justify-center'
            )}
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Panel tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {panels.map((panel) => (
            <button
              key={panel.id}
              className={cn(
                'flex-1 py-3 flex flex-col items-center gap-1',
                'text-xs font-medium transition-colors',
                'min-h-[60px]',
                activePanel === panel.id
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 -mb-[2px]'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}
              onClick={() => onPanelChange(panel.id)}
            >
              {panel.icon}
              <span>{panel.label}</span>
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>

        {/* Swipe indicator */}
        <div className="absolute top-1/2 -translate-y-1/2 right-0 w-1 h-16 bg-gray-300 dark:bg-gray-600 rounded-l-full opacity-50" />
      </div>
    </>
  );
});
