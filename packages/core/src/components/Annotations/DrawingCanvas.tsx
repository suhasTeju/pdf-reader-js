import { memo, useRef, useCallback, useState } from 'react';
import type { DrawingPath } from '../../types';
import { cn } from '../../utils';

export interface DrawingCanvasProps {
  width: number;
  height: number;
  scale: number;
  color?: string;
  strokeWidth?: number;
  isActive?: boolean;
  onDrawingComplete?: (path: DrawingPath) => void;
  className?: string;
}

// Convert points to SVG path string
function pointsToSvgPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y} L ${p.x} ${p.y}`;
  }

  // Use quadratic bezier curves for smoother lines
  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    // Calculate control point as midpoint
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    // Quadratic curve to the midpoint using p1 as control point
    path += ` Q ${p1.x} ${p1.y} ${midX} ${midY}`;
  }

  // Line to the last point
  if (points.length > 1) {
    const lastPoint = points[points.length - 1];
    path += ` L ${lastPoint.x} ${lastPoint.y}`;
  }

  return path;
}

// Simplify path by removing redundant points
function simplifyPath(
  points: { x: number; y: number }[],
  tolerance: number = 1
): { x: number; y: number }[] {
  if (points.length < 3) return points;

  const result: { x: number; y: number }[] = [points[0]];
  let lastAdded = points[0];

  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i];
    const dx = point.x - lastAdded.x;
    const dy = point.y - lastAdded.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist >= tolerance) {
      result.push(point);
      lastAdded = point;
    }
  }

  // Always add the last point
  result.push(points[points.length - 1]);
  return result;
}

export const DrawingCanvas = memo(function DrawingCanvas({
  width,
  height,
  scale,
  color = '#ef4444',
  strokeWidth = 2,
  isActive = false,
  onDrawingComplete,
  className,
}: DrawingCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);

  const getPoint = useCallback((e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    if (!svgRef.current) return null;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();

    let clientX: number;
    let clientY: number;

    if ('touches' in e) {
      const touch = e.touches[0];
      if (!touch) return null;
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  }, [scale]);

  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isActive) return;

    const point = getPoint(e);
    if (point) {
      setIsDrawing(true);
      setCurrentPath([point]);
    }
  }, [isActive, getPoint]);

  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !isActive) return;

    const point = getPoint(e);
    if (point) {
      setCurrentPath(prev => [...prev, point]);
    }
  }, [isDrawing, isActive, getPoint]);

  const handleEnd = useCallback(() => {
    if (!isDrawing) return;

    setIsDrawing(false);

    if (currentPath.length >= 2) {
      const simplifiedPoints = simplifyPath(currentPath, 2);
      onDrawingComplete?.({ points: simplifiedPoints });
    }

    setCurrentPath([]);
  }, [isDrawing, currentPath, onDrawingComplete]);

  return (
    <svg
      ref={svgRef}
      className={cn(
        'drawing-canvas',
        isActive && 'cursor-crosshair',
        className
      )}
      width={width * scale}
      height={height * scale}
      viewBox={`0 0 ${width} ${height}`}
      style={{ touchAction: isActive ? 'none' : 'auto' }}
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
    >
      {/* Current drawing path preview */}
      {isDrawing && currentPath.length > 0 && (
        <path
          d={pointsToSvgPath(currentPath)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.8}
        />
      )}
    </svg>
  );
});

// Export helper functions for reuse
export { pointsToSvgPath, simplifyPath };
