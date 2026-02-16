# due_date / original_due_date 수정 로직 정리

## 1. 필드 의미

| 필드 | 의미 | 갱신 시점 |
|------|------|-----------|
| **due_date** | 현재 예정일. NULL = 백로그 | 생성·수정·백로그 이동·오늘로 이동 시 변경 |
| **original_due_date** | “원래 예정일”(롤오버/지연 계산용). 생성 시 한 번 설정 | **일반적으로 수정하지 않음** (주석: set once on creation) |

- **롤오버**: `due_date < 오늘` && `status === 'TODO'` 인 태스크를 “오늘”에만 표시.
- **지연일(+Nd)**: `calculateRolloverInfo()`에서 `original_due_date`와 오늘의 차이로 계산.

---

## 2. 시나리오: 2.1 예정 → 백로그 → 2.10에 “오늘로 세팅”

가정: 최초 due_date = 2.1, 백로그로 이동 후, 오늘 2.10에 백로그에서 “오늘로 할당” 실행.

### 2.1 백로그로 이동 시 (홈/일간 스와이프 “Backlog”)

- **호출**: `moveTaskToBacklog(taskId)` → `updateTask({ id, due_date: null })`
- **전달 필드**: `due_date` 만.
- **결과**:
  - `due_date` = **null**
  - `original_due_date` = **그대로 2.1** (업데이트 인자에 없으므로 DB 값 유지)

### 2.2 백로그에서 “오늘로 할당” 시 (백로그 스와이프 “오늘로”)

- **호출**: `updateTask({ id, due_date: today })` (today = '2025-02-10')
- **전달 필드**: `due_date` 만.
- **결과**:
  - `due_date` = **2.10** (오늘)
  - `original_due_date` = **그대로 2.1** (업데이트 인자에 없음)

### 2.3 화면에 어떻게 나오는지

- **노출 날짜(버킷)**  
  `lib/utils/task-filtering.ts`의 `groupTasksByDate()`는 **due_date**만 사용합니다.
  - `due_date = 2.10` → **2.10(오늘) 버킷**에 표시됨. ✅

- **지연일 배지 (+Nd)**  
  `lib/api/tasks.ts`의 `calculateRolloverInfo()`는 **original_due_date**로 계산합니다.
  - `original_due_date = 2.1`, 오늘 = 2.10 → `daysOverdue = 9`, `isOverdue = true`
  - 따라서 **“+9”** 배지가 그대로 노출됩니다.

정리하면:

- **due_date는 2.10으로 바뀌고**, 오늘(2.10) 리스트에 들어갑니다.
- **original_due_date는 2.1로 남아 있어서**, “이미 9일 지난 일정”처럼 **+9일**로 표시됩니다.

---

## 3. 관련 코드 위치

| 처리 | 파일 | 내용 |
|------|------|------|
| 백로그 이동 | `lib/api/tasks.ts` | `moveTaskToBacklog()` → `updateTask({ id, due_date: null })` |
| 오늘로 할당 | `app/(tabs)/backlog.tsx` | `updateTask({ id, due_date: today })` |
| 수정 시 original 유지 | `lib/api/tasks.ts` | `updateTask()` 주석: original_due_date is NOT updated |
| 롤오버/지연 계산 | `lib/api/tasks.ts` | `calculateRolloverInfo()` → `original_due_date` 기준 daysOverdue |
| 날짜 버킷/정렬 | `lib/utils/task-filtering.ts` | `groupTasksByDate()` → 버킷은 due_date, 정렬에 original_due_date \|\| due_date 사용 |

---

## 4. “오늘로 세팅 = 깨끗한 오늘 일정”으로 바꾸고 싶을 때

백로그에서 “오늘로 할당”했을 때 **+Nd 없이** “오늘 일정”으로만 보이게 하려면:

- **오늘로 할당 시 `original_due_date`도 오늘로 맞춰 주면 됩니다.**
  - 예: `updateTask({ id, due_date: today, original_due_date: today })`
  - 이때 `UpdateTaskInput`에 `original_due_date`를 추가하고, 백로그의 “오늘로 할당” 호출부에서만 이렇게 넘기면 됩니다.

이렇게 하면:

- due_date = 2.10, original_due_date = 2.10
- `calculateRolloverInfo()` 기준 지연일 = 0 → **+N 배지 없음**.

원하면 이 방식으로 수정하는 패치 포인트(파일/함수명)까지 구체적으로 적어줄 수 있습니다.
