import { useCallback, useMemo } from 'react';
import { useAgentStore, useStudentStore, useAnnotationStore, useViewerStore } from './PDFViewerContext';
import type {
  AgentContext,
  FocusedRegion,
  Takeaway,
  AgentAPI,
  AgentHighlightParams,
} from '../types/agent-context';
import type { HighlightColor } from '../types';

export interface UseAgentContextOptions {
  /** Default focus region style */
  defaultFocusStyle?: 'pulse' | 'glow' | 'border';
  /** Default focus region color */
  defaultFocusColor?: string;
  /** Default auto-clear timeout for focus regions (ms) */
  defaultAutoClearTimeout?: number;
}

export interface UseAgentContextReturn {
  /** Current agent context */
  agentContext: AgentContext | null;
  /** Set or update agent context */
  setAgentContext: (context: Partial<AgentContext>) => void;
  /** Clear agent context */
  clearAgentContext: () => void;
  /** Currently focused regions */
  focusedRegions: FocusedRegion[];
  /** Add a focus region and return its ID */
  focusRegion: (region: Omit<FocusedRegion, 'id'>) => string;
  /** Remove a focus region by ID */
  clearFocusedRegion: (id: string) => void;
  /** Clear all focus regions */
  clearAllFocusedRegions: () => void;
  /** Add a takeaway for a page */
  addTakeaway: (pageNumber: number, summary: string, metadata?: Record<string, unknown>) => Takeaway;
  /** Add a highlight from the agent */
  addAgentHighlight: (params: AgentHighlightParams) => string;
  /** Get the agent API for external integration */
  getAgentAPI: () => AgentAPI;
}

/**
 * Hook for agent context management and AI agent integration.
 * Provides methods for agents to interact with the PDF viewer.
 */
export function useAgentContext(options: UseAgentContextOptions = {}): UseAgentContextReturn {
  const {
    defaultFocusStyle = 'pulse',
    defaultFocusColor,
    defaultAutoClearTimeout = 0,
  } = options;

  // Agent store state and actions
  const agentContext = useAgentStore((s) => s.currentContext);
  const focusedRegions = useAgentStore((s) => s.focusedRegions);
  const setAgentContextAction = useAgentStore((s) => s.setAgentContext);
  const clearAgentContextAction = useAgentStore((s) => s.clearAgentContext);
  const addFocusedRegionAction = useAgentStore((s) => s.addFocusedRegion);
  const removeFocusedRegionAction = useAgentStore((s) => s.removeFocusedRegion);
  const clearAllFocusedRegionsAction = useAgentStore((s) => s.clearAllFocusedRegions);

  // Student store actions for takeaways
  const addTakeawayAction = useStudentStore((s) => s.addTakeaway);

  // Annotation store for agent highlights
  const addHighlightAction = useAnnotationStore((s) => s.addHighlight);

  // Viewer store for navigation
  const goToPageAction = useViewerStore((s) => s.goToPage);
  const currentPage = useViewerStore((s) => s.currentPage);

  const setAgentContext = useCallback(
    (context: Partial<AgentContext>) => {
      setAgentContextAction(context);
    },
    [setAgentContextAction]
  );

  const clearAgentContext = useCallback(() => {
    clearAgentContextAction();
  }, [clearAgentContextAction]);

  const focusRegion = useCallback(
    (region: Omit<FocusedRegion, 'id'>) => {
      const regionWithDefaults: Omit<FocusedRegion, 'id'> = {
        ...region,
        style: region.style ?? defaultFocusStyle,
        color: region.color ?? defaultFocusColor,
        autoClearTimeout: region.autoClearTimeout ?? defaultAutoClearTimeout,
      };
      return addFocusedRegionAction(regionWithDefaults);
    },
    [addFocusedRegionAction, defaultFocusStyle, defaultFocusColor, defaultAutoClearTimeout]
  );

  const clearFocusedRegion = useCallback(
    (id: string) => {
      removeFocusedRegionAction(id);
    },
    [removeFocusedRegionAction]
  );

  const clearAllFocusedRegions = useCallback(() => {
    clearAllFocusedRegionsAction();
  }, [clearAllFocusedRegionsAction]);

  const addTakeaway = useCallback(
    (pageNumber: number, summary: string, metadata?: Record<string, unknown>) => {
      return addTakeawayAction({
        pageNumber,
        summary,
        source: 'agent',
        metadata,
      });
    },
    [addTakeawayAction]
  );

  const addAgentHighlight = useCallback(
    (params: AgentHighlightParams) => {
      const highlight = addHighlightAction({
        pageNumber: params.pageNumber,
        rects: params.rects,
        text: params.text,
        color: params.color ?? ('blue' as HighlightColor),
        comment: params.comment,
        source: 'agent',
      });
      return highlight.id;
    },
    [addHighlightAction]
  );

  const getAgentAPI = useCallback((): AgentAPI => {
    return {
      focusRegion,
      clearFocusedRegion: (id?: string) => {
        if (id) {
          clearFocusedRegion(id);
        } else {
          clearAllFocusedRegions();
        }
      },
      addTakeaway,
      setAgentContext,
      addAgentHighlight,
      goToPage: goToPageAction,
      getCurrentPage: () => currentPage,
      getAgentContext: () => agentContext,
    };
  }, [
    focusRegion,
    clearFocusedRegion,
    clearAllFocusedRegions,
    addTakeaway,
    setAgentContext,
    addAgentHighlight,
    goToPageAction,
    currentPage,
    agentContext,
  ]);

  return useMemo(
    () => ({
      agentContext,
      setAgentContext,
      clearAgentContext,
      focusedRegions,
      focusRegion,
      clearFocusedRegion,
      clearAllFocusedRegions,
      addTakeaway,
      addAgentHighlight,
      getAgentAPI,
    }),
    [
      agentContext,
      setAgentContext,
      clearAgentContext,
      focusedRegions,
      focusRegion,
      clearFocusedRegion,
      clearAllFocusedRegions,
      addTakeaway,
      addAgentHighlight,
      getAgentAPI,
    ]
  );
}
