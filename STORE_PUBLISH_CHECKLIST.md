# TodayCheck 앱 스토어 출시 체크리스트

앱을 **Google Play Store**와 **Apple App Store**에 올리기 위해 해야 할 일을 단계별로 정리했습니다.

---

## 공통 준비 (두 스토어 모두)

### 1. 앱 식별자 정리
- **Android** (`app.json`): `android.package`가 현재 `com.anonymous.TodayCheck`입니다.  
  출시 전에 **본인 도메인 기반**으로 변경 권장 (예: `com.본인도메인.todaycheck`).  
  한 번 스토어에 올리면 패키지명 변경이 거의 불가능하므로 신중히 결정하세요.
- **iOS**: `ios.bundleIdentifier`는 이미 `com.siro.TodayCheck`로 되어 있습니다.  
  Apple Developer 계정에서 동일한 Bundle ID로 App을 등록해야 합니다.

### 2. 버전·빌드 번호
- `app.json` → `expo.version`: "1.0.0" (스토어에 노출되는 **앱 버전**).
- iOS는 **빌드 번호**(CFBundleVersion)도 필요합니다.  
  EAS Build 사용 시 `app.json`에 `expo.ios.buildNumber` 추가하거나, 첫 제출 후에는 EAS가 자동 올려주는 방식으로 관리할 수 있습니다.
- Android는 **versionCode**가 필요합니다.  
  `expo.android.versionCode`를 `app.json`에 추가하거나, EAS Build가 자동 부여하게 둘 수 있습니다.

### 3. 스토어용 에셋 준비
- **앱 아이콘**: 이미 `assets/images/`에 설정되어 있음.  
  각 스토어 가이드라인 크기 확인 후 필요 시 리사이즈.
- **스플래시**: `expo-splash-screen` 설정 있음.
- **스크린샷**:  
  - **Android**: 폰/태블릿 최소 2장 이상 (기기별 요구사항 확인).  
  - **iOS**: 6.5", 5.5" 등 요구 사이즈별 스크린샷.
- **소개 문구**: 앱 한 줄 설명, 상세 설명, 키워드(Android), 부제(선택) 등.

### 4. 개인정보 처리방침 URL (필수)
- 두 스토어 모두 **개인정보 처리방침** 페이지 URL이 필요합니다.
- Supabase(회원/데이터)를 쓰므로, 수집 항목·이용 목적·보관 기간·제3자 제공 등을 적은 페이지를 웹에 올리고 URL을 준비하세요.

### 5. 백엔드·보안
- Supabase 프로젝트가 **프로덕션** 설정인지 확인 (환경 변수, RLS 정책 등).
- API 키 등은 앱에 하드코딩하지 말고 환경 변수/빌드 시 주입 방식 사용 권장.

---

## Google Play Store (Android)

### 1. 개발자 계정
- [Google Play Console](https://play.google.com/console) 가입.
- **일회성 등록비** 약 $25.

### 2. 앱 등록
- Play Console에서 “앱 만들기” 선택.
- 앱 이름, 기본 언어, 유료/무료, 개인정보 처리방침 URL 입력.

### 3. 빌드 제출
- **AAB(Android App Bundle)** 제출이 필수입니다. (APK만으로는 신규 앱 불가.)
- 로컬:  
  `npx expo run:android --variant release`  
  로 APK는 만들 수 있지만, AAB는 **EAS Build** 사용이 가장 쉽습니다.
  ```bash
  npx eas build --platform android --profile production
  ```
- 생성된 AAB를 Play Console → 해당 앱 → “출시” → “프로덕션” (또는 내부 테스트)에서 업로드.

### 4. 스토어 등록 정보 입력
- 스크린샷, 설명, 카테고리, 콘텐츠 등급(설문 기반), 타겟 연령 등.
- “데이터 안전” 섹션: 수집하는 데이터 종류(이메일, 계정 등)와 처리 방식 입력.

### 5. 검토 후 출시
- 검토 통과 후 “출시”하면 스토어에 노출됩니다.

---

## Apple App Store (iOS)

### 1. Apple Developer Program
- [developer.apple.com](https://developer.apple.com) 에서 **Apple Developer Program** 가입 (연 $99).

### 2. App Store Connect에서 앱 생성
- [App Store Connect](https://appstoreconnect.apple.com) 로그인.
- “앱” → “+” → 새 앱 추가.
- **Bundle ID**: Xcode/EAS에서 쓰는 것과 동일하게 `com.siro.TodayCheck` 선택(또는 등록).

### 3. 빌드 제출
- iOS는 **Xcode 아카이브** 또는 **EAS Build**로 빌드 후 업로드.
  ```bash
  npx eas build --platform ios --profile production
  ```
- 빌드가 끝나면 EAS에서 “Submit to App Store”로 제출하거나,  
  다운로드한 IPA를 Transporter 앱으로 업로드할 수 있습니다.

### 4. 스토어 등록 정보 입력
- 앱 이름, 부제, 설명, 키워드, 카테고리.
- 스크린샷(필수 사이즈별), 개인정보 처리방침 URL.
- 가격(무료면 “0”), 지역 등.

### 5. 검토 제출
- “앱 검토에 제출” 후, Apple 검토(보통 1~2일) 후 승인되면 “출시” 가능.

---

## EAS Build 사용 시 (권장)

Expo Application Services(EAS)를 쓰면 Android AAB와 iOS 빌드를 한 번에 관리하기 쉽습니다.

1. **EAS 로그인**
   ```bash
   npx eas login
   ```

2. **프로젝트 설정**
   ```bash
   npx eas build:configure
   ```
   - `eas.json`이 생성됩니다.  
   - `production` 프로필에 맞게 환경 변수(예: Supabase URL/키) 설정.

3. **Android AAB 빌드**
   ```bash
   npx eas build --platform android --profile production
   ```

4. **iOS 빌드**
   ```bash
   npx eas build --platform ios --profile production
   ```
   - 첫 iOS 빌드 시 인증서·프로비저닝은 EAS가 안내하거나 자동 생성해 줍니다.

5. **(선택) 제출 자동화**
   ```bash
   npx eas submit --platform android --latest
   npx eas submit --platform ios --latest
   ```

---

## 요약 체크리스트

| 항목 | Android | iOS |
|------|---------|-----|
| 개발자 계정 | Play Console ($25) | Apple Developer ($99/년) |
| 앱 식별자 | package 수정 권장 | bundleIdentifier 확인 |
| 빌드 형식 | AAB (EAS 권장) | IPA (EAS 또는 Xcode) |
| 개인정보 처리방침 | URL 필수 | URL 필수 |
| 스크린샷·설명 | Play Console 입력 | App Store Connect 입력 |
| 콘텐츠 등급 | Play Console 설문 | App Store 연령 등급 |

먼저 **개인정보 처리방침 페이지**와 **Android package 이름**을 정한 뒤, EAS로 한 번씩 빌드해 보는 순서를 추천합니다.
