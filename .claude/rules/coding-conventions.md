# 코딩 컨벤션

## 스타일링
- NativeWind className만 사용. StyleSheet.create 절대 금지.
- 디자인 토큰: primary(#2563eb), background(#F8FAFC), text-main(#1e293b), text-sub(#64748b)
- error(#dc2626), success(#16a34a), warning(#d97706)
- rounded: sm(8) / md(12) / lg(16) / xl(20)

## 컴포넌트
- 함수형 + Hooks만 (class 컴포넌트 금지)
- import 순서: React/RN -> 서드파티 -> @/로컬 (알파벳순)
- boolean: is/has/should 접두사
- 빈 catch 금지: 항상 console.error + showToast

## 타입
- lib/types.ts가 SSoT. 새 타입은 반드시 여기에 추가.
- any 최소화, @ts-ignore 금지.

## 상태관리
- 서버 상태 -> React Query (useQuery/useMutation)
- UI/로컬 상태 -> Zustand 스토어
- 컴포넌트 상태 -> useState
