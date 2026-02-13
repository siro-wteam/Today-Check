#!/bin/bash

# Android 실기기에서 앱 실행 (IP 자동 감지 + Metro bundler 자동 시작)
# 사용법: ./scripts/run-android-device.sh
#
# 사전 준비:
#   - 기기: 설정 → 개발자 옵션 → USB 디버깅 ON (또는 무선 디버깅)
#   - USB 연결 또는 adb connect <IP:포트>
#   - PC와 기기가 같은 Wi-Fi에 연결

set -e
cd "$(dirname "$0")/.."

# Android SDK 경로 (Gradle이 사용). ANDROID_HOME이 없으면 Mac 기본 경로 시도
if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
  if [ -d "$HOME/Library/Android/sdk" ]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
  fi
fi
if [ -n "$ANDROID_HOME" ] && [ ! -f "android/local.properties" ]; then
  echo "sdk.dir=$ANDROID_HOME" > android/local.properties
fi
if [ ! -f "android/local.properties" ] && [ -z "$ANDROID_HOME" ]; then
  echo "❌ 오류: Android SDK를 찾을 수 없습니다."
  echo "   Android Studio를 설치하거나 커맨드라인 도구를 설치한 뒤, 다음 중 하나를 하세요."
  echo "   1) 환경 변수 설정: export ANDROID_HOME=\$HOME/Library/Android/sdk"
  echo "   2) android/local.properties 파일 생성 후 한 줄 작성: sdk.dir=/경로/Android/sdk"
  echo "   (Mac에서 Android Studio 기본 경로: \$HOME/Library/Android/sdk)"
  exit 1
fi

# IP 자동 감지 (Mac: en0/en1, Linux: 보통 eth0/wlan0)
if command -v ipconfig >/dev/null 2>&1; then
  IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || ipconfig getifaddr en2 2>/dev/null)
elif command -v ip >/dev/null 2>&1; then
  IP=$(ip -4 route get 8.8.8.8 2>/dev/null | grep -oP 'src \K\S+' || true)
fi

if [ -z "$IP" ]; then
  echo "❌ 오류: IP 주소를 찾을 수 없습니다."
  echo "   Wi-Fi 또는 이더넷이 연결되어 있는지 확인하세요."
  exit 1
fi

echo "✅ 감지된 IP 주소: $IP"
echo "🚀 Android 기기에서 앱 실행 중..."
echo "📦 Metro bundler가 자동으로 시작됩니다."
echo "   (기기가 USB로 연결되었는지, 또는 무선 디버깅으로 adb connect 되어 있는지 확인하세요.)"
echo ""

REACT_NATIVE_PACKAGER_HOSTNAME=$IP npx expo run:android --device
EXIT_CODE=$?

if [ "$EXIT_CODE" -ne 0 ]; then
  echo ""
  echo "⚠️  빌드/설치가 실패했을 수 있습니다."
  echo "   adb devices 로 기기 연결을 확인하세요."
  echo ""
fi

echo ""
echo "📦 Metro bundler를 실행합니다. 기기에서 앱을 열면 연결됩니다. 종료: Ctrl+C"
echo ""
REACT_NATIVE_PACKAGER_HOSTNAME=$IP npx expo start
