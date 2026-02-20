# due_date / original_due_date 로직 (참고용)

이 문서는 **due_date**와 **original_due_date**의 갱신 규칙과, 롤오버/지연 계산·UI 안내를 수정할 때 참고하기 위한 자료입니다.

---

## 1. 필드 의미

| 필드 | 의미 | 갱신 규칙 |
|------|------|------------|
| **due_date** | 현재 예정일. `NULL` = 백로그(날짜 없음) | 백로그 이동·날짜 설정·날짜 변경 시 갱신 |
| **original_due_date** | “기준 마감일”(롤오버/지연/늦게 완료 계산용) | **백로그 ↔ 날짜 전환 시에만** 갱신. **날짜만 변경할 때는 유지** |

- **롤오버 (+Nd)**: `calculateRolloverInfo()`에서 `original_due_date`와 오늘의 차이로 `daysOverdue` 계산.
- **지연 통계**: `getUserStats()` 등에서 `original_due_date || due_date`를 기준일로 사용.
- **늦게 완료**: 완료일 − 기준일 계산 시 `original_due_date || due_date` 사용.

---

## 2. 갱신 규칙 (반드시 준수)

| 상황 | due_date | original_due_date |
|------|----------|--------------------|
| **일정 → 백로그** | `null` | `null` |
| **백로그 → 특정일** | 그날 | 그날 |
| **이미 날짜 있는 일정의 날짜만 변경** | 변경 | **유지** (변경하지 않음) |

- **백로그로 이동**: “날짜 없음” 상태로 리셋 → 둘 다 `null`.
- **백로그에서 날짜 부여**: “그날이 처음 마감일” → 둘 다 그날.
- **날짜만 수정**: “원래 마감일”은 그대로 두고 현재 예정일만 변경 → `due_date`만 전달, `original_due_date`는 API/클라이언트 모두에서 건드리지 않음.

---

## 3. 사용자 안내 (토스트, 영어)

모든 이동/일정 변경 시 사용자에게 영어로 안내합니다.

| 상황 | 토스트 (title / message) |
|------|---------------------------|
| **백로그로 이동** | `Moved to backlog` / `Task moved to backlog.` |
| **백로그 → 오늘** | `Scheduled for today` / `Task scheduled for today.` |
| **백로그 → 특정일 (편집 시트)** | `Scheduled` / `Task scheduled for [MMM d, yyyy].` |
| **날짜만 변경 (편집 시트)** | `Rescheduled` / `Task rescheduled to [MMM d, yyyy].` |
| **기타 수정** | `Updated` / `Task updated.` |

---

## 4. 코드 위치 (수정 시 참고)

### 4.1 API

| 처리 | 파일 | 함수/내용 |
|------|------|------------|
| 백로그로 이동 | `lib/api/tasks.ts` | `moveTaskToBacklog(taskId)` → `updateTask({ id, due_date: null, original_due_date: null })` |
| 태스크 수정 (공통) | `lib/api/tasks.ts` | `updateTask(input)` — 전달된 필드만 DB 반영. 날짜만 바꿀 때는 `original_due_date` 넘기지 않음 |
| 롤오버/지연 계산 | `lib/api/tasks.ts` | `calculateRolloverInfo()` — `original_due_date` 기준 `daysOverdue` |
| 지연 통계 | `lib/api/tasks.ts` | `getUserStats()` — 기준일 = `original_due_date \|\| due_date` |

### 4.2 백로그로 이동 (둘 다 null)

| 위치 | 내용 |
|------|------|
| `lib/api/tasks.ts` | `moveTaskToBacklog()` 에서 `original_due_date: null` 포함 |
| `app/(tabs)/index.tsx` | 스와이프 백로그: `updateTaskInStore(..., { due_date: null, original_due_date: null })` 후 `moveTaskToBacklog()` |
| `app/day.tsx` | 스와이프 백로그: `updateTaskInStore(..., { due_date: null, original_due_date: null })` |
| `components/EditTaskBottomSheet.tsx` | Move to Backlog: 낙관 업데이트에 `original_due_date: null` 포함, API는 `moveTaskToBacklog()` |

### 4.3 백로그 → 특정일 (둘 다 그날)

| 위치 | 내용 |
|------|------|
| `app/(tabs)/backlog.tsx` | “Schedule for today”: `updateTask({ id, due_date: today, original_due_date: today })`, 낙관 업데이트에도 둘 다 `today` |
| `components/EditTaskBottomSheet.tsx` | 저장 시 `wasBacklog && dueDateStr` 이면 `updateTask`에 `original_due_date: dueDateStr` 포함, 낙관 업데이트에도 반영 |

### 4.4 날짜만 변경 (due_date만, original_due_date 유지)

| 위치 | 내용 |
|------|------|
| `components/EditTaskBottomSheet.tsx` | 저장 시 이미 날짜 있는 태스크(`!wasBacklog`)는 `due_date`만 전달, `original_due_date` 미포함 |
| `lib/api/tasks.ts` | `postponeTask` / `postponeTaskToDate` — `due_date`만 업데이트 (동일 규칙) |
| `lib/api/tasks.ts` | `moveTaskToToday()` — `due_date`만 전달 (이미 날짜 있는 일정 “오늘로” 이동 시) |

### 4.5 타입

| 파일 | 내용 |
|------|------|
| `lib/types.ts` | `UpdateTaskInput` 에 `original_due_date?: string \| null` (백로그↔날짜 전환 시에만 전달) |

### 4.6 표시/정렬

| 파일 | 내용 |
|------|------|
| `lib/utils/task-filtering.ts` | `groupTasksByDate()` — 정렬 키 `original_due_date \|\| due_date \|\| created_at` |
| `app/day.tsx` / `app/(tabs)/index.tsx` | 늦게 완료 일수: 기준일 = `original_due_date \|\| due_date` |

---

## 5. 시나리오 요약

- **2/10 일정 생성**  
  → `due_date = 2/10`, `original_due_date = 2/10` (생성 시 둘 다 설정)

- **2/10 → 2/12 로 날짜만 수정**  
  → `due_date = 2/12`, `original_due_date = 2/10` 유지 → 롤오버/지연은 2/10 기준

- **2/10 일정을 백로그로 이동**  
  → `due_date = null`, `original_due_date = null`

- **백로그에서 2/15 로 스케줄**  
  → `due_date = 2/15`, `original_due_date = 2/15`  
  → 이후 2/20 으로 수정하면 `due_date = 2/20`, `original_due_date = 2/15` 유지

---

## 6. 수정 시 체크리스트

- [ ] 백로그로 보낼 때 `due_date`와 `original_due_date` 둘 다 `null`로 보내는가?
- [ ] 백로그에서 날짜를 넣을 때 둘 다 그날로 설정하는가? (백로그 화면 “오늘로” + 편집 시트에서 날짜 선택)
- [ ] 이미 날짜 있는 일정의 날짜만 바꿀 때 `original_due_date`를 넘기지 않는가?
- [ ] 이동/일정 변경 시 토스트가 영어로 위 표와 맞게 나오는가?
