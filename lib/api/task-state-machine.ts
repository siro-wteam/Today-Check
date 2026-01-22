/**
 * Task State Machine - 상태 전이 규칙
 * 
 * Allowed Transitions:
 * - TODO ↔ DONE
 * - TODO ↔ CANCEL
 * - Any state → DELETED (soft delete)
 * 
 * Blocked Transitions:
 * - DONE ↔ CANCEL (must go through TODO)
 */

import type { TaskStatus } from '../types';

/**
 * 상태 전이가 허용되는지 검증
 */
export function isValidStateTransition(
  currentStatus: TaskStatus,
  targetStatus: TaskStatus
): boolean {
  // 같은 상태로는 변경 불가
  if (currentStatus === targetStatus) {
    return false;
  }

  // TODO는 모든 상태로 전환 가능
  if (currentStatus === 'TODO') {
    return true;
  }

  // DONE → TODO만 허용
  if (currentStatus === 'DONE') {
    return targetStatus === 'TODO';
  }

  // CANCEL → TODO만 허용
  if (currentStatus === 'CANCEL') {
    return targetStatus === 'TODO';
  }

  return false;
}

/**
 * 안전한 상태 전이를 수행
 * 잘못된 전이 시 에러 반환
 */
export function validateStateTransition(
  currentStatus: TaskStatus,
  targetStatus: TaskStatus
): { valid: boolean; error?: string } {
  if (!isValidStateTransition(currentStatus, targetStatus)) {
    // DONE ↔ CANCEL direct transition attempt
    if (
      (currentStatus === 'DONE' && targetStatus === 'CANCEL') ||
      (currentStatus === 'CANCEL' && targetStatus === 'DONE')
    ) {
      return {
        valid: false,
        error: 'Cannot switch directly between DONE and CANCEL. Please restore to TODO first.',
      };
    }

    return {
      valid: false,
      error: `Cannot change from ${currentStatus} to ${targetStatus}.`,
    };
  }

  return { valid: true };
}

/**
 * 상태별 허용되는 액션 반환
 */
export function getAllowedActions(status: TaskStatus): {
  canSwipeRight: boolean;
  canSwipeLeft: boolean;
  tapAction: 'toggle' | 'restore' | null;
} {
  switch (status) {
    case 'TODO':
      return {
        canSwipeRight: true, // → DONE
        canSwipeLeft: true, // → CANCEL or DELETE
        tapAction: 'toggle', // → DONE
      };

    case 'DONE':
      return {
        canSwipeRight: false,
        canSwipeLeft: false,
        tapAction: 'restore', // → TODO
      };

    case 'CANCEL':
      return {
        canSwipeRight: false,
        canSwipeLeft: false,
        tapAction: 'restore', // → TODO
      };

    default:
      return {
        canSwipeRight: false,
        canSwipeLeft: false,
        tapAction: null,
      };
  }
}
