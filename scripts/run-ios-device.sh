#!/bin/bash

# iOS 기기에서 앱 실행 스크립트 (환경 분리 + IP 자동 감지 + Metro bundler 자동 시작)
# 사용법: 
#   ./scripts/run-ios-device.sh dev     # 개발 환경
#   ./scripts/run-ios-device.sh prod    # 프로덕션 환경
#   ./scripts/run-ios-device.sh         # 기존 방식 (.env.local 사용)

# 환경 변수 확인
ENVIRONMENT=${1:-"local"}

# 환경별 파일 설정
case $ENVIRONMENT in
  "dev"|"development")
    ENV_FILE=".env.development"
    echo "🔧 개발 환경으로 실행합니다..."
    ;;
  "prod"|"production")
    ENV_FILE=".env.production"
    echo "🚀 프로덕션 환경으로 실행합니다..."
    ;;
  "local"|*)
    ENV_FILE=".env.local"
    echo "📱 로컬 환경으로 실행합니다..."
    ;;
esac

# 환경 파일 존재 확인
if [ ! -f "$ENV_FILE" ]; then
  # scripts 폴더에서 실행 중이면 프로젝트 루트로 이동
  if [ -f "../$ENV_FILE" ]; then
    ENV_FILE="../$ENV_FILE"
  else
    echo "❌ 오류: $ENV_FILE 파일을 찾을 수 없습니다."
    echo "   파일을 생성하거나 올바른 환경을 선택하세요."
    echo "   사용 가능한 환경: dev, prod, local"
    echo "   현재 위치: $(pwd)"
    echo "   찾는 파일: $ENV_FILE"
    exit 1
  fi
fi

# 환경 파일 복사 (local이 아닌 경우에만)
if [ "$ENVIRONMENT" != "local" ]; then
  echo "📋 $ENV_FILE → .env.local 복사 중..."
  # scripts 폴더에서 실행 중이면 경로 조정
  if [[ $ENV_FILE == ../* ]]; then
    cp "$ENV_FILE" "../.env.local"
  else
    cp "$ENV_FILE" .env.local
  fi
  echo "✅ 환경 변수가 적용되었습니다."
fi

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
# npx expo run:ios --device는 자동으로 Metro bundler를 시작합니다
# scripts 폴더에서 실행 중이면 프로젝트 루트로 이동
if [[ $ENV_FILE == ../* ]]; then
  cd ..
fi
REACT_NATIVE_PACKAGER_HOSTNAME=$IP npx expo run:ios --device

# 실행 완료 메시지
echo "🎉 앱 실행이 완료되었습니다."
if [ "$ENVIRONMENT" != "local" ]; then
  echo "💡 팁: 다른 환경으로 실행하려면:"
  echo "   ./scripts/run-ios-device.sh dev"
  echo "   ./scripts/run-ios-device.sh prod"
fi
