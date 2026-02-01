# Supabase CORS 설정 찾는 방법

## 🎯 경로 1: 표준 경로

1. **프로젝트 대시보드:**
   ```
   https://supabase.com/dashboard/project/rfzongciokewupbrbuas
   ```

2. **Settings 메뉴:**
   - 왼쪽 사이드바에서 ⚙️ Settings 클릭
   - 또는 상단 Project Settings 클릭

3. **API 탭:**
   - Settings 페이지에서 API 탭 클릭

4. **CORS 설정:**
   - 스크롤 내리면 "CORS origins" 섹션 있음

## 🎯 경로 2: 직접 링크

**직접 API 설정 페이지:**
```
https://supabase.com/dashboard/project/rfzongciokewupbrbuas/settings/api
```

## 🎯 경로 3: 검색 기능

1. 프로젝트 대시보드에서 검색창에 "CORS" 입력
2. "CORS settings" 결과 클릭

## 🔍 화면 예시

**API 설정 페이지에서 찾아야 할 섹션:**
```
API URL
https://rfzongciokewupbrbuas.supabase.co

API Keys
anon public
service_role

CORS origins
[Add origin] 버튼
```

## 🎯 설정 방법

1. **Add origin 버튼 클릭**
2. `https://today-check.vercel.app` 입력
3. **Add origin** 클릭
4. `https://*.vercel.app` 입력
5. **Save** 버튼 클릭

## 💡 팁

**만약 CORS 설정을 찾을 수 없다면:**
1. 프로젝트가 최신 버전인지 확인
2. Supabase 업데이트 후 UI 변경되었을 수 있음
3. 검색 기능으로 "CORS" 검색

## 🚨 대안 방법

**CORS 설정이 없다면:**
1. Supabase 프로젝트 재생성
2. 또는 Supabase 지원팀에 문의
3. 임시로 모든 도메인 허용 (`*`) - 보안에 취약하므로 권장하지 않음
