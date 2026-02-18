# TodayCheck 프로젝트 구조

> **Simple like a To-do list, managed like pro**  
> Expo + React Native + Supabase 기반 개인/그룹 태스크 관리 앱

---

## 1. 개요

| 항목 | 내용 |
|------|------|
| **프레임워크** | Expo (Managed) + Expo Router (파일 기반 라우팅) |
| **언어** | TypeScript (Strict) |
| **스타일** | NativeWind (Tailwind for RN), `className` 사용 |
| **서버 상태** | TanStack React Query |
| **로컬 상태** | Zustand (Calendar, Group, Task 스토어) |
| **백엔드** | Supabase (PostgreSQL, Auth, RLS, Realtime) |
| **아이콘** | lucide-react-native |
| **날짜** | date-fns |

---

## 2. 앱 라우팅 구조 (Expo Router)

```
app/
├── _layout.tsx              # 루트: 폰트, QueryClient, Auth 리다이렉트, 알림 초기화
├── auth.tsx                 # 로그인/회원가입 (비인증 시 진입)
├── (tabs)/                  # 탭 네비게이션 (인증 후 메인)
│   ├── _layout.tsx          # 탭 레이아웃: Home, Backlog, Add(모달), Group, Profile
│   ├── index.tsx            # Home: 주간 타임라인 (WeekScreen)
│   ├── backlog.tsx          # Backlog: due_date = NULL 태스크
│   ├── add.tsx              # 탭만 있고 UI 없음 → AddTaskModal 트리거
│   ├── group.tsx            # 그룹 목록 + 생성/참가 모달
│   └── profile.tsx          # 프로필 + 닉네임 수정, 로그아웃
├── day.tsx                  # [모달] 일별 상세 뷰 (Horizontal Paging)
├── group-detail.tsx         # [모달] 그룹 상세 (멤버, 초대코드, 역할, 강퇴 등)
└── modal.tsx                # 범용 모달
```

- **인증**: `_layout.tsx`에서 `useAuth()`로 비인증 시 `/auth`, 인증 시 `/(tabs)`로 리다이렉트.
- **앵커**: `unstable_settings.anchor = '(tabs)'`로 탭을 기본 스택 앵커로 사용.

---

## 3. 화면별 역할

| 경로 | 화면 | 데이터 소스 | 비고 |
|------|------|-------------|------|
| `/(tabs)` | 탭 레이아웃 | - | Add 탭 클릭 시 `AddTaskModal` 오픈 |
| `/(tabs)/index` | **Home (주간)** | `useCalendarStore` | 주간 페이지 스와이프, 날짜별 섹션, 일별 모달 진입 |
| `/(tabs)/backlog` | **Backlog** | `useBacklogTasks()` (React Query) | `due_date = null` 태스크, 스케줄/완료/삭제 |
| `/(tabs)/group` | **그룹** | `useGroupStore` | 그룹 목록, 생성/참가 모달 |
| `/(tabs)/profile` | **프로필** | `useAuth()` (user, profile) | 닉네임 수정, 알림센터, 로그아웃 |
| `/day?jumpToDate=` | **일별 모달** | `useCalendarStore` | 날짜별 스와이프, Ghost Task, 롤오버 배지 |
| `/group-detail?groupId=` | **그룹 상세 모달** | `useGroupStore` (currentGroup) | 멤버, 초대코드, 역할, 강퇴, 이미지 |

---

## 4. 컴포넌트 구조

```
components/
├── AppHeader.tsx            # 상단: 로고, 알림 아이콘(뱃지), useNotificationRealtime 연동
├── NotificationCenterModal.tsx  # 알림 목록, 읽음 처리
├── AddTaskModal.tsx         # 태스크 추가 (개인/그룹, due_date/시간)
├── EditTaskBottomSheet.tsx  # 태스크 수정 (제목, 날짜, 완료/연기/취소/삭제)
├── DatePickerModal.tsx      # 날짜 선택
├── EmptyState.tsx           # 빈 상태 메시지
├── AssigneeAvatars.tsx      # 그룹 태스크 assignee 아바타
├── CreateGroupModal.tsx     # 그룹 생성
├── JoinGroupModal.tsx       # 초대코드로 그룹 참가
├── EditNicknameModal.tsx    # 프로필 닉네임 수정
├── MentionInput.tsx         # 멘션 입력 (그룹 등)
├── ModalCloseButton.tsx     # 모달 닫기 버튼
├── haptic-tab.tsx           # 탭 하단 햅틱
├── themed-text.tsx / themed-view.tsx
├── parallax-scroll-view.tsx
├── external-link.tsx / hello-wave.tsx
└── ui/
    ├── LogoIcon.tsx
    ├── collapsible.tsx
    └── icon-symbol*.tsx
```

---

## 5. 라이브러리/코어 (lib)

### 5.1 API 레이어 (`lib/api/`)

| 파일 | 역할 |
|------|------|
| **tasks.ts** | 태스크 CRUD, `getActiveTasks`, `getAllTasksInRange`, `createTask`, `createTaskWithAssignees`, `updateTask`, `deleteTask`, 롤오버 계산 등 |
| **task-state-machine.ts** | 상태 전이 검증 (TODO ↔ DONE ↔ CANCEL) |
| **groups.ts** | 그룹 CRUD, 참가/탈퇴, 초대코드, 멤버 역할(OWNER/ADMIN/MEMBER), 강퇴, 이미지 업로드 |
| **profiles.ts** | 프로필 조회/수정, 배치 조회 |
| **notifications.ts** | 알림 목록, 미읽음 개수, 읽음 처리 |

### 5.2 훅 (`lib/hooks/`)

| 훅 | 역할 |
|------|------|
| **use-auth.ts** | 세션/유저/프로필, 로그인/로그아웃, 프로필 업데이트, 그룹/캘린더 스토어 초기화 |
| **use-timeline-tasks.ts** | 타임라인용 태스크 (레거시/백업 대체용) |
| **use-today-tasks.ts** | 오늘 태스크 전용 |
| **use-week-tasks.ts** | 주간 태스크 |
| **use-backlog-tasks.ts** | Backlog 전용 (React Query) |
| **use-create-task.ts** | 태스크 생성 뮤테이션 |
| **use-task-realtime.ts** | 태스크 테이블 Realtime 구독 |
| **use-notification-realtime.ts** | 알림 Realtime 구독 |

### 5.3 스토어 (Zustand) (`lib/stores/`)

| 스토어 | 역할 |
|--------|------|
| **useCalendarStore** | 주간/일별 공통: `tasks`, `selectedDate`, 초기화/프리페치, `updateTask`/`toggleTaskComplete`/`deleteTask`/`addTask` (낙관적 업데이트), 로컬 알림 스케줄 |
| **useGroupStore** | 그룹 목록, `currentGroup`, 생성/참가/탈퇴/삭제, 역할 변경, 강퇴, Realtime 구독, `setQueryClientForGroupStore`로 React Query 연동 |
| **useTaskStore** | 액티브/타임라인 태스크 캐시, `fetchActiveTasks`, `fetchTimelineTasks` (일부 화면에서 사용) |

### 5.4 유틸 (`lib/utils/`)

| 파일 | 역할 |
|------|------|
| **task-filtering.ts** | `groupTasksByDate`, `getTasksForDate` — DONE은 `completed_at` 기준, TODO 롤오버는 “오늘” 섹션에만 표시 |
| **task-notifications.ts** | 로컬 푸시 스케줄/취소, `initializeNotifications` (앱 시작 시 호출) |

### 5.5 기타

- **lib/types.ts**: `Task`, `TaskWithRollover`, `TaskWithProgress`, `CreateTaskInput`, `CreateTaskWithAssigneesInput`, `Profile`, `Group`, `GroupMember`, `Notification`, `NotificationType` 등.
- **lib/supabase.ts**: Supabase 클라이언트.
- **lib/query-client.tsx**: React Query `QueryClient` 생성/export.
- **lib/fonts.ts**: Geist 폰트 설정.

---

## 6. 상수

| 파일 | 내용 |
|------|------|
| **constants/calendar.ts** | `getWeeklyCalendarRanges()` (-2달 ~ +4달), `isDateInWeeklyRange`, 주간 초기 로드 범위 |
| **constants/colors.ts** | `colors`, `borderRadius`, `shadows`, `spacing` 등 디자인 토큰 |
| **constants/theme.ts** | 테마 관련 상수 |

---

## 7. 데이터 흐름 요약

1. **인증**  
   `useAuth()` → Supabase Auth. 로그인 시 `fetchMyGroups(user.id)` 호출, 로그아웃 시 캘린더/그룹 스토어 초기화.

2. **홈/일별**  
   `useCalendarStore.initializeCalendar()` → `getAllTasksInRange` 등으로 태스크 로드 → `groupTasksByDate(tasks)` → 주간/일별 섹션 렌더링.  
   롤오버(Ghost): `due_date < today` && `status === 'TODO'` → 과거 날짜에는 Ghost, “오늘”에는 실제 항목으로 표시.

3. **Backlog**  
   `useBacklogTasks()` (React Query) → `due_date IS NULL` 태스크만 조회.

4. **그룹**  
   `useGroupStore`: 그룹 목록/상세, Realtime 구독. 그룹 태스크 생성 시 `createTaskWithAssignees` 사용.

5. **알림**  
   `notifications` 테이블 + RLS. 트리거: TASK_ASSIGNED, TASK_COMPLETED, GROUP_JOINED, GROUP_KICKED, GROUP_ROLE_CHANGED.  
   `useNotificationRealtime` + `getUnreadNotificationCount`로 헤더 뱃지/알림센터 연동.

---

## 8. Supabase 스키마 요약

- **tasks**: id, user_id, creator_id, group_id, batch_id, title, status, due_date, due_time, original_due_date, completed_at, created_at, updated_at, deleted_at (soft delete).
- **task_assignees**: task_id, user_id, is_completed, completed_at — 그룹 태스크 N명 배정.
- **groups**: id, name, owner_id, invite_code, image_url, created_at, updated_at.
- **group_members**: group_id, user_id, role (OWNER/ADMIN/MEMBER), profile_color, joined_at.
- **profiles**: id, nickname, avatar_url, created_at, updated_at.
- **notifications**: id, user_id, actor_id, group_id, type, title, body, target_id, is_read, created_at.  
  → RLS + 트리거로 INSERT, SELECT/UPDATE는 본인만.

---

## 9. 현재 작업/추가된 파일 (git 기준)

- **알림**: `NotificationCenterModal`, `lib/api/notifications.ts`, `use-notification-realtime.ts`, `task-notifications.ts`, `AppHeader` 알림 연동.
- **DB**: `supabase/migrations/20260130*` — notifications 테이블, RLS/트리거, search_path, delete 정책.
- **수정**: `backlog` / `index` / `profile` / `day` / `_layout` / `AppHeader` / `use-auth` / `useCalendarStore` / `useGroupStore` / `lib/types` 등 알림 및 UX 반영.

---

이 문서는 코드베이스와 최근 변경 사항을 바탕으로 작성되었으며, 새 기능 추가 시 여기에 섹션을 이어 붙이면 구조 파악에 도움이 됩니다.
