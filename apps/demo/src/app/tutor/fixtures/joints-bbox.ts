import type { PageBBoxData } from '@pdf-reader/core';
import rawBbox from '../../../../bbox.json';

/**
 * Joints-chapter bbox data (pages 1-7) sourced from `apps/demo/bbox.json`.
 * Real product usage supplies bbox for every page from the ARIA backend —
 * this import lets the dev playground exercise the visualization engine
 * against the same shape without a live PDF document.
 *
 * The cast is necessary because TS infers tuple/union fields from JSON as
 * widened arrays/strings. The file's values are verified to match the
 * `PageBBoxData` schema (see `packages/core/src/types/bbox.ts`).
 */
export const JOINTS_BBOX = rawBbox as unknown as PageBBoxData[];
