import { format, subDays, addDays } from 'date-fns';
import { groupTasksByDate, getTasksForDate } from '../lib/utils/task-filtering';
import type { TaskWithRollover } from '../lib/types';

// 테스트용 작업 생성 헬퍼
function makeTask(overrides: Partial<TaskWithRollover> = {}): TaskWithRollover {
  return {
    id: 'test-' + Math.random().toString(36).slice(2, 8),
    user_id: 'user-1',
    creator_id: 'user-1',
    batch_id: 'batch-1',
    title: 'Test Task',
    status: 'TODO',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    due_time: null,
    due_time_end: null,
    original_due_date: null,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    group_id: null,
    location: null,
    daysOverdue: 0,
    isOverdue: false,
    ...overrides,
  };
}

const todayStr = format(new Date(), 'yyyy-MM-dd');
const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');

describe('groupTasksByDate', () => {
  test('빈 배열은 빈 Map 반환', () => {
    const result = groupTasksByDate([]);
    expect(result.size).toBe(0);
  });

  test('오늘 TODO 작업은 오늘 날짜에 그룹화', () => {
    const task = makeTask({ due_date: todayStr });
    const result = groupTasksByDate([task]);
    expect(result.get(todayStr)).toHaveLength(1);
  });

  test('내일 TODO 작업은 내일 날짜에 그룹화', () => {
    const task = makeTask({ due_date: tomorrowStr });
    const result = groupTasksByDate([task]);
    expect(result.get(tomorrowStr)).toHaveLength(1);
  });

  test('어제 미완료 TODO 작업은 오늘로 롤오버 (isOverdue=true)', () => {
    const task = makeTask({ due_date: yesterdayStr, status: 'TODO' });
    const result = groupTasksByDate([task]);
    const todayTasks = result.get(todayStr);
    expect(todayTasks).toHaveLength(1);
    expect(todayTasks![0].isOverdue).toBe(true);
    expect(todayTasks![0].daysOverdue).toBe(1);
  });

  test('DONE 작업은 completed_at 날짜에 그룹화', () => {
    const task = makeTask({
      status: 'DONE',
      due_date: yesterdayStr,
      completed_at: new Date().toISOString(),
    });
    const result = groupTasksByDate([task]);
    expect(result.get(todayStr)).toHaveLength(1);
  });

  test('DONE 작업에 completed_at 없으면 제외', () => {
    const task = makeTask({
      status: 'DONE',
      completed_at: null,
    });
    const result = groupTasksByDate([task]);
    expect(result.size).toBe(0);
  });

  test('due_date 없는 TODO 작업은 제외 (백로그)', () => {
    const task = makeTask({ due_date: null });
    const result = groupTasksByDate([task]);
    expect(result.size).toBe(0);
  });

  test('CANCEL 상태의 과거 작업은 원래 날짜에 표시 (롤오버 안됨)', () => {
    const task = makeTask({ due_date: yesterdayStr, status: 'CANCEL' });
    const result = groupTasksByDate([task]);
    expect(result.get(yesterdayStr)).toHaveLength(1);
    expect(result.get(todayStr)).toBeUndefined();
  });
});

describe('getTasksForDate', () => {
  test('존재하는 날짜의 작업 반환', () => {
    const task = makeTask({ due_date: todayStr });
    const map = groupTasksByDate([task]);
    expect(getTasksForDate(map, todayStr)).toHaveLength(1);
  });

  test('존재하지 않는 날짜는 빈 배열 반환', () => {
    const map = groupTasksByDate([]);
    expect(getTasksForDate(map, '2099-01-01')).toEqual([]);
  });
});
