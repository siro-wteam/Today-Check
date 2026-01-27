/**
 * Calendar Range Constants
 * Defines the bounds and initial load range for the weekly calendar view
 */

import { addMonths, addWeeks, subMonths, subWeeks } from 'date-fns';

/**
 * Weekly View Range Limits
 * - Past: 3 months
 * - Future: 3 months
 * - Initial display: -2 weeks ~ +2 weeks (5 weeks total)
 */
export const WEEKLY_PAST_MONTHS = 3;
export const WEEKLY_FUTURE_MONTHS = 3;
export const WEEKLY_INITIAL_WEEKS = 2; // -2 weeks ~ +2 weeks = 5 weeks total

/**
 * Legacy: Daily view range limits (kept for backward compatibility)
 * @deprecated Use getWeeklyCalendarRanges() for weekly view
 */
export const PAST_LIMIT_MONTHS = 6;
export const FUTURE_LIMIT_MONTHS = 6;
export const INITIAL_LOAD_MONTHS = 1;

/**
 * Calculate weekly calendar ranges
 * - Full range: -2 months ~ +4 months
 * - Initial load: -2 weeks ~ +2 weeks (fast display)
 */
export function getWeeklyCalendarRanges() {
  const today = new Date();
  
  // Full range limits
  const pastLimit = subMonths(today, WEEKLY_PAST_MONTHS);
  const futureLimit = addMonths(today, WEEKLY_FUTURE_MONTHS);
  
  // Initial load range: -2 weeks ~ +2 weeks (5 weeks total)
  const initialLoadStart = subWeeks(today, WEEKLY_INITIAL_WEEKS);
  const initialLoadEnd = addWeeks(today, WEEKLY_INITIAL_WEEKS);
  
  return {
    pastLimit,
    futureLimit,
    initialLoadStart,
    initialLoadEnd,
  };
}

/**
 * Check if a date is within weekly view range
 */
export function isDateInWeeklyRange(date: Date): boolean {
  const { pastLimit, futureLimit } = getWeeklyCalendarRanges();
  return date >= pastLimit && date <= futureLimit;
}

/**
 * Legacy: Calculate date ranges (for daily view compatibility)
 * @deprecated Use getWeeklyCalendarRanges() for weekly view
 */
export function getCalendarRanges() {
  const today = new Date();
  
  // Past limit: 6 months ago
  const pastLimit = subMonths(today, PAST_LIMIT_MONTHS);
  
  // Future limit: 6 months from now
  const futureLimit = addMonths(today, FUTURE_LIMIT_MONTHS);
  
  // Initial load range: -1 month to +1 month
  const initialLoadStart = subMonths(today, INITIAL_LOAD_MONTHS);
  const initialLoadEnd = addMonths(today, INITIAL_LOAD_MONTHS);
  
  return {
    pastLimit,
    futureLimit,
    initialLoadStart,
    initialLoadEnd,
  };
}

/**
 * Check if a date is within the allowed range (legacy, for daily view)
 * @deprecated Use isDateInWeeklyRange() for weekly view
 */
export function isDateInRange(date: Date): boolean {
  const { pastLimit, futureLimit } = getCalendarRanges();
  return date >= pastLimit && date <= futureLimit;
}
