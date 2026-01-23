/**
 * Mobile-specific configuration and optimizations for PDF rendering.
 * Provides adaptive settings based on device capabilities.
 */

// ============================================================================
// Device Detection
// ============================================================================

export interface DeviceCapabilities {
  /** Whether the device is a mobile/tablet */
  isMobile: boolean;
  /** Whether the device supports touch */
  isTouch: boolean;
  /** Device pixel ratio */
  devicePixelRatio: number;
  /** Estimated device memory in GB (if available) */
  deviceMemory: number | null;
  /** Number of logical CPU cores */
  hardwareConcurrency: number;
  /** Whether the device is considered low-end */
  isLowEnd: boolean;
  /** Connection type if available */
  connectionType: 'slow' | 'fast' | 'unknown';
  /** Screen size category */
  screenSize: 'small' | 'medium' | 'large';
}

/**
 * Detect device capabilities for adaptive rendering.
 */
export function detectDeviceCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined') {
    // SSR fallback - assume desktop
    return {
      isMobile: false,
      isTouch: false,
      devicePixelRatio: 1,
      deviceMemory: null,
      hardwareConcurrency: 4,
      isLowEnd: false,
      connectionType: 'unknown',
      screenSize: 'large',
    };
  }

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || window.matchMedia('(max-width: 768px)').matches;

  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  const devicePixelRatio = window.devicePixelRatio || 1;

  // Device memory API (Chrome only)
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null;

  const hardwareConcurrency = navigator.hardwareConcurrency || 2;

  // Screen size detection
  const screenWidth = window.screen.width;
  const screenSize: 'small' | 'medium' | 'large' =
    screenWidth < 640 ? 'small' : screenWidth < 1024 ? 'medium' : 'large';

  // Connection type detection
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  let connectionType: 'slow' | 'fast' | 'unknown' = 'unknown';
  if (connection?.effectiveType) {
    connectionType = ['slow-2g', '2g', '3g'].includes(connection.effectiveType) ? 'slow' : 'fast';
  }

  // Determine if low-end device
  const isLowEnd =
    (deviceMemory !== null && deviceMemory < 4) ||
    hardwareConcurrency <= 2 ||
    (isMobile && devicePixelRatio > 2 && screenSize === 'small');

  return {
    isMobile,
    isTouch,
    devicePixelRatio,
    deviceMemory,
    hardwareConcurrency,
    isLowEnd,
    connectionType,
    screenSize,
  };
}

// ============================================================================
// Render Quality Settings
// ============================================================================

export type RenderQuality = 'low' | 'medium' | 'high' | 'auto';

export interface RenderConfig {
  /** Canvas scale factor (relative to device pixel ratio) */
  canvasScaleFactor: number;
  /** Maximum canvas dimension in pixels */
  maxCanvasDimension: number;
  /** Number of pages to preload around current page */
  overscanPages: number;
  /** Maximum pages to keep in memory */
  maxPagesInMemory: number;
  /** Debounce delay for scroll events (ms) */
  scrollDebounceMs: number;
  /** Whether to use low-resolution preview during scroll */
  useLowResPreview: boolean;
  /** Delay before rendering full resolution after scroll stops (ms) */
  fullResDelayMs: number;
  /** Whether to disable text layer on mobile for performance */
  disableTextLayerOnScroll: boolean;
  /** Render priority for current page vs adjacent pages */
  currentPagePriority: number;
  /** Whether to use requestIdleCallback for non-critical rendering */
  useIdleCallback: boolean;
  /** Maximum concurrent render operations */
  maxConcurrentRenders: number;
}

/**
 * Get render configuration based on quality setting and device capabilities.
 */
export function getRenderConfig(
  quality: RenderQuality = 'auto',
  capabilities?: DeviceCapabilities
): RenderConfig {
  const caps = capabilities ?? detectDeviceCapabilities();

  // Auto quality selection based on device
  if (quality === 'auto') {
    if (caps.isLowEnd) {
      quality = 'low';
    } else if (caps.isMobile) {
      quality = 'medium';
    } else {
      quality = 'high';
    }
  }

  switch (quality) {
    case 'low':
      return {
        canvasScaleFactor: Math.min(1, caps.devicePixelRatio * 0.5),
        maxCanvasDimension: 2048,
        overscanPages: 1,
        maxPagesInMemory: 3,
        scrollDebounceMs: 100,
        useLowResPreview: true,
        fullResDelayMs: 300,
        disableTextLayerOnScroll: true,
        currentPagePriority: 10,
        useIdleCallback: true,
        maxConcurrentRenders: 1,
      };

    case 'medium':
      return {
        canvasScaleFactor: Math.min(1.5, caps.devicePixelRatio * 0.75),
        maxCanvasDimension: 4096,
        overscanPages: 2,
        maxPagesInMemory: 5,
        scrollDebounceMs: 50,
        useLowResPreview: true,
        fullResDelayMs: 150,
        disableTextLayerOnScroll: true,
        currentPagePriority: 5,
        useIdleCallback: true,
        maxConcurrentRenders: 2,
      };

    case 'high':
    default:
      return {
        canvasScaleFactor: caps.devicePixelRatio,
        maxCanvasDimension: 8192,
        overscanPages: 3,
        maxPagesInMemory: 10,
        scrollDebounceMs: 16,
        useLowResPreview: false,
        fullResDelayMs: 0,
        disableTextLayerOnScroll: false,
        currentPagePriority: 1,
        useIdleCallback: false,
        maxConcurrentRenders: 4,
      };
  }
}

// ============================================================================
// Memory Management
// ============================================================================

export interface MemoryStatus {
  /** Whether memory pressure is detected */
  isUnderPressure: boolean;
  /** Used JS heap size in MB (if available) */
  usedHeapMB: number | null;
  /** Total JS heap size in MB (if available) */
  totalHeapMB: number | null;
  /** Heap usage percentage (if available) */
  heapUsagePercent: number | null;
}

/**
 * Check current memory status (Chrome only).
 */
export function getMemoryStatus(): MemoryStatus {
  if (typeof window === 'undefined') {
    return {
      isUnderPressure: false,
      usedHeapMB: null,
      totalHeapMB: null,
      heapUsagePercent: null,
    };
  }

  const memory = (performance as Performance & {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }).memory;

  if (!memory) {
    return {
      isUnderPressure: false,
      usedHeapMB: null,
      totalHeapMB: null,
      heapUsagePercent: null,
    };
  }

  const usedHeapMB = memory.usedJSHeapSize / (1024 * 1024);
  const totalHeapMB = memory.totalJSHeapSize / (1024 * 1024);
  const heapUsagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

  // Consider under pressure if using more than 70% of heap limit
  const isUnderPressure = heapUsagePercent > 70;

  return {
    isUnderPressure,
    usedHeapMB,
    totalHeapMB,
    heapUsagePercent,
  };
}

// ============================================================================
// Render Queue
// ============================================================================

interface RenderTask {
  id: string;
  pageNumber: number;
  priority: number;
  execute: () => Promise<void>;
  cancel?: () => void;
}

/**
 * Manages render tasks with priority and concurrency limits.
 * Prevents overwhelming mobile devices with too many concurrent renders.
 */
export class RenderQueue {
  private queue: RenderTask[] = [];
  private activeCount = 0;
  private maxConcurrent: number;
  private isProcessing = false;
  private cancelledIds = new Set<string>();

  constructor(maxConcurrent: number = 2) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Add a render task to the queue.
   */
  enqueue(task: RenderTask): void {
    // Remove any existing task for the same page
    this.queue = this.queue.filter((t) => t.pageNumber !== task.pageNumber);
    this.cancelledIds.delete(task.id);

    // Insert by priority (lower = higher priority)
    const insertIndex = this.queue.findIndex((t) => t.priority > task.priority);
    if (insertIndex === -1) {
      this.queue.push(task);
    } else {
      this.queue.splice(insertIndex, 0, task);
    }

    this.processQueue();
  }

  /**
   * Cancel a pending render task.
   */
  cancel(id: string): void {
    this.cancelledIds.add(id);
    const task = this.queue.find((t) => t.id === id);
    if (task?.cancel) {
      task.cancel();
    }
    this.queue = this.queue.filter((t) => t.id !== id);
  }

  /**
   * Cancel all pending tasks for pages not in the visible set.
   */
  cancelExcept(visiblePageNumbers: number[]): void {
    const visibleSet = new Set(visiblePageNumbers);
    const toCancel = this.queue.filter((t) => !visibleSet.has(t.pageNumber));
    for (const task of toCancel) {
      this.cancel(task.id);
    }
  }

  /**
   * Clear all pending tasks.
   */
  clear(): void {
    for (const task of this.queue) {
      if (task.cancel) {
        task.cancel();
      }
      this.cancelledIds.add(task.id);
    }
    this.queue = [];
  }

  /**
   * Update max concurrent renders (useful for adapting to memory pressure).
   */
  setMaxConcurrent(max: number): void {
    this.maxConcurrent = max;
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
      const task = this.queue.shift();
      if (!task || this.cancelledIds.has(task.id)) continue;

      this.activeCount++;

      // Execute without awaiting to allow concurrent processing
      task
        .execute()
        .catch((error) => {
          // Ignore cancellation errors
          if (error?.name !== 'RenderingCancelledException') {
            console.warn(`Render task ${task.id} failed:`, error);
          }
        })
        .finally(() => {
          this.activeCount--;
          this.processQueue();
        });
    }

    this.isProcessing = false;
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Throttle function calls to limit execution frequency.
 */
export function throttle<T extends (...args: Parameters<T>) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          func.apply(this, lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
}

/**
 * Debounce function calls to delay execution until after a pause.
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, wait);
  };
}

/**
 * Request idle callback with fallback for browsers that don't support it.
 */
export function requestIdleCallbackCompat(
  callback: () => void,
  options?: { timeout?: number }
): number {
  if (typeof window === 'undefined') {
    // SSR fallback
    return 0;
  }

  if ('requestIdleCallback' in window) {
    return (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout?: number }) => number }).requestIdleCallback(callback, options);
  }

  // Fallback to setTimeout for browsers without requestIdleCallback
  return setTimeout(callback, options?.timeout ?? 1) as unknown as number;
}

/**
 * Cancel idle callback with fallback.
 */
export function cancelIdleCallbackCompat(id: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  if ('cancelIdleCallback' in window) {
    (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

/**
 * Calculate optimal canvas dimensions respecting max dimension limits.
 */
export function calculateOptimalCanvasDimensions(
  width: number,
  height: number,
  scaleFactor: number,
  maxDimension: number
): { width: number; height: number; actualScale: number } {
  let canvasWidth = Math.floor(width * scaleFactor);
  let canvasHeight = Math.floor(height * scaleFactor);
  let actualScale = scaleFactor;

  // Check if either dimension exceeds the max
  if (canvasWidth > maxDimension || canvasHeight > maxDimension) {
    const scaleToFit = Math.min(maxDimension / canvasWidth, maxDimension / canvasHeight);
    canvasWidth = Math.floor(canvasWidth * scaleToFit);
    canvasHeight = Math.floor(canvasHeight * scaleToFit);
    actualScale = scaleFactor * scaleToFit;
  }

  return { width: canvasWidth, height: canvasHeight, actualScale };
}

// ============================================================================
// Global Instance
// ============================================================================

let globalCapabilities: DeviceCapabilities | null = null;
let globalRenderConfig: RenderConfig | null = null;
let globalRenderQueue: RenderQueue | null = null;

/**
 * Get or initialize global device capabilities (cached).
 */
export function getDeviceCapabilities(): DeviceCapabilities {
  if (!globalCapabilities) {
    globalCapabilities = detectDeviceCapabilities();
  }
  return globalCapabilities;
}

/**
 * Get or initialize global render config (cached).
 */
export function getGlobalRenderConfig(quality: RenderQuality = 'auto'): RenderConfig {
  if (!globalRenderConfig) {
    const caps = getDeviceCapabilities();
    globalRenderConfig = getRenderConfig(quality, caps);
  }
  return globalRenderConfig;
}

/**
 * Get or initialize global render queue.
 */
export function getGlobalRenderQueue(): RenderQueue {
  if (!globalRenderQueue) {
    const config = getGlobalRenderConfig();
    globalRenderQueue = new RenderQueue(config.maxConcurrentRenders);
  }
  return globalRenderQueue;
}

/**
 * Reset global instances (useful for testing or config changes).
 */
export function resetMobileConfig(): void {
  globalCapabilities = null;
  globalRenderConfig = null;
  if (globalRenderQueue) {
    globalRenderQueue.clear();
    globalRenderQueue = null;
  }
}
