# 할 일 추가 기능 - 패키지 설치 가이드

## 필수 패키지 설치

```bash
npm install @react-native-community/datetimepicker date-fns
```

## 패키지 설명

### 1. @react-native-community/datetimepicker
- **용도**: 날짜/시간 선택 UI
- **플랫폼**: iOS, Android, Web 모두 지원
- **버전**: 최신 버전 사용

### 2. date-fns
- **용도**: 날짜 계산 및 포맷팅
- **기능**: 
  - `addDays()`: 내일 날짜 계산
  - `format()`: 날짜/시간 포맷팅
  - `isToday()`, `isTomorrow()`: 날짜 비교
  - `startOfDay()`: 날짜 정규화

## 설치 후

```bash
# 개발 서버 재시작
npx expo start --clear
```

## 웹 환경 주의사항

웹에서 DateTimePicker가 기본 HTML5 input으로 표시됩니다.
더 나은 UX를 원한다면 `react-datepicker` 같은 웹 전용 라이브러리를 추가로 고려할 수 있습니다.
