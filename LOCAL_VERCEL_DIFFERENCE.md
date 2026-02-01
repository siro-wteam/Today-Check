# 로컬 vs Vercel 환경 차이 해결 가이드

## 🔍 문제 상황

- ✅ 로컬 환경: 정상 동작
- ❌ Vercel 배포: AbortError 발생

## 🎯 원인 분석

### 1. 환경 변수 로드 방식 차이

**로컬 환경:**
```bash
# .env.local 파일에서 직접 로드
EXPO_PUBLIC_SUPABASE_URL=https://rfzongciokewupbrbuas.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

**Vercel 환경:**
```bash
# Vercel Dashboard에서 주입
# 빌드 시점에 환경 변수 고정
```

### 2. CORS 설정 문제 (가장 가능성 높음)

**Supabase Dashboard에서 확인:**
1. Supabase 프로젝트 대시보드 접속
2. Settings → API → CORS 설정
3. Vercel 도메인 추가 필요

### 3. 네트워크 환경 차이

**로컬:** `http://localhost:8081`
**Vercel:** `https://today-check.vercel.app`

## 🔧 해결 방안

### 1. Supabase CORS 설정 (즉시 확인)

**Supabase Dashboard → Settings → API:**

```
CORS origins:
https://today-check.vercel.app
https://*.vercel.app
http://localhost:8081
```

### 2. 환경 변수 확인

**Vercel Dashboard → Settings → Environment Variables:**
```
EXPO_PUBLIC_SUPABASE_URL=https://rfzongciokewupbrbuas.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

### 3. 빌드 로그 확인

**Vercel 빌드 로그에서:**
- 환경 변수가 제대로 주입되는지
- 빌드 과정에서 오류가 있는지

## 🚀 즉시 확인할 사항

### 1. Supabase CORS 설정
가장 가능성이 높은 원인입니다!

### 2. 네트워크 탭 확인
- Supabase API 요청이 있는지
- CORS 오류가 있는지
- 401/403 에러가 있는지

### 3. 콘솔 로그 확인
```
🔍 Testing Supabase connection...
✅ Supabase connection successful: 또는 ❌ Supabase connection failed:
🔍 initializeCalendar called: { isInitialized: false, force: false }
```

## 🎯 해결 순서

1. **Supabase CORS 설정** ⭐ (가장 중요)
2. **Vercel 환경 변수 재확인**
3. **재배포 및 테스트**
4. **네트워크 탭 디버깅**

## 💡 팁

로컬에서 동작하고 배포에서 안되는 경우 90%는 CORS 또는 환경 변수 문제입니다!
