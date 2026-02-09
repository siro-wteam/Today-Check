#!/bin/bash

# iOS 기기에서 앱 실행 스크립트 (IP 자동 감지 + Metro bundler 자동 시작)
# 사용법: ./scripts/run-ios-device.sh
#
# 첫 설치 후 앱이 실행되지 않으면: iPhone 설정 → 일반 → VPN 및 기기 관리
# → 개발자 앱에서 본인 Apple ID 선택 → "신뢰" 탭

# 🔧 스크립트가 있는 위치에서 프로젝트 루트로 이동
cd "$(dirname "$0")/.."

# IP 주소 자동 감지
# en0 (일반 Wi-Fi) 또는 en1 (이더넷)에서 IP 찾기
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || ipconfig getifaddr en2 2>/dev/null)

if [ -z "$IP" ]; then
  echo "❌ 오류: IP 주소를 찾을 수 없습니다."
  echo "   Wi-Fi 또는 이더넷이 연결되어 있는지 확인하세요."
  exit 1
fi

echo "✅ 감지된 IP 주소: $IP"
echo "🚀 iOS 기기에서 앱 실행 중..."
echo "📦 Metro bundler가 자동으로 시작됩니다..."

# IP 주소를 환경 변수로 설정하고 실행
# 자동 서명 활성화를 위해 환경 변수 추가
EXPO_XCODE_ALLOW_PROVISIONING_UPDATES=true REACT_NATIVE_PACKAGER_HOSTNAME=$IP npx expo run:ios --device
