# iOS 실기기 빌드 (재발 방지)

## 1. 프로비저닝 프로필 오류 방지

`expo run:ios --device` 시 "No profiles for 'com.siro.TodayCheck' were found" 가 나지 않도록 Expo CLI를 수정합니다.

- **scripts/patch-expo-ios-device.js**: 실기기 빌드 시 항상 `-allowProvisioningUpdates` 를 넘기도록 `node_modules/expo/.../XcodeBuild.js` 를 수정
- `npm install` 시 `postinstall` 에서 위 스크립트가 자동 실행
- **expo 버전을 올리면** 수정 대상 코드가 바뀌어 스크립트가 스킵될 수 있음. 그때는 `scripts/patch-expo-ios-device.js` 를 새 Expo 버전에 맞게 수정하거나, Xcode에서 수동 서명 설정

## 2. 앱이 설치 후 실행되지 않을 때 (신뢰 안내)

"invalid code signature or its profile has not been explicitly trusted" 가 나오면:

- **iPhone**: 설정 → 일반 → VPN 및 기기 관리 → 개발자 앱에서 **본인 Apple ID** 선택 → **"신뢰"** 탭
- 기기/Apple ID당 한 번만 하면 됨

## 3. 실행 방법

```bash
./scripts/run-ios-device.sh
# 또는
npm run ios:device
```

## 4. 무료(개인) 팀 사용 시 Push Notifications 오류

"Personal development teams do not support the Push Notifications capability" / "Provisioning profile doesn't include the aps-environment entitlement" 가 나오면:

- **원인**: 무료 Apple 개발자 팀은 Push Notifications capability를 지원하지 않음.
- **조치**: 이 프로젝트는 **plugins/withNoPushEntitlement.js** 로 `aps-environment` entitlement을 제거해 두었으므로, **지금 상태로 다시 빌드**하면 됨. (`ios/TodayCheck/TodayCheck.entitlements` 에서도 해당 키 제거됨.)
- **참고**: 푸시 알림 기능은 **유료 Apple Developer Program** 가입 후, `app.json` 의 `./plugins/withNoPushEntitlement.js` 플러그인을 제거하고 `npx expo prebuild --clean --platform ios` 실행하면 다시 사용할 수 있음.
