import {
  isValidStateTransition,
  validateStateTransition,
  getAllowedActions,
} from '../lib/api/task-state-machine';

describe('isValidStateTransition', () => {
  // TODO에서 전환
  test('TODO -> DONE 허용', () => {
    expect(isValidStateTransition('TODO', 'DONE')).toBe(true);
  });

  test('TODO -> CANCEL 허용', () => {
    expect(isValidStateTransition('TODO', 'CANCEL')).toBe(true);
  });

  // DONE에서 전환
  test('DONE -> TODO 허용', () => {
    expect(isValidStateTransition('DONE', 'TODO')).toBe(true);
  });

  test('DONE -> CANCEL 차단', () => {
    expect(isValidStateTransition('DONE', 'CANCEL')).toBe(false);
  });

  // CANCEL에서 전환
  test('CANCEL -> TODO 허용', () => {
    expect(isValidStateTransition('CANCEL', 'TODO')).toBe(true);
  });

  test('CANCEL -> DONE 차단', () => {
    expect(isValidStateTransition('CANCEL', 'DONE')).toBe(false);
  });

  // 같은 상태
  test('같은 상태로 전환 차단', () => {
    expect(isValidStateTransition('TODO', 'TODO')).toBe(false);
    expect(isValidStateTransition('DONE', 'DONE')).toBe(false);
    expect(isValidStateTransition('CANCEL', 'CANCEL')).toBe(false);
  });
});

describe('validateStateTransition', () => {
  test('유효한 전이는 valid: true', () => {
    expect(validateStateTransition('TODO', 'DONE')).toEqual({ valid: true });
  });

  test('DONE -> CANCEL 직접 전이 시 안내 메시지', () => {
    const result = validateStateTransition('DONE', 'CANCEL');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('TODO first');
  });

  test('CANCEL -> DONE 직접 전이 시 안내 메시지', () => {
    const result = validateStateTransition('CANCEL', 'DONE');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('TODO first');
  });

  test('같은 상태 전이 시 에러', () => {
    const result = validateStateTransition('TODO', 'TODO');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('getAllowedActions', () => {
  test('TODO: 모든 액션 허용', () => {
    const actions = getAllowedActions('TODO');
    expect(actions.canSwipeRight).toBe(true);
    expect(actions.canSwipeLeft).toBe(true);
    expect(actions.tapAction).toBe('toggle');
  });

  test('DONE: 탭으로 복원만 가능', () => {
    const actions = getAllowedActions('DONE');
    expect(actions.canSwipeRight).toBe(false);
    expect(actions.canSwipeLeft).toBe(false);
    expect(actions.tapAction).toBe('restore');
  });

  test('CANCEL: 탭으로 복원만 가능', () => {
    const actions = getAllowedActions('CANCEL');
    expect(actions.canSwipeRight).toBe(false);
    expect(actions.canSwipeLeft).toBe(false);
    expect(actions.tapAction).toBe('restore');
  });
});
