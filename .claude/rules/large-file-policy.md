# 거대 파일 정책

다음 파일은 1000줄 이상. 전체 읽기 금지 - offset/limit으로 필요 부분만 읽을 것.

| 파일 | 줄 수 |
|------|-------|
| lib/api/tasks.ts | ~1642 |
| app/day.tsx | ~1636 |
| app/(tabs)/index.tsx | ~1526 |
| app/group-detail.tsx | ~1473 |
| components/EditTaskBottomSheet.tsx | ~1398 |
| lib/stores/useGroupStore.ts | ~1092 |
| app/(tabs)/backlog.tsx | ~1044 |

## 수정 시 규칙
- 관련 섹션만 읽고 수정
- 변경 후 해당 파일 lint 결과 확인
- 한 번에 하나의 함수/섹션만 변경
