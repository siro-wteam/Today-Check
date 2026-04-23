# RN/Expo Prebuild Gate

네이티브 레이어 변경 시 prebuild 재생성 + dev client 재빌드가 **필수**. JS 번들 변경(Metro reload)만으로는 반영 불가.

## Prebuild 재생성이 필요한 변경

- `app.config.ts` / `app.config.js` / `app.json`의 plugins 배열, icon/splash 설정
- `expo-config-plugins` 종속성 추가/변경/제거
- 네이티브 모듈(`react-native-*`) 종속성 추가/제거
- `ios/` 또는 `android/` 하위 파일 직접 편집
- EAS config (`eas.json`) build profile 변경

## 필수 작업 순서

1. `npx expo prebuild --clean` (managed workflow면 가능, bare면 수동 처리)
2. iOS: `cd ios && pod install`
3. 개발 클라이언트 재빌드: `eas build -p ios --profile development` / `-p android`
4. **실기기 or 시뮬레이터에서 전체 스모크 테스트**. Metro만 재시작해서는 안 됨

## PR 체크리스트 (네이티브 변경 있을 때)

- [ ] Info.plist에 필요한 `NSUsageDescription` 키 모두 존재 (카메라/위치/사진/마이크 등)
- [ ] Privacy Manifest (iOS 17+) — SDK가 required-reason API 쓰면 `PrivacyInfo.xcprivacy` 항목 추가
- [ ] `AndroidManifest.xml`의 permissions 최소 원칙 (실제 사용하는 것만)
- [ ] `targetSdkVersion` — 새 Google Play 업로드는 최신 -1년 이내 요구
- [ ] 빌드가 dev client에서 실제로 동작하는지 확인 (crash log 0)

## Anti-patterns

- ❌ "app.config.ts만 바꿨으니 OTA로 배포" — plugins 변경은 native rebuild 필요
- ❌ "시뮬레이터에서 됐으니 iOS OK" — 실기기에서 권한 요청 흐름 따로 검증 필요
- ❌ Pod/Gradle 캐시로 생긴 stale 빌드 재사용 — `--clean` 또는 수동 cache clear
