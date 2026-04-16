-- user_id는 deprecated (creator_id + task_assignees로 대체됨)
-- 코드에서 insert 시 user_id를 넣지 않으므로 기본값 설정
ALTER TABLE public.tasks ALTER COLUMN user_id SET DEFAULT auth.uid();
