import { createStore } from 'zustand/vanilla';
import type {
  StudentState,
  StudentActions,
  Bookmark,
  QuickNote,
  Takeaway,
} from '../types/agent-context';

export type StudentStore = StudentState & StudentActions;

const STORAGE_PREFIX = 'pdf-reader-student';

let idCounter = 0;

function generateId(prefix: string): string {
  return `${prefix}-${++idCounter}-${Date.now()}`;
}

function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

function getStorageKey(documentId: string, type: string): string {
  return `${STORAGE_PREFIX}:${documentId}:${type}`;
}

// Serialization helpers for dates
interface StoredBookmark extends Omit<Bookmark, 'timestamp'> {
  timestamp: string;
}

interface StoredQuickNote extends Omit<QuickNote, 'timestamp'> {
  timestamp: string;
}

interface StoredTakeaway extends Omit<Takeaway, 'timestamp'> {
  timestamp: string;
}

interface StoredStudentData {
  bookmarks: StoredBookmark[];
  quickNotes: StoredQuickNote[];
  takeaways: StoredTakeaway[];
  visitedPages: number[];
  progress: number;
}

const initialState: StudentState = {
  bookmarks: [],
  quickNotes: [],
  takeaways: [],
  visitedPages: new Set<number>(),
  progress: 0,
};

export function createStudentStore(initialOverrides: Partial<StudentState> = {}) {
  return createStore<StudentStore>()((set, get) => ({
    ...initialState,
    ...initialOverrides,

    // Bookmark actions
    addBookmark: (bookmark: Omit<Bookmark, 'id' | 'timestamp'>) => {
      const newBookmark: Bookmark = {
        ...bookmark,
        id: generateId('bookmark'),
        timestamp: new Date(),
      };

      set((state) => ({
        bookmarks: [...state.bookmarks, newBookmark],
      }));

      return newBookmark;
    },

    updateBookmark: (id: string, updates: Partial<Omit<Bookmark, 'id'>>) => {
      set((state) => ({
        bookmarks: state.bookmarks.map((b) =>
          b.id === id ? { ...b, ...updates } : b
        ),
      }));
    },

    removeBookmark: (id: string) => {
      set((state) => ({
        bookmarks: state.bookmarks.filter((b) => b.id !== id),
      }));
    },

    // Quick note actions
    addQuickNote: (note: Omit<QuickNote, 'id' | 'timestamp'>) => {
      const newNote: QuickNote = {
        ...note,
        id: generateId('note'),
        timestamp: new Date(),
      };

      set((state) => ({
        quickNotes: [...state.quickNotes, newNote],
      }));

      return newNote;
    },

    updateQuickNote: (id: string, updates: Partial<Omit<QuickNote, 'id'>>) => {
      set((state) => ({
        quickNotes: state.quickNotes.map((n) =>
          n.id === id ? { ...n, ...updates } : n
        ),
      }));
    },

    removeQuickNote: (id: string) => {
      set((state) => ({
        quickNotes: state.quickNotes.filter((n) => n.id !== id),
      }));
    },

    // Takeaway actions
    addTakeaway: (takeaway: Omit<Takeaway, 'id' | 'timestamp'>) => {
      const newTakeaway: Takeaway = {
        ...takeaway,
        id: generateId('takeaway'),
        timestamp: new Date(),
      };

      set((state) => ({
        takeaways: [...state.takeaways, newTakeaway],
      }));

      return newTakeaway;
    },

    removeTakeaway: (id: string) => {
      set((state) => ({
        takeaways: state.takeaways.filter((t) => t.id !== id),
      }));
    },

    // Progress tracking
    markPageVisited: (pageNumber: number) => {
      set((state) => {
        const newVisitedPages = new Set(state.visitedPages);
        newVisitedPages.add(pageNumber);
        return { visitedPages: newVisitedPages };
      });
    },

    setProgress: (progress: number) => {
      set({ progress: Math.max(0, Math.min(1, progress)) });
    },

    // Persistence
    persistToStorage: (documentId: string) => {
      if (!isStorageAvailable()) {
        console.warn('localStorage not available, student data will not persist');
        return;
      }

      const state = get();

      const data: StoredStudentData = {
        bookmarks: state.bookmarks.map((b) => ({
          ...b,
          timestamp: b.timestamp.toISOString(),
        })),
        quickNotes: state.quickNotes.map((n) => ({
          ...n,
          timestamp: n.timestamp.toISOString(),
        })),
        takeaways: state.takeaways.map((t) => ({
          ...t,
          timestamp: t.timestamp.toISOString(),
        })),
        visitedPages: Array.from(state.visitedPages),
        progress: state.progress,
      };

      try {
        localStorage.setItem(getStorageKey(documentId, 'data'), JSON.stringify(data));
      } catch (error) {
        console.error('Failed to persist student data:', error);
      }
    },

    loadFromStorage: (documentId: string) => {
      if (!isStorageAvailable()) {
        return;
      }

      try {
        const stored = localStorage.getItem(getStorageKey(documentId, 'data'));
        if (!stored) {
          return;
        }

        const data: StoredStudentData = JSON.parse(stored);

        set({
          bookmarks: data.bookmarks.map((b) => ({
            ...b,
            timestamp: new Date(b.timestamp),
          })),
          quickNotes: data.quickNotes.map((n) => ({
            ...n,
            timestamp: new Date(n.timestamp),
          })),
          takeaways: data.takeaways.map((t) => ({
            ...t,
            timestamp: new Date(t.timestamp),
          })),
          visitedPages: new Set(data.visitedPages),
          progress: data.progress,
        });
      } catch (error) {
        console.error('Failed to load student data:', error);
      }
    },

    reset: () => {
      set(initialState);
    },
  }));
}

export type StudentStoreApi = ReturnType<typeof createStudentStore>;
