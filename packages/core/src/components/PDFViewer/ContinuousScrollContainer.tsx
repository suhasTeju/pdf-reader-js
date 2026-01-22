import { memo } from 'react';
import {
  VirtualizedDocumentContainer,
  type VirtualizedDocumentContainerProps,
} from './VirtualizedDocumentContainer';

export interface ContinuousScrollContainerProps extends VirtualizedDocumentContainerProps {
  /** Scroll to page smoothly */
  smoothScroll?: boolean;
}

/**
 * ContinuousScrollContainer is a convenience wrapper around VirtualizedDocumentContainer
 * that provides continuous scrolling behavior with all pages visible in a single
 * scrollable view.
 *
 * Features:
 * - All pages rendered in a continuous scroll view
 * - Virtualized rendering for performance (only visible pages + buffer are rendered)
 * - Automatic page tracking based on scroll position
 * - Scroll-to-page functionality
 * - Memory management (unloads distant pages)
 */
export const ContinuousScrollContainer = memo(function ContinuousScrollContainer(
  props: ContinuousScrollContainerProps
) {
  // ContinuousScrollContainer is essentially the same as VirtualizedDocumentContainer
  // with default settings optimized for continuous reading
  return (
    <VirtualizedDocumentContainer
      overscan={3} // Render more pages for smoother scrolling
      pageGap={16}
      {...props}
    />
  );
});

// Re-export the virtualized container for direct use
export { VirtualizedDocumentContainer };
