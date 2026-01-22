import { createStore } from 'zustand/vanilla';
import type { Highlight, Annotation, HighlightColor, DrawingPath } from '../types';

export type AnnotationTool = 'note' | 'draw' | 'shape' | null;
export type ShapeType = 'rect' | 'circle' | 'arrow' | 'line';

export interface AnnotationState {
  highlights: Highlight[];
  annotations: Annotation[];
  selectedHighlightId: string | null;
  selectedAnnotationId: string | null;
  activeHighlightColor: HighlightColor;
  isHighlightMode: boolean;
  isAnnotationMode: boolean;

  // Drawing state
  activeAnnotationTool: AnnotationTool;
  activeShapeType: ShapeType;
  drawingColor: string;
  drawingStrokeWidth: number;
  currentDrawingPath: DrawingPath | null;
  currentDrawingPage: number | null;
}

export interface AnnotationActions {
  // Highlight actions
  addHighlight: (highlight: Omit<Highlight, 'id' | 'createdAt' | 'updatedAt'>) => Highlight;
  updateHighlight: (id: string, updates: Partial<Highlight>) => void;
  removeHighlight: (id: string) => void;
  selectHighlight: (id: string | null) => void;
  setActiveHighlightColor: (color: HighlightColor) => void;
  getHighlightsByPage: (pageNumber: number) => Highlight[];

  // Annotation actions
  addAnnotation: (annotation: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>) => Annotation;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;
  selectAnnotation: (id: string | null) => void;
  getAnnotationsByPage: (pageNumber: number) => Annotation[];

  // Mode actions
  setHighlightMode: (enabled: boolean) => void;
  setAnnotationMode: (enabled: boolean) => void;

  // Drawing tool actions
  setActiveAnnotationTool: (tool: AnnotationTool) => void;
  setActiveShapeType: (shapeType: ShapeType) => void;
  setDrawingColor: (color: string) => void;
  setDrawingStrokeWidth: (width: number) => void;

  // Drawing path actions
  startDrawing: (pageNumber: number, point: { x: number; y: number }) => void;
  addDrawingPoint: (point: { x: number; y: number }) => void;
  finishDrawing: () => Annotation | null;
  cancelDrawing: () => void;

  // Export/Import
  exportHighlights: () => string;
  importHighlights: (json: string) => void;
  exportAnnotations: () => string;
  importAnnotations: (json: string) => void;

  // Reset
  clearAll: () => void;
}

export type AnnotationStore = AnnotationState & AnnotationActions;

const initialState: AnnotationState = {
  highlights: [],
  annotations: [],
  selectedHighlightId: null,
  selectedAnnotationId: null,
  activeHighlightColor: 'yellow',
  isHighlightMode: false,
  isAnnotationMode: false,

  // Drawing state defaults
  activeAnnotationTool: null,
  activeShapeType: 'rect',
  drawingColor: '#ef4444',
  drawingStrokeWidth: 2,
  currentDrawingPath: null,
  currentDrawingPage: null,
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function createAnnotationStore(initialOverrides: Partial<AnnotationState> = {}) {
  return createStore<AnnotationStore>()((set, get) => ({
    ...initialState,
    ...initialOverrides,

    // Highlight actions
    addHighlight: (highlight) => {
      const newHighlight: Highlight = {
        ...highlight,
        id: generateId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      set((state) => ({
        highlights: [...state.highlights, newHighlight],
      }));
      return newHighlight;
    },

    updateHighlight: (id, updates) => {
      set((state) => ({
        highlights: state.highlights.map((h) =>
          h.id === id ? { ...h, ...updates, updatedAt: new Date() } : h
        ),
      }));
    },

    removeHighlight: (id) => {
      set((state) => ({
        highlights: state.highlights.filter((h) => h.id !== id),
        selectedHighlightId: state.selectedHighlightId === id ? null : state.selectedHighlightId,
      }));
    },

    selectHighlight: (id) => {
      set({ selectedHighlightId: id });
    },

    setActiveHighlightColor: (color) => {
      set({ activeHighlightColor: color });
    },

    getHighlightsByPage: (pageNumber) => {
      return get().highlights.filter((h) => h.pageNumber === pageNumber);
    },

    // Annotation actions
    addAnnotation: (annotation) => {
      const newAnnotation = {
        ...annotation,
        id: generateId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Annotation;
      set((state) => ({
        annotations: [...state.annotations, newAnnotation],
      }));
      return newAnnotation;
    },

    updateAnnotation: (id, updates) => {
      set((state) => ({
        annotations: state.annotations.map((a) =>
          a.id === id ? { ...a, ...updates, updatedAt: new Date() } : a
        ) as Annotation[],
      }));
    },

    removeAnnotation: (id) => {
      set((state) => ({
        annotations: state.annotations.filter((a) => a.id !== id),
        selectedAnnotationId: state.selectedAnnotationId === id ? null : state.selectedAnnotationId,
      }));
    },

    selectAnnotation: (id) => {
      set({ selectedAnnotationId: id });
    },

    getAnnotationsByPage: (pageNumber) => {
      return get().annotations.filter((a) => a.pageNumber === pageNumber);
    },

    // Mode actions
    setHighlightMode: (enabled) => {
      set({
        isHighlightMode: enabled,
        isAnnotationMode: enabled ? false : get().isAnnotationMode,
        activeAnnotationTool: enabled ? null : get().activeAnnotationTool,
      });
    },

    setAnnotationMode: (enabled) => {
      set({
        isAnnotationMode: enabled,
        isHighlightMode: enabled ? false : get().isHighlightMode,
      });
    },

    // Drawing tool actions
    setActiveAnnotationTool: (tool) => {
      set({
        activeAnnotationTool: tool,
        isAnnotationMode: tool !== null,
        isHighlightMode: false,
        currentDrawingPath: null,
        currentDrawingPage: null,
      });
    },

    setActiveShapeType: (shapeType) => {
      set({ activeShapeType: shapeType });
    },

    setDrawingColor: (color) => {
      set({ drawingColor: color });
    },

    setDrawingStrokeWidth: (width) => {
      set({ drawingStrokeWidth: Math.max(1, Math.min(20, width)) });
    },

    // Drawing path actions
    startDrawing: (pageNumber, point) => {
      set({
        currentDrawingPath: { points: [point] },
        currentDrawingPage: pageNumber,
      });
    },

    addDrawingPoint: (point) => {
      const { currentDrawingPath } = get();
      if (currentDrawingPath) {
        set({
          currentDrawingPath: {
            points: [...currentDrawingPath.points, point],
          },
        });
      }
    },

    finishDrawing: () => {
      const { currentDrawingPath, currentDrawingPage, activeAnnotationTool, drawingColor, drawingStrokeWidth } = get();

      if (!currentDrawingPath || currentDrawingPage === null || activeAnnotationTool !== 'draw') {
        set({ currentDrawingPath: null, currentDrawingPage: null });
        return null;
      }

      // Only create annotation if we have at least 2 points
      if (currentDrawingPath.points.length < 2) {
        set({ currentDrawingPath: null, currentDrawingPage: null });
        return null;
      }

      const newAnnotation = {
        type: 'drawing' as const,
        pageNumber: currentDrawingPage,
        paths: [currentDrawingPath],
        color: drawingColor,
        strokeWidth: drawingStrokeWidth,
        id: generateId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      set((state) => ({
        annotations: [...state.annotations, newAnnotation],
        currentDrawingPath: null,
        currentDrawingPage: null,
      }));

      return newAnnotation;
    },

    cancelDrawing: () => {
      set({ currentDrawingPath: null, currentDrawingPage: null });
    },

    // Export/Import
    exportHighlights: () => {
      const highlights = get().highlights;
      return JSON.stringify(highlights, null, 2);
    },

    importHighlights: (json) => {
      try {
        const highlights = JSON.parse(json) as Highlight[];
        set({ highlights });
      } catch {
        console.error('Failed to import highlights');
      }
    },

    exportAnnotations: () => {
      const annotations = get().annotations;
      return JSON.stringify(annotations, null, 2);
    },

    importAnnotations: (json) => {
      try {
        const annotations = JSON.parse(json) as Annotation[];
        set({ annotations });
      } catch {
        console.error('Failed to import annotations');
      }
    },

    // Reset
    clearAll: () => {
      set({
        ...initialState,
        // Preserve user preferences
        drawingColor: get().drawingColor,
        drawingStrokeWidth: get().drawingStrokeWidth,
        activeHighlightColor: get().activeHighlightColor,
      });
    },
  }));
}

export type AnnotationStoreApi = ReturnType<typeof createAnnotationStore>;
