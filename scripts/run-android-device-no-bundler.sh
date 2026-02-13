#!/bin/bash
# Android 실기기 빌드·설치만 (Metro는 별도 터미널에서 start-metro-for-devices.sh 실행)
set -e
cd "$(dirname "$0")/.."
if [ -z "$ANDROID_HOME" ] && [ -z "$ANDROID_SDK_ROOT" ]; then
  [ -d "$HOME/Library/Android/sdk" ] && export ANDROID_HOME="$HOME/Library/Android/sdk"
fi
[ -n "$ANDROID_HOME" ] && [ ! -f "android/local.properties" ] && echo "sdk.dir=$ANDROID_HOME" > android/local.properties
if [ ! -f "android/local.properties" ] && [ -z "$ANDROID_HOME" ]; then
  echo "❌ Android SDK를 찾을 수 없습니다. export ANDROID_HOME=\$HOME/Library/Android/sdk 또는 android/local.properties 에 sdk.dir 설정"
  exit 1
fi
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
REACT_NATIVE_PACKAGER_HOSTNAME=$IP npx expo run:android --device --no-bundler
