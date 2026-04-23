# Supabase RLS 필수 규칙

새 테이블을 생성하는 migration은 **같은 파일 안에** RLS 활성화 + 최소 1개 policy를 반드시 포함. CI(`rls-check.yml`)가 PR 단계에서 자동 강제.

## 규칙

1. `CREATE TABLE public.<name>` 뒤에 **즉시** `ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY;`
2. 최소 1개 `CREATE POLICY ...` 존재 (SELECT/INSERT/UPDATE/DELETE 중 필요한 것)
3. Policy는 authenticated 역할 기준으로 작성. anon 허용은 명시적 의사결정 필요

## Anti-pattern: "policy는 다음 PR에서"

CREATE TABLE만 먼저 ship하고 policy를 미루면:
- RLS 켜진 상태 + policy 0 → **모든 쿼리 차단되어 앱이 동작 안 함** → 급한 "allow all" 패치 → 데이터 노출
- 또는 RLS 안 켠 채 ship → 타 유저 데이터 전체 조회 가능

**반드시 같은 migration 파일 안에 완결된 세트로 포함**.

## CI 검증 방식

`.github/workflows/rls-check.yml`이 PR 시 `supabase/migrations/*.sql` 변경을 감지해:
- `CREATE TABLE` 존재 → `ENABLE ROW LEVEL SECURITY` 필수
- `ENABLE ROW LEVEL SECURITY` 있음 → `CREATE POLICY` 최소 1개 필수

미충족 시 CI 실패. 우회 수단 없음 (required status check로 등록 권장).

## 체크리스트 (migration 작성 시)

- [ ] `CREATE TABLE public.<name> (...)`
- [ ] `ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY;`
- [ ] SELECT policy — `USING (...)` 조건
- [ ] INSERT policy — `WITH CHECK (...)` 조건
- [ ] UPDATE policy — `USING + WITH CHECK` 양쪽
- [ ] DELETE policy — `USING (...)` 조건
- [ ] 로컬 `supabase db reset` 후 **다른 유저 세션으로 접근 테스트**

## 예외 (자동 skip)

- `supabase/migrations/*.sql` 외 파일 (seed, functions, tests)
- `CREATE TABLE` 없는 migration (ALTER TABLE, ADD COLUMN, INSERT만 있는 변경)

## 관련 문서

- `database-schema.md` — soft delete, task 비즈니스 로직, RLS가 활성화된 상태를 전제
