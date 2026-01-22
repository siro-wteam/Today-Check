# Soft Delete & Swipeable 기능 구현 가이드

## 📦 완료된 작업

### 1. **DB 스키마 변경**
- ✅ `deleted_at` 컬럼 추가 (Soft Delete)
- ✅ 인덱스 추가 (성능 최적화)
- ✅ TypeScript 타입 업데이트

### 2. **데이터 로직 변경**
- ✅ 모든 조회 쿼리에 `deleted_at IS NULL` 필터 추가
- ✅ `deleteTask()` 함수를 Soft Delete로 변경
- ✅ `hardDeleteTask()` 함수 추가 (필요 시 영구 삭제)

### 3. **UI/UX 개선**
- ✅ Swipeable 인터랙션 구현
  - 오른쪽 스와이프: 완료 (초록색)
  - 왼쪽 스와이프: 취소/삭제 버튼 (회색/빨간색)
- ✅ 상태별 스타일링
  - TODO: 기본 (검정)
  - DONE: 굵은 취소선
  - CANCEL: 연한 회색 취소선

---

## 🚀 설치 및 설정

### 1. Supabase 마이그레이션 실행

Supabase Dashboard → SQL Editor에서 다음 파일 실행:

```sql
-- supabase/migrations/20260119000000_add_soft_delete.sql
```

또는 Supabase CLI 사용:
```bash
supabase db push
```

### 2. 개발 서버 재시작

```bash
npx expo start --clear
```

---

## 🎨 사용법

### **오른쪽 스와이프 → 완료**
1. 태스크를 오른쪽으로 스와이프
2. 초록색 "완료" 버튼 표시
3. 버튼 탭 → `status = 'DONE'`
4. 굵은 취소선으로 표시

### **왼쪽 스와이프 → 취소/삭제**
1. 태스크를 왼쪽으로 스와이프
2. 회색 "취소", 빨간색 "삭제" 버튼 표시
3. **취소 버튼**: `status = 'CANCEL'` (연한 회색 취소선)
4. **삭제 버튼**: Soft Delete (목록에서 사라짐, DB에는 남음)

---

## 🗂️ Soft Delete 장점

### 1. **데이터 복구**
- 실수로 삭제한 태스크 복구 가능
- `deleted_at`을 `NULL`로 되돌리면 복구됨

### 2. **이력 관리**
- 사용자의 태스크 히스토리 보존
- 향후 통계/분석 기능에 활용 가능

### 3. **안전성**
- 영구 삭제 전에 일정 기간 보관
- 백업 정책과 함께 사용 가능

---

## 🔧 관리자 기능 (향후 구현 가능)

### 1. **휴지통 기능**
```typescript
// 삭제된 항목 조회
const { data } = await supabase
  .from('tasks')
  .select('*')
  .not('deleted_at', 'is', null)
  .order('deleted_at', { ascending: false });
```

### 2. **복구 기능**
```typescript
// 태스크 복구
const { error } = await supabase
  .from('tasks')
  .update({ deleted_at: null })
  .eq('id', taskId);
```

### 3. **영구 삭제 (정리)**
```typescript
// 30일 이상 지난 삭제 항목 영구 제거
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const { error } = await supabase
  .from('tasks')
  .delete()
  .lt('deleted_at', thirtyDaysAgo.toISOString());
```

---

## 📊 데이터베이스 구조

```sql
tasks 테이블
├── id (uuid)
├── user_id (uuid)
├── title (text)
├── status (text) -- 'TODO', 'DONE', 'CANCEL'
├── due_date (date)
├── due_time (time)
├── original_due_date (date)
├── created_at (timestamptz)
├── updated_at (timestamptz)
└── deleted_at (timestamptz) ⭐ NEW
```

---

## 🐛 문제 해결

### Q: Swipe가 작동하지 않아요
**A**: `react-native-gesture-handler`가 제대로 설치되었는지 확인
```bash
npm list react-native-gesture-handler
```

### Q: 삭제한 항목이 다시 나타나요
**A**: 쿼리에 `.is('deleted_at', null)` 필터가 있는지 확인

### Q: 마이그레이션 에러가 발생해요
**A**: Supabase Dashboard에서 수동으로 SQL 실행
