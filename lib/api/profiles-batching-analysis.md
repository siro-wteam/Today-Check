# Profiles API - Request Batching 분석

## 🔍 현재 상황

### 발견된 문제
```
1️⃣ profiles?id=in.(69a18fe2...)  → 사용자 A
2️⃣ profiles?id=in.(5ffddb50...)  → 사용자 B

이상적: profiles?id=in.(69a18fe2..., 5ffddb50...)
```

### 원인

**순차적 실행으로 인한 개별 API 호출:**

```typescript
// 시간 t=0ms
enrichTasksWithProfiles() 
  → fetchProfiles([userA])  // API 호출 1

// 시간 t=100ms (약간 후)
fetchMyGroups()
  → fetchProfiles([userB])  // API 호출 2 (캐시 없음)
```

---

## 📊 현재 최적화 상태

### ✅ 구현된 것들

1. **메모리 캐싱** (5분 TTL)
   ```typescript
   profileCache.get(userId)  // 캐시 hit → API 호출 없음
   ```

2. **동시 요청 중복 제거**
   ```typescript
   pendingRequests.get(requestKey)  // 같은 요청 중복 방지
   ```

### ⚠️ 부족한 것

**Request Batching**이 없음:
- 짧은 시간 내 여러 요청을 모아서 한 번에 처리하지 못함
- 서로 다른 사용자 ID 요청은 각각 API 호출

---

## 💡 최적화 방안

### Option 1: Request Batching (권장)

짧은 시간(50ms) 동안 쌓인 모든 요청을 모아서 한 번에 처리:

```typescript
// Batching queue
const batchQueue = new Set<string>();
let batchTimer: NodeJS.Timeout | null = null;
const BATCH_DELAY = 50; // ms

export async function fetchProfiles(userIds: string[]): Promise<Map<string, ProfileData>> {
  return new Promise((resolve) => {
    // Add to queue
    userIds.forEach(id => batchQueue.add(id));
    
    // Schedule batch execution
    if (batchTimer) clearTimeout(batchTimer);
    
    batchTimer = setTimeout(async () => {
      const allIds = Array.from(batchQueue);
      batchQueue.clear();
      
      // Single API call for all IDs
      const result = await fetchProfilesInternal(allIds);
      resolve(result);
    }, BATCH_DELAY);
  });
}
```

**장점:**
- 50ms 이내의 모든 요청을 1번 API 호출로 처리
- 초기 로딩 시 2-3번 → 1번으로 감소

**단점:**
- 50ms 지연 추가 (사용자는 못 느낌)
- 구현 복잡도 증가

---

### Option 2: React Query Batching

React Query의 내장 batching 기능 활용:

```typescript
import { QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // React Query가 자동으로 batching
    },
  },
});
```

**장점:**
- 라이브러리가 자동 처리
- 구현 간단

**단점:**
- React Query 전용
- 순수 API 함수에는 적용 불가

---

### Option 3: 현재 상태 유지

캐싱이 잘 작동하고 있으므로 추가 최적화 미룸:

**현재 효과:**
- 첫 로딩: 2번 API 호출 (각 사용자)
- 화면 전환: 0번 API 호출 (캐시 hit)
- 5분 후: 다시 2번 (캐시 만료)

**언제 문제가 될까?**
- 사용자가 많은 그룹 (10+ members)
- 초기 로딩 시에만 영향
- 이후에는 캐시로 빠름

---

## 🎯 추천 사항

### 우선순위

1. **현재 상태 유지** (단기)
   - 캐싱이 잘 작동 중
   - 첫 로딩 시 2번 정도는 허용 가능
   - 이후 화면 전환은 매우 빠름

2. **Request Batching 구현** (중기, 선택사항)
   - 사용자가 늘어나면 고려
   - 10+ 멤버 그룹이 많아지면 필수
   - 50ms batching으로 1번 API 호출로 통합

---

## 📈 성능 비교

### 현재 (캐싱만)

```
초기 로딩:
  ├─ profiles (userA)  100ms
  ├─ profiles (userB)  100ms
  ────────────────────────────
  Total: ~200ms (순차)

화면 전환:
  └─ 모두 캐시 hit!
  ────────────────────────────
  Total: ~0ms
```

### Batching 추가 시

```
초기 로딩:
  ├─ 50ms wait (batching)
  └─ profiles (A,B)    100ms
  ────────────────────────────
  Total: ~150ms (25% 빠름)

화면 전환:
  └─ 모두 캐시 hit!
  ────────────────────────────
  Total: ~0ms
```

---

## 💭 결론

**현재 profiles API는 충분히 최적화되어 있습니다.**

- ✅ 캐싱으로 반복 호출 방지
- ✅ 중복 요청 제거
- ⚠️ Request batching은 선택사항
  - 멤버 많은 그룹에서만 유용
  - 초기 로딩 시에만 영향

**권장:**
1. 현재 상태로 충분
2. 사용자 피드백 확인 후 결정
3. 필요시 batching 추가
