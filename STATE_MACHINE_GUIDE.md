# Task State Machine 가이드

## 📊 상태 전이 규칙 (State Transition Rules)

### ✅ 허용되는 전이 (Allowed)
```
TODO ↔ DONE      (완료 및 완료 취소)
TODO ↔ CANCEL    (취소 및 취소 복구)
Any → DELETED    (소프트 삭제)
```

### ❌ 금지되는 전이 (Blocked)
```
DONE ↔ CANCEL    (직접 전환 불가)
```

**이유**: 데이터 무결성을 위해 DONE과 CANCEL 간 직접 전환을 금지합니다.
변경하려면 반드시 TODO를 거쳐야 합니다.

---

## 🎨 상태별 UI 인터랙션

### **TODO 상태**
- ✅ **탭(Tap)**: TODO → DONE
- ✅ **오른쪽 스와이프**: TODO → DONE (초록색 "완료" 버튼)
- ✅ **왼쪽 스와이프**: 
  - 회색 "취소" 버튼: TODO → CANCEL
  - 빨간색 "삭제" 버튼: Soft Delete

### **DONE 상태**
- ✅ **탭(Tap)**: DONE → TODO (복구)
- ❌ **스와이프**: 비활성화
- 💡 **힌트**: "탭하여 TODO로 복구" 표시

### **CANCEL 상태**
- ✅ **탭(Tap)**: CANCEL → TODO (복구)
- ❌ **스와이프**: 비활성화
- 💡 **힌트**: "탭하여 TODO로 복구" 표시

---

## 🛡️ 검증 시스템

### State Machine Functions
`lib/api/task-state-machine.ts`에 구현된 검증 함수:

#### 1. `isValidStateTransition(current, target)`
```typescript
// 상태 전이가 허용되는지 검증
isValidStateTransition('TODO', 'DONE')     // true
isValidStateTransition('DONE', 'TODO')     // true
isValidStateTransition('DONE', 'CANCEL')   // false ❌
```

#### 2. `validateStateTransition(current, target)`
```typescript
// 검증 + 에러 메시지 반환
const result = validateStateTransition('DONE', 'CANCEL');
// { valid: false, error: "완료↔취소 간 직접 전환은 불가능합니다..." }
```

#### 3. `getAllowedActions(status)`
```typescript
// 상태별 허용되는 액션 반환
getAllowedActions('TODO')
// {
//   canSwipeRight: true,
//   canSwipeLeft: true,
//   tapAction: 'toggle'
// }

getAllowedActions('DONE')
// {
//   canSwipeRight: false,
//   canSwipeLeft: false,
//   tapAction: 'restore'
// }
```

---

## 🎯 사용자 시나리오

### 시나리오 1: 완료 처리
1. TODO 태스크 탭 → DONE
2. 또는 오른쪽 스와이프 → "완료" 버튼

**결과**: 굵은 취소선 + 초록 체크박스

### 시나리오 2: 완료 취소
1. DONE 태스크 탭 → TODO
2. 다시 작업 가능 상태로 복구

### 시나리오 3: 취소 처리
1. TODO 태스크 왼쪽 스와이프
2. "취소" 버튼 탭 → CANCEL

**결과**: 연한 회색 취소선 + 회색 X 표시

### 시나리오 4: 취소 복구
1. CANCEL 태스크 탭 → TODO
2. 다시 작업 가능 상태로 복구

### 시나리오 5: 완료 → 취소로 변경하고 싶을 때
❌ **불가능**: DONE → CANCEL 직접 전환 불가

✅ **해결 방법**:
1. DONE 태스크 탭 → TODO (복구)
2. TODO 태스크 왼쪽 스와이프 → "취소" 버튼
3. CANCEL 상태로 변경

---

## 🔧 구현 세부사항

### TaskItem 컴포넌트 로직

```typescript
// 1. State Machine에서 허용 액션 가져오기
const allowedActions = getAllowedActions(task.status);

// 2. 탭 동작
const handlePress = () => {
  if (allowedActions.tapAction === 'toggle') {
    changeStatus('DONE');  // TODO → DONE
  } else if (allowedActions.tapAction === 'restore') {
    changeStatus('TODO');   // DONE/CANCEL → TODO
  }
};

// 3. 조건부 Swipeable 렌더링
if (task.status === 'TODO') {
  return <Swipeable>{content}</Swipeable>;
}
return content; // DONE/CANCEL은 Swipeable 없음
```

### 상태 변경 시 검증
```typescript
const changeStatus = async (targetStatus: TaskStatus) => {
  // 검증
  const validation = validateStateTransition(task.status, targetStatus);
  
  if (!validation.valid) {
    Alert.alert('상태 변경 불가', validation.error);
    return;
  }

  // 변경
  await updateTask({ id: task.id, status: targetStatus });
};
```

---

## 📊 상태 다이어그램

```
       ┌─────────┐
       │  TODO   │ ◄──┐
       └─────────┘    │
         │  ▲  │      │
         │  │  │      │
     DONE│  │  │CANCEL│
         ▼  │  ▼      │
       ┌─────────┐  ┌─────────┐
       │  DONE   │  │ CANCEL  │
       └─────────┘  └─────────┘
             ▲          ▲
             │          │
             └──────────┘
               RESTORE
```

---

## 🐛 문제 해결

### Q: DONE 상태에서 스와이프가 안 돼요
**A**: 의도된 동작입니다. DONE 상태에서는 스와이프가 비활성화됩니다.
복구하려면 태스크를 탭하여 TODO로 변경하세요.

### Q: 완료된 태스크를 취소로 바꾸고 싶어요
**A**: 직접 전환은 불가능합니다. 다음 단계를 따르세요:
1. DONE 태스크 탭 → TODO
2. 왼쪽 스와이프 → "취소" 버튼

### Q: 왜 DONE ↔ CANCEL 직접 전환을 막나요?
**A**: 데이터 무결성을 위함입니다. 완료와 취소는 서로 다른 의미이므로,
중간에 TODO 상태를 거쳐 명시적으로 변경하도록 설계했습니다.

---

## 🎨 상태별 스타일

```typescript
// TODO
text-gray-900 dark:text-white

// DONE
text-gray-900 dark:text-white font-bold line-through

// CANCEL
text-gray-300 dark:text-gray-600 line-through
```

---

## 🔮 향후 확장 가능성

### 1. 상태 추가
- `IN_PROGRESS`: 진행 중 상태
- `BLOCKED`: 차단됨 상태

### 2. 히스토리 추적
```typescript
interface TaskHistory {
  task_id: string;
  from_status: TaskStatus;
  to_status: TaskStatus;
  changed_at: string;
}
```

### 3. 권한별 상태 전이 제한
```typescript
// 예: 매니저만 CANCEL → TODO 복구 가능
if (user.role !== 'manager' && currentStatus === 'CANCEL') {
  return { valid: false, error: '권한이 없습니다' };
}
```
