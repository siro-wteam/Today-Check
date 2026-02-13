# Android 실기기에서 테스트하기

같은 Wi‑Fi + USB(또는 무선 디버깅)로 실기기에 빌드·설치하고 Metro에 연결하는 방법입니다.

> **APK만 빌드해서 Metro 없이 테스트**하려면 → [APK_BUILD_TEST_GUIDE.md](./APK_BUILD_TEST_GUIDE.md)

---

## 1. 준비 (한 번만)

### 1.1 Android SDK (필수)

Gradle이 Android SDK 경로를 알아야 빌드됩니다.

- **Android Studio 설치** 시 SDK는 보통 다음 경로에 설치됩니다.  
  - **Mac:** `~/Library/Android/sdk`  
  - **Windows:** `%LOCALAPPDATA%\Android\Sdk`
- 터미널에서 사용하려면 **환경 변수**를 설정하세요.  
  - Mac (zsh): `echo 'export ANDROID_HOME=$HOME/Library/Android/sdk' >> ~/.zshrc` 후 `source ~/.zshrc`  
  - 또는 매번 실행 전: `export ANDROID_HOME=$HOME/Library/Android/sdk`
- `ANDROID_HOME`을 설정한 뒤 `run-android-device.sh`를 실행하면, `android/local.properties`가 없을 경우 **자동으로** `sdk.dir`을 채워 줍니다.
- SDK를 다른 경로에 둔 경우: `android/local.properties` 파일을 만들고 한 줄만 넣으세요.  
  `sdk.dir=/실제/경로/Android/sdk`

### 1.2 개발자 옵션 & USB 디버깅

1. **설정** → **휴대전화 정보** (또는 **디바이스 정보**)
2. **소프트웨어 정보** → **빌드 번호**를 7번 연속 탭 → “개발자가 되었습니다” 메시지
3. **설정** → **개발자 옵션** → **USB 디버깅** 켜기
4. USB로 Mac/PC와 연결 후 기기에서 **“USB 디버깅 허용”** → **허용** (필요 시 “항상 허용” 체크)

### 1.3 (선택) 무선 디버깅 (Android 11+)

- **설정** → **개발자 옵션** → **무선 디버깅** 켜기  
- 기기와 PC가 **같은 Wi‑Fi**에 있어야 함  
- PC에서: `adb connect <기기IP>:<포트>` (무선 디버깅 화면에 IP:포트 표시됨)

### 1.4 네이티브 프로젝트 생성 (최초 1회)

```bash
npx expo prebuild --platform android
```

이미 `android/` 폴더가 있으면 생략 가능.

---

## 2. 실행 방법

### 방법 A: 스크립트 사용 (권장)

Mac/PC와 **같은 Wi‑Fi**에 Android 기기를 연결한 뒤:

```bash
./scripts/run-android-device.sh
```

- PC의 IP를 자동으로 잡아서 `REACT_NATIVE_PACKAGER_HOSTNAME`으로 설정
- `expo run:android --device`로 빌드·설치
- 끝나면 Metro를 계속 켜 둠 → 기기에서 앱 실행 시 해당 Metro에 연결

### 방법 B: 직접 명령

1. **USB로 기기 연결** (또는 무선 디버깅으로 `adb connect` 완료)
2. **같은 Wi‑Fi**에 PC와 기기 연결
3. PC IP 확인 (예: Mac `ipconfig getifaddr en0`)

```bash
# 빌드 + 기기 설치 (IP를 본인 환경에 맞게 변경)
REACT_NATIVE_PACKAGER_HOSTNAME=192.168.x.x npx expo run:android --device
```

4. 설치 후 Metro가 종료되면, 같은 호스트로 다시 실행:

```bash
REACT_NATIVE_PACKAGER_HOSTNAME=192.168.x.x npx expo start
```

---

## 3. 연결 확인

- **USB:** 터미널에서 `adb devices` → 기기 목록에 기기가 보이면 OK
- **Metro:** 앱 실행 시 터미널에 번들 요청 로그가 찍히면 Metro 연결 성공

---

## 4. 문제 해결

| 증상 | 확인 사항 |
|------|-----------|
| `adb devices`에 기기 없음 | USB 디버깅 허용, 케이블/포트, 다른 PC에서는 되는지 |
| 앱이 하얀 화면 / 연결 안 됨 | PC와 기기 **같은 Wi‑Fi**, `REACT_NATIVE_PACKAGER_HOSTNAME`에 PC IP 설정 후 Metro 재시작 |
| 빌드 실패 | `npx expo prebuild --platform android --clean` 후 다시 `run:android` |

---

## 5. iOS와 비교

| 항목 | iOS | Android |
|------|-----|---------|
| 실기기 스크립트 | `./scripts/run-ios-device.sh` | `./scripts/run-android-device.sh` |
| 연결 | USB (Xcode/기기 신뢰) | USB 또는 무선 디버깅 |
| Metro | 같은 Wi‑Fi + `REACT_NATIVE_PACKAGER_HOSTNAME` | 동일 |
