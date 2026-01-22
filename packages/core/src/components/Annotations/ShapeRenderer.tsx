import { memo, useCallback, useState, useRef } from 'react';
import type { ShapeAnnotation } from '../../types';
import { cn } from '../../utils';

export interface ShapeRendererProps {
  shape: ShapeAnnotation;
  scale: number;
  isSelected?: boolean;
  isEditing?: boolean;
  onSelect?: () => void;
  onUpdate?: (updates: Partial<ShapeAnnotation>) => void;
  onDelete?: () => void;
  className?: string;
}

interface ResizeHandle {
  position: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
  cursor: string;
  x: number;
  y: number;
}

export const ShapeRenderer = memo(function ShapeRenderer({
  shape,
  scale,
  isSelected,
  isEditing,
  onSelect,
  onUpdate,
  onDelete: _onDelete,
  className,
}: ShapeRendererProps) {
  const [_isDragging, setIsDragging] = useState(false);
  const [_isResizing, setIsResizing] = useState(false);
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startShapeRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const { shapeType, x, y, width, height, color, strokeWidth, id: _id } = shape;
  const scaledX = x * scale;
  const scaledY = y * scale;
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;
  const scaledStroke = strokeWidth * scale;

  // Calculate resize handles positions
  const getResizeHandles = useCallback((): ResizeHandle[] => {
    const handleSize = 8;
    const half = handleSize / 2;

    return [
      { position: 'nw', cursor: 'nwse-resize', x: scaledX - half, y: scaledY - half },
      { position: 'n', cursor: 'ns-resize', x: scaledX + scaledWidth / 2 - half, y: scaledY - half },
      { position: 'ne', cursor: 'nesw-resize', x: scaledX + scaledWidth - half, y: scaledY - half },
      { position: 'e', cursor: 'ew-resize', x: scaledX + scaledWidth - half, y: scaledY + scaledHeight / 2 - half },
      { position: 'se', cursor: 'nwse-resize', x: scaledX + scaledWidth - half, y: scaledY + scaledHeight - half },
      { position: 's', cursor: 'ns-resize', x: scaledX + scaledWidth / 2 - half, y: scaledY + scaledHeight - half },
      { position: 'sw', cursor: 'nesw-resize', x: scaledX - half, y: scaledY + scaledHeight - half },
      { position: 'w', cursor: 'ew-resize', x: scaledX - half, y: scaledY + scaledHeight / 2 - half },
    ];
  }, [scaledX, scaledY, scaledWidth, scaledHeight]);

  const handleMouseDown = useCallback((e: React.MouseEvent, handle?: string) => {
    e.stopPropagation();
    onSelect?.();

    if (!isEditing) return;

    startPosRef.current = { x: e.clientX, y: e.clientY };
    startShapeRef.current = { x, y, width, height };

    if (handle) {
      setIsResizing(true);
      setActiveHandle(handle);
    } else {
      setIsDragging(true);
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startPosRef.current.x) / scale;
      const dy = (moveEvent.clientY - startPosRef.current.y) / scale;

      if (handle) {
        // Resizing
        let newX = startShapeRef.current.x;
        let newY = startShapeRef.current.y;
        let newWidth = startShapeRef.current.width;
        let newHeight = startShapeRef.current.height;

        switch (handle) {
          case 'nw':
            newX += dx;
            newY += dy;
            newWidth -= dx;
            newHeight -= dy;
            break;
          case 'n':
            newY += dy;
            newHeight -= dy;
            break;
          case 'ne':
            newY += dy;
            newWidth += dx;
            newHeight -= dy;
            break;
          case 'e':
            newWidth += dx;
            break;
          case 'se':
            newWidth += dx;
            newHeight += dy;
            break;
          case 's':
            newHeight += dy;
            break;
          case 'sw':
            newX += dx;
            newWidth -= dx;
            newHeight += dy;
            break;
          case 'w':
            newX += dx;
            newWidth -= dx;
            break;
        }

        // Ensure minimum size
        if (newWidth >= 10 && newHeight >= 10) {
          onUpdate?.({ x: newX, y: newY, width: newWidth, height: newHeight });
        }
      } else {
        // Dragging
        onUpdate?.({
          x: startShapeRef.current.x + dx,
          y: startShapeRef.current.y + dy,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setActiveHandle(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isEditing, x, y, width, height, scale, onSelect, onUpdate]);

  const renderShape = useCallback(() => {
    const commonProps = {
      stroke: color,
      strokeWidth: scaledStroke,
      fill: 'none',
      className: cn(
        'cursor-pointer transition-opacity',
        isSelected && 'filter drop-shadow-sm'
      ),
    };

    switch (shapeType) {
      case 'rect':
        return (
          <rect
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
        const arrowLength = Math.min(15, Math.sqrt(scaledWidth * scaledWidth + scaledHeight * scaledHeight) * 0.2);
        const arrowAngle = Math.PI / 6;

        const arrow1X = endX - arrowLength * Math.cos(angle - arrowAngle);
        const arrow1Y = endY - arrowLength * Math.sin(angle - arrowAngle);
        const arrow2X = endX - arrowLength * Math.cos(angle + arrowAngle);
        const arrow2Y = endY - arrowLength * Math.sin(angle + arrowAngle);

        return (
          <g>
            <line x1={scaledX} y1={scaledY} x2={endX} y2={endY} {...commonProps} />
            <line x1={endX} y1={endY} x2={arrow1X} y2={arrow1Y} {...commonProps} />
            <line x1={endX} y1={endY} x2={arrow2X} y2={arrow2Y} {...commonProps} />
          </g>
        );

      default:
        return null;
    }
  }, [shapeType, scaledX, scaledY, scaledWidth, scaledHeight, color, scaledStroke, isSelected]);

  return (
    <g
      className={cn('shape-renderer', className)}
      onMouseDown={(e) => handleMouseDown(e)}
    >
      {/* Hit area for selection (invisible, larger) */}
      <rect
        x={scaledX - 5}
        y={scaledY - 5}
        width={scaledWidth + 10}
        height={scaledHeight + 10}
        fill="transparent"
        stroke="none"
        className="cursor-pointer"
      />

      {/* The actual shape */}
      {renderShape()}

      {/* Selection outline */}
      {isSelected && (
        <rect
          x={scaledX - 2}
          y={scaledY - 2}
          width={scaledWidth + 4}
          height={scaledHeight + 4}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={1}
          strokeDasharray="4 2"
        />
      )}

      {/* Resize handles when editing */}
      {isSelected && isEditing && getResizeHandles().map((handle) => (
        <rect
          key={handle.position}
          x={handle.x}
          y={handle.y}
          width={8}
          height={8}
          fill="white"
          stroke="#3b82f6"
          strokeWidth={1}
          className={cn('cursor-pointer', activeHandle === handle.position && 'fill-blue-500')}
          style={{ cursor: handle.cursor }}
          onMouseDown={(e) => handleMouseDown(e, handle.position)}
        />
      ))}
    </g>
  );
});

// Shape preview component for drawing new shapes
export interface ShapePreviewProps {
  shapeType: 'rect' | 'circle' | 'arrow' | 'line';
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  scale: number;
  color: string;
  strokeWidth: number;
}

export const ShapePreview = memo(function ShapePreview({
  shapeType,
  startPoint,
  endPoint,
  scale,
  color,
  strokeWidth,
}: ShapePreviewProps) {
  const x = Math.min(startPoint.x, endPoint.x) * scale;
  const y = Math.min(startPoint.y, endPoint.y) * scale;
  const width = Math.abs(endPoint.x - startPoint.x) * scale;
  const height = Math.abs(endPoint.y - startPoint.y) * scale;
  const scaledStroke = strokeWidth * scale;

  const commonProps = {
    stroke: color,
    strokeWidth: scaledStroke,
    fill: 'none',
    opacity: 0.7,
  };

  switch (shapeType) {
    case 'rect':
      return (
        <rect x={x} y={y} width={width} height={height} {...commonProps} />
      );

    case 'circle':
      return (
        <ellipse
          cx={x + width / 2}
          cy={y + height / 2}
          rx={width / 2}
          ry={height / 2}
          {...commonProps}
        />
      );

    case 'line':
      return (
        <line
          x1={startPoint.x * scale}
          y1={startPoint.y * scale}
          x2={endPoint.x * scale}
          y2={endPoint.y * scale}
          {...commonProps}
        />
      );

    case 'arrow':
      const endX = endPoint.x * scale;
      const endY = endPoint.y * scale;
      const dx = endPoint.x - startPoint.x;
      const dy = endPoint.y - startPoint.y;
      const angle = Math.atan2(dy, dx);
      const arrowLength = Math.min(15, Math.sqrt(width * width + height * height) * 0.2);
      const arrowAngle = Math.PI / 6;

      const arrow1X = endX - arrowLength * Math.cos(angle - arrowAngle);
      const arrow1Y = endY - arrowLength * Math.sin(angle - arrowAngle);
      const arrow2X = endX - arrowLength * Math.cos(angle + arrowAngle);
      const arrow2Y = endY - arrowLength * Math.sin(angle + arrowAngle);

      return (
        <g>
          <line
            x1={startPoint.x * scale}
            y1={startPoint.y * scale}
            x2={endX}
            y2={endY}
            {...commonProps}
          />
          <line x1={endX} y1={endY} x2={arrow1X} y2={arrow1Y} {...commonProps} />
          <line x1={endX} y1={endY} x2={arrow2X} y2={arrow2Y} {...commonProps} />
        </g>
      );

    default:
      return null;
  }
});
