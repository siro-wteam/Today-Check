# 구독 결제 연동 가이드

구독 제한(그룹/백로그/날짜당 일감)은 이미 `profiles.subscription_tier` (`'free'` | `'paid'`) 기준으로 동작합니다.  
결제 연동 시 **이 컬럼만 결제 쪽에서 갱신**하면 됩니다.

---

## 1. 전체 흐름

```
[앱] 구독 구매 요청 → [결제 제공자] 결제 처리
       ↑                              ↓
       └── 웹훅/콜백으로 "유료 갱신" 수신 ←──┘
              ↓
       [Supabase] profiles.subscription_tier = 'paid' 업데이트
              ↓
       [앱] useSubscription() / 프로필 재조회 → 제한 해제
```

- **클라이언트**: 결제 SDK로 상품 구매만 유도.
- **서버(웹훅)**: 결제 성공/갱신/해지 이벤트를 받아 `profiles.subscription_tier`만 갱신.  
  클라이언트는 직접 `subscription_tier`를 쓰지 않고, 결제 제공자 → 웹훅 → DB 경로만 신뢰.

---

## 2. 결제 제공자 선택

| 대상 | 추천 | 비고 |
|------|------|------|
| **iOS / Android 앱** | RevenueCat 또는 앱스토어/플레이 인앱결제 | 영수증 검증·웹훅·동기화 제공. |
| **웹 (Vercel 등)** | Stripe | Checkout / Customer Portal로 구독 생성·관리. |
| **앱 + 웹 모두** | RevenueCat(앱) + Stripe(웹) 또는 Stripe 단일 | 한 계정에 두 채널이면 “동일 사용자 = paid” 매칭(이메일/uid) 필요. |

- **RevenueCat**: 앱 전용. 앱스토어/구글플레이 구독 한 번 연동 후, 웹훅으로 Supabase(또는 백엔드)에 `user_id` ↔ `paid` 전달하기만 하면 됨.
- **Stripe**: 웹·앱 모두 가능. Subscription 생성 후 `customer.subscription.updated` 등 웹훅에서 `subscription.status` 보고 `profiles.subscription_tier` 갱신.

---

## 3. 구현 단계 (공통)

### 3.1 제품/플랜 정의

- **RevenueCat**: App Store Connect / Play Console에 구독 상품 생성 → RevenueCat 대시에서 제품·프로젝트 연동.
- **Stripe**: Stripe 대시에서 Product + Price(월/연 구독) 생성.

이미 “free / paid” 단일 티어이므로, 상품은 **1개(유료 구독)** 만 있어도 됨.

### 3.2 앱에서 구매 유도

- **앱(iOS/Android)**: RevenueCat SDK 설치 → “구독하기” 버튼 → `Purchases.purchasePackage(package)` 호출.  
  또는 인앱결제 직접 연동 후 RevenueCat으로 영수증 전송.
- **웹**: Stripe Checkout 링크 또는 Stripe Customer Portal 링크로 이동.  
  로그인 사용자 `id`(또는 이메일)를 `client_reference_id` / `metadata`로 넘기면 웹훅에서 Supabase `profiles.id`와 매칭 가능.

### 3.3 웹훅 수신 및 DB 갱신

- **필수**: 결제 제공자 대시에서 **웹훅 URL** 설정 (Supabase Edge Function 또는 별도 백엔드).
- **검증**: 웹훅 서명(RevenueCat/Stripe 모두 제공) 검증 후 처리.
- **처리 내용**  
  - 구독 시작/갱신/재활성화 → 해당 사용자 `profiles.subscription_tier = 'paid'`  
  - 구독 취소/만료(정책에 따라 “즉시 해제” vs “기간 만료까지 유지”) → `'free'` 로 변경 여부 결정.

**사용자 매칭**

- RevenueCat: `app_user_id`를 Supabase `auth.uid()`와 동일하게 설정해 두면, 웹훅 payload의 `app_user_id` = `profiles.id`로 매칭.
- Stripe: `metadata.user_id` 또는 `client_reference_id`에 `profiles.id`(또는 이메일) 저장 후 웹훅에서 조회.

### 3.4 Supabase에서 갱신 방식

- **Option A – Edge Function**: 웹훅 URL을 `https://<project>.supabase.co/functions/v1/subscription-webhook` 같은 Edge Function으로 두고, 함수 내부에서 Service Role로 `profiles` 업데이트.
- **Option B – 외부 서버**: 이미 있는 백엔드가 있다면 그 서버가 웹훅을 받고 Supabase Admin API로 `profiles` 업데이트.

두 경우 모두 **Service Role 키**로만 `profiles.subscription_tier`를 갱신하고, 클라이언트는 이 값을 **직접 수정하지 않도록** 합니다.

### 3.5 클라이언트 반영

- `useSubscription()` / `useAuth()` 등에서 이미 `profiles.subscription_tier`를 읽고 있으므로,  
  **프로필 재조회**(또는 실시간 구독)만 하면 곧바로 제한 해제가 반영됩니다.
- 필요하면 구매 완료 화면에서 `queryClient.invalidateQueries` 또는 프로필 refetch 한 번 호출.

---

## 4. 체크리스트

- [ ] 결제 제공자 선택 (RevenueCat / Stripe / 둘 다)
- [ ] 상품 1개(유료 구독) 생성 및 앱/웹 연동
- [ ] 웹훅 URL 준비 (Supabase Edge Function 또는 기존 백엔드)
- [ ] 웹훅 서명 검증 구현
- [ ] payload에서 사용자 식별 → `profiles.id` 매칭
- [ ] `profiles.subscription_tier` 업데이트 (Service Role만 사용)
- [ ] 구독 취소/만료 시 `'free'` 전환 정책 결정 및 구현
- [ ] 앱/웹에서 “구독하기” 진입점 및 구매 후 프로필 재조회

---

## 5. 참고

- **RevenueCat**: [Webhooks](https://www.revenuecat.com/docs/webhooks), [Supabase 연동 예시](https://www.revenuecat.com/docs/integrations/supabase).
- **Stripe**: [Subscription webhooks](https://stripe.com/docs/subscriptions/webhooks), [Checkout](https://stripe.com/docs/checkout), [Customer Portal](https://stripe.com/docs/billing/subscriptions/integrating-customer-portal).
- 현재 앱: `SUBSCRIPTION_LIMITS_PLAN.md`, `lib/hooks/use-subscription.ts`, `profiles.subscription_tier` 마이그레이션 참고.

이 가이드만 따라가면, 기존 구독 제한 로직은 수정 없이 **결제 연동 → `subscription_tier` 갱신**만으로 유료 전환이 완료됩니다.

---

## 6. 정기구독(월간) 데이터 구조 검토

### 6.1 현재 구조

| 위치 | 컬럼 | 의미 |
|------|------|------|
| `profiles` | `subscription_tier` | `'free'` \| `'paid'` (기본값 `'free'`) |

**판단: 매월 사용료(정기구독)에 적합한가?**

- **적합합니다.**  
  웹훅으로 “구독 시작/갱신 → `paid`”, “구독 취소·만료·결제 실패 → `free`”만 갱신하면, **지금 유료인지**는 이 컬럼만으로 판단 가능합니다.  
  정기구독은 결제 제공자(Stripe/RevenueCat)가 갱신·만료를 알려주므로, 그 시점에 `subscription_tier`만 바꿔도 됩니다.

### 6.2 현재 구조만으로 부족한 점

| 필요 | 현재 | 영향 |
|------|------|------|
| **갱신/만료 일시** | 없음 | “다음 결제일”, “N일 후 만료” 등 표시 불가. 웹훅을 놓치면 만료 후에도 `paid`로 남을 수 있음. |
| **외부 구독 ID** | 없음 | 웹훅 중복 처리 방지, 고객 문의 시 결제 쪽 구독 조회 불가. |
| **결제 제공자** | 없음 | 앱/웹 등 채널이 둘 이상일 때 “어디서 구독 관리?” 링크 결정 어려움. |

### 6.3 권장 보완 (선택)

정기구독을 더 안정적으로 쓰고 UX를 높이려면 아래를 추가하는 것을 권장합니다. **없어도 월간 결제 연동은 가능**합니다.

| 컬럼 | 타입 | 용도 |
|------|------|------|
| `subscription_expires_at` | `TIMESTAMPTZ NULL` | 현재 구독 기간 만료 시각. 웹훅에서 “기간 끝” 넣어 둠. UI에 “N월 N일까지 이용”, 스케줄 작업으로 `expires_at < now()`이면 `tier = 'free'` 보정 가능. |
| `subscription_external_id` | `TEXT NULL` | Stripe `sub_xxx`, RevenueCat 구독 ID 등. 웹훅 중복 처리·문의 시 조회용. |
| `subscription_provider` | `TEXT NULL` | 예: `'stripe'` \| `'revenuecat'`. “구독 관리” 버튼이 Stripe Portal / 앱 설정 중 어디로 갈지 결정용. |

**로직 보완**

- 웹훅에서 구독 시작/갱신 시: `subscription_tier = 'paid'`, `subscription_expires_at = <다음 기간 끝>`, `subscription_external_id`/`subscription_provider` 설정.
- 구독 취소·만료·결제 실패 시: `subscription_tier = 'free'`, `subscription_expires_at = NULL` (필요 시 external_id는 유지해도 됨).
- (선택) Cron/Edge Function: `subscription_expires_at < now()` 이고 `subscription_tier = 'paid'`인 행은 `tier = 'free'`, `expires_at = NULL`로 보정 → 웹훅 누락 시 안전망.

### 6.4 요약

- **지금 구조만으로** 웹훅만 믿고 `subscription_tier`만 갱신하면 **매월 정기구독 적용 가능**.
- **갱신일/만료일 표시, 웹훅 누락 대비, 지원/관리 편의**를 위해 `subscription_expires_at`(권장), `subscription_external_id`, `subscription_provider` 추가를 검토하면 좋습니다.

---

## 7. 구독 테스트 (결제 연동 전) — 결제 연동 시 제거·반영 가이드

결제 연동 전에 **구독하기/구독해제**를 프로필에서 버튼으로 테스트할 수 있도록 구현해 두었습니다.  
실제 결제를 연동할 때 아래를 참고해 **테스트용만 제거**하고, **같은 데이터 모델로 웹훅만 연결**하면 됩니다.

### 7.1 테스트용으로 추가된 것

| 구분 | 내용 | 위치 |
|------|------|------|
| **DB** | `subscription_expires_at`, `subscription_external_id`, `subscription_provider` 컬럼 | `supabase/migrations/20260228000000_profiles_subscription_fields_and_test_rpc.sql` |
| **DB** | 테스트용 RPC: `subscription_test_activate()`, `subscription_test_deactivate()` | 같은 마이그레이션 파일 |
| **타입** | `Profile`에 `subscriptionExpiresAt`, `subscriptionExternalId`, `subscriptionProvider` | `lib/types.ts` |
| **API** | 프로필 조회 시 위 3개 컬럼 포함, `subscriptionTestActivate()`, `subscriptionTestDeactivate()` | `lib/api/profiles.ts` |
| **Auth** | 프로필 매핑 시 위 3개 필드 반영 | `lib/hooks/use-auth.ts` |
| **UI** | 프로필 화면의 **「구독 테스트」** 블록 (구독하기/구독해제 버튼, 만료일 표시) | `app/(tabs)/profile.tsx` |

- 테스트 시: **구독하기** → `tier = 'paid'`, `expires_at = now + 1 month`, `provider = 'test'`.  
- **구독해제** → `tier = 'free'`, 위 3개 컬럼 NULL.

### 7.2 결제 연동 시 제거할 것 (체크리스트)

- [ ] **프로필 화면 UI**  
  - **파일**: `app/(tabs)/profile.tsx`  
  - **제거**: 「구독 테스트」 전체 블록  
    - `구독 테스트` 제목, 만료일 텍스트, **구독하기** / **구독해제** 버튼이 있는 `View` 전체.  
  - **유지**: 상단의 Free/Paid 뱃지, `useSubscription()` 사용부는 그대로 둠.

- [ ] **테스트 전용 API (선택)**  
  - **파일**: `lib/api/profiles.ts`  
  - **제거**: `subscriptionTestActivate`, `subscriptionTestDeactivate` 함수 및 export.  
  - **유지**: 프로필 조회 시 `subscription_expires_at`, `subscription_external_id`, `subscription_provider` 선택·반환은 **유지** (웹훅으로 채우는 값이므로).

- [ ] **DB RPC (선택)**  
  - 테스트용 RPC `subscription_test_activate`, `subscription_test_deactivate`는  
    프로필 UI 제거 후 호출되지 않으므로, 그대로 두거나 별도 마이그레이션으로 `DROP FUNCTION` 해도 됨.

### 7.3 결제 연동 시 유지·반영할 것

- **데이터 모델**  
  - `profiles` 컬럼: `subscription_tier`, `subscription_expires_at`, `subscription_external_id`, `subscription_provider` **그대로 사용**.  
  - 웹훅에서 이 컬럼들만 갱신하면 됨.

- **웹훅 갱신 예시**  
  - 구독 시작/갱신:  
    `subscription_tier = 'paid'`,  
    `subscription_expires_at = <다음 기간 끝>`,  
    `subscription_external_id = <Stripe sub_xxx 등>`,  
    `subscription_provider = 'stripe'` (또는 `'revenuecat'`).  
  - 구독 취소/만료/결제 실패:  
    `subscription_tier = 'free'`,  
    `subscription_expires_at = NULL`,  
    (필요 시 `subscription_external_id`/`subscription_provider`는 유지해도 됨).

- **클라이언트**  
  - `useSubscription()`, `useAuth()`의 프로필/구독 읽기, `lib/types.ts`의 `Profile` 타입, `lib/api/profiles.ts`의 프로필 **조회** 로직은 수정하지 않음.  
  - 결제 완료 후 `refreshProfile()` 또는 `queryClient.invalidateQueries({ queryKey: ['subscription-limits'] })` 등으로 한 번 갱신만 해 주면 됨.

### 7.4 요약

- **제거**: 프로필 화면의 「구독 테스트」 블록 + (선택) 테스트용 API·RPC.  
- **유지**: `profiles` 확장 컬럼, 타입, 프로필 조회, Free/Paid 뱃지.  
- **추가**: 웹훅에서 위 컬럼들 갱신 + 앱/웹에서 실제 결제 플로우(Stripe/RevenueCat 등) 연결.

이 순서로 진행하면 기존 구독 제한·테스트 구조를 막지 않고 결제 연동만 깔끔하게 반영할 수 있습니다.
