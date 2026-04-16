# 테스트 정책

- 순수 함수(utils/, constants/)를 수정하면 테스트도 추가/수정할 것
- 테스트 파일 위치: __tests__/ (jest.config.js roots 설정)
- 테스트 이름: 한국어로 작성 (기존 패턴)
- Supabase 의존 함수는 mock 없이 테스트하지 않음
- 검증: npm run verify (lint + test)
