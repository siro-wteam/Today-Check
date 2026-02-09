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

# IP 주소를 환경 변수로 설정하고 실행 (빌드 + 설치; devicectl 이슈로 자동 실행이 실패할 수 있음)
# 자동 서명 활성화를 위해 환경 변수 추가
EXPO_XCODE_ALLOW_PROVISIONING_UPDATES=true REACT_NATIVE_PACKAGER_HOSTNAME=$IP npx expo run:ios --device
EXIT_CODE=$?
if [ "$EXIT_CODE" -ne 0 ]; then
  echo ""
  echo "⚠️  앱이 기기에서 자동 실행되지 않았을 수 있습니다."
  echo "   기기에서: 설정 → 일반 → VPN 및 기기 관리 → 개발자 앱 → 신뢰"
  echo ""
fi
# run:ios 종료 후에도 Metro를 계속 띄워 둠 (devicectl 경고 시 자동 실행이 안 되어도 기기에서 수동 실행 가능)
echo ""
echo "📦 Metro bundler를 실행합니다. 기기에서 앱을 열면 연결됩니다. 종료: Ctrl+C"
echo ""
REACT_NATIVE_PACKAGER_HOSTNAME=$IP npx expo start