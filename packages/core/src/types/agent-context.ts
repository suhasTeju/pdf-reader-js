import type { HighlightColor, HighlightRect } from './index';

// ============================================================================
// Agent Context Types
// ============================================================================

/**
 * Context provided by an external AI agent during interaction
 */
export interface AgentContext {
  /** The last statement or response from the agent */
  lastStatement?: string;
  /** Unique identifier for the conversation session */
  conversationId?: string;
  /** Timestamp of the context */
  timestamp: Date;
  /** Additional metadata from the agent */
  metadata?: Record<string, unknown>;
}

/**
 * Context passed when user triggers "Ask About This" feature
 */
export interface AskAboutContext {
  /** Type of content being asked about */
  type: 'text' | 'region';
  /** Page number where the selection is made */
  pageNumber: number;
  /** Selected text content (for text type) */
  selectedText?: string;
  /** Selected region coordinates (for region type) */
  region?: PDFRegion;
  /** Current agent context when asking */
  agentContext?: AgentContext;
}

/**
 * Represents a rectangular region on a PDF page
 */
export interface PDFRegion {
  /** X coordinate (from left) */
  x: number;
  /** Y coordinate (from top) */
  y: number;
  /** Width of the region */
  width: number;
  /** Height of the region */
  height: number;
}

/**
 * A focused region with visual styling, typically used by AI agent
 * to highlight content being discussed
 */
export interface FocusedRegion extends PDFRegion {
  /** Unique identifier for this focus region */
  id: string;
  /** Page number where the region is located */
  pageNumber: number;
  /** Visual style for the focus indicator */
  style?: 'pulse' | 'glow' | 'border';
  /** Color of the focus indicator */
  color?: string;
  /** Auto-clear timeout in milliseconds (0 = no auto-clear) */
  autoClearTimeout?: number;
}

// ============================================================================
// Student Learning Types
// ============================================================================

/**
 * A bookmark saved by the student
 */
export interface Bookmark {
  /** Unique identifier */
  id: string;
  /** Page number of the bookmark */
  pageNumber: number;
  /** When the bookmark was created */
  timestamp: Date;
  /** Agent's last statement when bookmarking (captured from context) */
  agentContext?: string;
  /** User's personal note about the bookmark */
  userNote?: string;
  /** Optional label for the bookmark */
  label?: string;
}

/**
 * A quick note added by the student
 */
export interface QuickNote {
  /** Unique identifier */
  id: string;
  /** Page number where the note is placed */
  pageNumber: number;
  /** X coordinate on the page */
  x: number;
  /** Y coordinate on the page */
  y: number;
  /** Note content */
  content: string;
  /** When the note was created */
  timestamp: Date;
  /** Agent's last statement when creating note */
  agentLastStatement?: string;
}

/**
 * A key takeaway or summary, typically from the AI agent
 */
export interface Takeaway {
  /** Unique identifier */
  id: string;
  /** Page number associated with this takeaway */
  pageNumber: number;
  /** Summary content */
  summary: string;
  /** When the takeaway was added */
  timestamp: Date;
  /** Source of the takeaway */
  source: 'agent' | 'user';
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Agent API Types
// ============================================================================

/**
 * Parameters for creating an agent-sourced highlight
 */
export interface AgentHighlightParams {
  /** Page number for the highlight */
  pageNumber: number;
  /** Rectangles defining the highlight area */
  rects: HighlightRect[];
  /** Text content being highlighted */
  text: string;
  /** Highlight color */
  color?: HighlightColor;
  /** Optional comment */
  comment?: string;
}

/**
 * API exposed to external AI agents for interacting with the PDF viewer
 */
export interface AgentAPI {
  /**
   * Focus a region on the page (visual indicator of what agent is discussing)
   * @returns The ID of the focused region
   */
  focusRegion: (region: Omit<FocusedRegion, 'id'>) => string;

  /**
   * Clear a focused region by ID, or all if no ID provided
   */
  clearFocusedRegion: (id?: string) => void;

  /**
   * Add a key takeaway for a page
   */
  addTakeaway: (pageNumber: number, summary: string, metadata?: Record<string, unknown>) => Takeaway;

  /**
   * Set the current agent context
   */
  setAgentContext: (context: Partial<AgentContext>) => void;

  /**
   * Add a highlight from the agent (marked with source: 'agent')
   */
  addAgentHighlight: (params: AgentHighlightParams) => string;

  /**
   * Navigate to a specific page
   */
  goToPage: (pageNumber: number) => void;

  /**
   * Get current page number
   */
  getCurrentPage: () => number;

  /**
   * Get current agent context
   */
  getAgentContext: () => AgentContext | null;
}

// ============================================================================
// Student Store Types
// ============================================================================

export interface StudentState {
  /** User's bookmarks */
  bookmarks: Bookmark[];
  /** User's quick notes */
  quickNotes: QuickNote[];
  /** Key takeaways (from agent or user) */
  takeaways: Takeaway[];
  /** Pages the user has visited */
  visitedPages: Set<number>;
  /** Reading progress (0-1) */
  progress: number;
}

export interface StudentActions {
  // Bookmarks
  addBookmark: (bookmark: Omit<Bookmark, 'id' | 'timestamp'>) => Bookmark;
  updateBookmark: (id: string, updates: Partial<Omit<Bookmark, 'id'>>) => void;
  removeBookmark: (id: string) => void;

  // Quick Notes
  addQuickNote: (note: Omit<QuickNote, 'id' | 'timestamp'>) => QuickNote;
  updateQuickNote: (id: string, updates: Partial<Omit<QuickNote, 'id'>>) => void;
  removeQuickNote: (id: string) => void;

  // Takeaways
  addTakeaway: (takeaway: Omit<Takeaway, 'id' | 'timestamp'>) => Takeaway;
  removeTakeaway: (id: string) => void;

  // Progress tracking
  markPageVisited: (pageNumber: number) => void;
  setProgress: (progress: number) => void;

  // Persistence
  persistToStorage: (documentId: string) => void;
  loadFromStorage: (documentId: string) => void;

  // Reset
  reset: () => void;
}

export interface AgentState {
  /** Current agent context */
  currentContext: AgentContext | null;
  /** Currently focused regions */
  focusedRegions: FocusedRegion[];
}

export interface AgentActions {
  /** Set the current agent context */
  setAgentContext: (context: Partial<AgentContext>) => void;
  /** Clear the agent context */
  clearAgentContext: () => void;
  /** Add a focused region */
  addFocusedRegion: (region: Omit<FocusedRegion, 'id'>) => string;
  /** Remove a focused region by ID */
  removeFocusedRegion: (id: string) => void;
  /** Clear all focused regions */
  clearAllFocusedRegions: () => void;
  /** Reset agent state */
  reset: () => void;
}

// ============================================================================
// Extended Viewer Props for Student Mode
// ============================================================================

export interface StudentModeCallbacks {
  /** Callback when user triggers "Ask About This" */
  onAskAbout?: (context: AskAboutContext) => void;
  /** Callback when a bookmark is added */
  onBookmarkAdd?: (bookmark: Bookmark) => void;
  /** Callback when a quick note is added */
  onQuickNoteAdd?: (note: QuickNote) => void;
}

export interface StudentModeProps {
  /** Enable student learning mode features */
  studentMode?: boolean;
  /** Callbacks for agent integration */
  agentCallbacks?: StudentModeCallbacks;
  /** Initial agent context */
  initialAgentContext?: AgentContext;
  /** Show quick note buttons on pages */
  showQuickNoteButtons?: boolean;
  /** Show the minimap */
  showMinimap?: boolean;
  /** Position of the minimap */
  minimapPosition?: 'sidebar' | 'floating';
  /** Enable "Ask About This" feature */
  enableAskAbout?: boolean;
  /** Long press duration for ask about trigger (ms) */
  askAboutLongPressDuration?: number;
}
