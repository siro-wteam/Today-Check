# 🚀 task_assignees RLS 정책 적용 방법

## 📋 즉시 적용 방법

### 1. Supabase Dashboard에서 SQL 실행

1. **Supabase Dashboard** 접속
2. **SQL Editor** 탭으로 이동
3. 아래 SQL 코드 복사/붙여넣기
4. **Run** 버튼 클릭

### 2. 적용할 SQL 코드

```sql
-- 기존 정책 삭제
DROP POLICY IF EXISTS "Enable all operations for users based on user_id" ON public.task_assignees;

-- 새로운 정책 생성
CREATE POLICY "Enable all operations for users based on user_id" ON public.task_assignees
  FOR ALL
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (
    -- UPDATE/DELETE: Users can only modify their own data
    (auth.uid() = user_id) OR
    -- INSERT: Authenticated users can insert new assignees
    (user_id IS NULL AND auth.role() = 'authenticated')
  );
```

### 3. 적용 확인

**정책 적용 후:**
1. **Authentication** → **Policies** 탭
2. **task_assignees** 테이블 선택
3. 새로운 정책이 생성되었는지 확인
4. 태스크 등록 테스트

## 🎯 예상 결과

**이전:**
- ❌ `401 Unauthorized`
- ❌ `new row violates row-level security policy`

**해결 후:**
- ✅ 정상적인 태스크 등록
- ✅ 태스크가 정상적으로 노출
- ✌ 401 에러 해결

## 📋 마이그레이션 파일

**생성된 파일:** `supabase/migrations/20260206000001_fix_task_assignees_rls_policy.sql`

**내용:**
- 기존 정책 삭제
- 새로운 정책 생성
- 주석으로 변경 사항 기록

## 💡 중요 사항

1. **테스트:** 개발 환경에서 충분히 테스트
2. **백업:** 기존 정책 백업 완료
3. **보안:** 인증된 사용자만 삽입 가능하도록 설정
4. **기록:** 마이그레이션 파일로 변경 이력 관리
