# Supabase CORS 설정 상세 가이드

## 🚨 즉시 설정할 내용

### 1. Supabase Dashboard 접속
```
https://supabase.com/dashboard/project/rfzongciokewupbrbuas
```

### 2. CORS 설정 경로
```
Settings → API → CORS settings
```

### 3. 현재 상태 확인
아마 이렇게 되어 있을 것:
```
CORS origins:
http://localhost:8081
```

### 4. 추가할 도메인
```
https://today-check.vercel.app
https://*.vercel.app
```

### 5. 설정 방법
1. "Add origin" 버튼 클릭
2. `https://today-check.vercel.app` 입력
3. "Add origin" 버튼 클릭
4. `https://*.vercel.app` 입력 (와일드카드)
5. "Save" 버튼 클릭

## 🎯 설정 후 확인

### 1. 대기 시간
- 설정 후 1-2분 대기
- Supabase 설정이 전파되는 시간 필요

### 2. 페이지 새로고침
- Vercel 페이지 새로고침
- 콘솔 로그 확인

### 3. 예상되는 로그
```
🔍 Testing Supabase connection...
✅ Supabase connection successful: { data: [...], error: null }
🔍 initializeCalendar called: { isInitialized: false, force: false }
✅ initializeCalendar success: { tasksCount: X, isInitialized: true }
```

## 💡 중요

**CORS 설정이 없으면:**
- 브라우저가 Supabase API 요청 차단
- `🔍 Testing Supabase connection...` 후 결과 없음
- AbortError 발생

**설정 후:**
- Supabase API 요청 성공
- 데이터 로딩 시작
- 페이지 정상 동작

## 🔍 문제 해결 순서

1. **CORS 설정** ⭐ (가장 중요)
2. **1-2분 대기**
3. **페이지 새로고침**
4. **콘솔 로그 확인**
