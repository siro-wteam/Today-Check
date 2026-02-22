# 일감에 장소 추가 — 추천 방식

**원칙**: 할일 생성은 **제목만** 입력하는 것을 기본으로 유지하고, **가끔** 장소를 넣을 수 있게 한다.

---

## 추천: “추가하기”로만 펼치기 (옵션 필드)

- **생성/수정 화면**  
  - 기본: **제목 입력란 하나**만 보임 (지금처럼).  
  - **「+ 장소」** 같은 **작은 링크/칩** 하나만 두고, 탭하면 그때 **장소 입력란**이 아래에 펼쳐진다.  
  - 펼치지 않으면 장소 없이 생성/수정 (기존과 동일).

**장점**
- 평소에는 화면이 그대로 “제목만”이라 정체성을 유지.
- 장소가 필요할 때만 한 번 탭해서 입력.
- 구현이 단순하고, 나중에 “참고 링크”, “메모” 등도 같은 패턴으로 확장 가능.

**데이터**
- `tasks` 테이블에 `location` (또는 `place`) 컬럼 하나 추가. `TEXT NULL`.  
- 있으면 목록/상세에서만 “장소”로 표시.

---

## 대안 1: 수정 시에만 장소

- **생성**: 지금처럼 제목만 입력.  
- **장소**: 일감 생성 후 **상세/수정**에서만 “장소” 필드를 두고 추가·수정.

**장점**  
- 생성 플로우를 전혀 건드리지 않음.  
**단점**  
- “만들자마자 장소까지 넣고 싶다”는 경우 한 번 더 들어가야 함.

---

## 대안 2: 제목 옆 아이콘

- 제목 입력란 **오른쪽**에 **위치 아이콘** 하나.  
- 탭하면 모달/팝업으로 “장소” 한 줄 입력.

**장점**  
- 제목 영역을 넓히지 않고 장소를 옵션으로 둠.  
**단점**  
- 아이콘 의미를 사용자가 처음에 모를 수 있음. “+ 장소” 텍스트가 더 직관적일 수 있음.

---

## 채택 방식: 제목 옆 장소 아이콘 → 인라인 입력 + Google 검색·선택

(모달 없이, 같은 화면 안에서 처리하는 방식)

### 흐름

1. 제목 입력란 **옆**에 **위치(장소) 아이콘** 버튼.
2. 아이콘 탭 → **모달이 아니라** 그 자리 아래(또는 옆)에 **입력박스가 인라인으로 나타남**.
3. 사용자가 그 **입력란에 장소를 입력** → **Google API**로 검색 → **추천 장소 목록**이 입력란 바로 아래에 노출.
4. 사용자가 **목록에서 하나 선택** → 그 장소가 일감의 “등록된 장소”로 설정됨.
5. **등록된 장소는 제거 가능** (예: 장소 옆 X 버튼 또는 “장소 제거”) → 제거하면 `location`이 비워짐.

### 장점

- **모달 없이** 같은 폼 안에서 이어지므로 흐름이 끊기지 않음.
- **인라인 자동완성**이라 Google Calendar의 “장소 추가”와 유사한 UX.
- **Google API**로 검색·노출하므로 장소 표기 통일, 오타 감소.
- **제거 가능**이라 잘못 선택했을 때나 “장소 없이 쓰고 싶을 때” 대응 가능.

### 필요한 것

1. **Google Places API**  
   - **Places Autocomplete** (또는 New)로 입력어에 맞는 장소 목록 조회.  
   - API 키·과금·쿼터·도메인 제한 설정 필요.
2. **UI**  
   - 장소 아이콘 탭 시: **인라인으로 입력박스** 노출 (제목 아래 한 줄 추가).  
   - 입력박스에 타이핑 → 디바운스(예: 300ms) 후 Google API 호출 → **결과 리스트를 입력란 바로 아래**에 드롭다운처럼 표시.  
   - 리스트 항목 탭 → 선택한 장소 문자열을 state에 저장하고, 리스트는 숨김.  
   - 장소가 이미 있으면: **선택된 장소 텍스트 + 제거(X)** 표시. 제거 시 `location = null`.
3. **저장**  
   - DB `tasks.location`에는 **선택한 표시 문자열**(예: Google이 주는 `description`)만 저장.  
   - 필요 시 나중에 `location_place_id` 컬럼을 추가해 Place ID도 저장 가능.

### 구현 포인트

- **모달 사용 안 함** → 제목/장소가 같은 뷰에 있으므로, “장소 입력 영역”을 조건부로 렌더 (아이콘 탭 시 또는 이미 장소가 있을 때).
- 입력 중: `TextInput` + 아래에 `FlatList` 또는 `ScrollView`로 추천 목록.  
  선택 후: 입력란 대신 “선택된 장소 이름 + 제거 버튼” 표시.
- 생성/수정 화면 모두 같은 패턴 적용.

---

## 정리

- **채택 UX**: **제목 옆 장소 아이콘** → **인라인 입력박스** 노출 → 입력 시 **Google API**로 추천 목록 노출 → **선택**으로 등록, **제거**로 삭제. (모달 없음.)
- **가장 단순한 대안**: **「+ 장소」** 칩으로 “필요할 때만” 장소 **텍스트 입력란**만 펼치는 방식. DB는 `tasks.location` (TEXT NULL) 하나면 충분.

“제목만” 기본은 유지하고, 장소는 인라인 검색·선택·제거로 넣는 흐름으로 정리.

---

## 실제 연동 경로 (구현 시 참고)

장소를 넣으려면 아래 순서로 연동하면 된다. **DB → 타입/API → UI** 순.

### 1. DB

- **마이그레이션** 한 개 추가.
- `public.tasks` 테이블에 컬럼 추가:
  - `location TEXT NULL`
- RLS/정책 수정은 필요 없음 (기존 INSERT/UPDATE가 컬럼만 추가되면 그대로 적용).

```sql
-- 예: supabase/migrations/YYYYMMDD_add_tasks_location.sql
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS location TEXT;
COMMENT ON COLUMN public.tasks.location IS 'Optional place/location for the task.';
```

### 2. 타입 (lib/types.ts)

- **Task**: `location?: string | null` 추가.
- **CreateTaskInput**: `location?: string | null` 추가.
- **CreateTaskWithAssigneesInput**: `location?: string | null` 추가.
- **UpdateTaskInput**: `location?: string | null` 추가.

### 3. API (lib/api/tasks.ts)

- **CreateTaskInput / CreateTaskWithAssigneesInput / UpdateTaskInput** 인터페이스에 `location` 추가 (위 타입과 맞춤).
- **createTask()**: `taskData`에 `location: input.location ?? null` 포함해서 `insert`.
- **createTaskWithAssignees()**: `taskData`에 `location: input.location ?? null` 포함해서 `insert`.
- **updateTask()**: `input`을 그대로 `update(updates)`에 넘기므로, `UpdateTaskInput`에 `location`만 있으면 자동 반영.
- 조회는 전부 `select('*')` 또는 `select(\`*, task_assignees(...)\`)` 이므로, 컬럼 추가 후 재배포하면 응답에 `location` 포함됨. 별도 수정 불필요.

### 4. UI — 생성 (AddTaskModal)

**A) 단순 텍스트**
- state: `const [location, setLocation] = useState('');`  
  필요 시 `const [showLocationField, setShowLocationField] = useState(false);`
- 기본은 **제목만** 보이게 하고, **「+ 장소」** 누르면 아래에 `<TextInput value={location} onChangeText={setLocation} placeholder="장소" />` 노출.
- 제출 시: `addTask({ ..., location: location.trim() || null })` 넘김.

**B) 채택 방식: 인라인 입력 + Google 검색·선택**
- 제목 입력란 **옆**에 위치 아이콘. 탭 시 **모달 없이** 그 아래에 **인라인 입력박스** 표시.
- 입력박스에 타이핑 → 디바운스 후 **Google Places API** 호출 → **추천 목록을 입력란 바로 아래**에 표시.
- 목록에서 선택 → `setLocation(선택한 표시 문자열)`, 리스트 숨김. 이미 장소가 있으면 “선택된 장소 + 제거(X)” UI.
- 제거 시 `setLocation(null)`.
- DB에는 선택한 **표시 문자열**만 저장 (`tasks.location`). 제출 시 `addTask({ ..., location: selectedDisplayName || null })`.
- 그룹 일감이면 `createTaskWithAssignees`에도 `location` 포함.

### 5. UI — 수정 (EditTaskBottomSheet)

- 기존 일감 값: `task.location` 사용.
- 수정 시에도 **장소 아이콘 → 인라인 입력박스** + Google 추천 목록 + 선택·제거 패턴 적용.
  - 장소가 이미 있으면 “선택된 장소 + 제거” 표시, 아이콘 다시 탭 시 입력/검색 가능.
- 저장 시: `updateTask({ id: task.id, ..., location: location.trim() || null })` 포함.

### 6. UI — 표시 (일감 행/카드)

- 주간/일간/백로그 등 **일감 한 줄(카드)** 렌더하는 곳에서:
  - `task.location`이 있으면: 작은 텍스트 또는 아이콘(예: MapPin) + `task.location` 표시.
- 없으면 아무것도 안 그리면 됨.

### 7. 스토어/캐시

- **useCalendarStore**의 `addTask` 등은 이미 `CreateTaskInput`을 그대로 API에 넘기므로, 타입과 API에 `location`만 넣으면 스토어는 수정 없이 연동됨.
- 낙관적 업데이트 시 `optimisticTask`에 `location: input.location ?? null` 넣어 주면 표시와 서버 응답이 맞음.

### 요약 표

| 단계 | 위치 | 내용 |
|------|------|------|
| DB | 새 마이그레이션 | `tasks.location` (TEXT NULL) 추가 |
| 타입 | `lib/types.ts` | Task, CreateTaskInput, CreateTaskWithAssigneesInput, UpdateTaskInput 에 `location` |
| API | `lib/api/tasks.ts` | createTask / createTaskWithAssignees 의 taskData 에 location, UpdateTaskInput 에 location |
| 생성 | `components/AddTaskModal.tsx` | 「+ 장소」 펼치기 → location state → addTask 시 전달 |
| 수정 | `components/EditTaskBottomSheet.tsx` | task.location 표시/수정 → updateTask 시 전달 |
| 표시 | 일감 렌더하는 컴포넌트(주간/일간/백로그 카드) | `task.location` 있으면 아이콘+텍스트 표시 |
