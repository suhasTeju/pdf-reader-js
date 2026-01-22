import { useRef, useCallback, useEffect } from 'react';

export interface UseTouchGesturesOptions {
  /** Callback when pinch-to-zoom is detected */
  onPinchZoom?: (scale: number, center: { x: number; y: number }) => void;
  /** Callback when swipe left is detected */
  onSwipeLeft?: () => void;
  /** Callback when swipe right is detected */
  onSwipeRight?: () => void;
  /** Callback when long press is detected */
  onLongPress?: (position: { x: number; y: number }) => void;
  /** Callback when double tap is detected */
  onDoubleTap?: (position: { x: number; y: number }) => void;
  /** Minimum swipe distance in pixels */
  swipeThreshold?: number;
  /** Long press duration in milliseconds */
  longPressDuration?: number;
  /** Double tap max interval in milliseconds */
  doubleTapInterval?: number;
  /** Whether gestures are enabled */
  enabled?: boolean;
}

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
  startDistance: number;
  currentScale: number;
  isPinching: boolean;
  longPressTimer: number | null;
  lastTapTime: number;
}

function getDistance(touch1: Touch, touch2: Touch): number {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getCenter(touch1: Touch, touch2: Touch): { x: number; y: number } {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
  };
}

export function useTouchGestures<T extends HTMLElement = HTMLElement>(
  options: UseTouchGesturesOptions = {}
) {
  const {
    onPinchZoom,
    onSwipeLeft,
    onSwipeRight,
    onLongPress,
    onDoubleTap,
    swipeThreshold = 50,
    longPressDuration = 500,
    doubleTapInterval = 300,
    enabled = true,
  } = options;

  const elementRef = useRef<T | null>(null);
  const stateRef = useRef<TouchState>({
    startX: 0,
    startY: 0,
    startTime: 0,
    startDistance: 0,
    currentScale: 1,
    isPinching: false,
    longPressTimer: null,
    lastTapTime: 0,
  });

  const clearLongPressTimer = useCallback(() => {
    if (stateRef.current.longPressTimer !== null) {
      clearTimeout(stateRef.current.longPressTimer);
      stateRef.current.longPressTimer = null;
    }
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;

      const state = stateRef.current;
      clearLongPressTimer();

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        state.startX = touch.clientX;
        state.startY = touch.clientY;
        state.startTime = Date.now();
        state.isPinching = false;

        // Set up long press detection
        if (onLongPress) {
          state.longPressTimer = window.setTimeout(() => {
            onLongPress({ x: touch.clientX, y: touch.clientY });
            state.longPressTimer = null;
          }, longPressDuration);
        }
      } else if (e.touches.length === 2 && onPinchZoom) {
        // Start pinch gesture
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        state.startDistance = getDistance(touch1, touch2);
        state.currentScale = 1;
        state.isPinching = true;
        clearLongPressTimer();
      }
    },
    [enabled, onLongPress, onPinchZoom, longPressDuration, clearLongPressTimer]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;

      const state = stateRef.current;
      clearLongPressTimer();

      if (e.touches.length === 2 && state.isPinching && onPinchZoom) {
        // Handle pinch zoom
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = getDistance(touch1, touch2);
        const center = getCenter(touch1, touch2);

        if (state.startDistance > 0) {
          const scale = currentDistance / state.startDistance;
          state.currentScale = scale;
          onPinchZoom(scale, center);
        }
      } else if (e.touches.length === 1) {
        // Check if we've moved enough to cancel long press
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - state.startX);
        const dy = Math.abs(touch.clientY - state.startY);

        if (dx > 10 || dy > 10) {
          clearLongPressTimer();
        }
      }
    },
    [enabled, onPinchZoom, clearLongPressTimer]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;

      const state = stateRef.current;
      clearLongPressTimer();

      // Handle pinch end
      if (state.isPinching) {
        state.isPinching = false;
        state.startDistance = 0;
        return;
      }

      // Only process single touch end
      if (e.changedTouches.length !== 1) return;

      const touch = e.changedTouches[0];
      const endTime = Date.now();
      const duration = endTime - state.startTime;

      // Calculate movement
      const dx = touch.clientX - state.startX;
      const dy = touch.clientY - state.startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Check for double tap
      if (onDoubleTap && duration < 300 && absDx < 20 && absDy < 20) {
        const timeSinceLastTap = endTime - state.lastTapTime;
        if (timeSinceLastTap < doubleTapInterval) {
          onDoubleTap({ x: touch.clientX, y: touch.clientY });
          state.lastTapTime = 0;
          return;
        }
        state.lastTapTime = endTime;
      }

      // Check for swipe (quick horizontal movement)
      if (duration < 300 && absDx > swipeThreshold && absDx > absDy * 2) {
        if (dx > 0 && onSwipeRight) {
          onSwipeRight();
        } else if (dx < 0 && onSwipeLeft) {
          onSwipeLeft();
        }
      }
    },
    [enabled, onSwipeLeft, onSwipeRight, onDoubleTap, swipeThreshold, doubleTapInterval, clearLongPressTimer]
  );

  const handleTouchCancel = useCallback(() => {
    clearLongPressTimer();
    stateRef.current.isPinching = false;
  }, [clearLongPressTimer]);

  // Attach event listeners
  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
      clearLongPressTimer();
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel, clearLongPressTimer]);

  // Return ref to attach to element
  const setRef = useCallback((element: T | null) => {
    elementRef.current = element;
  }, []);

  return {
    ref: setRef,
    elementRef,
  };
}

// Utility hook for detecting if device supports touch
export function useIsTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// Utility hook for detecting if device is mobile
export function useIsMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 640px)').matches;
}
