# 그룹 일정 Done 처리 구현 계획 (확정)

## ✅ 최종 결정 사항

### 1. API 로직 사용 (DB 트리거 X)
- DB 의존성 최소화
- 유지보수 관점에서 API에서 명시적 처리

### 2. 담당자 없는 그룹 태스크 허용
- 오너만 완료 처리 가능

### 3. 개인 태스크 기존 로직 유지
- `group_id IS NULL`: 기존 로직
- `group_id NOT NULL`: 새 로직 (task_assignees)

### 4. 주간뷰 먼저 개발

---

## 📋 개발 단계

### Phase 1: API 개발 (Backend)

#### 1-1. 담당자 완료 상태 토글 API
```typescript
// lib/api/task-state-machine.ts 또는 lib/api/tasks.ts

/**
 * 담당자 개별 완료 상태 토글
 * 권한: 본인 또는 그룹 오너
 */
export async function toggleAssigneeCompletion(
  taskId: string,
  userId: string,
  isCompleted: boolean
): Promise<{ error: Error | null }> {
  try {
    // 1. task_assignees 업데이트
    const { error: assigneeError } = await supabase
      .from('task_assignees')
      .update({
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
      })
      .eq('task_id', taskId)
      .eq('user_id', userId);

    if (assigneeError) throw assigneeError;

    // 2. 모든 담당자 상태 확인
    const { data: assignees, error: fetchError } = await supabase
      .from('task_assignees')
      .select('is_completed')
      .eq('task_id', taskId);

    if (fetchError) throw fetchError;

    // 3. task.status 업데이트
    const allCompleted = assignees?.every(a => a.is_completed) ?? false;
    const newStatus = allCompleted ? 'DONE' : 'TODO';

    const { error: taskError } = await supabase
      .from('tasks')
      .update({
        status: newStatus,
        completed_at: allCompleted ? new Date().toISOString() : null,
      })
      .eq('id', taskId);

    if (taskError) throw taskError;

    return { error: null };
  } catch (error) {
    console.error('[toggleAssigneeCompletion] Error:', error);
    return { error: error as Error };
  }
}
```

#### 1-2. 전체 담당자 일괄 토글 API (오너 전용)
```typescript
/**
 * 모든 담당자 완료 상태 일괄 변경
 * 권한: 그룹 오너만
 */
export async function toggleAllAssigneesCompletion(
  taskId: string,
  isCompleted: boolean
): Promise<{ error: Error | null }> {
  try {
    // 1. 모든 task_assignees 업데이트
    const { error: assigneeError } = await supabase
      .from('task_assignees')
      .update({
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
      })
      .eq('task_id', taskId);

    if (assigneeError) throw assigneeError;

    // 2. task.status 업데이트
    const { error: taskError } = await supabase
      .from('tasks')
      .update({
        status: isCompleted ? 'DONE' : 'TODO',
        completed_at: isCompleted ? new Date().toISOString() : null,
      })
      .eq('id', taskId);

    if (taskError) throw taskError;

    return { error: null };
  } catch (error) {
    console.error('[toggleAllAssigneesCompletion] Error:', error);
    return { error: error as Error };
  }
}
```

#### 1-3. 권한 확인 유틸리티
```typescript
/**
 * 담당자 토글 권한 확인
 */
export function canToggleAssignee(
  task: Task,
  targetUserId: string,
  currentUserId: string,
  userRole?: 'OWNER' | 'MEMBER'
): boolean {
  // 개인 태스크는 기존 로직 사용
  if (!task.group_id) return false;

  // 그룹 오너는 모든 담당자 토글 가능
  if (userRole === 'OWNER') return true;

  // 자신의 상태만 토글 가능
  return targetUserId === currentUserId;
}
```

---

### Phase 2: UI 컴포넌트 개발

#### 2-1. AssigneeAvatars 컴포넌트 개선

**파일**: `components/AssigneeAvatars.tsx`

```typescript
import { View, Text, Pressable } from 'react-native';
import { useState } from 'react';

interface Assignee {
  user_id: string;
  is_completed: boolean;
  completed_at: string | null;
  profile: {
    nickname: string;
    avatar_url: string | null;
  } | null;
}

interface AssigneeAvatarsProps {
  assignees: Assignee[];
  taskId: string;
  groupId: string;
  currentUserId: string;
  userRole?: 'OWNER' | 'MEMBER';
  showCompletionRate?: boolean; // 일간뷰에서만 true
  onToggle?: () => void; // 토글 후 refetch
}

export function AssigneeAvatars({
  assignees,
  taskId,
  currentUserId,
  userRole,
  showCompletionRate = false,
  onToggle,
}: AssigneeAvatarsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleAssigneeClick = async (assignee: Assignee) => {
    // 권한 확인
    const canToggle = userRole === 'OWNER' || assignee.user_id === currentUserId;
    if (!canToggle) return;

    setLoading(assignee.user_id);
    try {
      const { error } = await toggleAssigneeCompletion(
        taskId,
        assignee.user_id,
        !assignee.is_completed
      );

      if (!error) {
        onToggle?.();
      }
    } finally {
      setLoading(null);
    }
  };

  const completionRate = {
    completed: assignees.filter(a => a.is_completed).length,
    total: assignees.length,
  };

  return (
    <View className="flex-row items-center gap-1">
      {/* 담당자 이니셜 */}
      {assignees.map(assignee => {
        const initial = assignee.profile?.nickname?.[0] || '?';
        const canInteract = userRole === 'OWNER' || assignee.user_id === currentUserId;

        return (
          <Pressable
            key={assignee.user_id}
            onPress={() => handleAssigneeClick(assignee)}
            disabled={!canInteract || loading === assignee.user_id}
            className={`
              w-6 h-6 rounded-full items-center justify-center
              ${assignee.is_completed ? 'bg-green-500' : 'bg-gray-300'}
              ${canInteract ? 'opacity-100' : 'opacity-60'}
            `}
          >
            <Text className="text-xs font-semibold text-white">
              {initial}
            </Text>
          </Pressable>
        );
      })}

      {/* 완료율 (일간뷰) */}
      {showCompletionRate && (
        <Text className="text-xs text-gray-600 ml-1">
          {completionRate.completed}/{completionRate.total}
        </Text>
      )}
    </View>
  );
}
```

#### 2-2. 주간뷰 TaskCard 수정

**파일**: `app/(tabs)/index.tsx` (WeekScreen)

```typescript
// TaskCard 내부
{task.group_id && task.assignees && task.assignees.length > 0 && (
  <AssigneeAvatars
    assignees={task.assignees}
    taskId={task.id}
    groupId={task.group_id}
    currentUserId={user.id}
    userRole={getUserRoleInGroup(task.group_id)}
    onToggle={() => refetch()}
  />
)}
```

#### 2-3. 체크박스 로직 수정

```typescript
const handleTaskToggle = async (task: Task) => {
  // 개인 태스크: 기존 로직
  if (!task.group_id) {
    // 기존 코드 유지
    return;
  }

  // 그룹 태스크: 새 로직
  const userRole = getUserRoleInGroup(task.group_id);
  
  if (userRole === 'OWNER') {
    // 오너: 전체 담당자 토글
    const allCompleted = task.assignees?.every(a => a.is_completed) ?? false;
    await toggleAllAssigneesCompletion(task.id, !allCompleted);
  } else {
    // 멤버: 자신의 상태만 토글
    const myAssignment = task.assignees?.find(a => a.user_id === user.id);
    if (myAssignment) {
      await toggleAssigneeCompletion(
        task.id,
        user.id,
        !myAssignment.is_completed
      );
    }
  }

  refetch();
};
```

---

### Phase 3: 유틸리티 함수

#### 3-1. 완료율 계산
```typescript
export function getCompletionRate(assignees: Assignee[]) {
  const completed = assignees.filter(a => a.is_completed).length;
  const total = assignees.length;
  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}
```

#### 3-2. 그룹 내 역할 조회
```typescript
export function getUserRoleInGroup(
  groupId: string,
  groups: Group[]
): 'OWNER' | 'MEMBER' | null {
  const group = groups.find(g => g.id === groupId);
  return group?.myRole || null;
}
```

---

## 🧪 테스트 시나리오

### 1. 담당자 토글 (멤버)
- [ ] 멤버가 자신의 이니셜 클릭 → 완료/미완료 토글
- [ ] 다른 담당자 이니셜 클릭 → 반응 없음
- [ ] 모든 담당자 완료 → task.status = 'DONE'

### 2. 담당자 토글 (오너)
- [ ] 오너가 모든 담당자 이니셜 클릭 가능
- [ ] 각 담당자 개별 토글 가능
- [ ] 부분 완료 → task.status = 'TODO'

### 3. 체크박스 (오너)
- [ ] 체크박스 클릭 → 모든 담당자 일괄 완료
- [ ] 다시 클릭 → 모든 담당자 일괄 미완료
- [ ] 이니셜 상태와 싱크

### 4. 체크박스 (멤버)
- [ ] 체크박스 클릭 → 자신의 상태만 토글
- [ ] 다른 담당자 상태 유지

### 5. UI 표시
- [ ] 주간뷰: 이니셜 + 완료 상태 색상
- [ ] 일간뷰: 이니셜 + 완료율 (2/3)
- [ ] 완료 담당자: 초록색, 미완료: 회색

### 6. 엣지 케이스
- [ ] 담당자 없는 그룹 태스크 → 오너만 완료 가능
- [ ] 개인 태스크 → 기존 로직 동작
- [ ] 권한 없는 사용자 클릭 → 반응 없음

---

## 📦 구현 순서

1. ✅ API 함수 작성
   - `toggleAssigneeCompletion`
   - `toggleAllAssigneesCompletion`
   - `canToggleAssignee`

2. ✅ AssigneeAvatars 컴포넌트
   - 클릭 가능하게 수정
   - 완료 상태 시각화
   - 권한별 스타일링

3. ✅ 주간뷰 통합
   - TaskCard에 AssigneeAvatars 추가
   - 체크박스 로직 수정

4. ✅ 일간뷰 통합 (나중)
   - 완료율 표시 추가

5. ✅ 테스트
   - 각 시나리오 검증

---

## 🚀 시작!

이제 Phase 1 (API 개발)부터 시작하겠습니다!
