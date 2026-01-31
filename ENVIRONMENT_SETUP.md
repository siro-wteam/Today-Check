# 환경 변수 관리 가이드

## 📁 환경 파일 구조

```
.env.local          # 현재 활성화된 환경 변수 (자동 생성)
.env.development    # 개발 환경 변수 (Supabase dev)
.env.production     # 프로덕션 환경 변수 (Supabase prod)
```

## 🚀 사용 방법

### iOS 기기 실행
```bash
# 기존 방식 (로컬 환경)
./scripts/run-ios-device.sh
npm run ios:device

# 개발 환경으로 iOS 기기 실행
./scripts/run-ios-device.sh dev
npm run ios:device:dev

# 프로덕션 환경으로 iOS 기기 실행
./scripts/run-ios-device.sh prod
npm run ios:device:prod
```

### 일반 iOS 실행
```bash
# 개발 환경으로 시뮬레이터 실행
npm run ios:dev

# 프로덕션 환경으로 시뮬레이터 실행
npm run ios:prod

# 기존 방식 (로컬 환경)
npm run ios
```

### 개발 환경 실행
```bash
# 개발 환경으로 시작
npm run start:dev
npm run android:dev
npm run ios:dev
npm run web:dev

# 빌드
npm run build:dev
```

### 프로덕션 환경 실행
```bash
# 프로덕션 환경으로 시작
npm run start:prod
npm run android:prod
npm run ios:prod
npm run web:prod

# 빌드
npm run build:prod
```

### 기존 방식 (현재 .env.local 사용)
```bash
npm start
npm run android
npm run ios
npm run web
```

## ⚙️ 환경 변수 설정

### 1. 개발 환경 설정 (.env.development)
```bash
# Supabase 개발 환경
EXPO_PUBLIC_SUPABASE_URL=https://your-dev-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key-here
```

### 2. 프로덕션 환경 설정 (.env.production)
```bash
# Supabase 프로덕션 환경
EXPO_PUBLIC_SUPABASE_URL=https://your-prod-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key-here
```

## 🏗️ EAS 빌드 설정

### 개발 빌드
```bash
eas build --profile development
```

### 프로덕션 빌드
```bash
eas build --profile production
```

## 🔐 보안 주의사항

- `.env.*` 파일들은 `.gitignore`에 포함되어 있어 깃허브에 올라가지 않음
- 각 환경별 Supabase 프로젝트를 별도로 관리
- 프로덕션 키는 절대 개발 환경에서 사용하지 않기
- 팀원들과는 개발 환경 변수만 공유

## 📱 앱 배포

### 개발 버전 배포 (TestFlight 등)
```bash
npm run android:dev
# 또
npm run ios:dev
```

### 프로덕션 버전 배포 (App Store/Play Store)
```bash
npm run android:prod
# 또
npm run ios:prod

# EAS 빌드
eas build --profile production
eas submit --platform android
eas submit --platform ios
```

## 🔄 환경 전환

환경을 전환할 때마다 해당 스크립트가 자동으로 `.env.local` 파일을 덮어쓰므로, 앱을 재시작해야 새 환경이 적용됩니다.

## 🛠️ 자동화

스크립트가 자동으로 환경 파일을 복사하므로 수동으로 `.env.local`을 관리할 필요가 없습니다. 각 환경에 맞는 스크립트를 실행하기만 하면 됩니다.
