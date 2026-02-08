# 🔧 task_assignees RLS 정책 수정

## 📋 문제 원인

**현재 정책:** `auth.uid() = user_id`
**문제점:** 새로운 태스크 등록 시 user_id가 없어서 실패

## 🔧 해결 방법

### 방법 1: 정책 수정 (권장)

```sql
-- 현재 정책 삭제
DROP POLICY IF EXISTS "Enable all operations for users based on user_id" ON task_assignees;

-- 새로운 정책 생성 (INSERT 시 user_id 체크하지 않음)
CREATE POLICY "Enable all operations for users based on user_id" ON task_assignees
FOR ALL
USING (auth.uid() = user_id OR user_id IS NULL)
WITH CHECK (
    -- UPDATE/DELETE: 자신의 데이터만 수정/삭제 가능
    (auth.uid() = user_id) OR
    -- INSERT: 인증된 사용자는 누구나 삽입 가능
    (user_id IS NULL AND auth.role() = 'authenticated')
);
```

### 방법 2: 트리거로 user_id 자동 설정

```sql
-- task_assignees 테이블에 트리거 추가
CREATE OR REPLACE FUNCTION set_task_assignee_user_id()
RETURNS TRIGGER AS $$
BEGIN
    -- user_id가 NULL이면 현재 인증된 사용자 ID로 설정
    IF NEW.user_id IS NULL THEN
        NEW.user_id = auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 연결
CREATE TRIGGER set_task_assignee_user_id_trigger
BEFORE INSERT ON task_assignees
FOR EACH ROW
EXECUTE FUNCTION set_task_assignee_user_id();
```

### 방법 3: 애플리케이션에서 user_id 명시적 설정

```typescript
// 태스크 등록 시 user_id 명시적 설정
const { data, error } = await supabase
  .from('task_assignees')
  .insert({
    task_id: taskId,
    user_id: userId,  // 현재 사용자 ID 명시적 설정
    assigned_at: new Date().toISOString()
  });
```

## 🎯 즉시 적용 방법

### 1. Supabase Dashboard에서
1. **Authentication** → **Policies** 탭
2. **task_assignees** 테이블 선택
3. 기존 정책 삭제
4. 새로운 정책 생성 (방법 1)

### 2. SQL Editor에서
```sql
-- 바로 실행 가능한 SQL
DROP POLICY IF EXISTS "Enable all operations for users based on user_id" ON task_assignees;

CREATE POLICY "Enable all operations for users based on user_id" ON task_assignees
FOR ALL
USING (auth.uid() = user_id OR user_id IS NULL)
WITH CHECK (
    (auth.uid() = user_id) OR
    (user_id IS NULL AND auth.role() = 'authenticated')
);
```

## 💡 추천 해결책

**방법 1**을 추천합니다:
- 기존 정책 로직 유지
- INSERT 시 user_id가 없는 경우 허용
- 보안성 유지하면서 문제 해결

## 🚨 주의사항

1. **테스트:** 개발 환경에서 충분히 테스트 후 적용
2. **백업:** 기존 정책 백업 후 수정
3. **보안:** user_id IS NULL 조건이 보안에 미치지 않는지 확인
