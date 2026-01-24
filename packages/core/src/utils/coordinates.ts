// ============================================================================
// Coordinate Conversion Utilities
// ============================================================================

/**
 * Convert PDF coordinates to viewport (screen) coordinates.
 * PDF coordinates have origin at bottom-left, viewport at top-left.
 *
 * @param x - X coordinate in PDF space
 * @param y - Y coordinate in PDF space
 * @param scale - Current zoom scale
 * @param pageHeight - Height of the page in PDF units
 * @returns Viewport coordinates { x, y }
 */
export function pdfToViewport(
  x: number,
  y: number,
  scale: number,
  pageHeight: number
): { x: number; y: number } {
  return {
    x: x * scale,
    y: (pageHeight - y) * scale,
  };
}

/**
 * Convert viewport (screen) coordinates to PDF coordinates.
 * Viewport coordinates have origin at top-left, PDF at bottom-left.
 *
 * @param x - X coordinate in viewport space
 * @param y - Y coordinate in viewport space
 * @param scale - Current zoom scale
 * @param pageHeight - Height of the page in PDF units
 * @returns PDF coordinates { x, y }
 */
export function viewportToPDF(
  x: number,
  y: number,
  scale: number,
  pageHeight: number
): { x: number; y: number } {
  return {
    x: x / scale,
    y: pageHeight - y / scale,
  };
}

/**
 * Convert percentage-based coordinates to PDF coordinates.
 * Useful for positioning elements based on relative position.
 *
 * @param xPercent - X coordinate as percentage (0-100)
 * @param yPercent - Y coordinate as percentage (0-100)
 * @param pageWidth - Width of the page in PDF units
 * @param pageHeight - Height of the page in PDF units
 * @returns PDF coordinates { x, y }
 */
export function percentToPDF(
  xPercent: number,
  yPercent: number,
  pageWidth: number,
  pageHeight: number
): { x: number; y: number } {
  return {
    x: (xPercent / 100) * pageWidth,
    y: (yPercent / 100) * pageHeight,
  };
}

/**
 * Convert PDF coordinates to percentage-based coordinates.
 *
 * @param x - X coordinate in PDF space
 * @param y - Y coordinate in PDF space
 * @param pageWidth - Width of the page in PDF units
 * @param pageHeight - Height of the page in PDF units
 * @returns Percentage coordinates { x, y } (0-100)
 */
export function pdfToPercent(
  x: number,
  y: number,
  pageWidth: number,
  pageHeight: number
): { x: number; y: number } {
  return {
    x: (x / pageWidth) * 100,
    y: (y / pageHeight) * 100,
  };
}

/**
 * Convert percentage coordinates to viewport (screen) pixels.
 *
 * @param xPercent - X coordinate as percentage (0-100)
 * @param yPercent - Y coordinate as percentage (0-100)
 * @param pageWidth - Width of the page in PDF units
 * @param pageHeight - Height of the page in PDF units
 * @param scale - Current zoom scale
 * @returns Viewport coordinates { x, y }
 */
export function percentToViewport(
  xPercent: number,
  yPercent: number,
  pageWidth: number,
  pageHeight: number,
  scale: number
): { x: number; y: number } {
  return {
    x: (xPercent / 100) * pageWidth * scale,
    y: (yPercent / 100) * pageHeight * scale,
  };
}

/**
 * Convert viewport (screen) pixels to percentage coordinates.
 *
 * @param x - X coordinate in viewport space
 * @param y - Y coordinate in viewport space
 * @param pageWidth - Width of the page in PDF units
 * @param pageHeight - Height of the page in PDF units
 * @param scale - Current zoom scale
 * @returns Percentage coordinates { x, y } (0-100)
 */
export function viewportToPercent(
  x: number,
  y: number,
  pageWidth: number,
  pageHeight: number,
  scale: number
): { x: number; y: number } {
  return {
    x: (x / (pageWidth * scale)) * 100,
    y: (y / (pageHeight * scale)) * 100,
  };
}

/**
 * Apply rotation to coordinates.
 * Rotates point around the center of the page.
 *
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param rotation - Rotation in degrees (0, 90, 180, 270)
 * @param pageWidth - Width of the page
 * @param pageHeight - Height of the page
 * @returns Rotated coordinates { x, y }
 */
export function applyRotation(
  x: number,
  y: number,
  rotation: number,
  pageWidth: number,
  pageHeight: number
): { x: number; y: number } {
  const normalizedRotation = ((rotation % 360) + 360) % 360;

  switch (normalizedRotation) {
    case 90:
      return { x: y, y: pageWidth - x };
    case 180:
      return { x: pageWidth - x, y: pageHeight - y };
    case 270:
      return { x: pageHeight - y, y: x };
    default:
      return { x, y };
  }
}

/**
 * Remove rotation from coordinates.
 * Inverse of applyRotation.
 *
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param rotation - Rotation in degrees (0, 90, 180, 270)
 * @param pageWidth - Width of the page (original, before rotation)
 * @param pageHeight - Height of the page (original, before rotation)
 * @returns Unrotated coordinates { x, y }
 */
export function removeRotation(
  x: number,
  y: number,
  rotation: number,
  pageWidth: number,
  pageHeight: number
): { x: number; y: number } {
  const normalizedRotation = ((rotation % 360) + 360) % 360;

  // Apply inverse rotation
  switch (normalizedRotation) {
    case 90:
      return { x: pageWidth - y, y: x };
    case 180:
      return { x: pageWidth - x, y: pageHeight - y };
    case 270:
      return { x: y, y: pageHeight - x };
    default:
      return { x, y };
  }
}

/**
 * Calculate the bounding box dimensions after rotation.
 *
 * @param width - Original width
 * @param height - Original height
 * @param rotation - Rotation in degrees
 * @returns Rotated dimensions { width, height }
 */
export function getRotatedDimensions(
  width: number,
  height: number,
  rotation: number
): { width: number; height: number } {
  const normalizedRotation = ((rotation % 360) + 360) % 360;

  if (normalizedRotation === 90 || normalizedRotation === 270) {
    return { width: height, height: width };
  }

  return { width, height };
}

/**
 * Convert a rectangle from one coordinate space to another.
 *
 * @param rect - Rectangle with x, y, width, height
 * @param fromScale - Source scale
 * @param toScale - Target scale
 * @returns Scaled rectangle
 */
export function scaleRect(
  rect: { x: number; y: number; width: number; height: number },
  fromScale: number,
  toScale: number
): { x: number; y: number; width: number; height: number } {
  const ratio = toScale / fromScale;
  return {
    x: rect.x * ratio,
    y: rect.y * ratio,
    width: rect.width * ratio,
    height: rect.height * ratio,
  };
}

/**
 * Check if a point is inside a rectangle.
 *
 * @param point - Point coordinates { x, y }
 * @param rect - Rectangle { x, y, width, height }
 * @returns True if point is inside rectangle
 */
export function isPointInRect(
  point: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Check if two rectangles intersect.
 *
 * @param rectA - First rectangle
 * @param rectB - Second rectangle
 * @returns True if rectangles intersect
 */
export function doRectsIntersect(
  rectA: { x: number; y: number; width: number; height: number },
  rectB: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    rectA.x + rectA.width < rectB.x ||
    rectB.x + rectB.width < rectA.x ||
    rectA.y + rectA.height < rectB.y ||
    rectB.y + rectB.height < rectA.y
  );
}

/**
 * Get the intersection of two rectangles.
 *
 * @param rectA - First rectangle
 * @param rectB - Second rectangle
 * @returns Intersection rectangle or null if no intersection
 */
export function getRectIntersection(
  rectA: { x: number; y: number; width: number; height: number },
  rectB: { x: number; y: number; width: number; height: number }
): { x: number; y: number; width: number; height: number } | null {
  const x = Math.max(rectA.x, rectB.x);
  const y = Math.max(rectA.y, rectB.y);
  const right = Math.min(rectA.x + rectA.width, rectB.x + rectB.width);
  const bottom = Math.min(rectA.y + rectA.height, rectB.y + rectB.height);

  if (right <= x || bottom <= y) {
    return null;
  }

  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
  };
}
