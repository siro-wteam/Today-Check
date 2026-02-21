# 아이콘·스플래시 적용 (iOS / Android)

## 1. 필요한 파일

다음 파일을 **`assets/images/`** 폴더에 두면 됩니다.

| 파일 | 용도 | 권장 크기 |
|------|------|-----------|
| **icon.png** | 앱 아이콘 (iOS·Android·웹 공용) | 1024×1024 |
| **splash-screen.png** | 스플래시 이미지 (iOS·Android 공용) | 1284×2778 등 (세로 비율) |

- **Android**는 `icon.png`를 그대로 사용합니다 (흰 배경 + 아이콘). 별도 `android-icon-*.png`는 없어도 됩니다.
- `app.json`에서 `icon`, `web.favicon`, `expo-splash-screen.image`, Android `adaptiveIcon.foregroundImage`가 위 경로를 가리키도록 이미 설정되어 있습니다.

## 2. app.json 설정 요약

- **아이콘**: `./assets/images/icon.png` (iOS, 웹, Android 포그라운드)
- **Android 적응형 아이콘**: 배경색 `#FFFFFF`, 포그라운드 `icon.png`
- **스플래시**: `./assets/images/splash-screen.png` (파란 그라데이션 + 아이콘 + TodayCheck + 태그라인), `resizeMode`: `contain`, 배경색 `#1E3A8A`

## 3. 적용 절차 (아이콘/스플래시 바꾼 뒤)

아이콘이나 스플래시 이미지를 **바꾼 경우**에는 네이티브 쪽을 다시 만들어야 앱에 반영됩니다.

### Android

```bash
npx expo prebuild --clean --platform android
npx expo run:android --variant release
```

또는 APK만 만들 때:

```bash
npx expo prebuild --clean --platform android
cd android && ./gradlew assembleRelease
```

설치 후 **앱 아이콘**은 홈 화면, **스플래시**는 앱 실행 직후에 확인할 수 있습니다.

### iOS

```bash
npx expo prebuild --clean --platform ios
npx expo run:ios --configuration Release
```

또는 Xcode에서 `ios/` 프로젝트를 열고 시뮬레이터/기기에서 실행하거나 Archive로 빌드합니다.

- **아이콘**: 홈 화면·앱 전환 화면
- **스플래시**: 앱 실행 직후

## 4. 확인 방법

| 확인 항목 | Android | iOS |
|-----------|---------|-----|
| **앱 아이콘** | 홈 화면·앱 서랍에 설치된 TodayCheck 아이콘 확인 | 홈 화면·앱 서랍 확인 |
| **스플래시** | 앱 실행 → 바로 뜨는 첫 화면 (진한 파란 배경 + 로고·문구) | 앱 실행 → 첫 화면 |

- **Expo Go**에서는 커스텀 아이콘/스플래시가 **적용되지 않습니다.**  
  반드시 **직접 빌드한 앱**(`expo run:android` / `expo run:ios` 또는 EAS Build 결과물)으로 확인해야 합니다.
- 스플래시는 **앱을 완전히 종료한 뒤 다시 실행**할 때만 보입니다. 백그라운드에서 복귀할 때는 나오지 않을 수 있습니다.

## 5. 한 줄 요약

1. `assets/images/icon.png`, `assets/images/splash-screen.png` 넣기  
2. `npx expo prebuild --clean --platform android` (또는 `ios`)  
3. `npx expo run:android --variant release` (또는 `run:ios`) 로 빌드 후 설치  
4. 홈 화면에서 아이콘, 앱 실행 시 스플래시 확인  
