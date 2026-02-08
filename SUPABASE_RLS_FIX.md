# 🔍 task_assignees 테이블 RLS 정책 확인 및 수정

## 📋 현재 문제

**에러:** `new row violates row-level security policy for table "task_assignees"`
**원인:** RLS(Row Level Security) 정책이 새로운 데이터 삽입을 차단

## 🔧 해결 방법

### 1. 현재 RLS 정책 확인
```sql
-- Supabase SQL Editor에서 실행
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check,
    as_bypass
FROM pg_policies 
WHERE tablename = 'task_assignees';
```

### 2. task_assignees 테이블 구조 확인
```sql
-- 테이블 구조 확인
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'task_assignees';
```

### 3. RLS 정책 수정 (필요시)
```sql
-- 현재 사용자가 task_assignees에 데이터를 삽입할 수 있도록 정책 수정
CREATE POLICY "Users can insert task assignees" ON task_assignees
FOR INSERT
WITH CHECK (
    auth.uid() = user_id  -- 현재 로그인한 사용자만 자신의 데이터 삽입 가능
);

-- 또는 모든 인증된 사용자가 삽입 가능하도록
CREATE POLICY "Authenticated users can insert task assignees" ON task_assignees
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');
```

### 4. RLS 정책 활성화 확인
```sql
-- RLS가 활성화되어 있는지 확인
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
```

## 🎯 즉시 확인 방법

### 1. Supabase Dashboard에서 확인
1. **Authentication** → **Policies** 탭
2. **task_assignees** 테이블 선택
3. 현재 정책 목록 확인
4. **INSERT** 권한이 있는지 확인

### 2. SQL Editor에서 직접 확인
1. **SQL Editor** 탭으로 이동
2. 위 SQL 쿼리 실행
3. 결과 확인 및 정책 수정

## 💡 임시 해결책

### RLS 정책 수정 전 임시 조치
```sql
-- 모든 인증된 사용자에게 권한 부여 (임시)
DROP POLICY IF EXISTS "task_assignees_insert_policy" ON task_assignees;
CREATE POLICY "Enable insert for all authenticated users" ON task_assignees
FOR INSERT TO authenticated
USING (true)
WITH CHECK (true);
```

## 🚨 주의사항

1. **보안:** RLS 정책 수정 시 보안에 미치지 않도록 주의
2. **테스트:** 개발 환경에서 충분히 테스트 후 적용
3. **백업:** 기존 정책 백업 후 수정

## 📋 확인할 사항

- [ ] task_assignees 테이블 존재 여부
- [ ] 현재 RLS 정책 목록
- [ ] INSERT 권한이 있는 정책 존재 여부
- [ ] 정책 수정 후 테스트 완료
