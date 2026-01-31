# Vercel 환경 변수 관리 가이드

## 🌐 Vercel 환경 설정

Vercel에서는 Preview/Production 환경을 자동으로 분리할 수 있습니다.

### 📋 환경 변수 설정 방법

#### 1. Vercel Dashboard 설정
1. Vercel 프로젝트 대시보드로 이동
2. **Settings** → **Environment Variables** 탭으로 이동
3. 다음 환경 변수들을 각 환경에 맞게 설정:

**Production 환경:**
```
EXPO_PUBLIC_SUPABASE_URL=https://your-prod-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key-here
```

**Preview/Development 환경:**
```
EXPO_PUBLIC_SUPABASE_URL=https://your-dev-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key-here
```

#### 2. Vercel CLI 설정 (선택사항)
```bash
# Production 환경 변수 설정
vercel env add EXPO_PUBLIC_SUPABASE_URL production
vercel env add EXPO_PUBLIC_SUPABASE_ANON_KEY production

# Preview 환경 변수 설정
vercel env add EXPO_PUBLIC_SUPABASE_URL preview
vercel env add EXPO_PUBLIC_SUPABASE_ANON_KEY preview

# Development 환경 변수 설정
vercel env add EXPO_PUBLIC_SUPABASE_URL development
vercel env add EXPO_PUBLIC_SUPABASE_ANON_KEY development
```

## 🚀 배포 방법

### Production 배포
```bash
# main 브랜치에 푸시하면 자동으로 Production 배포
git push origin main

# 또는 수동 Production 배포
vercel --prod
```

### Preview 배포
```bash
# 다른 브랜치에 푸시하면 자동으로 Preview 배포
git checkout feature/new-feature
git push origin feature/new-feature

# 또는 수동 Preview 배포
vercel
```

## 🔧 Vercel.json 설정

현재 `vercel.json`은 다음과 같이 설정되어 있습니다:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "build": {
    "env": {
      "EXPO_PUBLIC_SUPABASE_URL": "@supabase_url",
      "EXPO_PUBLIC_SUPABASE_ANON_KEY": "@supabase_anon_key"
    }
  },
  "env": {
    "EXPO_PUBLIC_SUPABASE_URL": "@supabase_url",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY": "@supabase_anon_key"
  }
}
```

## 📱 환경별 URL

- **Production**: `https://your-app.vercel.app`
- **Preview**: `https://your-app-<branch-name>-<hash>.vercel.app`

## 🔄 자동 배포 설정

### GitHub 연동
1. Vercel 프로젝트에서 GitHub 연동
2. **Settings** → **Git Integration**에서 브랜치별 배포 규칙 설정:

**Production 배포 규칙:**
- 브랜치: `main`
- 배포 환경: `Production`

**Preview 배포 규칙:**
- 브랜치: `*` (모든 브랜치)
- 배포 환경: `Preview`

## 🛠️ 로컬 개발과 Vercel 연동

### 로컬에서 Vercel 환경 변수 테스트
```bash
# Vercel 환경 변수를 로컬로 가져오기
vercel env pull .env.local

# 개발 환경으로 테스트
npm run start:dev

# 프로덕션 환경으로 테스트
npm run start:prod
```

## 🔐 보안 주의사항

1. **환경 변수 분리**: 각 환경별 Supabase 프로젝트를 별도로 관리
2. **키 보호**: Vercel Dashboard에서만 환경 변수 관리
3. **접근 제한**: 팀원별로 환경 변수 접근 권한 관리
4. **주기적 교체**: 주기적으로 Supabase 키 교체 권장

## 📊 모니터링

### Vercel Analytics
- 각 환경별 사용량 모니터링
- 성능 메트릭 확인
- 에러 추적

### Supabase Dashboard
- 각 환경별 데이터베이스 사용량 확인
- API 호출 모니터링
- 사용자 활동 추적

## 🚨 문제 해결

### 환경 변수가 적용되지 않을 때
1. Vercel Dashboard에서 환경 변수 확인
2. 빌드 로그에서 환경 변수 출력 확인
3. Vercel 재배포 실행

### Supabase 연결 오류
1. 환경 변수 값 확인
2. Supabase 프로젝트 상태 확인
3. 네트워크 연결 확인

## 🎯 모범 사례

1. **환경 분리**: dev/staging/prod 환경 명확히 분리
2. **자동화**: CI/CD 파이프라인 구축
3. **모니터링**: 각 환경별 상태 모니터링
4. **문서화**: 환경 설정 문서 최신 유지
