import { memo } from 'react';
import { usePDFViewer } from '../../hooks';
import { ThumbnailPanel } from './ThumbnailPanel';
import { SearchPanel } from './SearchPanel';
import { OutlinePanel } from './OutlinePanel';
import { HighlightsPanel } from './HighlightsPanel';
import { cn } from '../../utils';
import type { SidebarPanel as SidebarPanelType } from '../../types';

export interface SidebarProps {
  className?: string;
  width?: number;
}

interface SidebarTabProps {
  id: SidebarPanelType;
  icon: React.ReactNode;
  title: string;
  isActive: boolean;
  onClick: () => void;
}

const SidebarTab = memo(function SidebarTab({
  icon,
  title,
  isActive,
  onClick,
}: SidebarTabProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'p-3 flex items-center justify-center',
        'hover:bg-gray-100 dark:hover:bg-gray-700',
        'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500',
        isActive && 'bg-gray-100 dark:bg-gray-700 border-l-2 border-blue-500'
      )}
      title={title}
      aria-label={title}
      aria-selected={isActive}
      role="tab"
    >
      {icon}
    </button>
  );
});

export const Sidebar = memo(function Sidebar({
  className,
  width = 280,
}: SidebarProps) {
  const { sidebarOpen, sidebarPanel, setSidebarPanel } = usePDFViewer();

  if (!sidebarOpen) {
    return null;
  }

  const tabs: Array<{
    id: SidebarPanelType;
    icon: React.ReactNode;
    title: string;
  }> = [
    {
      id: 'thumbnails',
      title: 'Thumbnails',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      ),
    },
    {
      id: 'search',
      title: 'Search',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      ),
    },
    {
      id: 'outline',
      title: 'Outline',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 10h16M4 14h16M4 18h16"
          />
        </svg>
      ),
    },
    {
      id: 'annotations',
      title: 'Annotations',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
          />
        </svg>
      ),
    },
  ];

  const renderPanel = () => {
    switch (sidebarPanel) {
      case 'thumbnails':
        return <ThumbnailPanel className="flex-1" />;
      case 'search':
        return <SearchPanel className="flex-1" />;
      case 'outline':
        return <OutlinePanel className="flex-1" />;
      case 'annotations':
        return <HighlightsPanel className="flex-1" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        'pdf-sidebar',
        'flex h-full',
        'bg-white dark:bg-gray-800',
        'border-r border-gray-200 dark:border-gray-700',
        className
      )}
      style={{ width }}
    >
      {/* Tab bar */}
      <div
        className={cn(
          'flex flex-col',
          'border-r border-gray-200 dark:border-gray-700',
          'bg-gray-50 dark:bg-gray-900'
        )}
        role="tablist"
        aria-orientation="vertical"
      >
        {tabs.map((tab) => (
          <SidebarTab
            key={tab.id}
            id={tab.id}
            icon={tab.icon}
            title={tab.title}
            isActive={sidebarPanel === tab.id}
            onClick={() => setSidebarPanel(tab.id)}
          />
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 flex flex-col overflow-hidden">{renderPanel()}</div>
    </div>
  );
});
