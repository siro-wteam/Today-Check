# iOS + Android 실기기 동시 테스트

Metro를 **한 번만** 띄우고, iPhone과 Android 폰이 **같은 Metro**에 붙어서 동시에 테스트하는 방법입니다.

---

## 전제 조건

- **같은 Wi‑Fi**: Mac/PC, iPhone, Android 기기 모두 같은 공유기에 연결
- **iOS**: USB 연결, 개발자 신뢰 완료 (설정 → 일반 → VPN 및 기기 관리)
- **Android**: USB 디버깅 또는 무선 디버깅으로 `adb devices`에 기기 표시

---

## 3개 터미널로 실행

### 터미널 1: Metro만 실행

```bash
npm run start:devices
```

또는:

```bash
./scripts/start-metro-for-devices.sh
```

- PC IP로 Metro가 떠 있어서, 두 기기 모두 이 주소로 JS 번들을 받습니다.
- **이 터미널은 계속 켜 둡니다.** (종료: Ctrl+C)

---

### 터미널 2: iOS 실기기에 빌드·설치

```bash
npm run ios:device:no-bundler
```

또는:

```bash
./scripts/run-ios-device-no-bundler.sh
```

- Metro는 띄우지 않고, 빌드 후 기기에만 설치합니다.
- 설치가 끝나면 iPhone에서 앱을 실행하면 터미널 1의 Metro에 자동 연결됩니다.

---

### 터미널 3: Android 실기기에 빌드·설치

```bash
npm run android:device:no-bundler
```

또는:

```bash
./scripts/run-android-device-no-bundler.sh
```

- 마찬가지로 Metro는 띄우지 않고, 빌드 후 기기에만 설치합니다.
- 설치 후 Android에서 앱을 실행하면 같은 Metro에 연결됩니다.

---

## 순서 요약

| 순서 | 터미널 | 명령 | 설명 |
|------|--------|------|------|
| 1 | 1 | `npm run start:devices` | Metro 먼저 실행 (계속 켜 둠) |
| 2 | 2 | `npm run ios:device:no-bundler` | iOS 빌드·설치 (Metro 사용 안 함) |
| 3 | 3 | `npm run android:device:no-bundler` | Android 빌드·설치 (Metro 사용 안 함) |

2와 3은 동시에 실행해도 되고, 순서는 상관없습니다.  
두 기기에서 앱을 열면 **같은 Metro**에서 번들을 받습니다.

---

## 한 기기만 쓸 때

- **iOS만**: `npm run ios:device` (Metro 자동 실행)
- **Android만**: `npm run android:device` (Metro 자동 실행)

이 경우에는 터미널 하나로 충분합니다.
