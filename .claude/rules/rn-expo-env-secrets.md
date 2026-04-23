# 환경변수 / 시크릿 저장 규칙

## EXPO_PUBLIC_* 은 번들에 노출됨

`EXPO_PUBLIC_` 접두사 붙은 환경변수는 **빌드 타임에 JS 번들에 인라인**된다. source map과 디컴파일로 누구나 읽을 수 있음.

### ✅ EXPO_PUBLIC_ 에 넣어도 되는 것

- Supabase URL, anon key (anon은 공개 의도 — RLS가 보호)
- 공개 API endpoint (예: 지도 타일 서버)
- 피처 플래그 (on/off)
- Analytics 프로젝트 ID
- 공개 도메인

### ❌ EXPO_PUBLIC_ 에 절대 넣으면 안 되는 것

- Supabase **service_role** key (RLS 우회 가능)
- OpenAI/Anthropic API key
- 결제 secret (Stripe secret_key, RevenueCat API secret)
- 서드파티 admin token
- OAuth client secret
- 서버 전용 암호화 키

→ 이런 시크릿은 **서버(Supabase Edge Function / Cloud Run) 에만 두고** 앱은 인증된 세션으로 그 엔드포인트를 호출.

## 토큰 저장 — expo-secure-store 전용

사용자 access token, refresh token, OAuth token 등 **세션 토큰**은:

- ✅ `expo-secure-store` 사용 (iOS: Keychain, Android: Keystore). 하드웨어 보호
- ❌ `AsyncStorage` 금지 — 디바이스 백업으로 유출 가능, 암호화 안 됨
- ❌ `localStorage` / `sessionStorage` (web) — XSS에 노출. 필요 시 httpOnly cookie 패턴

## Supabase 클라이언트 스토리지

Supabase JS 클라이언트의 세션 저장소 설정 확인:
```ts
createClient(url, anonKey, {
  auth: {
    storage: SecureStore 기반 어댑터, // NOT AsyncStorage
    // ...
  }
})
```

현재 TodayCheck는 `lib/supabase.ts` 싱글턴 사용 중 — 세션 스토리지 어댑터 점검 필요 시 별도 티켓으로.

## PR 체크리스트

- [ ] 새로 추가한 `EXPO_PUBLIC_*` 변수가 시크릿이 아님 (위 ❌ 목록 대조)
- [ ] 토큰·키·패스워드를 저장하는 코드가 `expo-secure-store` 사용
- [ ] Supabase 쿼리에 `service_role` 키가 **절대** 프론트엔드에 노출 안 됨
- [ ] `.env.local` 파일이 `.gitignore`에 포함돼 있음 (이미 기본 포함이지만 재확인)
- [ ] 디버그 로그(`console.log`)에 토큰/시크릿이 찍히지 않음

## 참고

- Expo 공식: https://docs.expo.dev/guides/environment-variables/
- secure-store: https://docs.expo.dev/versions/latest/sdk/securestore/
- 관련 규칙: `database-schema.md` (RLS가 anon key 노출의 안전장치 역할)
