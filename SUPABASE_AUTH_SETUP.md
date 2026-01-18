# Supabase Authentication Setup

## 1. Disable Email Confirmation (For Testing)

개발 단계에서는 이메일 확인 없이 바로 가입할 수 있도록 설정하는 것이 편리합니다.

### Supabase Dashboard에서 설정:

1. Supabase 프로젝트 대시보드로 이동
2. **Authentication** → **Settings** (왼쪽 메뉴)
3. **Email Auth** 섹션에서 다음 설정 변경:
   - ✅ **Enable Email provider** (체크)
   - ✅ **Confirm email** (체크 해제) ← 중요!
4. **Save** 클릭

## 2. Configure Site URL (For Redirects)

1. Authentication → **URL Configuration**
2. **Site URL** 설정:
   ```
   http://localhost:8081
   ```
   또는 Expo에서 제공하는 URL (예: `exp://192.168.x.x:8081`)

## 3. Test the Auth Flow

### 회원가입 테스트:
```
Email: test@example.com
Password: test1234
```

회원가입 후 바로 로그인이 가능해야 합니다 (이메일 확인 불필요).

## 4. Troubleshooting

### 문제: "Email not confirmed" 에러
**해결**: Authentication → Settings에서 "Confirm email" 체크 해제

### 문제: "Invalid email or password"
**해결**: 
- 비밀번호가 최소 6자 이상인지 확인
- 이메일 형식이 올바른지 확인

### 문제: 회원가입 후 로그인이 안 됨
**해결**: 
- Supabase Dashboard → Authentication → Users에서 유저가 생성되었는지 확인
- 유저의 `email_confirmed_at` 필드가 null이 아닌지 확인

## 5. Production 설정 (나중에)

프로덕션 환경에서는 다음 설정을 권장합니다:
- ✅ Email Confirmation 활성화
- ✅ Email 템플릿 커스터마이징
- ✅ Password Policy 강화
- ✅ Rate Limiting 설정
