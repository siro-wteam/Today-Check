# APK 빌드로 개발된 부분 테스트하기

Metro 없이 **APK 한 번 설치해서** 실기기/에뮬레이터에서 동작을 확인하는 방법입니다.  
(개발 시에는 [ANDROID_DEVICE_BUILD.md](./ANDROID_DEVICE_BUILD.md)처럼 Metro + 실기기 연결을 쓰면 됩니다.)

---

## 요약

| 목적 | 방법 | 결과물 |
|------|------|--------|
| **로컬에서 APK 만들어서 바로 테스트** | `expo run:android --variant release` | `android/app/build/outputs/apk/release/app-release.apk` |
| **디버그 APK (Metro 연결용)** | `expo run:android --device` | `android/app/build/outputs/apk/debug/app-debug.apk` (실행 시 Metro 필요) |
| **클라우드에서 APK 받기** | EAS Build (선택) | 다운로드 링크로 APK 설치 |

**Metro 없이 혼자 돌아가는 앱**으로 테스트하려면 **Release APK**를 쓰면 됩니다.

- **Release APK**: JS 번들이 APK 안에 포함되어 있어서 **localhost:8081(Metro)이 안 떠 있어도** 그대로 실행됩니다. 웹 서버 위치 설정이나 재빌드 필요 없음.
- **Debug APK**: 실행 시 Metro(8081)에서 번들을 불러오므로, **Metro가 떠 있어야** 정상 동작합니다.

---

## 1. 준비 (한 번만)

- **Android SDK**: [ANDROID_DEVICE_BUILD.md](./ANDROID_DEVICE_BUILD.md)의 “1. 준비”처럼 `ANDROID_HOME` 설정 및 `android/local.properties` 확인.
- **네이티브 프로젝트**: `android/` 폴더가 없으면  
  `npx expo prebuild --platform android`  
  한 번 실행.

---

## 2. Release APK 빌드 (번들 포함, Metro 불필요)

### 방법 A: npm 스크립트 (기기/에뮬레이터 연결 시)

프로젝트 루트에서:

```bash
npm run android:apk
```

또는 직접:

```bash
npx expo run:android --variant release
```

- **에뮬레이터/기기 선택**: 실행 시 연결된 기기나 에뮬레이터를 고르라는 메뉴가 나오면 원하는 것을 선택.
- 기기가 없으면 adb 오류(`no devices/emulators found` 등)로 **실패할 수 있습니다**. 그럴 때는 **방법 B**를 쓰세요.

### 방법 B: Gradle만 사용 (기기 없이 APK만 만들기)

에뮬레이터/기기를 연결하지 않았거나, `npm run android:apk` 실행 시 adb 오류가 나면 아래처럼 **Gradle로만** 빌드하면 됩니다.

```bash
cd android
./gradlew assembleRelease
```

- **처음 빌드**는 5~10분 정도 걸릴 수 있습니다 (Gradle 다운로드, 네이티브 컴파일, JS 번들 생성 포함).
- 끝나면 같은 경로에 APK가 생성됩니다.

**APK 위치 (방법 A·B 동일):**

```
android/app/build/outputs/apk/release/app-release.apk
```

이 APK에는 JS 번들이 **포함**되어 있어서, **Metro를 켜지 않아도** 설치만 하면 앱이 실행됩니다.

---

## 3. APK 설치해서 테스트

### 3.1 USB로 연결된 기기 (adb)

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

- `-r`: 기존에 설치된 같은 앱이 있으면 덮어쓰기(재설치).
- 다른 경로에 APK를 둔 경우 해당 경로로 바꾸면 됩니다.

### 3.2 APK 파일만 옮겨서 설치

1. `app-release.apk`를 이메일/드라이브/메신저로 본인에게 보내거나, USB로 기기에 복사.
2. 기기에서 해당 파일을 탭해서 설치.  
   (필요하면 **설정 → 보안**에서 “알 수 없는 앱 설치” 허용.)

설치 후 앱 아이콘으로 실행하면, **개발 서버 없이** 빌드 시점의 코드로 동작합니다.

---

## 4. 디버그 APK vs Release APK

| 구분 | 디버그 APK | Release APK |
|------|------------|-------------|
| **만드는 방법** | `expo run:android` (기본) 또는 `./gradlew assembleDebug` | `expo run:android --variant release` |
| **출력 경로** | `android/app/build/outputs/apk/debug/app-debug.apk` | `android/app/build/outputs/apk/release/app-release.apk` |
| **실행 시** | 기본적으로 **Metro**에서 JS 로드 (개발용) | APK 안에 번들 포함 → **Metro 없이** 실행 |
| **용도** | 실기기 + Metro로 개발·디버깅 | “APK만 배포해서” 동작 확인, 내부 테스트 |

개발된 기능을 **APK만으로** 테스트하려면 Release APK를 쓰면 됩니다.

---

## 5. (선택) EAS Build로 APK 받기

Expo Application Services(EAS)를 쓰면 클라우드에서 APK를 빌드해 받을 수 있습니다.

### 5.1 EAS CLI & 로그인

```bash
npm install -g eas-cli
eas login
```

### 5.2 eas.json 설정 (APK로 받고 싶을 때)

프로젝트 루트에 `eas.json`이 없으면 생성:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

- `"buildType": "apk"`: AAB 대신 **APK**로 받기 (기기에 바로 설치 가능).
- `preview` / `production`은 프로필 이름이므로, 팀에 맞게 이름을 바꿔도 됩니다.

### 5.3 빌드 실행

```bash
eas build --platform android --profile preview
```

완료 후 Expo 대시보드에서 **APK 다운로드** 링크가 나옵니다. 받은 APK를 기기에 설치해 테스트하면 됩니다.

---

## 6. 자주 쓰는 명령 정리

```bash
# Release APK 빌드 (번들 포함, Metro 불필요)
npm run android:apk
# 또는: npx expo run:android --variant release

# 빌드된 Release APK 설치 (adb)
adb install -r android/app/build/outputs/apk/release/app-release.apk

# 디버그 APK만 빌드 (실기기 없이)
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 7. 문제 해결

- **SDK location not found**: [ANDROID_DEVICE_BUILD.md](./ANDROID_DEVICE_BUILD.md)의 SDK 설정을 확인하고, `android/local.properties`에 `sdk.dir`이 있는지 봅니다.
- **Release 빌드 서명 오류**: 이 프로젝트는 release도 **debug keystore**로 서명되도록 되어 있어, 별도 keystore 없이 로컬 테스트용 APK를 만들 수 있습니다. 스토어 제출용은 나중에 별도 keystore 설정이 필요합니다.
- **앱이 빈 화면/에러**: Release APK는 **빌드 시점의 코드**가 들어갑니다. 수정한 뒤에는 다시 `expo run:android --variant release`로 빌드하고 APK를 재설치해야 합니다.

이 가이드만 따라하면 **APK 빌드 → 설치 → Metro 없이 실행**까지 한 사이클로 테스트할 수 있습니다.
