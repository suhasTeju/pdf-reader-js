import { memo, useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import type { NoteAnnotation } from '../../types';
import { cn } from '../../utils';

export interface StickyNoteProps {
  note: NoteAnnotation;
  scale: number;
  isSelected?: boolean;
  isEditing?: boolean;
  onSelect?: () => void;
  onUpdate?: (updates: Partial<NoteAnnotation>) => void;
  onDelete?: () => void;
  onStartEdit?: () => void;
  onEndEdit?: () => void;
  onDragStart?: (e: React.MouseEvent | React.TouchEvent) => void;
  className?: string;
}

const NOTE_COLORS = [
  '#fef08a', // yellow
  '#bbf7d0', // green
  '#bfdbfe', // blue
  '#fbcfe8', // pink
  '#fed7aa', // orange
];

export const StickyNote = memo(function StickyNote({
  note,
  scale,
  isSelected,
  isEditing,
  onSelect,
  onUpdate,
  onDelete,
  onStartEdit,
  onEndEdit,
  onDragStart,
  className,
}: StickyNoteProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localContent, setLocalContent] = useState(note.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);

  // Update local content when note changes
  useEffect(() => {
    setLocalContent(note.content);
  }, [note.content]);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.();
    if (!isExpanded) {
      setIsExpanded(true);
    }
  }, [isExpanded, onSelect]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onStartEdit?.();
  }, [onStartEdit]);

  const handleBlur = useCallback(() => {
    if (isEditing && localContent !== note.content) {
      onUpdate?.({ content: localContent });
    }
    onEndEdit?.();
  }, [isEditing, localContent, note.content, onUpdate, onEndEdit]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setLocalContent(note.content);
      onEndEdit?.();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleBlur();
    }
  }, [note.content, onEndEdit, handleBlur]);

  const handleColorChange = useCallback((color: string) => {
    onUpdate?.({ color });
  }, [onUpdate]);

  const handleCollapse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(false);
    onEndEdit?.();
  }, [onEndEdit]);

  // Collapsed note icon
  if (!isExpanded) {
    return (
      <div
        ref={noteRef}
        className={cn(
          'absolute cursor-pointer transition-transform hover:scale-110',
          'w-6 h-6 rounded-sm shadow-md',
          'flex items-center justify-center',
          isSelected && 'ring-2 ring-blue-500 ring-offset-1',
          className
        )}
        style={{
          left: note.x * scale,
          top: note.y * scale,
          backgroundColor: note.color,
          zIndex: isSelected ? 60 : 55,
        }}
        onClick={handleClick}
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
        title={note.content || 'Empty note'}
      >
        <svg
          className="w-4 h-4 opacity-70"
          fill="currentColor"
          viewBox="0 0 20 20"
          style={{ color: '#333' }}
        >
          <path
            fillRule="evenodd"
            d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    );
  }

  // Expanded note
  return (
    <div
      ref={noteRef}
      className={cn(
        'absolute rounded shadow-lg transition-shadow',
        'min-w-[180px] max-w-[280px]',
        isSelected && 'ring-2 ring-blue-500',
        className
      )}
      style={{
        left: note.x * scale,
        top: note.y * scale,
        backgroundColor: note.color,
        zIndex: isSelected ? 60 : 55,
      }}
      onClick={handleClick}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-2 py-1 border-b border-black/10 cursor-move"
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
      >
        {/* Color picker */}
        <div className="flex gap-1">
          {NOTE_COLORS.map((color) => (
            <button
              key={color}
              className={cn(
                'w-4 h-4 rounded-full border border-black/20',
                'hover:scale-110 transition-transform',
                note.color === color && 'ring-1 ring-black/30'
              )}
              style={{ backgroundColor: color }}
              onClick={(e) => {
                e.stopPropagation();
                handleColorChange(color);
              }}
              title={`Change to ${color}`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-1">
          <button
            className="p-0.5 hover:bg-black/10 rounded"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            title="Delete note"
          >
            <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button
            className="p-0.5 hover:bg-black/10 rounded"
            onClick={handleCollapse}
            title="Collapse note"
          >
            <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-2">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            className={cn(
              'w-full min-h-[60px] resize-none bg-transparent',
              'text-sm text-gray-800 placeholder-gray-500',
              'border-none outline-none focus:ring-0'
            )}
            value={localContent}
            onChange={(e) => setLocalContent(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Enter note..."
          />
        ) : (
          <div
            className={cn(
              'text-sm text-gray-800 whitespace-pre-wrap min-h-[40px]',
              !note.content && 'text-gray-500 italic'
            )}
            onDoubleClick={handleDoubleClick}
          >
            {note.content || 'Double-click to edit...'}
          </div>
        )}
      </div>

      {/* Timestamp */}
      <div className="px-2 pb-1 text-[10px] text-gray-500">
        {new Date(note.updatedAt).toLocaleDateString()}
      </div>
    </div>
  );
});
