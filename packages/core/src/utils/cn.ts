import { clsx, type ClassValue } from 'clsx';

/**
 * Utility for merging class names with support for conditionals.
 * Uses clsx under the hood.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
