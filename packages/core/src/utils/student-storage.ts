import type { Bookmark, QuickNote, Takeaway } from '../types/agent-context';

const STORAGE_PREFIX = 'pdf-reader-student';

/**
 * Check if localStorage is available (SSR-safe).
 */
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

/**
 * Generate a storage key for a document.
 */
function getStorageKey(documentId: string, type: string): string {
  return `${STORAGE_PREFIX}:${documentId}:${type}`;
}

// Serialization interfaces
interface StoredBookmark extends Omit<Bookmark, 'timestamp'> {
  timestamp: string;
}

interface StoredQuickNote extends Omit<QuickNote, 'timestamp'> {
  timestamp: string;
}

interface StoredTakeaway extends Omit<Takeaway, 'timestamp'> {
  timestamp: string;
}

export interface StoredStudentData {
  bookmarks: StoredBookmark[];
  quickNotes: StoredQuickNote[];
  takeaways: StoredTakeaway[];
  visitedPages: number[];
  progress: number;
  lastAccessed: string;
}

export interface StudentData {
  bookmarks: Bookmark[];
  quickNotes: QuickNote[];
  takeaways: Takeaway[];
  visitedPages: Set<number>;
  progress: number;
  lastAccessed: Date;
}

/**
 * Save student data to localStorage.
 */
export function saveStudentData(documentId: string, data: StudentData): boolean {
  if (!isStorageAvailable()) {
    console.warn('localStorage not available, student data will not persist');
    return false;
  }

  try {
    const storedData: StoredStudentData = {
      bookmarks: data.bookmarks.map((b) => ({
        ...b,
        timestamp: b.timestamp.toISOString(),
      })),
      quickNotes: data.quickNotes.map((n) => ({
        ...n,
        timestamp: n.timestamp.toISOString(),
      })),
      takeaways: data.takeaways.map((t) => ({
        ...t,
        timestamp: t.timestamp.toISOString(),
      })),
      visitedPages: Array.from(data.visitedPages),
      progress: data.progress,
      lastAccessed: new Date().toISOString(),
    };

    localStorage.setItem(getStorageKey(documentId, 'data'), JSON.stringify(storedData));
    return true;
  } catch (error) {
    console.error('Failed to save student data:', error);
    return false;
  }
}

/**
 * Load student data from localStorage.
 */
export function loadStudentData(documentId: string): StudentData | null {
  if (!isStorageAvailable()) {
    return null;
  }

  try {
    const stored = localStorage.getItem(getStorageKey(documentId, 'data'));
    if (!stored) {
      return null;
    }

    const data: StoredStudentData = JSON.parse(stored);

    return {
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
      lastAccessed: new Date(data.lastAccessed),
    };
  } catch (error) {
    console.error('Failed to load student data:', error);
    return null;
  }
}

/**
 * Clear student data for a specific document.
 */
export function clearStudentData(documentId: string): boolean {
  if (!isStorageAvailable()) {
    return false;
  }

  try {
    localStorage.removeItem(getStorageKey(documentId, 'data'));
    return true;
  } catch (error) {
    console.error('Failed to clear student data:', error);
    return false;
  }
}

/**
 * Get all document IDs that have stored student data.
 */
export function getAllStudentDataDocumentIds(): string[] {
  if (!isStorageAvailable()) {
    return [];
  }

  const ids: string[] = [];
  const prefixWithColon = STORAGE_PREFIX + ':';

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefixWithColon) && key.endsWith(':data')) {
      const id = key.slice(prefixWithColon.length, -5); // Remove prefix and ':data' suffix
      ids.push(id);
    }
  }

  return ids;
}

/**
 * Get storage usage statistics.
 */
export function getStorageStats(): { usedBytes: number; itemCount: number } {
  if (!isStorageAvailable()) {
    return { usedBytes: 0, itemCount: 0 };
  }

  let usedBytes = 0;
  let itemCount = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      const value = localStorage.getItem(key);
      if (value) {
        usedBytes += key.length + value.length;
        itemCount++;
      }
    }
  }

  return { usedBytes, itemCount };
}
