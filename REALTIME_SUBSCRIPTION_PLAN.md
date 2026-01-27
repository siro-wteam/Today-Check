# Realtime 구독 방식 구현 계획

## 📊 현재 vs Realtime 구독 비교

### 현재 방식 (DB SELECT)
```
1. UPDATE task_assignees (1 API)
2. SELECT task_assignees (1 API) ← 제거 가능!
3. UPDATE tasks (1 API)
총: 3 API 호출
```

### Realtime 구독 방식
```
1. UPDATE task_assignees (1 API)
2. UPDATE tasks (1 API)
총: 2 API 호출

+ Realtime 구독이 자동으로:
  - 다른 사용자의 변경사항 감지
  - React Query 캐시 자동 업데이트
  - task status 계산 및 업데이트
```

---

## 🔧 구현 방법

### 1. Realtime 구독 Hook 생성
✅ `lib/hooks/use-task-realtime.ts` 생성 완료

### 2. `toggleAssigneeCompletion` 최적화
- SELECT 제거
- task status 계산을 구독 핸들러로 이동
- 또는 DB trigger 사용 (하지만 API 로직 선호)

### 3. 앱에 구독 적용
- 주간뷰, 일간뷰, 백로그뷰에 구독 추가
- 또는 전역적으로 한 번만 구독

---

## 💡 구현 옵션

### 옵션 A: 구독 핸들러에서 task status 업데이트
```typescript
// Realtime 구독 핸들러
.on('UPDATE', async (payload) => {
  // 1. 최신 assignees 가져오기
  const latestAssignees = await fetchLatestAssignees(taskId);
  
  // 2. task status 계산
  const allCompleted = latestAssignees.every(a => a.is_completed);
  
  // 3. task status 업데이트
  await updateTaskStatus(taskId, allCompleted ? 'DONE' : 'TODO');
  
  // 4. React Query 캐시 업데이트
  queryClient.setQueriesData(...);
})
```

**장점:**
- `toggleAssigneeCompletion`에서 SELECT 제거 가능
- 모든 변경사항을 구독에서 일관되게 처리

**단점:**
- 구독 핸들러가 복잡해짐
- 자신의 변경도 구독을 받아서 중복 처리 가능

### 옵션 B: Optimistic Update + 구독으로 동기화
```typescript
// toggleAssigneeCompletion
1. UPDATE task_assignees
2. Optimistic Update (로컬 캐시)
3. UPDATE tasks (status 계산은 여전히 필요)

// Realtime 구독
- 다른 사용자의 변경사항만 처리
- 자신의 변경은 Optimistic Update로 이미 처리됨
```

**장점:**
- 구현 간단
- 자신의 변경은 즉시 반영 (Optimistic)
- 다른 사용자의 변경은 구독으로 자동 동기화

**단점:**
- 여전히 SELECT 필요 (task status 계산)

---

## 🎯 추천: 옵션 B (하이브리드)

1. **자신의 변경**: Optimistic Update + SELECT + task status 업데이트
2. **다른 사용자의 변경**: Realtime 구독으로 자동 동기화

이렇게 하면:
- ✅ 자신의 변경은 즉시 반영 (Optimistic)
- ✅ 다른 사용자의 변경은 실시간 동기화
- ✅ 구현 복잡도 적당
- ✅ API 호출: 3개 → 2개 (SELECT 제거 가능하지만, task status 계산 필요)

---

## 📝 다음 단계

1. ✅ `use-task-realtime.ts` Hook 생성 완료
2. ⏳ 앱에 구독 적용 (주간뷰, 일간뷰 등)
3. ⏳ `toggleAssigneeCompletion` 최적화 (선택적)
