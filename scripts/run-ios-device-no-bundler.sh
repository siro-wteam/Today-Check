#!/bin/bash
# iOS 실기기 빌드·설치만 (Metro는 별도 터미널에서 start-metro-for-devices.sh 실행)
# 무료(개인) Apple 개발자 팀 사용 시: Push Notifications는 비활성화됨(plugins/withNoPushEntitlement.js).
# 유료 Apple Developer Program 가입 후 푸시를 쓰려면 해당 플러그인 제거 후 prebuild 다시 실행.
set -e
cd "$(dirname "$0")/.."
if command -v ipconfig >/dev/null 2>&1; then
  IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || ipconfig getifaddr en2 2>/dev/null)
elif command -v ip >/dev/null 2>&1; then
  IP=$(ip -4 route get 8.8.8.8 2>/dev/null | grep -oP 'src \K\S+' || true)
fi
if [ -z "$IP" ]; then
  echo "❌ IP를 찾을 수 없습니다."
  exit 1
fi
echo "✅ Packager host: $IP (Metro가 이미 떠 있어야 합니다)"
EXPO_XCODE_ALLOW_PROVISIONING_UPDATES=true REACT_NATIVE_PACKAGER_HOSTNAME=$IP npx expo run:ios --device --no-bundler
