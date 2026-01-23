import { useCallback, useMemo } from 'react';
import { useStudentStore, useAgentStore, useViewerStore } from './PDFViewerContext';
import type { QuickNote } from '../types/agent-context';

export interface UseQuickNotesOptions {
  /** Callback when note is added */
  onNoteAdd?: (note: QuickNote) => void;
  /** Callback when note is removed */
  onNoteRemove?: (id: string) => void;
  /** Automatically capture agent's last statement when creating notes */
  captureAgentContext?: boolean;
}

export interface UseQuickNotesReturn {
  /** All quick notes */
  quickNotes: QuickNote[];
  /** Quick notes for the current page */
  currentPageNotes: QuickNote[];
  /** Add a quick note */
  addQuickNote: (data: { content: string; x: number; y: number; pageNumber?: number }) => QuickNote;
  /** Update a quick note */
  updateQuickNote: (id: string, updates: Partial<Omit<QuickNote, 'id'>>) => void;
  /** Remove a quick note */
  removeQuickNote: (id: string) => void;
  /** Get notes for a specific page */
  getNotesForPage: (pageNumber: number) => QuickNote[];
  /** Notes grouped by page */
  notesByPage: Map<number, QuickNote[]>;
}

/**
 * Hook for managing quick notes with agent context capture.
 */
export function useQuickNotes(options: UseQuickNotesOptions = {}): UseQuickNotesReturn {
  const { onNoteAdd, onNoteRemove, captureAgentContext = true } = options;

  // Student store state and actions
  const quickNotes = useStudentStore((s) => s.quickNotes);
  const addQuickNoteAction = useStudentStore((s) => s.addQuickNote);
  const updateQuickNoteAction = useStudentStore((s) => s.updateQuickNote);
  const removeQuickNoteAction = useStudentStore((s) => s.removeQuickNote);

  // Agent context for capturing
  const agentContext = useAgentStore((s) => s.currentContext);

  // Viewer store for current page
  const currentPage = useViewerStore((s) => s.currentPage);

  const currentPageNotes = useMemo(
    () => quickNotes.filter((n) => n.pageNumber === currentPage),
    [quickNotes, currentPage]
  );

  const notesByPage = useMemo(() => {
    const map = new Map<number, QuickNote[]>();
    quickNotes.forEach((note) => {
      const existing = map.get(note.pageNumber) || [];
      map.set(note.pageNumber, [...existing, note]);
    });
    return map;
  }, [quickNotes]);

  const addQuickNote = useCallback(
    (data: { content: string; x: number; y: number; pageNumber?: number }) => {
      const noteData = {
        content: data.content,
        x: data.x,
        y: data.y,
        pageNumber: data.pageNumber ?? currentPage,
        agentLastStatement: captureAgentContext && agentContext?.lastStatement
          ? agentContext.lastStatement
          : undefined,
      };

      const note = addQuickNoteAction(noteData);
      onNoteAdd?.(note);
      return note;
    },
    [currentPage, captureAgentContext, agentContext, addQuickNoteAction, onNoteAdd]
  );

  const updateQuickNote = useCallback(
    (id: string, updates: Partial<Omit<QuickNote, 'id'>>) => {
      updateQuickNoteAction(id, updates);
    },
    [updateQuickNoteAction]
  );

  const removeQuickNote = useCallback(
    (id: string) => {
      removeQuickNoteAction(id);
      onNoteRemove?.(id);
    },
    [removeQuickNoteAction, onNoteRemove]
  );

  const getNotesForPage = useCallback(
    (pageNumber: number) => {
      return quickNotes.filter((n) => n.pageNumber === pageNumber);
    },
    [quickNotes]
  );

  return useMemo(
    () => ({
      quickNotes,
      currentPageNotes,
      addQuickNote,
      updateQuickNote,
      removeQuickNote,
      getNotesForPage,
      notesByPage,
    }),
    [
      quickNotes,
      currentPageNotes,
      addQuickNote,
      updateQuickNote,
      removeQuickNote,
      getNotesForPage,
      notesByPage,
    ]
  );
}
