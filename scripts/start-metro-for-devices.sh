#!/bin/bash

# Metro를 한 번만 띄워서 iOS·Android 실기기가 동시에 연결할 때 사용
# 사용법:
#   터미널 1: ./scripts/start-metro-for-devices.sh
#   터미널 2: REACT_NATIVE_PACKAGER_HOSTNAME=<동일IP> npx expo run:ios --device --no-bundler
#   터미널 3: REACT_NATIVE_PACKAGER_HOSTNAME=<동일IP> npx expo run:android --device --no-bundler
# 또는 npm run start:devices 후 다른 터미널에서 ios:device:no-bundler, android:device:no-bundler

set -e
cd "$(dirname "$0")/.."

if command -v ipconfig >/dev/null 2>&1; then
  IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || ipconfig getifaddr en2 2>/dev/null)
elif command -v ip >/dev/null 2>&1; then
  IP=$(ip -4 route get 8.8.8.8 2>/dev/null | grep -oP 'src \K\S+' || true)
fi

if [ -z "$IP" ]; then
  echo "❌ IP 주소를 찾을 수 없습니다. Wi-Fi/이더넷을 확인하세요."
  exit 1
fi

echo "✅ Packager host: $IP"
echo "📦 Metro만 실행합니다. 다른 터미널에서:"
echo "   iOS:     REACT_NATIVE_PACKAGER_HOSTNAME=$IP npx expo run:ios --device --no-bundler"
echo "   Android: REACT_NATIVE_PACKAGER_HOSTNAME=$IP npx expo run:android --device --no-bundler"
echo "   npm run ios:device:no-bundler   /   npm run android:device:no-bundler"
echo ""
REACT_NATIVE_PACKAGER_HOSTNAME=$IP npx expo start
