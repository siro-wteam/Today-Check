# App Store 심사 준비 체크리스트

$99 Apple Developer Program 가입 후 앱을 제출하기 전에 확인·준비할 항목입니다.

---

## 1. 반드시 해결해야 할 항목 (심사 거절 가능)

### 1.1 개인정보 처리방침(Privacy Policy) URL
- **적용됨:** 영문 Privacy Policy 초안 작성 및 앱 내 적용 완료.
  - **내용:** `constants/privacy-policy.ts` (영문, 수집 항목·이용 목적·제3자·보안·권리·연락처 등)
  - **웹:** `/privacy` 라우트(`app/privacy.tsx`)에서 동일 내용 노출. 웹 앱 배포 시 `https://your-domain.com/privacy` 로 접근 가능.
  - **앱 내:** About 화면의 "Privacy Policy" 탭 시 → `EXPO_PUBLIC_PRIVACY_POLICY_URL`이 있으면 해당 URL 오픈, 없으면 **앱 내에서** 정책 전문 표시 (심사 거절 방지).
- **제출 전:** 웹 앱을 배포한 뒤 `EXPO_PUBLIC_PRIVACY_POLICY_URL=https://your-domain.com/privacy` 로 설정하고, App Store Connect의 **Privacy Policy URL**에도 동일 URL 입력.

### 1.2 이용약관(Terms of Service) URL (선택이지만 권장)
- **현재:** 로그인 화면에 "By continuing, you agree to our Terms of Service and Privacy Policy" 문구만 있음 (링크 없음)
- **권장:** 이용약관 페이지를 만들고, 로그인 화면·설정 등에서 링크 제공

### 1.3 iOS 권한 설명 문구 (사진/카메라)
- **현재:** `expo-image-picker` 사용(그룹 이미지·프로필 사진)하지만, `app.json`에 카메라/사진 라이브러리 권한 설명이 없음
- **필수:** iOS는 권한 요청 시 사용 목적 설명이 없으면 심사에서 거절될 수 있음
- **조치:** `app.json`의 `plugins`에 `expo-image-picker` 설정 추가 (아래 적용됨)

---

## 2. 제출 전 권장 사항

### 2.1 콘솔 로그 정리
- **현재:** `app/(tabs)/index.tsx`, `app/_layout.tsx`, `app/group-detail.tsx` 등에 `console.log` 다수
- **권장:** 프로덕션 빌드에서는 제거하거나 `__DEV__`로 감싸기  
  예: `if (__DEV__) console.log(...)`
- 필수는 아니지만, 로그에 내부 정보가 나오지 않도록 정리하는 것이 좋음

### 2.2 앱 메타데이터 (App Store Connect)
- **앱 이름:** TodayCheck (또는 노출용 이름)
- **부제목/설명:** 앱 기능 설명 (예: 주간 할 일 관리, 그룹 태스크)
- **키워드:** 할 일, 태스크, 주간, 그룹 등
- **카테고리:** Productivity 등
- **연령 등급:** 4+ 등 (데이터 수집·소셜 기능에 따라 선택)
- **스크린샷:** iPhone 6.7", 6.5", 5.5" 등 필수 크기 준비
- **앱 아이콘:** 1024x1024 (무변형, 알파 없음)
- **Support URL:** 문의/지원용 웹 페이지 또는 이메일
- **Marketing URL:** (선택) 앱 소개 페이지

### 2.3 로그인 방식과 “Sign in with Apple”
- **현재:** 이메일/비밀번호만 사용 (Supabase Auth)
- **Apple 정책:** 앱에서 **타사 소셜 로그인**(Google, Facebook 등)을 제공하면 **Sign in with Apple**도 함께 제공해야 함
- **결론:** 지금은 이메일만 사용하므로 Sign in with Apple은 **필수는 아님**. 나중에 Google 로그인 등을 추가할 때 함께 추가하면 됨.

### 2.4 테스트
- **실기기:** 최소 1대 이상 iPhone에서 설치·실행 후 크래시 없이 핵심 플로우 동작 확인
- **계정:** 심사용 테스트 계정(이메일/비밀번호) 준비 → App Store Connect “앱 심사 정보”에 입력
- **그룹/초대:** 그룹 초대 코드 등 특수 시나리오가 있다면, 심사 노트에 사용 방법 적어 두기

### 2.5 기타
- **아이콘/스플래시:** `assets/images/`에 아이콘·스플래시 있음. 1024x1024 앱 아이콘이 App Store 규격에 맞는지 확인
- **버전:** `app.json`의 `version`(1.0.0)과 App Store Connect에 입력하는 버전 일치시키기

---

## 3. 적용해 둔 수정 사항

- **iOS 사진/카메라 권한 문구:** `app.json`의 `plugins`에 `expo-image-picker` 추가됨  
  - `photosPermission`: 그룹 이미지·프로필 사진 선택용  
  - `cameraPermission`: 그룹 이미지·프로필 사진 촬영용  
  - 다음 네이티브 빌드(`expo prebuild` 또는 `expo run:ios`) 시 Info.plist에 반영됨  

---

## 4. 요약

| 항목 | 상태 | 비고 |
|------|------|------|
| Privacy Policy URL | ✅ 앱 내 적용됨 | 웹 배포 후 URL 설정·Connect 입력 권장 |
| Terms of Service | ⚪ 권장 | 링크 추가 시 로그인 화면 등 수정 |
| iOS 권한 설명 (사진/카메라) | ✅ 적용됨 | `app.json` 플러그인 추가 |
| console.log 정리 | ⚪ 권장 | `__DEV__` 또는 제거 |
| App Store Connect 메타·스크린샷 | ❌ 수동 작업 | 제출 전 입력 |
| Sign in with Apple | ✅ 해당 없음 | 이메일 로그인만 사용 시 |

**정리:** Privacy Policy 실제 URL 확정 및 반영, App Store Connect 메타데이터·스크린샷 준비가 되면, 코드 측면에서는 심사 받을 수 있는 상태로 정리된 것입니다.  
개인정보 처리방침 페이지가 아직 없다면, 간단한 정적 페이지(예: GitHub Pages, Notion 공개 페이지)라도 만들어 URL만 확정해 두는 것을 권장합니다.
