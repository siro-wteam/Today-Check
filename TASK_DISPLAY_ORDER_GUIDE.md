# 할일 노출·정렬 로직 가이드

할일이 **어디에, 어떤 순서로** 노출되는지 정리한 문서입니다.

---

## 1. 데이터 소스와 API 정렬

### 1.1 주간/일별 뷰 (캘린더)

- **소스**: `useCalendarStore`의 `tasks` (초기값은 `getAllTasksInRange`로 채워짐)
- **API**: `lib/api/tasks.ts` → `getAllTasksInRange(startDate, endDate)`
  - 조건: `due_date`가 구간 안 **또는** `status = DONE` 이고 `completed_at`이 구간 안
  - **정렬**: `due_date` ↑ → `due_time` ↑ (nullsLast) → `created_at` ↑

즉, 서버에서 내려올 때 이미 **due_date → due_time → created_at** 순으로 정렬된 배열이 옵니다.

---

## 2. 날짜별 그룹핑 (groupTasksByDate)

**파일**: `lib/utils/task-filtering.ts` → `groupTasksByDate(tasks)`

결과: `Map<날짜문자열, TaskWithOverdue[]>`  
날짜 문자열은 `yyyy-MM-dd`.

### 2.1 어떤 할일이 어떤 날짜에 붙는지

| 상태   | 조건              | 노출 위치                    |
|--------|-------------------|-----------------------------|
| DONE   | `completed_at` 있음 | **completed_at 날짜**에 표시 |
| TODO   | `due_date` < 오늘   | **오늘**에만 표시 (롤오버)   |
| TODO   | `due_date` ≥ 오늘   | **due_date**에 표시         |
| CANCEL | (due_date 기준)    | **due_date**에 표시         |

- **롤오버**: 미완료(TODO)인데 예정일이 지난 과제는 **오늘** 날짜에만 모아서 표시하고, `isOverdue`, `daysOverdue`로 지연 정보를 붙입니다.
- **DONE**은 “완료한 날” 기준으로만 모으고, `due_date`가 아닌 `completed_at` 날짜로 그룹됩니다.

### 2.2 날짜 버킷 내 정렬 (status 미반영)

**모든 날짜 버킷**에 같은 정렬을 적용합니다. 정렬 키에 **status(TODO/DONE)를 넣지 않아**, 완료/미완료 토글 시 노출 순서가 바뀌지 않습니다.

1. **기준일**: `original_due_date` → 없으면 `due_date` → 없으면 `created_at` (갱신 규칙은 [DUE_DATE_ORIGINAL_DUE_DATE_LOGIC.md](./DUE_DATE_ORIGINAL_DUE_DATE_LOGIC.md) 참고)
2. 위 날짜 기준 **오름차순**
3. 같은 경우 `due_time` 문자열 비교
4. 그다음 `created_at` 문자열 비교
5. 동점이면 `id` 문자열 비교 (안정 정렬)

**미래 일정을 오늘 완료한 경우**: 해당 일정은 **오늘** 버킷에 들어가고(completed_at = 오늘), 정렬 시에는 **원래 예정일(original_due_date/due_date)** 로 순서가 정해집니다. 따라서 오늘 버킷 안에서는 “예정일이 빠른 순” → “예정일이 늦은 순”이 되어, **미래에 잡혀 있던 일정은 오늘 목록의 뒤쪽**에 위치합니다.

---

## 3. 화면별 노출 순서

### 3.1 주간 뷰 (index.tsx)

- `tasksByDate = groupTasksByDate(tasks)` 로 날짜별 Map 생성
- 각 요일 카드: `dayTasks = getTasksForDate(tasksByDate, dateStr)` → 그날 할일 배열
- 카드 안에서는 `visibleTasks = group.tasks` (= `dayTasks`) 순서대로 렌더
- 즉, **날짜별로는 2.1 규칙**, **해당 날짜 안에서는 2.2(오늘만 정렬) 또는 API 순서**입니다.

### 3.2 일별 뷰 (day.tsx)

- 동일하게 `tasksByDate = groupTasksByDate(tasks)` → `getTasksForDate(tasksByDate, dateStr)` 로 그날 할일 획득
- 그날 리스트를 그 순서대로 세로 스크롤로 표시

### 3.3 백로그 (backlog.tsx)

- **소스**: `useBacklogTasks()` → `getBacklogTasks()` (React Query)
- **조건**: `due_date IS NULL`, `status = 'TODO'`, soft-delete 제외
- **정렬**: `created_at` **내림차순** (최신 생성 먼저)
- 화면에서는 같은 `tasks` 배열을
  - **TODO**만 필터 → “Incomplete” 섹션
  - **DONE**만 필터 → “Completed” 섹션  
  (현재 API는 TODO만 반환하므로, DONE 섹션은 낙관적 업데이트/캐시에만 있을 수 있음)

---

## 4. 요약 표

| 화면       | 데이터 소스              | 날짜/그룹 기준        | 일자/리스트 내 정렬                                                    |
|------------|---------------------------|------------------------|------------------------------------------------------------------------|
| 주간 뷰    | Store (getAllTasksInRange) | groupTasksByDate       | 모든 날짜: original_due_date → due_time → created_at (status 미반영)   |
| 일별 뷰    | 동일                      | 동일                   | 동일                                                                   |
| 백로그     | getBacklogTasks           | 없음 (due_date=null)   | created_at **내림차순** (최신 먼저)                                    |

---

## 5. 관련 코드 위치

- **그룹핑·오늘 정렬**: `lib/utils/task-filtering.ts` (`groupTasksByDate`, `getTasksForDate`)
- **캘린더용 API 정렬**: `lib/api/tasks.ts` (`getAllTasksInRange` 등에서 `.order(...)`)
- **백로그 API 정렬**: `lib/api/tasks.ts` → `getBacklogTasks` (`.order('created_at', { ascending: false })`)
- **주간**: `app/(tabs)/index.tsx` (weekPages → dailyGroups → dayTasks)
- **일별**: `app/day.tsx` (tasksByDate → getTasksForDate)
- **백로그**: `app/(tabs)/backlog.tsx` (useBacklogTasks → TODO/DONE 필터)

이 가이드는 현재 코드 기준으로 작성되었습니다. 정렬/노출 규칙을 바꿀 때는 위 위치들을 함께 수정하면 됩니다.
