# TodayCheck - Claude Code 프로젝트 가이드

> 이 파일이 AGENTS.md보다 우선한다. 충돌 시 CLAUDE.md를 따를 것.

## 프로젝트 개요

**"Simple like a To-do list, managed like pro"**

개인/그룹 할일 관리 크로스플랫폼 앱 (iOS, Android, Web).
주간 타임라인, Ghost Task, 백로그, 그룹 협업, 알림, 구독(Freemium) 기능 구현 완료.

| 영역 | 기술 |
|------|------|
| Framework | Expo 54 (Managed) + React Native 0.81 + React 19 |
| Routing | Expo Router 6 (파일 기반, typed routes) |
| 상태관리 | Zustand (로컬/UI) + TanStack React Query 5 (서버) |
| 스타일링 | NativeWind 4.2 (Tailwind CSS) - **StyleSheet.create 사용 금지** |
| Backend | Supabase (PostgreSQL + Auth + RLS + Realtime + Storage) |
| 인증 | Supabase Auth (Email/Password, JWT) |
| 알림 | expo-notifications + burnt (토스터) |
| 날짜 | date-fns 4.1 |
| 아이콘 | lucide-react-native |
| 기타 | @gorhom/bottom-sheet, react-native-draggable-flatlist, expo-haptics |

---

## 빌드/린트/테스트

```bash
# 개발
npm start                  # Expo 개발 서버
npm run web               # 웹 브라우저
npm run ios               # iOS 시뮬레이터
npm run android           # Android 에뮬레이터
npm run ios:device        # iOS 물리 디바이스
npm run android:device    # Android 물리 디바이스

# 검증
npm run lint              # ESLint
npx tsc --noEmit          # TypeScript 타입 체크

# 빌드
npm run build             # 웹 정적 빌드
npm run android:apk       # Android APK (릴리즈)
```

테스트 프레임워크 미구성. 커밋 형식: `type: description` (feat/fix/refactor/docs/chore)

---

## 코딩 컨벤션

### 스타일링: NativeWind 전용
```tsx
// 올바름
<View className="px-4 py-2 bg-primary rounded-md">
  <Text className="text-white font-semibold">Hello</Text>
</View>

// 금지 - StyleSheet.create 사용하지 않음
```

### 커스텀 디자인 토큰
- primary: #2563eb / background: #F8FAFC / text-main: #1e293b / text-sub: #64748b
- error: #dc2626 / success: #16a34a / warning: #d97706
- rounded-sm(8) / rounded-md(12) / rounded-lg(16) / rounded-xl(20)

### 타입
- `lib/types.ts`가 타입의 Single Source of Truth
- `any` 사용 최소화, `@ts-ignore` 금지
- Task, Group, Profile, Notification, TaskAssignee 등 정의

### 컴포넌트
- 함수형 컴포넌트 + Hooks만 사용 (class 컴포넌트 금지)
- import 순서: React/RN -> 서드파티 -> 로컬 (@/ 경로 별칭 사용)
- boolean 변수: is/has/should 접두사

### 상태관리 규칙
- 서버 상태 -> React Query (useQuery/useMutation)
- UI/로컬 상태 -> Zustand 스토어
- 컴포넌트 상태 -> useState

### API 패턴
- Supabase 클라이언트: `lib/supabase.ts` 싱글턴만 사용
- 반환 형태: `{ data, error }` 구조
- soft delete: 항상 `deleted_at IS NULL` 필터
- 날짜: `date-fns` 사용, DB 저장 형식 `yyyy-MM-dd`

### UX 패턴
- 햅틱: expo-haptics (Light: 짧은 탭, Heavy: 중요 액션)
- 토스트: `showToast('success'|'error'|'info', message)`
- 빈 catch 블록 금지 - 항상 에러 로깅 + 사용자 알림

---

## 아키텍처

### 디렉토리 구조
```
app/
  _layout.tsx              # 루트: 폰트, QueryClient, Auth 리다이렉트
  auth.tsx                 # 인증 (로그인/회원가입)
  onboarding.tsx           # 첫 실행 온보딩
  day.tsx                  # [모달] 일별 상세 뷰
  group-detail.tsx         # [모달] 그룹 상세
  (tabs)/
    _layout.tsx            # 탭 레이아웃 (5탭: Home/Backlog/Add/Group/Profile)
    index.tsx              # Home: 주간 타임라인 (가장 복잡)
    backlog.tsx            # 백로그 (due_date=null)
    add.tsx                # 추가 (모달 트리거)
    group.tsx              # 그룹 목록
    profile.tsx            # 프로필/설정

components/                # 27개 컴포넌트
  AddTaskModal.tsx         # 작업 생성 (개인/그룹, 날짜/시간/위치/담당자)
  EditTaskBottomSheet.tsx  # 작업 수정 BottomSheet
  AppHeader.tsx            # 상단 헤더
  NotificationCenterModal.tsx
  CreateGroupModal.tsx / JoinGroupModal.tsx
  LocationInput.tsx        # Google Places 자동완성
  MentionInput.tsx         # @멘션 입력
  AssigneeAvatars.tsx      # 담당자 아바타
  ...

lib/
  api/                     # Supabase API 함수
    tasks.ts               # 작업 CRUD (가장 큰 파일)
    groups.ts              # 그룹 관리
    profiles.ts            # 프로필 관리
    notifications.ts       # 알림
    subscription-limits.ts # 구독 제한 체크
  hooks/                   # 커스텀 훅
    use-auth.ts            # 인증/프로필
    use-week-tasks.ts      # 주간 작업
    use-backlog-tasks.ts   # 백로그 작업
    use-notification-realtime.ts  # 알림 Realtime
    use-subscription-limits.ts    # 구독 제한
  stores/                  # Zustand 스토어
    useCalendarStore.ts    # 주간/일별 뷰 상태, 낙관적 업데이트, 알림 스케줄
    useGroupStore.ts       # 그룹 CRUD, Realtime 구독, 정렬
    useTaskStore.ts        # 작업 목록
    useTaskFilterStore.ts  # 필터 (개인/그룹별)
  utils/
    task-filtering.ts      # 날짜별 그룹핑, 롤오버 계산
    task-notifications.ts  # 로컬 푸시 알림 스케줄
  types.ts                 # 타입 정의 (Single Source of Truth)
  supabase.ts              # Supabase 클라이언트 싱글턴
  query-client.tsx         # React Query 설정

constants/
  colors.ts                # 디자인 토큰
  calendar.ts              # 주간 범위 계산 (getWeeklyCalendarRanges)
  subscription.ts          # 구독 티어 설정
```

### React Query 키
```
['tasks', 'timeline']              # 타임라인
['tasks', 'backlog']               # 백로그
['tasks', 'week', weekStartStr]    # 주간
['groups', 'my']                   # 내 그룹
['notifications', 'unread']        # 미읽음 수
['notifications', 'list']          # 알림 목록
```

---

## DB 스키마 핵심

### Task
- status: 'TODO' | 'DONE' | 'CANCEL'
- group_id=NULL -> 개인 작업, group_id=uuid -> 그룹 작업
- due_date=NULL -> 백로그, due_date < today AND status=TODO -> 롤오버 (오늘로 표시)
- soft delete: deleted_at 필드
- 그룹 작업은 task_assignees 테이블로 다중 담당자 관리

### Group
- 역할: OWNER / ADMIN / MEMBER
- 초대코드: 6자리 (RPC로 생성)
- OWNER: 모든 관리 권한, ADMIN: 멤버 강퇴, MEMBER: 자신만 관리

### Profile
- subscription_tier: 'free' | 'paid'
- free 제한: 그룹 3개, 백로그 5개, 일별 작업 5개

### RLS 규칙
- 모든 테이블 RLS 활성화
- 개인 작업: creator_id = auth.uid()
- 그룹 작업: 그룹 멤버만 접근
- 관리 기능: OWNER/ADMIN 역할 검사

### Realtime 구독
- group_members 변경 감지 (멤버 추가/제거/강퇴)
- notifications 테이블 변경 감지

---

## 기술 부채 (우선순위순)

### P0 - 출시 차단
1. ~~lib/api/tasks.ts 중복 Supabase 클라이언트~~ (2026-03-26 해결, fb9db6d)
2. ~~lib/supabase.ts 디버깅 코드 __DEV__ 가드 적용~~ (2026-03-26 해결, fb9db6d)
3. ~~Task 타입 'CANCELLED' -> 'CANCEL' 통일~~ (2026-03-26 해결, fb9db6d)
4. **EAS Build 미구성** - eas.json 생성 필요
5. **개인정보처리방침 URL** - 스토어 제출 필수

### P1 - 출시 전 권장
6. 테스트 프레임워크 설정 + 핵심 테스트 10개
7. GitHub Actions CI (lint + type-check + test)
8. Sentry 에러 모니터링
9. 거대 파일 분할 (REFACTORING_PLAN.md Phase 3 참조)
10. iOS 푸시 알림 설정 (APNs) - withNoPushEntitlement 플러그인 전환

### P2 - 개선
11. TypeScript strict 모드 점진적 활성화
12. 소셜 로그인 (Apple Sign-In, Google)
13. 결제 시스템 본 연동 (Stripe/RevenueCat)
14. UI 한국어 지역화

---

## 거대 파일 (리팩토링 대상)

| 파일 | 줄 수 | 분할 후보 |
|------|-------|----------|
| lib/api/tasks.ts | ~1642 | 쿼리빌더/타입 분리, 백로그/타임라인 전용 파일 |
| app/day.tsx | ~1636 | 헤더/섹션 컴포넌트 추출 |
| app/(tabs)/index.tsx | ~1526 | 롤오버/오늘/완료 섹션별 컴포넌트 |
| app/group-detail.tsx | ~1473 | 상단 정보/멤버 목록/설정 분리 |
| components/EditTaskBottomSheet.tsx | ~1398 | 폼 필드 그룹별 분리 |
| lib/stores/useGroupStore.ts | ~1092 | API 호출 로직을 api/groups.ts로 이동 |
| app/(tabs)/backlog.tsx | ~1044 | 리스트 아이템/필터 UI 분리 |

리팩토링 원칙: REFACTORING_PLAN.md 참조. 한 번에 하나만, 매 단계 검증, 단계별 커밋.

---

## 팀 구성

### 핵심 (5명)
1. **서버 엔지니어** - Supabase 인프라, DB, Edge Functions, 보안, 결제 webhook
2. **iOS 전문가** - EAS Build, 앱스토어, APNs, Apple Sign-In, IAP
3. **Android 전문가** - Play Store, FCM, Material Design, IAP
4. **UX/UI 전문가** - 디자인 시스템, 한국어화, 접근성, 스토어 에셋
5. **비즈니스 전략가** - 수익화, GTM, KPI, ASO, 마케팅

### 추천 (3명)
6. **QA 엔지니어** - 테스트 프레임워크, E2E, 크로스플랫폼 QA
7. **DevOps 엔지니어** - CI/CD, EAS Build, Sentry, 환경 분리
8. **프론트엔드 리드** - 리팩토링, 타입 통합, 아키텍처 정리

---

## 출시 로드맵

- **Phase 0 (2주)**: 기술 부채 P0 해결, EAS Build, CI 기본, 환경 분리
- **Phase 1 (3주)**: 테스트 작성, Sentry, 리팩토링 1차, 디바이스 테스트
- **Phase 2 (2주)**: 스토어 에셋, 개인정보처리방침, TestFlight/내부테스트, 푸시 알림
- **Phase 3 (1-2주)**: App Store + Play Store 심사 제출
- **Phase 4 (지속)**: 피드백 대응, 소셜 로그인, 결제 연동, 위젯

---

## 관련 문서

- `AGENTS.md` - 기존 AI 에이전트 가이드 (Cursor용, 상세 코드 예시 포함)
- `REFACTORING_PLAN.md` - 리팩토링 단계별 계획
- `STORE_PUBLISH_CHECKLIST.md` - 앱스토어 출시 체크리스트
- `APP_STORE_REVIEW_CHECKLIST.md` - 앱스토어 심사 체크리스트

---

## 환경 설정

- Bundle ID (iOS/Android): `io.rnxt.check`
- URL 스킴: `todaycheck`
- Supabase: `.env.local`에 URL/ANON_KEY/Google Places API Key
- Vercel: SPA 라우팅 (vercel.json)
- New Architecture: 활성화
- React Compiler: 활성화 (실험적)
