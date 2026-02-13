# TodayCheck - 프로젝트 요약

## 📋 프로젝트 개요

**TodayCheck**는 "Simple like a To-do list, but managed like Jira" 컨셉의 개인 및 그룹 태스크 관리 애플리케이션입니다.

- **타입**: 크로스 플랫폼 모바일 앱 (iOS, Android, Web)
- **주요 기능**: Timeline View, Ghost Task, Backlog 관리, 그룹 태스크 협업
- **목표**: 간단한 To-do 앱의 직관성과 Jira의 체계적 관리를 결합

---

## 🏗️ 기술 스택

### **Frontend**
| 기술 | 버전 | 역할 |
|------|------|------|
| **Expo** | ~54.0.31 | 크로스 플랫폼 프레임워크 (Managed Workflow) |
| **React Native** | 0.81.5 | 모바일 UI 프레임워크 |
| **React** | 19.1.0 | UI 라이브러리 |
| **TypeScript** | ~5.9.2 | 타입 안전성 (Strict mode OFF) |
| **Expo Router** | ~6.0.21 | 파일 기반 라우팅 시스템 |

### **Styling**
| 기술 | 역할 |
|------|------|
| **NativeWind** | Tailwind CSS for React Native (v4.2.1) |
| **Tailwind CSS** | Utility-first CSS 프레임워크 |
| **Lucide React Native** | 아이콘 라이브러리 |

### **State Management**
| 기술 | 역할 |
|------|------|
| **TanStack Query (React Query)** | 서버 상태 관리, 캐싱, 낙관적 업데이트 |
| **Zustand** | 로컬 상태 관리 (Calendar, Group, Task stores) |

### **Backend & Database**
| 기술 | 역할 |
|------|------|
| **Supabase** | PostgreSQL 데이터베이스, 인증, RLS (Row Level Security) |
| **@supabase/supabase-js** | Supabase 클라이언트 라이브러리 |

### **Utilities**
| 기술 | 역할 |
|------|------|
| **date-fns** | 날짜 조작 및 포맷팅 (v4.1.0) |
| **expo-haptics** | 햅틱 피드백 |
| **expo-notifications** | 푸시 알림 |
| **react-native-reanimated** | 애니메이션 라이브러리 |
| **burnt** | Toast 알림 (v0.13.0) |

---

## 📁 프로젝트 구조

```
TodayCheck/
├── app/                          # Expo Router 페이지 (파일 기반 라우팅)
│   ├── (tabs)/                   # 탭 네비게이션
│   │   ├── _layout.tsx           # 탭 레이아웃
│   │   ├── index.tsx             # 홈 (Timeline View - 주간 캘린더)
│   │   ├── backlog.tsx           # Backlog 화면
│   │   ├── group.tsx             # 그룹 관리 화면
│   │   ├── profile.tsx           # 프로필 화면
│   │   └── add.tsx               # 태스크 추가 (더미 탭)
│   ├── _layout.tsx               # Root 레이아웃
│   ├── auth.tsx                  # 인증 화면
│   ├── day.tsx                   # 일일 상세 화면
│   ├── group-detail.tsx          # 그룹 상세 화면
│   ├── privacy.tsx               # 개인정보 처리방침
│   └── modal.tsx                 # 모달 화면
│
├── components/                   # React 컴포넌트
│   ├── ui/                       # UI 기본 컴포넌트
│   │   ├── LogoIcon.tsx          # 로고 SVG 컴포넌트
│   │   ├── collapsible.tsx       # 접을 수 있는 UI
│   │   └── icon-symbol.tsx       # 아이콘 시스템
│   ├── AddTaskModal.tsx          # 태스크 생성 모달
│   ├── EditTaskBottomSheet.tsx   # 태스크 수정 Bottom Sheet
│   ├── AppHeader.tsx             # 앱 헤더 (로고, 알림 벨)
│   ├── AssigneeAvatars.tsx       # 담당자 아바타 표시
│   ├── CreateGroupModal.tsx      # 그룹 생성 모달
│   ├── JoinGroupModal.tsx        # 그룹 참여 모달
│   ├── NotificationCenterModal.tsx # 알림 센터
│   ├── DatePickerModal.tsx       # 날짜 선택 모달
│   ├── EmptyState.tsx            # 빈 상태 UI
│   └── ModalCloseButton.tsx      # 모달 닫기 버튼
│
├── lib/                          # 핵심 로직
│   ├── api/                      # API 함수
│   │   ├── tasks.ts              # 태스크 CRUD (1496줄)
│   │   ├── groups.ts             # 그룹 관리
│   │   ├── profiles.ts           # 프로필 관리
│   │   ├── notifications.ts      # 알림 관리
│   │   └── task-state-machine.ts # 태스크 상태 전환 로직
│   ├── hooks/                    # Custom Hooks
│   │   ├── use-auth.ts           # 인증 훅
│   │   ├── use-timeline-tasks.ts # Timeline 태스크 페칭
│   │   ├── use-today-tasks.ts    # 오늘 태스크 페칭
│   │   ├── use-backlog-tasks.ts  # Backlog 태스크 페칭
│   │   ├── use-week-tasks.ts     # 주간 태스크 페칭
│   │   └── use-create-task.ts    # 태스크 생성 훅
│   ├── stores/                   # Zustand Stores
│   │   ├── useCalendarStore.ts   # 캘린더 상태 관리
│   │   ├── useGroupStore.ts      # 그룹 상태 관리
│   │   └── useTaskStore.ts       # 태스크 상태 관리
│   ├── contexts/                 # React Contexts
│   │   └── NotificationSettingsContext.tsx # 알림 설정
│   ├── utils/                    # 유틸리티 함수
│   │   ├── task-filtering.ts     # 태스크 필터링 및 그룹화
│   │   └── task-notifications.ts # 태스크 알림 로직
│   ├── supabase.ts               # Supabase 클라이언트
│   ├── types.ts                  # TypeScript 타입 정의
│   └── query-client.tsx          # React Query 설정
│
├── constants/                    # 상수 정의
│   ├── colors.ts                 # 색상 팔레트, shadows, borderRadius
│   ├── theme.ts                  # 테마 설정
│   ├── calendar.ts               # 캘린더 유틸리티
│   └── privacy-policy.ts         # 개인정보 처리방침
│
├── hooks/                        # 공통 Hooks
│   ├── use-theme-color.ts        # 테마 색상 훅
│   └── use-color-scheme.ts       # 색상 스킴 훅
│
├── assets/                       # 정적 자산
│   ├── fonts/                    # Geist 폰트 (Regular, Medium, SemiBold, Bold)
│   └── images/                   # 이미지 (아이콘, 스플래시)
│
├── supabase/                     # 데이터베이스 스크립트
│   ├── migrations/               # SQL 마이그레이션 (미포함)
│   ├── test_notification_triggers.sql
│   ├── verify_search_path.sql
│   └── check_rls_status.sql
│
├── scripts/                      # 빌드 및 실행 스크립트
│   ├── run-ios-device.sh         # iOS 실기기 실행
│   ├── run-android-device.sh     # Android 실기기 실행
│   ├── start-metro-for-devices.sh # Metro 번들러 시작
│   └── patch-expo-ios-device.js  # Expo iOS 패치
│
├── .cursorrules                  # Cursor AI 규칙 (34줄)
├── package.json                  # 의존성 정의
├── tsconfig.json                 # TypeScript 설정 (Strict: false)
├── tailwind.config.js            # Tailwind 설정 (NativeWind)
├── app.json                      # Expo 설정
├── babel.config.js               # Babel 설정
├── metro.config.js               # Metro 번들러 설정
├── global.css                    # Tailwind 글로벌 스타일
└── README.md                     # 프로젝트 소개
```

---

## 🎯 핵심 기능

### 1. **Timeline View (주간 캘린더)**
- **Horizontal Day Paging**: 좌우 스와이프로 날짜 이동
- **Ghost Task**: 과거 미완료 태스크를 원래 날짜에 희미하게 표시 (회고 가능)
- **Rollover Tracking**: 지연된 태스크에 `+Nd` 배지 표시

### 2. **Backlog 관리**
- `due_date = NULL`인 태스크는 Backlog로 분류
- 스와이프로 빠른 스케줄링 (Do Today, Do Tomorrow, Pick Date)
- Inbox Zero 접근법

### 3. **그룹 태스크 협업**
- 1:N 태스크 할당 (1개 태스크 → N명 담당자)
- 담당자별 개별 완료 체크 (is_completed per assignee)
- 그룹 역할: OWNER, ADMIN, MEMBER
- 초대 코드 기반 그룹 가입

### 4. **Smart Task Management**
- **Short Tap**: 상태 토글 (TODO ↔ DONE)
- **Long Press**: Action Sheet (Complete/Postpone/Cancel/Delete)
- **Postpone to Tomorrow**: 내일로 연기 (original_due_date 유지)
- **Haptic Feedback**: Light for tap, Heavy for long press

---

## 🗄️ 데이터베이스 스키마

### **tasks 테이블**
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | Primary Key |
| creator_id | uuid | 생성자 (FK → auth.users) |
| group_id | uuid | NULL = 개인, NOT NULL = 그룹 태스크 |
| title | text | 태스크 제목 |
| status | enum | TODO, DONE, CANCELLED |
| due_date | date | NULL = Backlog, NOT NULL = 스케줄된 태스크 |
| due_time | time | 시간 (선택) |
| original_due_date | date | 생성 시 설정, 지연 계산에 사용 |
| completed_at | timestamp | 완료 시각 (DONE 시 자동 설정) |
| deleted_at | timestamp | Soft delete (NULL = 활성) |

### **task_assignees 테이블**
| 컬럼 | 타입 | 설명 |
|------|------|------|
| task_id | uuid | FK → tasks |
| user_id | uuid | FK → auth.users |
| is_completed | boolean | 담당자별 완료 여부 |
| completed_at | timestamp | 담당자별 완료 시각 |

### **groups 테이블**
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | Primary Key |
| name | text | 그룹 이름 |
| owner_id | uuid | 그룹 소유자 |
| invite_code | text | 6자리 초대 코드 |
| image_url | text | 그룹 이미지 URL |

### **group_members 테이블**
| 컬럼 | 타입 | 설명 |
|------|------|------|
| group_id | uuid | FK → groups |
| user_id | uuid | FK → auth.users |
| role | enum | OWNER, ADMIN, MEMBER |
| profile_color | text | UI 구분용 색상 |

---

## 🔐 보안 및 인증

- **Supabase Auth**: 이메일/비밀번호 인증
- **Row Level Security (RLS)**: 
  - 개인 태스크: `creator_id = auth.uid()`
  - 그룹 태스크: `group_id IN (사용자 그룹 목록)`
- **Soft Delete**: `deleted_at IS NULL` 필터링

---

## 🚀 빌드 및 실행 명령어

### **개발 환경**
```bash
npm start                          # Expo 개발 서버 시작
npm run android                    # Android 에뮬레이터
npm run ios                        # iOS 시뮬레이터
npm run web                        # 웹 브라우저
npm run lint                       # ESLint 실행
```

### **실기기 실행**
```bash
npm run ios:device                 # iOS 실기기 (Metro 포함)
npm run android:device             # Android 실기기 (Metro 포함)
npm run start:devices              # Metro 번들러만 시작
npm run ios:device:no-bundler      # iOS (Metro 제외)
npm run android:device:no-bundler  # Android (Metro 제외)
```

### **프로덕션 빌드**
```bash
npm run build                      # Web 빌드
npm run android:apk                # Android APK 빌드
```

---

## 📐 아키텍처 패턴

### **상태 관리 전략**
```typescript
// 서버 상태: React Query (캐싱, 자동 리페칭)
useQuery(['tasks', 'timeline'], getActiveTasksAndTimeline)

// 로컬 상태: Zustand (UI 상태, 선택된 날짜)
const { selectedDate, setSelectedDate } = useCalendarStore()
```

### **데이터 페칭 최적화**
```typescript
// OPTIMIZED: 단일 API 호출로 범위 내 모든 태스크 조회
getAllTasksInRange(startDate, endDate)

// 초기 로드: ±7일
// 페이지네이션: ±30일 (필요 시 확장)
// 최대 범위: ±6개월
```

### **Ghost Task 로직**
```typescript
if (due_date < today && status === 'TODO') {
  // 과거 섹션에 Ghost 생성
  pastSection.push({ ...task, isGhost: true });
  
  // Today 섹션에 실제 항목 생성
  todaySection.push({ ...task, isGhost: false });
}
```

---

## 🎨 디자인 시스템

### **색상 팔레트** (Tailwind Config)
- **Primary**: `#2563eb` (Blue-600)
- **Background**: `#F8FAFC` (슬레이트 회색 배경)
- **Text Main**: `#1e293b`
- **Text Sub**: `#64748b`
- **Error**: `#dc2626`
- **Success**: `#16a34a`

### **Border Radius**
- `sm`: 8px
- `md`: 12px
- `lg`: 16px
- `xl`: 20px

### **스타일링 규칙**
- ✅ **DO**: `className="px-4 py-2 bg-primary text-white"` (NativeWind)
- ❌ **DON'T**: `StyleSheet.create({...})` (React Native 기본 스타일링)

---

## 📚 관련 문서

### **설정 가이드**
- `SETUP_INSTRUCTIONS.md`: 초기 설정 가이드
- `SUPABASE_AUTH_SETUP.md`: Supabase 인증 설정
- `IOS_DEVICE_BUILD.md`: iOS 실기기 빌드 가이드
- `APK_BUILD_TEST_GUIDE.md`: Android APK 빌드 가이드
- `DEVICES_BOTH.md`: iOS/Android 실기기 동시 실행

### **기능 가이드**
- `NAVIGATION_GUIDE.md`: 네비게이션 구조
- `HORIZONTAL_PAGING_GUIDE.md`: 수평 페이징 구현
- `TIMELINE_VIEW_GUIDE.md`: Timeline View 및 Ghost Task
- `PAGINATION_GUIDE.md`: 윈도우 기반 페이지네이션
- `COMPLETED_AT_GUIDE.md`: 완료 날짜 그룹화
- `TIMEZONE_GUIDE.md`: 타임존 안전 처리
- `TAP_LONGPRESS_UX_GUIDE.md`: 터치 인터랙션 패턴
- `STATE_MACHINE_GUIDE.md`: 태스크 상태 전환 규칙

### **리팩토링 문서**
- `REFACTORING_PLAN.md`: 리팩토링 계획
- `OPTIMIZATION_COMPARISON.md`: 최적화 비교
- `V0_REFERENCE_APPLY.md`: v0 참고 소스 적용
- `RLS_POLICY_APPLY.md`: RLS 정책 적용
- `GROUP_TASK_IMPLEMENTATION_PLAN.md`: 그룹 태스크 구현 계획

---

## 🧪 테스트 및 린트

### **ESLint 규칙**
```javascript
// .eslintrc.js
{
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/no-unused-vars': 'warn',
  '@typescript-eslint/prefer-const': 'warn'
}
```

### **TypeScript 설정**
- **Strict Mode**: `false` (점진적 타입 강화)
- **Base**: `expo/tsconfig.base` 확장
- **Module Resolution**: `bundler`
- **Path Aliases**: `@/*` → `./`

---

## 🛠️ 개발 환경 요구사항

- **Node.js**: 18+
- **npm** or **yarn**
- **Expo CLI**: 설치 필요
- **Supabase 계정**: 백엔드 및 인증
- **iOS**: Xcode (macOS only)
- **Android**: Android Studio

---

## 📝 라이선스

MIT License

---

## 🤝 기여

이 프로젝트는 개인 학습 및 포트폴리오 목적으로 제작되었습니다.

---

**Made with ❤️ for productive task management**
