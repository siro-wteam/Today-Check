# 브라우저 네트워크 탭 디버깅 가이드

## 🔍 즉시 확인할 사항

### 1. 브라우저 개발자 도구 열기
- Chrome/Firefox: F12 또는 Ctrl+Shift+I
- 개발자 도구 → Network 탭

### 2. 네트워크 탭에서 확인할 내용

**Supabase API 요청 찾기:**
```
https://rfzongciokewupbrbuas.supabase.co/rest/v1/profiles?select=count
```

**확인할 내용:**
- **Status**: 200 (성공) 또는 에러 코드
- **Response**: 데이터가 있는지
- **Headers**: CORS 관련 에러가 있는지

### 3. 예상되는 결과

**정상적인 경우:**
```
Status: 200 OK
Response: {"count": 1}
```

**CORS 에러인 경우:**
```
Status: (failed)
Response: CORS policy error
Console: Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**네트워크 에러인 경우:**
```
Status: (failed)
Response: net::ERR_CONNECTION_TIMED_OUT
```

### 4. 필터링 방법

**Network 탭 필터:**
- `supabase` 입력하여 Supabase 요청만 필터링
- `profiles` 입력하여 관련 요청만 필터링

### 5. 타이밍 확인

**Timing 탭에서:**
- 요청이 전송되는지 확인
- 응답이 오는지 확인
- 얼마나 걸리는지 확인

## 🎯 문제 해결

### CORS 에러인 경우
1. Supabase Dashboard에서 CORS 설정 추가
2. `https://today-check.vercel.app` 추가
3. 1-2분 후 페이지 새로고침

### 네트워크 에러인 경우
1. Supabase 프로젝트 상태 확인
2. API 키 유효성 확인
3. 네트워크 연결 상태 확인

### 타임아웃인 경우
1. Supabase 서버 상태 확인
2. 요청 타임아웃 설정 확인
3. 네트워크 속도 확인

## 💡 팁

**콘솔 로그와 네트워크 탭을 함께 보면:**
- 콘솔: JavaScript 오류 메시지
- 네트워크: 실제 HTTP 요청/응답
- 둘을 비교하면 정확한 원인 파악 가능
