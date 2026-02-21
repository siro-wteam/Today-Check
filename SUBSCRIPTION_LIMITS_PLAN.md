# 구독 제한 적용 전체 플랜

백로그 이동·오늘로 완료까지 포함해, **무료 tier 제한이 걸리는 모든 지점**과 **서버/클라이언트 적용 순서**를 정리한 플랜입니다.

---

## 1. 제한 요약 (무료)

| 제한 | 상수 | 의미 |
|------|------|------|
| 그룹 개수 | `FREE_MAX_GROUPS` (2) | 사용자가 생성한 그룹 수 |
| 백로그 개수 | `FREE_MAX_BACKLOG` (5) | due_date = null 인 일감 전체 |
| 날짜당 일감 개수 | `FREE_MAX_TASKS_PER_DATE` (5) | 특정 날짜(due_date)에 배정된 일감 수 (연기 포함) |

유료: 위 검사 생략 (무제한).

---

## 2. 구독 상태 (적용 완료)

- **저장**: `profiles.subscription_tier` = `'free'` | `'paid'` (기본값 `'free'`). 결제 연동은 추후 동일 컬럼/웹훅으로 갱신 가능.
- **클라이언트**: `useSubscription()` 훅 → `{ tier, isSubscribed }`. `isSubscribed === true` 이면 유료(제한 없음).
- **서버**: 제한 검사 시 `profiles.subscription_tier` 조회 후 `'paid'`면 검사 생략. (추후 `isSubscribed(userId)` 헬퍼 추가 가능.)

---

## 3. 제한이 걸리는 모든 지점

### 3.1 그룹 개수 (≤ FREE_MAX_GROUPS)

| # | 액션 | 검사 내용 | 서버 | 클라이언트 |
|---|------|-----------|------|------------|
| G1 | 그룹 생성 | 현재 내 그룹 수 < 2 | createGroup 전에 count 확인, 초과 시 403/409 | 그룹 생성 버튼 비활성화 또는 모달에서 안내 |

---

### 3.2 백로그 개수 (≤ FREE_MAX_BACKLOG)

**“백로그 개수”** = due_date IS NULL 인 일감 수 (정책: 개인 일감 + 내가 속한 그룹 일감 등, 팀 정책에 맞게 정의).

| # | 액션 | 검사 내용 | 서버 | 클라이언트 |
|---|------|-----------|------|------------|
| B1 | 새 일감 생성 (due_date 없음) | 백로그 개수 < 5 | createTask(due_date=null) 전에 count, 초과 시 거부 | AddTaskModal에서 날짜 없이 저장 시도 전에 체크, 초과 시 버튼 비활성/토스트 |
| B2 | 백로그로 이동 | 백로그 개수 < 5 | moveTaskToBacklog / updateTask(due_date=null) 전에 count, 초과 시 거부 | Day 주간 백로그 스와이프, Weekly 백로그 스와이프, EditTaskBottomSheet “Backlog” 선택 시 초과하면 비활성/토스트 |

---

### 3.3 날짜당 일감 개수 (≤ FREE_MAX_TASKS_PER_DATE)

**“날짜 D의 일감 개수”** = due_date = D 인 일감 수 (해당 날짜로 연기된 것 포함).  
제한은 **모든 날짜**에 공통: 특정 due_date 에 이미 5개면, 그 날짜로 하나 더 넣는 행위 불가.

| # | 액션 | 검사 내용 | 서버 | 클라이언트 |
|---|------|-----------|------|------------|
| D1 | 새 일감 생성 (due_date = D) | 날짜 D 의 일감 수 < 5 | createTask(due_date=D) 전에 count(D), 초과 시 거부 | AddTaskModal에서 D 선택 후 저장 시도 전에 체크 |
| D2 | 오늘로 예약 (Schedule for today) | 오늘(today) 일감 수 < 5 | updateTask(due_date=today) 전에 count(today), 초과 시 거부 | Backlog “Schedule for today” 스와이프/버튼 클릭 전 체크 |
| D3 | 백로그에서 오늘로 완료 처리 | 오늘 일감 수 < 5 | 완료 API 호출 시 due_date=today 로 세팅하는 경우, count(today) 체크 후 초과 시 거부 | Backlog에서 완료(→ 오늘로 이동) 버튼/체크 전 체크 |
| D4 | 일감 날짜 변경 (Edit) | 변경 대상 날짜 D 의 일감 수 < 5 | updateTask(due_date=D) 전에 count(D), 초과 시 거부 | EditTaskBottomSheet에서 날짜 D 로 변경 저장 시 체크 |
| D5 | 기타 “특정 날짜로 넣기” | 해당 날짜 count < 5 | 해당 updateTask/createTask 전 count | 해당 UI에서 동작 전 체크 |

- **D3** 요약: “백로그에서 오늘로 완료 처리” 시에도 **오늘(due_date=today) 일감 수** 제한이 적용되므로, 무료 사용자는 “오늘 일정이 이미 5개일 때” 백로그 완료(오늘로 이동)도 막힌다.

---

## 4. 서버 측 구현 요약

1. **구독 확인**  
   - 각 제한 검사 전에 `isSubscribed(userId)` 호출 → `true`면 해당 검사 스킵.

2. **그룹**  
   - `createGroup` 직전: 내 그룹 수 조회 → 무료이고 `>= FREE_MAX_GROUPS` 이면 403/409 및 메시지 반환.

3. **백로그**  
   - `due_date`를 null 로 두는 모든 경로에서:
     - 무료일 때만: due_date IS NULL 인 일감 수(count) 조회 → `>= FREE_MAX_BACKLOG` 이면 거부.
   - 적용 API: createTask(due_date=null), moveTaskToBacklog, updateTask(due_date=null).

4. **날짜당 일감**  
   - `due_date`를 특정 날짜 D 로 두는 모든 경로에서:
     - 무료일 때만: due_date = D 인 일감 수(count) 조회 → `>= FREE_MAX_TASKS_PER_DATE` 이면 거부.
   - 적용 API: createTask(due_date=D), updateTask(due_date=D) (오늘로 완료 포함), moveTaskToBacklog 반대(오늘로 예약) 등.

5. **카운트 쿼리**  
   - 그룹 수: 기존 그룹 목록/카운트 API 활용.  
   - 백로그 수: `tasks` where due_date IS NULL (및 RLS/정책).  
   - 날짜 D 수: `tasks` where due_date = D (및 RLS/정책).  
   - 그룹 일감 포함 여부는 팀 정책에 따라 count 대상에 포함할지 결정.

---

## 5. 클라이언트 측 구현 요약

1. **구독 상태**  
   - 프로필/구독 API에서 tier 를 가져와, 화면/훅에서 `isSubscribed` 사용.

2. **그룹**  
   - 그룹 생성 진입 전에 그룹 개수 + `isSubscribed` 확인 → 무료이고 이미 2개면 생성 버튼 비활성 또는 “그룹 제한” 안내.

3. **백로그**  
   - B1: 새 일감을 날짜 없이 만들 때 → 백로그 개수 API/캐시로 확인 후 5개면 “백로그 제한” 안내/비활성.  
   - B2: “백로그로 이동” (Day/Weekly 스와이프, Edit “Backlog”) → 같은 백로그 개수 체크 후 5개면 스와이프 비활성 또는 토스트.

4. **날짜당 일감**  
   - D1: AddTask에서 날짜 D 선택 후 저장 시 → 해당 날짜 일감 개수 확인 후 5개면 안내/비활성.  
   - D2: Backlog “Schedule for today” → 오늘 일감 개수 확인 후 5개면 비활성/토스트.  
   - D3: Backlog “오늘로 완료 처리” → 오늘 일감 개수 확인 후 5개면 완료(오늘 이동) 비활성/토스트.  
   - D4: Edit에서 날짜를 D 로 변경 후 저장 → D 일감 개수 확인 후 5개면 저장 거부/안내.

5. **공통**  
   - 제한 걸릴 때 메시지 예: “Free plan: max 5 tasks per date. Upgrade to add more.”  
   - 가능하면 “해당 날짜/백로그 개수”를 가져오는 공용 훅/API 하나 두고, 위 지점에서 재사용.

---

## 6. 작업 순서 제안

| 단계 | 내용 |
|------|------|
| 1 | 구독 상태 저장소 및 `isSubscribed(userId)` 구현 (서버 + 클라이언트) |
| 2 | 서버: 그룹 개수 검사 (createGroup) |
| 3 | 서버: 백로그 개수 검사 (createTask due_date=null, moveTaskToBacklog, updateTask due_date=null) |
| 4 | 서버: 날짜당 개수 검사 (createTask/updateTask 로 due_date 설정하는 모든 경로, **백로그→오늘 완료 포함**) |
| 5 | 클라이언트: 그룹 생성 시 제한 안내/비활성 |
| 6 | 클라이언트: 백로그 관련 제한 (새 일감 무날짜, 백로그로 이동) |
| 7 | 클라이언트: 날짜 관련 제한 (새 일감 날짜, 오늘로 예약, **백로그 오늘로 완료**, 날짜 변경) |

이 순서로 적용하면 “백로그로 이동”과 “오늘로 완료 처리”까지 동일한 제한이 서버·클라이언트 모두에서 일관되게 적용된다.
