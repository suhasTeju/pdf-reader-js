import { memo, useCallback, useRef, MouseEvent, TouchEvent } from 'react';
import type { Annotation, DrawingPath } from '../../types';
import { cn } from '../../utils';

export interface AnnotationLayerProps {
  pageNumber: number;
  annotations: Annotation[];
  scale: number;
  selectedId?: string | null;
  isDrawing?: boolean;
  currentDrawingPath?: DrawingPath | null;
  drawingColor?: string;
  drawingStrokeWidth?: number;
  activeAnnotationTool?: 'note' | 'draw' | 'shape' | null;
  onAnnotationClick?: (annotation: Annotation) => void;
  onNoteClick?: (annotation: Annotation, event: { x: number; y: number }) => void;
  onDrawStart?: (point: { x: number; y: number }) => void;
  onDrawMove?: (point: { x: number; y: number }) => void;
  onDrawEnd?: () => void;
  onPageClick?: (point: { x: number; y: number }) => void;
  className?: string;
}

// Convert points to SVG path data
function pointsToPath(points: { x: number; y: number }[], scale: number): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x * scale} ${p.y * scale} L ${p.x * scale} ${p.y * scale}`;
  }

  const path = points.reduce((acc, point, index) => {
    const scaledX = point.x * scale;
    const scaledY = point.y * scale;
    if (index === 0) {
      return `M ${scaledX} ${scaledY}`;
    }
    return `${acc} L ${scaledX} ${scaledY}`;
  }, '');

  return path;
}

// Render a shape annotation
function renderShape(
  annotation: Annotation & { type: 'shape' },
  scale: number,
  isSelected: boolean
): React.ReactNode {
  const { shapeType, x, y, width, height, color, strokeWidth, id } = annotation;
  const scaledX = x * scale;
  const scaledY = y * scale;
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;
  const scaledStroke = strokeWidth * scale;

  const commonProps = {
    stroke: color,
    strokeWidth: scaledStroke,
    fill: 'none',
    className: cn(
      'cursor-pointer transition-opacity',
      isSelected && 'opacity-80'
    ),
  };

  switch (shapeType) {
    case 'rect':
      return (
        <rect
          key={id}
          x={scaledX}
          y={scaledY}
          width={scaledWidth}
          height={scaledHeight}
          {...commonProps}
        />
      );
    case 'circle':
      return (
        <ellipse
          key={id}
          cx={scaledX + scaledWidth / 2}
          cy={scaledY + scaledHeight / 2}
          rx={scaledWidth / 2}
          ry={scaledHeight / 2}
          {...commonProps}
        />
      );
    case 'line':
      return (
        <line
          key={id}
          x1={scaledX}
          y1={scaledY}
          x2={scaledX + scaledWidth}
          y2={scaledY + scaledHeight}
          {...commonProps}
        />
      );
    case 'arrow':
      const endX = scaledX + scaledWidth;
      const endY = scaledY + scaledHeight;
      const angle = Math.atan2(scaledHeight, scaledWidth);
      const arrowLength = 10 * scale;
      const arrowAngle = Math.PI / 6;

      const arrow1X = endX - arrowLength * Math.cos(angle - arrowAngle);
      const arrow1Y = endY - arrowLength * Math.sin(angle - arrowAngle);
      const arrow2X = endX - arrowLength * Math.cos(angle + arrowAngle);
      const arrow2Y = endY - arrowLength * Math.sin(angle + arrowAngle);

      return (
        <g key={id}>
          <line
            x1={scaledX}
            y1={scaledY}
            x2={endX}
            y2={endY}
            {...commonProps}
          />
          <line
            x1={endX}
            y1={endY}
            x2={arrow1X}
            y2={arrow1Y}
            {...commonProps}
          />
          <line
            x1={endX}
            y1={endY}
            x2={arrow2X}
            y2={arrow2Y}
            {...commonProps}
          />
        </g>
      );
    default:
      return null;
  }
}

export const AnnotationLayer = memo(function AnnotationLayer({
  pageNumber: _pageNumber,
  annotations,
  scale,
  selectedId,
  isDrawing,
  currentDrawingPath,
  drawingColor = '#ef4444',
  drawingStrokeWidth = 2,
  activeAnnotationTool,
  onAnnotationClick,
  onNoteClick,
  onDrawStart,
  onDrawMove,
  onDrawEnd,
  onPageClick,
  className,
}: AnnotationLayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);

  // Get relative coordinates from mouse/touch event
  const getRelativePoint = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  }, [scale]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (activeAnnotationTool !== 'draw') return;

    const point = getRelativePoint(e.clientX, e.clientY);
    if (point) {
      isDrawingRef.current = true;
      onDrawStart?.(point);
    }
  }, [activeAnnotationTool, getRelativePoint, onDrawStart]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDrawingRef.current || activeAnnotationTool !== 'draw') return;

    const point = getRelativePoint(e.clientX, e.clientY);
    if (point) {
      onDrawMove?.(point);
    }
  }, [activeAnnotationTool, getRelativePoint, onDrawMove]);

  const handleMouseUp = useCallback(() => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      onDrawEnd?.();
    }
  }, [onDrawEnd]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (activeAnnotationTool !== 'draw') return;

    const touch = e.touches[0];
    if (touch) {
      const point = getRelativePoint(touch.clientX, touch.clientY);
      if (point) {
        isDrawingRef.current = true;
        onDrawStart?.(point);
      }
    }
  }, [activeAnnotationTool, getRelativePoint, onDrawStart]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDrawingRef.current || activeAnnotationTool !== 'draw') return;

    const touch = e.touches[0];
    if (touch) {
      const point = getRelativePoint(touch.clientX, touch.clientY);
      if (point) {
        e.preventDefault(); // Prevent scrolling while drawing
        onDrawMove?.(point);
      }
    }
  }, [activeAnnotationTool, getRelativePoint, onDrawMove]);

  const handleTouchEnd = useCallback(() => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      onDrawEnd?.();
    }
  }, [onDrawEnd]);

  const handleClick = useCallback((e: MouseEvent) => {
    if (activeAnnotationTool === 'note') {
      const point = getRelativePoint(e.clientX, e.clientY);
      if (point) {
        onPageClick?.(point);
      }
    }
  }, [activeAnnotationTool, getRelativePoint, onPageClick]);

  // Annotations are already filtered for this page by PDFPage component
  // Separate drawings/shapes from notes
  const drawings = annotations.filter(a => a.type === 'drawing');
  const shapes = annotations.filter(a => a.type === 'shape');
  const notes = annotations.filter(a => a.type === 'note');

  return (
    <div
      ref={containerRef}
      className={cn(
        'pdf-annotation-layer',
        'absolute inset-0',
        activeAnnotationTool && 'cursor-crosshair',
        className
      )}
      style={{ zIndex: 50, pointerEvents: activeAnnotationTool ? 'auto' : 'none' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
    >
      {/* SVG layer for drawings and shapes */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ overflow: 'visible' }}
      >
        {/* Render completed drawings */}
        {drawings.map((drawing) => {
          if (drawing.type !== 'drawing') return null;
          const isSelected = drawing.id === selectedId;

          return drawing.paths.map((path, pathIndex) => (
            <path
              key={`${drawing.id}-${pathIndex}`}
              d={pointsToPath(path.points, scale)}
              stroke={drawing.color}
              strokeWidth={drawing.strokeWidth * scale}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(
                'cursor-pointer pointer-events-auto',
                isSelected && 'filter drop-shadow-md'
              )}
              onClick={(e) => {
                e.stopPropagation();
                onAnnotationClick?.(drawing);
              }}
            />
          ));
        })}

        {/* Render shapes */}
        {shapes.map((shape) => {
          if (shape.type !== 'shape') return null;
          const isSelected = shape.id === selectedId;

          return (
            <g
              key={shape.id}
              className="pointer-events-auto"
              onClick={(e) => {
                e.stopPropagation();
                onAnnotationClick?.(shape);
              }}
            >
              {renderShape(shape, scale, isSelected)}
            </g>
          );
        })}

        {/* Render current drawing path (preview) */}
        {isDrawing && currentDrawingPath && currentDrawingPath.points.length > 0 && (
          <path
            d={pointsToPath(currentDrawingPath.points, scale)}
            stroke={drawingColor}
            strokeWidth={drawingStrokeWidth * scale}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.8}
          />
        )}
      </svg>

      {/* Sticky notes */}
      {notes.map((note) => {
        if (note.type !== 'note') return null;
        const isSelected = note.id === selectedId;

        return (
          <div
            key={note.id}
            className={cn(
              'absolute pointer-events-auto cursor-pointer',
              'w-6 h-6 flex items-center justify-center',
              'rounded-sm shadow-md transition-transform hover:scale-110',
              isSelected && 'ring-2 ring-blue-500'
            )}
            style={{
              left: note.x * scale,
              top: note.y * scale,
              backgroundColor: note.color,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onAnnotationClick?.(note);
              onNoteClick?.(note, { x: e.clientX, y: e.clientY });
            }}
            title={note.content}
          >
            <svg
              className="w-4 h-4 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        );
      })}
    </div>
  );
});
