# 즉시 확인할 사항

## 🚨 Supabase CORS 설정

**Supabase Dashboard → Settings → API → CORS settings:**

현재 설정된 도메인:
```
http://localhost:8081
```

**추가해야 할 도메인:**
```
https://today-check.vercel.app
https://*.vercel.app
```

## 🔧 설정 방법

1. Supabase 프로젝트 대시보드 접속
2. Settings → API 탭으로 이동
3. CORS 설정 섹션 찾기
4. 다음 도메인들 추가:
   - `https://today-check.vercel.app`
   - `https://*.vercel.app` (와일드카드)
5. Save 클릭

## 🎯 확인 방법

설치 후 1-2분 뒤에 Vercel 페이지 새로고침

## 💡 이유

로컬에서는 `localhost`가 허용되지만, Vercel에서는 다른 도메인에서 접속하므로 CORS 오류가 발생합니다.
