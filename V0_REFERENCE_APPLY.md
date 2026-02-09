# v0 참고 소스 적용 가이드

참고 소스 경로: `/Users/siro/Downloads/task-management-app (5)`  
**스택**: Next.js + Tailwind 4 + Radix UI (웹 전용)  
**현재 앱**: Expo + React Native + NativeWind

참고 소스는 **웹용**이므로 그대로 붙이지 말고, **레이아웃·스타일을 참고해서** RN 컴포넌트로 다시 만듭니다.

---

## 1. 컴포넌트 매핑

| 참고 소스 (task-management-app) | TodayCheck 적용 위치 |
|--------------------------------|----------------------|
| `app/page.tsx` | 주간 홈 구조 참고 → `app/(tabs)/index.tsx` |
| `components/date-section.tsx` | 요일별 카드(날짜+태스크 목록) → 주간/일별 뷰의 날짜 카드 |
| `components/task-item.tsx` | 태스크 한 줄(체크+제목+뱃지) → `WeekTaskCard` / 일별 태스크 행 |
| `components/app-header.tsx` | 상단 로고+알림 → `components/AppHeader.tsx` |
| `components/week-navigation.tsx` | 주 이동 ← → | `app/(tabs)/index.tsx` 내 주 네비게이션 |
| `components/add-task-modal.tsx` | 추가 모달 | `components/AddTaskModal.tsx` |
| `components/bottom-nav.tsx` | 하단 탭 | `app/(tabs)/_layout.tsx` 탭 바 |
| `app/backlog/page.tsx` | 백로그 화면 | `app/(tabs)/backlog.tsx` |
| `app/group/page.tsx`, `group/[id]/page.tsx` | 그룹 목록/상세 | `app/(tabs)/group.tsx`, `app/group-detail.tsx` |

---

## 2. 웹 → React Native 변환 규칙

- `div` → `View`
- `span`, `p`, `h1` 등 → `Text`
- `button` → `Pressable` (필요 시 `TouchableOpacity`)
- `className="..."` → 그대로 `className="..."` (NativeWind 지원)
- `cn(...)` → `className` 하나로 합치거나 조건부 클래스 문자열
- `hover:`, `active:` → RN에서는 `active:opacity-80` 등만 지원, 나머지는 생략하거나 `Pressable` style으로 처리
- `lucide-react` → 프로젝트에 이미 `lucide-react-native` 사용 중이면 아이콘만 동일하게 맞추기

---

## 3. 참고할 때 열어볼 파일 순서

1. **전체 흐름**: `task-management-app (5)/app/page.tsx`  
   → 주간 날짜 배열, 모달 열기, 토글 처리 흐름 참고.

2. **날짜 카드(요일별 블록)**: `components/date-section.tsx`  
   → “날짜 헤더 + 진행률 + 태스크 리스트” 구조를 `View`/`Text`/`Pressable`로 옮기기.

3. **태스크 한 줄**: `components/task-item.tsx`  
   → 체크 버튼, 제목, 지연 뱃지(+Nd), 시간/백로그/그룹 뱃지 → 기존 `WeekTaskCard`/일별 행에 스타일만 맞추기.

4. **상단 헤더**: `components/app-header.tsx`  
   → 로고·알림 버튼 배치를 `components/AppHeader.tsx`에 반영.

5. **색/테마**: `app/globals.css` (`:root` 변수)  
   → 필요하면 `constants/colors.ts` / `tailwind.config.js`에 맞춰 색만 가져오기 (이미 primary 등은 비슷하게 맞춰 둔 상태).

---

## 4. 한 컴포넌트씩 적용하는 순서 제안

1. **AppHeader**  
   참고: `app-header.tsx`  
   적용: `components/AppHeader.tsx`  
   → 레이아웃·아이콘·로고 텍스트만 참고해서 RN으로 구현.

2. **태스크 행(카드)**  
   참고: `task-item.tsx`  
   적용: 주간 뷰의 태스크 카드 또는 일별 리스트 아이템  
   → rounded-xl, 배경색(완료/지연/기본), 뱃지 위치를 NativeWind로 맞추기.

3. **날짜 섹션 카드**  
   참고: `date-section.tsx`  
   적용: 주간/일별의 “날짜 하나 + 그날 태스크들” 블록  
   → 오늘 강조(테두리/배경), “Today” 뱃지, 진행 텍스트 구조만 참고.

4. **주 네비게이션**  
   참고: `week-navigation.tsx`  
   적용: `index.tsx` 상단의 주 이동 UI  
   → “이전 주 / 2026.1.20–26 / 다음 주” 같은 구조만 가져오기.

5. **모달·백로그·그룹**  
   참고: `add-task-modal`, `backlog/page`, `group/page`  
   적용: 기존 `AddTaskModal`, `backlog.tsx`, `group.tsx` 등  
   → 레이아웃·버튼 위치·카드 스타일만 참고.

---

## 5. 참고 소스 테마(색) 가져오기 (선택)

참고 소스는 `globals.css`에서 `oklch`로 정의돼 있습니다.  
RN/NativeWind에서는 보통 hex를 쓰므로:

- [oklch to hex 변환](https://www.npmjs.com/package/oklch-to-hex) 또는 온라인 변환기로 hex로 바꾼 뒤  
- `constants/colors.ts` / `tailwind.config.js`의 `theme.extend.colors`에 넣어서  
  참고 디자인과 비슷한 톤으로 맞출 수 있습니다.  
  (지금 앱도 primary 등은 이미 비슷하게 맞춰져 있음.)

---

## 6. 요약

- **복사–붙여넣기 금지**: 웹(div/button)이므로 RN(View/Text/Pressable)로 **구조만 참고**해서 다시 작성.
- **스타일만 가져오기**: `className` 값(레이아웃, 색, 간격, 둥근 모서리)은 NativeWind로 그대로 옮기면 됨.
- **한 번에 하나씩**: AppHeader → 태스크 행 → 날짜 카드 → 주 네비 → 모달/백로그/그룹 순으로 적용하면 됨.

특정 화면(예: “주간 뷰의 날짜 카드만 먼저”)을 정해주면, 그 부분만 골라서 RN 코드 예시까지 써줄 수 있습니다.
