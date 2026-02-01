# Vercel 배포 문제 해결 가이드

## 🔍 현재 문제 상황

- 배포는 성공하지만 페이지 접속 시 무한 대기
- 콘솔 오류: `AbortError: signal is aborted without reason`

## 🔧 해결 방안

### 1. Vercel 환경 변수 설정 확인

**Vercel Dashboard → Settings → Environment Variables에서 확인:**

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

### 2. Supabase 연결 테스트

**로컬에서 환경 변수 테스트:**
```bash
# Vercel 환경 변수 가져오기
vercel env pull .env.production

# 프로덕션 환경으로 테스트
npm run build:prod
npm run start:prod
```

### 3. 빌드 로그 확인

**Vercel 빌드 로그에서 확인할 내용:**
- 환경 변수가 제대로 주입되었는지
- 빌드 과정에서 오류가 있는지
- Supabase 연결 테스트 통과 여부

### 4. 브라우저 개발자 도구 확인

**Network 탭 확인:**
- Supabase API 요청이 있는지
- 404/500 에러가 있는지
- CORS 오류가 있는지

**Console 탭 확인:**
- Supabase 관련 오류 메시지
- React hydration 오류
- 모듈 로딩 오류

## 🚀 즉시 확인할 사항

### 1. Vercel 환경 변수 설정
- Vercel Dashboard에 접속
- Environment Variables 탭 확인
- Production 환경에 Supabase 값이 있는지 확인

### 2. Supabase 프로젝트 상태
- Supabase Dashboard 접속
- 프로젝트가 활성 상태인지 확인
- API 키가 유효한지 확인

### 3. 로컬 테스트
```bash
# 현재 .env.production 값 확인
cat .env.production

# Vercel 환경 변수와 비교
vercel env ls
```

## 🛠️ 임시 해결 방안

### 1. 간단한 테스트 페이지 추가
Supabase 연결 없이 기본 UI만 테스트

### 2. 환경 변수 로깅 추가
앱 시작 시 환경 변수 값을 콘솔에 출력

### 3. 에러 바운더리 추가
Supabase 연결 실패 시 대체 UI 표시

## 📋 문제 해결 순서

1. **Vercel 환경 변수 확인** ⭐ (가장 가능성 높음)
2. **Supabase 프로젝트 상태 확인**
3. **빌드 로그 확인**
4. **로컬 환경 변수 테스트**
5. **브라우저 개발자 도구 분석**
