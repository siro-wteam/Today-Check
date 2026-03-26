import { addMonths, subMonths, addDays } from 'date-fns';
import {
  getWeeklyCalendarRanges,
  isDateInWeeklyRange,
  WEEKLY_PAST_MONTHS,
  WEEKLY_FUTURE_MONTHS,
} from '../constants/calendar';

describe('getWeeklyCalendarRanges', () => {
  test('pastLimit는 현재보다 과거', () => {
    const { pastLimit } = getWeeklyCalendarRanges();
    expect(pastLimit.getTime()).toBeLessThan(Date.now());
  });

  test('futureLimit는 현재보다 미래', () => {
    const { futureLimit } = getWeeklyCalendarRanges();
    expect(futureLimit.getTime()).toBeGreaterThan(Date.now());
  });

  test('initialLoadStart < initialLoadEnd', () => {
    const { initialLoadStart, initialLoadEnd } = getWeeklyCalendarRanges();
    expect(initialLoadStart.getTime()).toBeLessThan(initialLoadEnd.getTime());
  });

  test('초기 로드 범위는 전체 범위 안에 포함', () => {
    const { pastLimit, futureLimit, initialLoadStart, initialLoadEnd } =
      getWeeklyCalendarRanges();
    expect(initialLoadStart.getTime()).toBeGreaterThanOrEqual(pastLimit.getTime());
    expect(initialLoadEnd.getTime()).toBeLessThanOrEqual(futureLimit.getTime());
  });
});

describe('isDateInWeeklyRange', () => {
  test('오늘은 범위 안', () => {
    expect(isDateInWeeklyRange(new Date())).toBe(true);
  });

  test('내일은 범위 안', () => {
    expect(isDateInWeeklyRange(addDays(new Date(), 1))).toBe(true);
  });

  test('1년 전은 범위 밖', () => {
    expect(isDateInWeeklyRange(subMonths(new Date(), 12))).toBe(false);
  });

  test('1년 후는 범위 밖', () => {
    expect(isDateInWeeklyRange(addMonths(new Date(), 12))).toBe(false);
  });
});
