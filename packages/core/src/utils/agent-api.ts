import type { StoreApi } from 'zustand/vanilla';
import type { AgentStore } from '../store/agent-store';
import type { StudentStore } from '../store/student-store';
import type { ViewerStore } from '../store/viewer-store';
import type { AnnotationStore } from '../store/annotation-store';
import type {
  AgentAPI,
  AgentContext,
  FocusedRegion,
  Takeaway,
  AgentHighlightParams,
} from '../types/agent-context';
import type { HighlightColor } from '../types';

export interface AgentAPIStores {
  agentStore: StoreApi<AgentStore>;
  studentStore: StoreApi<StudentStore>;
  viewerStore: StoreApi<ViewerStore>;
  annotationStore: StoreApi<AnnotationStore>;
}

/**
 * Create a standalone Agent API for external AI agent integration.
 * This allows external agents to interact with the PDF viewer without
 * needing direct access to React hooks.
 *
 * @example
 * ```typescript
 * import { createAgentAPI } from 'pdfjs-reader-core';
 *
 * // Get stores from the context (this would typically be done in a React component)
 * const api = createAgentAPI(stores);
 *
 * // Now the external agent can use the API
 * api.setAgentContext({ lastStatement: "The mitochondria is the powerhouse of the cell" });
 * api.focusRegion({ pageNumber: 1, x: 100, y: 200, width: 300, height: 50, style: 'pulse' });
 * api.addTakeaway(1, "Key concept: Cell energy production");
 * ```
 */
export function createAgentAPI(stores: AgentAPIStores): AgentAPI {
  const { agentStore, studentStore, viewerStore, annotationStore } = stores;

  let focusRegionIdCounter = 0;

  const generateFocusRegionId = (): string => {
    return `api-focus-${++focusRegionIdCounter}-${Date.now()}`;
  };

  const api: AgentAPI = {
    focusRegion: (region: Omit<FocusedRegion, 'id'>) => {
      const id = generateFocusRegionId();
      const focusedRegion: FocusedRegion = {
        ...region,
        id,
        style: region.style ?? 'pulse',
      };

      const state = agentStore.getState();
      agentStore.setState({
        focusedRegions: [...state.focusedRegions, focusedRegion],
      });

      // Set up auto-clear if timeout is specified
      if (region.autoClearTimeout && region.autoClearTimeout > 0) {
        setTimeout(() => {
          api.clearFocusedRegion(id);
        }, region.autoClearTimeout);
      }

      return id;
    },

    clearFocusedRegion: (id?: string) => {
      if (id) {
        const state = agentStore.getState();
        agentStore.setState({
          focusedRegions: state.focusedRegions.filter((r) => r.id !== id),
        });
      } else {
        agentStore.setState({ focusedRegions: [] });
      }
    },

    addTakeaway: (pageNumber: number, summary: string, metadata?: Record<string, unknown>) => {
      const takeaway: Takeaway = {
        id: `takeaway-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        pageNumber,
        summary,
        timestamp: new Date(),
        source: 'agent',
        metadata,
      };

      const state = studentStore.getState();
      studentStore.setState({
        takeaways: [...state.takeaways, takeaway],
      });

      return takeaway;
    },

    setAgentContext: (context: Partial<AgentContext>) => {
      const currentContext = agentStore.getState().currentContext;
      agentStore.setState({
        currentContext: {
          ...currentContext,
          ...context,
          timestamp: context.timestamp ?? new Date(),
        } as AgentContext,
      });
    },

    addAgentHighlight: (params: AgentHighlightParams) => {
      const highlightId = `agent-hl-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const now = new Date();

      const state = annotationStore.getState();
      annotationStore.setState({
        highlights: [
          ...state.highlights,
          {
            id: highlightId,
            pageNumber: params.pageNumber,
            rects: params.rects,
            text: params.text,
            color: params.color ?? ('blue' as HighlightColor),
            comment: params.comment,
            createdAt: now,
            updatedAt: now,
            source: 'agent',
          },
        ],
      });

      return highlightId;
    },

    goToPage: (pageNumber: number) => {
      viewerStore.getState().goToPage(pageNumber);
    },

    getCurrentPage: () => {
      return viewerStore.getState().currentPage;
    },

    getAgentContext: () => {
      return agentStore.getState().currentContext;
    },
  };

  return api;
}

/**
 * Convenience type for the return value of createAgentAPI
 */
export type AgentAPIInstance = ReturnType<typeof createAgentAPI>;
