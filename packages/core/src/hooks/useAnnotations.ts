import { useCallback, useMemo } from 'react';
import { useAnnotationStore } from './PDFViewerContext';
import type { Annotation, NoteAnnotation, ShapeAnnotation } from '../types';
import type { AnnotationTool, ShapeType } from '../store/annotation-store';

export interface UseAnnotationsOptions {
  onAnnotationCreate?: (annotation: Annotation) => void;
  onAnnotationUpdate?: (annotation: Annotation) => void;
  onAnnotationDelete?: (id: string) => void;
}

export interface UseAnnotationsReturn {
  // Annotations state
  annotations: Annotation[];
  selectedAnnotation: Annotation | undefined;
  selectedAnnotationId: string | null;

  // Tool state
  activeTool: AnnotationTool;
  activeShapeType: ShapeType;
  drawingColor: string;
  drawingStrokeWidth: number;
  isDrawing: boolean;
  currentDrawingPath: { points: { x: number; y: number }[] } | null;
  currentDrawingPage: number | null;

  // Tool actions
  setActiveTool: (tool: AnnotationTool) => void;
  setActiveShapeType: (shapeType: ShapeType) => void;
  setDrawingColor: (color: string) => void;
  setDrawingStrokeWidth: (width: number) => void;

  // Note actions
  createNote: (pageNumber: number, x: number, y: number, content?: string, color?: string) => NoteAnnotation;
  updateNote: (id: string, updates: Partial<NoteAnnotation>) => void;

  // Drawing actions
  startDrawing: (pageNumber: number, point: { x: number; y: number }) => void;
  continueDrawing: (point: { x: number; y: number }) => void;
  finishDrawing: () => Annotation | null;
  cancelDrawing: () => void;

  // Shape actions
  /**
   * Create a shape annotation programmatically.
   * Coordinates should be in PDF points (not scaled).
   *
   * @example
   * ```tsx
   * // Create a red rectangle box annotation
   * createShape({
   *   pageNumber: 1,
   *   shapeType: 'rect',
   *   x: 100,
   *   y: 200,
   *   width: 150,
   *   height: 80,
   *   color: '#ef4444',
   *   strokeWidth: 2
   * });
   * ```
   */
  createShape: (options: {
    pageNumber: number;
    shapeType: ShapeType;
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
    strokeWidth?: number;
  }) => ShapeAnnotation;
  updateShape: (id: string, updates: Partial<ShapeAnnotation>) => void;

  // General annotation actions
  selectAnnotation: (id: string | null) => void;
  deleteAnnotation: (id: string) => void;
  getAnnotationsByPage: (pageNumber: number) => Annotation[];

  // Export/Import
  exportAnnotations: () => string;
  importAnnotations: (json: string) => void;
}

export function useAnnotations(options: UseAnnotationsOptions = {}): UseAnnotationsReturn {
  const { onAnnotationCreate, onAnnotationUpdate, onAnnotationDelete } = options;

  // Store selectors
  const annotations = useAnnotationStore((s) => s.annotations);
  const selectedAnnotationId = useAnnotationStore((s) => s.selectedAnnotationId);
  const activeTool = useAnnotationStore((s) => s.activeAnnotationTool);
  const activeShapeType = useAnnotationStore((s) => s.activeShapeType);
  const drawingColor = useAnnotationStore((s) => s.drawingColor);
  const drawingStrokeWidth = useAnnotationStore((s) => s.drawingStrokeWidth);
  const currentDrawingPath = useAnnotationStore((s) => s.currentDrawingPath);
  const currentDrawingPage = useAnnotationStore((s) => s.currentDrawingPage);

  // Store actions
  const addAnnotation = useAnnotationStore((s) => s.addAnnotation);
  const updateAnnotation = useAnnotationStore((s) => s.updateAnnotation);
  const removeAnnotation = useAnnotationStore((s) => s.removeAnnotation);
  const selectAnnotationAction = useAnnotationStore((s) => s.selectAnnotation);
  const getAnnotationsByPageAction = useAnnotationStore((s) => s.getAnnotationsByPage);
  const setActiveAnnotationTool = useAnnotationStore((s) => s.setActiveAnnotationTool);
  const setActiveShapeTypeAction = useAnnotationStore((s) => s.setActiveShapeType);
  const setDrawingColorAction = useAnnotationStore((s) => s.setDrawingColor);
  const setDrawingStrokeWidthAction = useAnnotationStore((s) => s.setDrawingStrokeWidth);
  const startDrawingAction = useAnnotationStore((s) => s.startDrawing);
  const addDrawingPoint = useAnnotationStore((s) => s.addDrawingPoint);
  const finishDrawingAction = useAnnotationStore((s) => s.finishDrawing);
  const cancelDrawingAction = useAnnotationStore((s) => s.cancelDrawing);
  const exportAnnotationsAction = useAnnotationStore((s) => s.exportAnnotations);
  const importAnnotationsAction = useAnnotationStore((s) => s.importAnnotations);

  // Derived state
  const selectedAnnotation = useMemo(() => {
    return annotations.find((a) => a.id === selectedAnnotationId);
  }, [annotations, selectedAnnotationId]);

  const isDrawing = currentDrawingPath !== null;

  // Tool actions
  const setActiveTool = useCallback((tool: AnnotationTool) => {
    setActiveAnnotationTool(tool);
  }, [setActiveAnnotationTool]);

  const setActiveShapeType = useCallback((shapeType: ShapeType) => {
    setActiveShapeTypeAction(shapeType);
  }, [setActiveShapeTypeAction]);

  const setDrawingColor = useCallback((color: string) => {
    setDrawingColorAction(color);
  }, [setDrawingColorAction]);

  const setDrawingStrokeWidth = useCallback((width: number) => {
    setDrawingStrokeWidthAction(width);
  }, [setDrawingStrokeWidthAction]);

  // Note actions
  const createNote = useCallback((
    pageNumber: number,
    x: number,
    y: number,
    content: string = '',
    color: string = '#fef08a'
  ): NoteAnnotation => {
    const noteData: Omit<NoteAnnotation, 'id' | 'createdAt' | 'updatedAt'> = {
      type: 'note',
      pageNumber,
      x,
      y,
      content,
      color,
    };
    const note = addAnnotation(noteData as Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>) as NoteAnnotation;

    onAnnotationCreate?.(note);
    return note;
  }, [addAnnotation, onAnnotationCreate]);

  const updateNote = useCallback((id: string, updates: Partial<NoteAnnotation>) => {
    updateAnnotation(id, updates);
    const updated = annotations.find((a) => a.id === id);
    if (updated) {
      onAnnotationUpdate?.(updated);
    }
  }, [updateAnnotation, annotations, onAnnotationUpdate]);

  // Drawing actions
  const startDrawing = useCallback((pageNumber: number, point: { x: number; y: number }) => {
    startDrawingAction(pageNumber, point);
  }, [startDrawingAction]);

  const continueDrawing = useCallback((point: { x: number; y: number }) => {
    addDrawingPoint(point);
  }, [addDrawingPoint]);

  const finishDrawing = useCallback((): Annotation | null => {
    const annotation = finishDrawingAction();
    if (annotation) {
      onAnnotationCreate?.(annotation);
    }
    return annotation;
  }, [finishDrawingAction, onAnnotationCreate]);

  const cancelDrawing = useCallback(() => {
    cancelDrawingAction();
  }, [cancelDrawingAction]);

  // Shape actions
  const createShape = useCallback((options: {
    pageNumber: number;
    shapeType: ShapeType;
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
    strokeWidth?: number;
  }): ShapeAnnotation => {
    const shapeData: Omit<ShapeAnnotation, 'id' | 'createdAt' | 'updatedAt'> = {
      type: 'shape',
      pageNumber: options.pageNumber,
      shapeType: options.shapeType,
      x: options.x,
      y: options.y,
      width: options.width,
      height: options.height,
      color: options.color ?? drawingColor,
      strokeWidth: options.strokeWidth ?? drawingStrokeWidth,
    };
    const shape = addAnnotation(shapeData as Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>) as ShapeAnnotation;

    onAnnotationCreate?.(shape);
    return shape;
  }, [addAnnotation, drawingColor, drawingStrokeWidth, onAnnotationCreate]);

  const updateShape = useCallback((id: string, updates: Partial<ShapeAnnotation>) => {
    updateAnnotation(id, updates);
    const updated = annotations.find((a) => a.id === id);
    if (updated) {
      onAnnotationUpdate?.(updated);
    }
  }, [updateAnnotation, annotations, onAnnotationUpdate]);

  // General annotation actions
  const selectAnnotation = useCallback((id: string | null) => {
    selectAnnotationAction(id);
  }, [selectAnnotationAction]);

  const deleteAnnotation = useCallback((id: string) => {
    removeAnnotation(id);
    onAnnotationDelete?.(id);
  }, [removeAnnotation, onAnnotationDelete]);

  const getAnnotationsByPage = useCallback((pageNumber: number) => {
    return getAnnotationsByPageAction(pageNumber);
  }, [getAnnotationsByPageAction]);

  // Export/Import
  const exportAnnotations = useCallback(() => {
    return exportAnnotationsAction();
  }, [exportAnnotationsAction]);

  const importAnnotations = useCallback((json: string) => {
    importAnnotationsAction(json);
  }, [importAnnotationsAction]);

  return {
    // State
    annotations,
    selectedAnnotation,
    selectedAnnotationId,
    activeTool,
    activeShapeType,
    drawingColor,
    drawingStrokeWidth,
    isDrawing,
    currentDrawingPath,
    currentDrawingPage,

    // Tool actions
    setActiveTool,
    setActiveShapeType,
    setDrawingColor,
    setDrawingStrokeWidth,

    // Note actions
    createNote,
    updateNote,

    // Drawing actions
    startDrawing,
    continueDrawing,
    finishDrawing,
    cancelDrawing,

    // Shape actions
    createShape,
    updateShape,

    // General actions
    selectAnnotation,
    deleteAnnotation,
    getAnnotationsByPage,

    // Export/Import
    exportAnnotations,
    importAnnotations,
  };
}
