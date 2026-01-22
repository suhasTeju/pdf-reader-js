import { memo, useCallback, useState, useRef, useEffect } from 'react';
import { cn } from '../../utils';
import { useAnnotationStore } from '../../hooks';
import type { AnnotationTool, ShapeType } from '../../store/annotation-store';

export interface AnnotationToolbarProps {
  /** Override the active tool from store */
  activeTool?: AnnotationTool;
  /** Override the active shape type from store */
  activeShapeType?: ShapeType;
  /** Override the drawing color from store */
  drawingColor?: string;
  /** Override the stroke width from store */
  strokeWidth?: number;
  /** Custom tool change handler */
  onToolChange?: (tool: AnnotationTool) => void;
  /** Custom shape type change handler */
  onShapeTypeChange?: (shapeType: ShapeType) => void;
  /** Custom color change handler */
  onColorChange?: (color: string) => void;
  /** Custom stroke width change handler */
  onStrokeWidthChange?: (width: number) => void;
  /** Position of the toolbar */
  position?: 'top' | 'bottom' | 'floating';
  /** Additional class name */
  className?: string;
}

const COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#000000', // black
];

const STROKE_WIDTHS = [1, 2, 3, 5, 8];

const SHAPE_TYPES: { type: ShapeType; icon: React.ReactNode; label: string }[] = [
  {
    type: 'rect',
    label: 'Rectangle',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <rect x="4" y="6" width="16" height="12" strokeWidth={2} />
      </svg>
    ),
  },
  {
    type: 'circle',
    label: 'Circle/Ellipse',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <ellipse cx="12" cy="12" rx="8" ry="6" strokeWidth={2} />
      </svg>
    ),
  },
  {
    type: 'arrow',
    label: 'Arrow',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
      </svg>
    ),
  },
  {
    type: 'line',
    label: 'Line',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20L20 4" />
      </svg>
    ),
  },
];

export const AnnotationToolbar = memo(function AnnotationToolbar({
  activeTool: activeToolProp,
  activeShapeType: activeShapeTypeProp,
  drawingColor: drawingColorProp,
  strokeWidth: strokeWidthProp,
  onToolChange: onToolChangeProp,
  onShapeTypeChange: onShapeTypeChangeProp,
  onColorChange: onColorChangeProp,
  onStrokeWidthChange: onStrokeWidthChangeProp,
  position = 'top',
  className,
}: AnnotationToolbarProps) {
  // Get state from store
  const storeActiveTool = useAnnotationStore((s) => s.activeAnnotationTool);
  const storeActiveShapeType = useAnnotationStore((s) => s.activeShapeType);
  const storeDrawingColor = useAnnotationStore((s) => s.drawingColor);
  const storeStrokeWidth = useAnnotationStore((s) => s.drawingStrokeWidth);
  const setActiveAnnotationTool = useAnnotationStore((s) => s.setActiveAnnotationTool);
  const setActiveShapeType = useAnnotationStore((s) => s.setActiveShapeType);
  const setDrawingColor = useAnnotationStore((s) => s.setDrawingColor);
  const setDrawingStrokeWidth = useAnnotationStore((s) => s.setDrawingStrokeWidth);

  // Use props if provided, otherwise use store values
  const activeTool = activeToolProp !== undefined ? activeToolProp : storeActiveTool;
  const activeShapeType = activeShapeTypeProp !== undefined ? activeShapeTypeProp : storeActiveShapeType;
  const drawingColor = drawingColorProp !== undefined ? drawingColorProp : storeDrawingColor;
  const strokeWidth = strokeWidthProp !== undefined ? strokeWidthProp : storeStrokeWidth;

  // Use custom handlers if provided, otherwise use store actions
  const onToolChange = onToolChangeProp || setActiveAnnotationTool;
  const onShapeTypeChange = onShapeTypeChangeProp || setActiveShapeType;
  const onColorChange = onColorChangeProp || setDrawingColor;
  const onStrokeWidthChange = onStrokeWidthChangeProp || setDrawingStrokeWidth;

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showShapePicker, setShowShapePicker] = useState(false);
  const [showStrokeWidth, setShowStrokeWidth] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const shapePickerRef = useRef<HTMLDivElement>(null);
  const strokePickerRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (colorPickerRef.current && !colorPickerRef.current.contains(target)) {
        setShowColorPicker(false);
      }
      if (shapePickerRef.current && !shapePickerRef.current.contains(target)) {
        setShowShapePicker(false);
      }
      if (strokePickerRef.current && !strokePickerRef.current.contains(target)) {
        setShowStrokeWidth(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToolClick = useCallback((tool: AnnotationTool) => {
    onToolChange(activeTool === tool ? null : tool);
  }, [activeTool, onToolChange]);

  const isActive = activeTool !== null;

  return (
    <div
      className={cn(
        'annotation-toolbar flex items-center gap-1 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700',
        position === 'floating' && 'fixed bottom-20 left-1/2 -translate-x-1/2 z-50',
        position === 'top' && 'sticky top-0 z-40',
        position === 'bottom' && 'sticky bottom-0 z-40',
        !isActive && 'opacity-90',
        className
      )}
    >
      {/* Note tool */}
      <button
        className={cn(
          'p-2 rounded transition-colors',
          activeTool === 'note'
            ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
        )}
        onClick={() => handleToolClick('note')}
        title="Sticky Note"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      </button>

      {/* Draw tool */}
      <button
        className={cn(
          'p-2 rounded transition-colors',
          activeTool === 'draw'
            ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
        )}
        onClick={() => handleToolClick('draw')}
        title="Freehand Draw"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>

      {/* Shape tool with dropdown */}
      <div className="relative" ref={shapePickerRef}>
        <button
          className={cn(
            'p-2 rounded transition-colors flex items-center gap-1',
            activeTool === 'shape'
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          )}
          onClick={() => {
            if (activeTool !== 'shape') {
              handleToolClick('shape');
            }
            setShowShapePicker(!showShapePicker);
          }}
          title="Shapes"
        >
          {SHAPE_TYPES.find(s => s.type === activeShapeType)?.icon || SHAPE_TYPES[0].icon}
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showShapePicker && (
          <div className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex gap-1">
              {SHAPE_TYPES.map((shape) => (
                <button
                  key={shape.type}
                  className={cn(
                    'p-2 rounded transition-colors',
                    activeShapeType === shape.type
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  )}
                  onClick={() => {
                    onShapeTypeChange(shape.type);
                    onToolChange('shape');
                    setShowShapePicker(false);
                  }}
                  title={shape.label}
                >
                  {shape.icon}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

      {/* Color picker */}
      <div className="relative" ref={colorPickerRef}>
        <button
          className={cn(
            'p-2 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-700',
            showColorPicker && 'bg-gray-100 dark:bg-gray-700'
          )}
          onClick={() => setShowColorPicker(!showColorPicker)}
          title="Color"
        >
          <div
            className="w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-500"
            style={{ backgroundColor: drawingColor }}
          />
        </button>

        {showColorPicker && (
          <div className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-4 gap-1">
              {COLORS.map((color) => (
                <button
                  key={color}
                  className={cn(
                    'w-6 h-6 rounded border-2 transition-transform hover:scale-110',
                    drawingColor === color
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-gray-300 dark:border-gray-500'
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    onColorChange(color);
                    setShowColorPicker(false);
                  }}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stroke width */}
      <div className="relative" ref={strokePickerRef}>
        <button
          className={cn(
            'p-2 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-700',
            showStrokeWidth && 'bg-gray-100 dark:bg-gray-700'
          )}
          onClick={() => setShowStrokeWidth(!showStrokeWidth)}
          title="Stroke Width"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <div
              className="rounded-full bg-gray-700 dark:bg-gray-300"
              style={{ width: Math.min(strokeWidth * 2, 16), height: Math.min(strokeWidth * 2, 16) }}
            />
          </div>
        </button>

        {showStrokeWidth && (
          <div className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col gap-1">
              {STROKE_WIDTHS.map((width) => (
                <button
                  key={width}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1 rounded transition-colors',
                    strokeWidth === width
                      ? 'bg-blue-100 dark:bg-blue-900'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                  onClick={() => {
                    onStrokeWidthChange(width);
                    setShowStrokeWidth(false);
                  }}
                >
                  <div
                    className="rounded-full bg-gray-700 dark:bg-gray-300"
                    style={{ width: width * 2, height: width * 2 }}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{width}px</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

      {/* Clear/Cancel button */}
      {activeTool && (
        <button
          className="p-2 rounded transition-colors hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
          onClick={() => onToolChange(null)}
          title="Exit annotation mode"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
});
