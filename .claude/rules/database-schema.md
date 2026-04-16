# Database & Supabase 규칙

## 쿼리 필수 패턴
- Supabase 클라이언트: lib/supabase.ts 싱글턴만 사용
- 모든 SELECT에 `.is('deleted_at', null)` 추가 (soft delete)
- 반환: `{ data, error }` 구조
- 날짜 DB 저장: 'yyyy-MM-dd' (date-fns format 사용)

## Task 비즈니스 로직
- group_id=NULL -> 개인, group_id=uuid -> 그룹
- due_date=NULL -> 백로그, due_date < today AND TODO -> 롤오버
- 상태: 'TODO' | 'DONE' | 'CANCEL' (CANCELLED 아님!)
- 그룹 작업: task_assignees 테이블로 다중 담당자

## Group
- 역할: OWNER / ADMIN / MEMBER
- 초대코드: 6자리 (RPC 생성)

## RLS
- 모든 테이블 RLS 활성화
- 개인 작업: creator_id = auth.uid()
- 그룹 작업: group_members 테이블 조인
- 관리 기능: OWNER/ADMIN 역할 검사

## Profile
- subscription_tier: 'free' | 'paid'
- free 제한: 그룹 3개, 백로그 5개, 일별 작업 5개
