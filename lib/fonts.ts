/**
 * Geist Font Utilities
 * Helper functions for applying Geist font family to Text components
 */

import { typography } from '@/constants/colors';

/**
 * Get font family name based on font weight
 */
export function getFontFamily(weight: 'regular' | 'medium' | 'semibold' | 'bold' = 'regular'): string {
  return typography.fontFamily[weight];
}

/**
 * Get font style object with Geist font family
 */
export function getFontStyle(weight: 'regular' | 'medium' | 'semibold' | 'bold' = 'regular') {
  return {
    fontFamily: getFontFamily(weight),
  };
}
