# React Query 패턴

## Query Keys (정확히 이 키를 사용할 것)
- ['tasks', 'timeline'] - 타임라인
- ['tasks', 'backlog'] - 백로그
- ['tasks', 'week', weekStartStr] - 주간
- ['groups', 'my'] - 내 그룹
- ['notifications', 'unread'] - 미읽음 수
- ['notifications', 'list'] - 알림 목록

## Mutation 후 invalidation
- task 변경 -> invalidateQueries({ queryKey: ['tasks'] })
- group 변경 -> invalidateQueries({ queryKey: ['groups'] })
- notification 변경 -> invalidateQueries({ queryKey: ['notifications'] })

## 패턴
- onSuccess: 캐시 무효화 + showToast('success', ...)
- onError: console.error + showToast('error', ...)
