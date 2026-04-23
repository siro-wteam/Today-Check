# OTA 업데이트 vs Store 재제출

모든 PR은 배포 경로가 **OTA 가능**(EAS Update로 즉시 배포)인지 **Store 재제출 필수**(TestFlight/Play Internal 업로드 후 심사)인지 명시해야 함.

## OTA-safe (EAS Update로 배포 가능)

- JavaScript/TypeScript 코드만 변경
- 이미지·폰트·JSON 등 assets 변경 (이미 번들된 타입)
- NativeWind/Tailwind 스타일 변경
- `constants/`, `components/`, `app/`, `lib/`, `hooks/` 하위 변경
- i18n 문자열 변경

→ `eas update --branch <production|preview> --message "$COMMIT_MSG"`로 즉시 배포

## Store-required (재제출 필수)

- `app.config.ts` / `app.json` plugins 배열 변경
- 네이티브 모듈(`react-native-*`) 추가/제거/버전 변경
- `ios/` 또는 `android/` 하위 파일 변경
- Info.plist NSUsageDescription 추가/변경
- `AndroidManifest.xml` permission 추가/제거
- `targetSdkVersion` / Xcode deployment target 변경
- iOS entitlements, capabilities 변경 (푸시, Sign in with Apple 등)
- Privacy Manifest (`PrivacyInfo.xcprivacy`) 변경
- 앱 아이콘 / splash 설정 변경 (이미지 파일은 OTA 가능하지만 config 변경은 재제출)

→ `eas build -p ios --profile production` + App Store Connect 업로드 → TestFlight → 심사

## PR 라벨 규칙

PR 생성 시 제목 또는 라벨에 명시:
- `ota-safe`: OTA 배포 가능
- `store-required`: Store 재제출 필요
- `mixed`: JS + 네이티브 동시 변경 — **JS를 먼저 머지 & OTA 금지**, native 포함한 build + store 재제출로 함께 배포

## 판별 체크리스트

변경 파일 목록에 다음 중 하나라도 있으면 **자동으로 store-required**:
```
ios/**
android/**
app.config.*
app.json
eas.json (build profile)
package.json (new native dep added)
plugins/** (config plugins)
```

## 리스크 시나리오

- `react-native-*` 추가 후 OTA 배포 → **앱 크래시** (네이티브 바이너리에 없는 모듈 참조)
- Info.plist 권한 문구만 OTA로 바꾸려 시도 → **적용 안 됨** (plist는 바이너리 임베드)
- EAS Update 채널 오염 시 구 버전 앱에 호환 안 되는 JS 배포 → rollback 필요
