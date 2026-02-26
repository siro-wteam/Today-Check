# 온보딩(사용법 안내) 테스트 방법

앱을 재설치하지 않고 온보딩 화면을 다시 보는 방법입니다.

## 방법 1: 프로필 탭에서 버튼 사용 (권장)

**개발 빌드**에서만 보입니다.

1. 앱 실행 후 **Profile** 탭으로 이동
2. 맨 아래 **"TodayCheck v1.0.0"** 아래에 **"온보딩 다시 보기 (테스트)"** 링크가 보임
3. 탭하면 저장된 완료 여부가 지워지고 온보딩 화면으로 이동
4. "시작하기"를 누르면 다시 메인으로 돌아옴

> `__DEV__`가 true일 때만 이 링크가 보입니다. Release 빌드에서는 보이지 않습니다.

## 방법 2: AsyncStorage 직접 지우기

디버거 콘솔에서 다음을 실행한 뒤 앱을 다시 로드합니다.

```javascript
// React Native Debugger 또는 Flipper 등 앱 컨텍스트에서 실행
require('@react-native-async-storage/async-storage').default.removeItem('todaycheck_has_seen_onboarding');
// 그 다음 앱 리로드 (예: 개발 메뉴에서 Reload)
```

## 방법 3: 앱 데이터 삭제 (기기 설정)

- **Android**: 설정 → 앱 → TodayCheck → 저장공간 → 데이터 삭제
- **iOS**: 앱 삭제 후 재설치 (또는 설정에서 앱 데이터 제거)

이 경우 로그인 정보 등 다른 데이터도 함께 삭제됩니다.
