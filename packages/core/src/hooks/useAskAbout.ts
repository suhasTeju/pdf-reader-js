import { useState, useCallback, useRef, useEffect } from 'react';
import { useAgentStore } from './PDFViewerContext';
import type { AskAboutContext, PDFRegion } from '../types/agent-context';

export interface UseAskAboutOptions {
  /** Whether the feature is enabled */
  enabled?: boolean;
  /** Long press duration to trigger ask about (ms) */
  longPressDuration?: number;
  /** Callback when ask about is triggered */
  onAskAbout?: (context: AskAboutContext) => void;
  /** Minimum selection length to enable ask about for text */
  minSelectionLength?: number;
}

export interface UseAskAboutReturn {
  /** Whether ask about is currently in progress (long press active) */
  isLongPressing: boolean;
  /** Progress of the long press (0-1) */
  longPressProgress: number;
  /** Position of the long press */
  longPressPosition: { x: number; y: number } | null;
  /** Trigger ask about for selected text */
  askAboutSelection: (text: string, pageNumber: number) => void;
  /** Trigger ask about for a region (diagram, image) */
  askAboutRegion: (region: PDFRegion, pageNumber: number) => void;
  /** Start long press tracking (for custom implementations) */
  startLongPress: (x: number, y: number) => void;
  /** Cancel long press */
  cancelLongPress: () => void;
  /** Complete long press and trigger callback */
  completeLongPress: (type: 'text' | 'region', pageNumber: number, text?: string, region?: PDFRegion) => void;
  /** Handlers for attaching to elements */
  handlers: {
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseUp: () => void;
    onMouseLeave: () => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
    onTouchCancel: () => void;
  };
}

/**
 * Hook for implementing the "Ask About This" feature.
 * Provides long-press detection and callbacks for asking about text or regions.
 */
export function useAskAbout(options: UseAskAboutOptions = {}): UseAskAboutReturn {
  const {
    enabled = true,
    longPressDuration = 800,
    onAskAbout,
    minSelectionLength = 3,
  } = options;

  const [isLongPressing, setIsLongPressing] = useState(false);
  const [longPressProgress, setLongPressProgress] = useState(0);
  const [longPressPosition, setLongPressPosition] = useState<{ x: number; y: number } | null>(null);

  const timerRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Get agent context for including in ask about
  const agentContext = useAgentStore((s) => s.currentContext);

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (progressIntervalRef.current !== null) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const cancelLongPress = useCallback(() => {
    clearTimers();
    setIsLongPressing(false);
    setLongPressProgress(0);
    setLongPressPosition(null);
  }, [clearTimers]);

  const triggerAskAbout = useCallback(
    (context: AskAboutContext) => {
      // Include agent context if available
      const fullContext: AskAboutContext = {
        ...context,
        agentContext: agentContext ?? undefined,
      };
      onAskAbout?.(fullContext);
    },
    [onAskAbout, agentContext]
  );

  const startLongPress = useCallback(
    (x: number, y: number) => {
      if (!enabled) return;

      clearTimers();
      setIsLongPressing(true);
      setLongPressProgress(0);
      setLongPressPosition({ x, y });
      startTimeRef.current = Date.now();

      // Update progress every 50ms
      progressIntervalRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const progress = Math.min(elapsed / longPressDuration, 1);
        setLongPressProgress(progress);
      }, 50);

      // Complete after duration
      timerRef.current = window.setTimeout(() => {
        setLongPressProgress(1);
        clearTimers();
      }, longPressDuration);
    },
    [enabled, longPressDuration, clearTimers]
  );

  const completeLongPress = useCallback(
    (type: 'text' | 'region', pageNumber: number, text?: string, region?: PDFRegion) => {
      if (longPressProgress >= 1) {
        triggerAskAbout({
          type,
          pageNumber,
          selectedText: text,
          region,
        });
      }
      cancelLongPress();
    },
    [longPressProgress, triggerAskAbout, cancelLongPress]
  );

  const askAboutSelection = useCallback(
    (text: string, pageNumber: number) => {
      if (!enabled || text.length < minSelectionLength) return;

      triggerAskAbout({
        type: 'text',
        pageNumber,
        selectedText: text,
      });
    },
    [enabled, minSelectionLength, triggerAskAbout]
  );

  const askAboutRegion = useCallback(
    (region: PDFRegion, pageNumber: number) => {
      if (!enabled) return;

      triggerAskAbout({
        type: 'region',
        pageNumber,
        region,
      });
    },
    [enabled, triggerAskAbout]
  );

  // Mouse handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;
      startLongPress(e.clientX, e.clientY);
    },
    [enabled, startLongPress]
  );

  const handleMouseUp = useCallback(() => {
    if (isLongPressing && longPressProgress < 1) {
      cancelLongPress();
    }
  }, [isLongPressing, longPressProgress, cancelLongPress]);

  const handleMouseLeave = useCallback(() => {
    if (isLongPressing) {
      cancelLongPress();
    }
  }, [isLongPressing, cancelLongPress]);

  // Touch handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || e.touches.length !== 1) return;
      const touch = e.touches[0];
      startLongPress(touch.clientX, touch.clientY);
    },
    [enabled, startLongPress]
  );

  const handleTouchEnd = useCallback(() => {
    if (isLongPressing && longPressProgress < 1) {
      cancelLongPress();
    }
  }, [isLongPressing, longPressProgress, cancelLongPress]);

  const handleTouchCancel = useCallback(() => {
    cancelLongPress();
  }, [cancelLongPress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return {
    isLongPressing,
    longPressProgress,
    longPressPosition,
    askAboutSelection,
    askAboutRegion,
    startLongPress,
    cancelLongPress,
    completeLongPress,
    handlers: {
      onMouseDown: handleMouseDown,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave,
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
    },
  };
}
