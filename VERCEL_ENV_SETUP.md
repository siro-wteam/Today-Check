# Vercel 환경 변수 설정 가이드

## 🚨 즉시 확인할 사항

### 1. Vercel Dashboard 환경 변수 설정

**경로:** Vercel Dashboard → Project → Settings → Environment Variables

**Production 환경에 추가:**
```
EXPO_PUBLIC_SUPABASE_URL=https://your-prod-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key-here
```

### 2. 설정 확인 방법

**Vercel CLI로 확인:**
```bash
# Vercel 로그인
vercel login

# 프로젝트 연결
vercel link

# 환경 변수 확인
vercel env ls
```

**웹 대시보드로 확인:**
1. Vercel 프로젝트 대시보드 접속
2. Settings → Environment Variables
3. Production 탭에서 환경 변수 확인

### 3. 재배포 방법

**환경 변수 설정 후:**
```bash
# 변경 사항 푸시
git push origin dev

# 또는 수동 재배포
vercel --prod
```

### 4. 디버깅 로그 확인

**배포 후 브라우저 콘솔에서:**
```
🔍 Environment Variables Debug:
EXPO_PUBLIC_SUPABASE_URL: [URL 값]
EXPO_PUBLIC_SUPABASE_ANON_KEY: ✅ Set 또는 ❌ Missing

🔍 Supabase Config Debug:
supabaseUrl: ✅ Set 또는 ❌ Missing
supabaseAnonKey: ✅ Set 또는 ❌ Missing

🔍 Testing Supabase connection...
✅ Supabase connection successful: 또는 ❌ Supabase connection failed:
```

## 🎯 문제 해결 순서

### 1단계: 환경 변수 설정
- Vercel Dashboard에 Supabase 값 추가
- Production 환경에만 설정 (Preview는 나중에)

### 2단계: 재배포
- 코드 푸시로 자동 배포
- 배포 로그 확인

### 3단계: 디버깅
- 브라우저 콘솔 로그 확인
- 환경 변수가 제대로 로드되는지 확인

### 4단계: 테스트
- 페이지 새로고침
- 네트워크 탭에서 Supabase 요청 확인

## 🚨 중요

**AbortError의 90%는 환경 변수 문제입니다!**

Vercel Dashboard에 환경 변수를 설정하면 대부분 해결됩니다.
