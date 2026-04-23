# TodayCheck - Claude Code 프로젝트 가이드

> 상세 규칙은 `.claude/rules/`에서 자동 로드됨. 이 파일은 핵심 정보만 담는다.

## 프로젝트 개요

**"Simple like a To-do list, managed like pro"** - 개인/그룹 할일 관리 크로스플랫폼 앱.

| 영역 | 기술 |
|------|------|
| Framework | Expo 54 + React Native 0.81 + React 19 |
| Routing | Expo Router 6 (파일 기반, typed routes) |
| 상태관리 | Zustand (로컬) + TanStack React Query 5 (서버) |
| 스타일링 | NativeWind 4.2 - **StyleSheet.create 금지** |
| Backend | Supabase (PostgreSQL + Auth + RLS + Realtime) |
| 날짜 | date-fns 4.1 |
| 아이콘 | lucide-react-native |

---

## 빌드/검증

```bash
npm start              # Expo 개발 서버
npm run verify         # lint + test (push 전 필수)
npx tsc --noEmit       # 타입 체크
npm run build          # 웹 정적 빌드
```

커밋 형식: `type: description` (feat/fix/refactor/docs/chore)

---

## 핵심 규칙 5가지

1. **NativeWind 전용** - className만 사용, StyleSheet.create 절대 금지
2. **타입 SSoT** - `lib/types.ts`에 모든 타입 정의. any/@ts-ignore 금지
3. **상태관리** - 서버=ReactQuery, 로컬=Zustand, 컴포넌트=useState
4. **soft delete** - 모든 쿼리에 `.is('deleted_at', null)` 필수
5. **날짜** - date-fns 사용, DB 저장 형식 `yyyy-MM-dd`

---

## 디렉토리 구조

```
app/                    # Expo Router 페이지
  (tabs)/               # 5탭: Home/Backlog/Add/Group/Profile
  day.tsx, group-detail.tsx  # 모달 뷰
components/             # UI 컴포넌트 (~27개)
lib/
  api/                  # Supabase API (tasks, groups, profiles, notifications)
  hooks/                # 커스텀 훅 (use-auth, use-week-tasks 등)
  stores/               # Zustand (useCalendarStore, useGroupStore 등)
  utils/                # 유틸 (task-filtering, task-notifications)
  types.ts              # 타입 SSoT
  supabase.ts           # Supabase 싱글턴
constants/              # 디자인 토큰, 구독 설정
```

---

## 기술 부채

### P0 - 출시 차단
- ~~Supabase 싱글턴, 타입 통일, EAS Build~~ (해결)
- **개인정보처리방침 URL** - 스토어 제출 필수

### P1 - 출시 전 권장
- Sentry 에러 모니터링
- 거대 파일 분할 (아래 목록 참조)
- iOS 푸시 알림 (APNs)

### P2 - 개선
- TypeScript strict 모드 (117개 tsc 에러 잔존)
- 소셜 로그인, 결제 연동, 한국어 현지화

---

## 거대 파일 (1000줄+, 수정시 offset/limit 사용)

| 파일 | 줄 수 |
|------|-------|
| lib/api/tasks.ts | ~1642 |
| app/day.tsx | ~1636 |
| app/(tabs)/index.tsx | ~1526 |
| app/group-detail.tsx | ~1473 |
| components/EditTaskBottomSheet.tsx | ~1398 |
| lib/stores/useGroupStore.ts | ~1092 |
| app/(tabs)/backlog.tsx | ~1044 |

---

## 관련 문서

- `.claude/rules/` - 코딩 컨벤션, DB 스키마, React Query, 테스트 정책, RN/Expo 네이티브 gate / OTA vs Store / 환경변수 시크릿
- `REFACTORING_PLAN.md` - 리팩토링 단계별 계획
- `STORE_PUBLISH_CHECKLIST.md` - 앱스토어 출시 체크리스트

---

## 환경

- Bundle ID: `io.rnxt.check` / URL 스킴: `todaycheck`
- Supabase: `.env.local`에 URL/ANON_KEY
- 웹 배포: GCP Cloud Run (asia-northeast3) + nginx 정적 서빙
- 도메인: todo.rnxt.app
- 빌드/배포: Cloud Build (cloudbuild.yaml) -> Artifact Registry -> Cloud Run
- New Architecture + React Compiler 활성화
