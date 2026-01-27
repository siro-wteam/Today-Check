# 그룹 일정 Done 처리 로직 개발 계획

## 📋 요구사항 정리

### 1️⃣ 담당자 시스템
- 그룹 일정에 여러 담당자 할당 가능
- 각 담당자별로 개별 완료 상태 관리 (`task_assignees.is_completed`)

### 2️⃣ 완료 처리 권한
| 역할 | 권한 |
|------|------|
| **담당자** | 자신의 완료 상태만 토글 가능 |
| **그룹 오너** | 모든 담당자의 완료 상태 토글 가능 |
| **그룹 멤버** | 자신이 담당자인 경우만 자신의 상태 토글 |

### 3️⃣ 일정 완료 조건
```
모든 담당자 완료 → task.status = 'DONE'
일부만 완료 → task.status = 'TODO' (부분 완료)
```

### 4️⃣ UI 표시
- **주간뷰**: 담당자 이니셜만 (완료/미완료 표시)
- **일간뷰**: 담당자 이니셜 + 완료율 (예: `2/3 완료`)

### 5️⃣ 체크박스 동작
- **오너가 체크박스 클릭**:
  - 현재 상태가 전체 완료 → 전체 미완료 처리
  - 현재 상태가 미완료/부분완료 → 전체 완료 처리
- 담당자 이니셜 상태와 체크박스 상태 싱크

---

## 🔍 개발 전 검토 사항

### ✅ 1. 현재 DB 스키마 확인

#### task_assignees 테이블
```sql
CREATE TABLE task_assignees (
  task_id UUID NOT NULL,
  user_id UUID NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);
```

**확인 결과**: ✅ 구조 적합
- `is_completed`: 개별 담당자 완료 상태
- `completed_at`: 완료 시각 기록

---

### ⚠️ 2. RLS 정책 확인 필요

#### 현재 정책
```sql
-- 조회 정책
CREATE POLICY "Users can view task assignees for their tasks"
  ON task_assignees FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tasks t
      INNER JOIN group_members gm ON gm.group_id = t.group_id
      WHERE t.id = task_assignees.task_id
      AND gm.user_id = auth.uid()
    )
  );

-- 수정 정책
CREATE POLICY "Users can update their own assignment completion"
  ON task_assignees FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**문제점**: ❌ 오너가 다른 담당자의 완료 상태를 변경할 수 없음

**필요한 수정**:
```sql
-- 오너도 그룹 태스크의 담당자 상태를 변경할 수 있도록
CREATE POLICY "Owner can update any assignee completion in their group"
  ON task_assignees FOR UPDATE
  USING (
    -- 자신의 상태는 항상 수정 가능
    auth.uid() = user_id
    OR
    -- 그룹 오너는 모든 담당자 상태 수정 가능
    EXISTS (
      SELECT 1 FROM tasks t
      INNER JOIN groups g ON g.id = t.group_id
      WHERE t.id = task_assignees.task_id
      AND g.owner_id = auth.uid()
    )
  );
```

---

### ✅ 3. API 함수 필요 사항

#### 3-1. 담당자 완료 상태 토글
```typescript
// 개별 담당자 완료 상태 토글
async function toggleAssigneeCompletion(
  taskId: string,
  userId: string,
  isCompleted: boolean
): Promise<{ error?: Error }>
```

#### 3-2. 전체 담당자 완료 상태 일괄 변경 (오너 전용)
```typescript
// 모든 담당자 완료/미완료 일괄 처리
async function toggleAllAssigneesCompletion(
  taskId: string,
  isCompleted: boolean
): Promise<{ error?: Error }>
```

#### 3-3. 태스크 상태 자동 업데이트
```typescript
// 담당자 완료 상태에 따라 task.status 자동 업데이트
// 모두 완료 → 'DONE', 일부만 완료 → 'TODO'
async function updateTaskStatusFromAssignees(
  taskId: string
): Promise<{ error?: Error }>
```

---

### ✅ 4. UI 컴포넌트 수정 사항

#### 4-1. AssigneeAvatars 컴포넌트 개선
```typescript
// 현재: 단순 표시용
// 필요: 클릭 가능 + 완료 상태 토글

interface AssigneeAvatarsProps {
  assignees: TaskAssignee[];
  taskId: string;
  isOwner: boolean; // 오너인지 여부
  currentUserId: string;
  showCompletionRate?: boolean; // 일간뷰에서만 true
  onAssigneeClick: (userId: string) => void;
}
```

**기능**:
- 담당자 이니셜 클릭 → 완료 상태 토글
- 오너: 모든 담당자 클릭 가능
- 멤버: 자신만 클릭 가능
- 완료된 담당자: 체크 표시 또는 스타일 변경

#### 4-2. 주간뷰 TaskCard
- 담당자 이니셜 표시
- 완료/미완료 시각적 구분
- 클릭 핸들러 연결

#### 4-3. 일간뷰 TaskCard
- 담당자 이니셜 + 완료율 표시
- 예: `👤A ✓  👤B ✗  👤C ✓  (2/3)`

#### 4-4. 체크박스 동작
```typescript
// 현재: task.status만 변경
// 필요: task_assignees + task.status 모두 변경

const handleCheckboxClick = async () => {
  if (isOwner) {
    // 전체 담당자 상태 토글
    const allCompleted = assignees.every(a => a.is_completed);
    await toggleAllAssigneesCompletion(taskId, !allCompleted);
  } else {
    // 자신의 상태만 토글
    const myAssignment = assignees.find(a => a.user_id === currentUserId);
    if (myAssignment) {
      await toggleAssigneeCompletion(taskId, currentUserId, !myAssignment.is_completed);
    }
  }
};
```

---

### ✅ 5. 상태 관리 로직

#### 5-1. 완료율 계산
```typescript
function getCompletionRate(assignees: TaskAssignee[]): {
  completed: number;
  total: number;
  percentage: number;
} {
  const completed = assignees.filter(a => a.is_completed).length;
  const total = assignees.length;
  return {
    completed,
    total,
    percentage: Math.round((completed / total) * 100)
  };
}
```

#### 5-2. 태스크 상태 결정
```typescript
function determineTaskStatus(assignees: TaskAssignee[]): 'TODO' | 'DONE' {
  const allCompleted = assignees.every(a => a.is_completed);
  return allCompleted ? 'DONE' : 'TODO';
}
```

---

### ⚠️ 6. 트리거 또는 로직 필요 여부

#### Option 1: DB 트리거 (권장)
```sql
-- task_assignees 변경 시 자동으로 task.status 업데이트
CREATE OR REPLACE FUNCTION update_task_status_from_assignees()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tasks
  SET 
    status = CASE
      WHEN (
        SELECT COUNT(*) = COUNT(*) FILTER (WHERE is_completed = true)
        FROM task_assignees
        WHERE task_id = NEW.task_id
      ) THEN 'DONE'
      ELSE 'TODO'
    END,
    completed_at = CASE
      WHEN (
        SELECT COUNT(*) = COUNT(*) FILTER (WHERE is_completed = true)
        FROM task_assignees
        WHERE task_id = NEW.task_id
      ) THEN NOW()
      ELSE NULL
    END
  WHERE id = NEW.task_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_task_status
AFTER INSERT OR UPDATE ON task_assignees
FOR EACH ROW
EXECUTE FUNCTION update_task_status_from_assignees();
```

**장점**: 자동화, 일관성 보장
**단점**: DB 로직 증가

#### Option 2: API에서 처리
API 함수 내에서 담당자 상태 변경 후 태스크 상태 업데이트

**장점**: 로직이 명시적
**단점**: 두 번의 쿼리 필요

---

### ✅ 7. 권한 확인 로직

```typescript
function canToggleAssignee(
  task: Task,
  targetUserId: string,
  currentUserId: string,
  userRole: 'OWNER' | 'MEMBER'
): boolean {
  // 오너는 모든 담당자 토글 가능
  if (userRole === 'OWNER') return true;
  
  // 자신의 상태만 토글 가능
  return targetUserId === currentUserId;
}
```

---

### ⚠️ 8. 엣지 케이스

1. **담당자가 없는 그룹 태스크**
   - 허용할 것인가? → 아마도 NO (최소 1명 필요)

2. **담당자 제거 시**
   - 완료 상태는 어떻게? → 해당 assignee 레코드 삭제

3. **개인 태스크 vs 그룹 태스크**
   - 개인 태스크는 기존 로직 유지
   - 그룹 태스크만 새 로직 적용

4. **완료 후 다시 미완료 처리**
   - `completed_at = null`로 설정

---

## 📝 개발 순서 (권장)

### Phase 1: DB 준비
1. ✅ RLS 정책 수정 (오너 권한 추가)
2. ✅ DB 트리거 생성 (자동 status 업데이트)
3. ✅ Migration 작성 및 적용

### Phase 2: API 개발
1. ✅ `toggleAssigneeCompletion` 함수
2. ✅ `toggleAllAssigneesCompletion` 함수
3. ✅ 권한 검증 로직

### Phase 3: UI 개발
1. ✅ `AssigneeAvatars` 컴포넌트 개선
2. ✅ 주간뷰 통합
3. ✅ 일간뷰 통합 (완료율 추가)
4. ✅ 체크박스 로직 수정

### Phase 4: 테스트
1. ✅ 오너가 담당자 상태 변경
2. ✅ 멤버가 자신의 상태만 변경
3. ✅ 전체 완료 → DONE 자동 전환
4. ✅ 부분 완료 → TODO 유지
5. ✅ 체크박스와 이니셜 싱크

---

## 🚨 주의사항

1. **기존 개인 태스크와의 호환성**
   - `group_id = null`인 태스크는 기존 로직 유지
   - 조건부 렌더링 필요

2. **성능**
   - 담당자가 많을 경우 (10+) UI 성능 고려
   - 일괄 업데이트 API 사용

3. **UX**
   - 누가 완료했는지 명확히 표시
   - 로딩 상태 표시
   - 에러 핸들링

---

## ✅ 검토 체크리스트

- [ ] 요구사항 이해 확인
- [ ] DB 스키마 적합성 확인
- [ ] RLS 정책 수정 필요 확인
- [ ] API 함수 목록 작성
- [ ] UI 컴포넌트 수정 범위 파악
- [ ] 트리거 vs API 로직 결정
- [ ] 엣지 케이스 검토
- [ ] 개발 순서 합의

---

## ✅ 결정 사항

### 1. DB 트리거 vs API 로직
**결정: API 로직 사용** ✅
- 이유: DB 의존성 최소화, 유지보수 용이
- 구현: API에서 담당자 상태 변경 후 task.status 업데이트

### 2. 담당자 없는 그룹 태스크
**결정: 허용** ✅
- 오너만 완료 처리 가능
- 담당자 없어도 그룹 일정 생성 가능

### 3. 개인 태스크 처리
**결정: 기존 로직 유지 (group_id로 구분)** ✅
- 이유:
  - 개인 태스크는 단순해야 함 (다중 담당자 불필요)
  - 기존 데이터 안정성 유지
  - 명확한 구분 (`group_id IS NULL` vs `NOT NULL`)
  - 각 로직 독립적, 유지보수 용이
- 구현:
  ```typescript
  if (task.group_id) {
    // 그룹: task_assignees 로직
  } else {
    // 개인: 기존 task.status 로직
  }
  ```

### 4. UI 개발 우선순위
**결정: 주간뷰 먼저** ✅
- Phase 3-1: 주간뷰 (이니셜만)
- Phase 3-2: 일간뷰 (이니셜 + 완료율)

---

## 🚀 개발 시작 준비 완료!

모든 결정이 완료되었으므로 바로 개발을 시작할 수 있습니다.
