# Tap & Long Press UX 가이드

## 🎯 인터랙션 방식 변경

### ❌ 이전: Swipe 방식
- 오른쪽 스와이프: 완료
- 왼쪽 스와이프: 취소/삭제
- **문제점**: 
  - 제스처 충돌 가능성
  - 사용자가 발견하기 어려움
  - 학습 곡선 존재

### ✅ 현재: Tap & Long Press 방식
- 짧게 탭: 상태 토글/복구
- 길게 누르기: 액션 시트 (취소/삭제)
- **장점**:
  - 직관적이고 발견하기 쉬움
  - 제스처 충돌 없음
  - 햅틱 피드백으로 명확한 반응

---

## 🎨 인터랙션 상세

### 1️⃣ 짧게 탭 (onPress)

#### **TODO 상태**
- **동작**: TODO → DONE
- **햅틱**: 가벼운 진동 (Light)
- **시각**: 체크박스 ✓ + 굵은 취소선

#### **DONE 상태**
- **동작**: DONE → TODO (복구)
- **햅틱**: 가벼운 진동 (Light)
- **시각**: 체크박스 해제 + 취소선 제거

#### **CANCEL 상태**
- **동작**: CANCEL → TODO (복구)
- **햅틱**: 가벼운 진동 (Light)
- **시각**: 체크박스 ✕ 제거 + 취소선 제거

### 2️⃣ 길게 누르기 (onLongPress)

#### **TODO 상태에서만 작동**
- **트리거**: 0.5초 길게 누르기
- **햅틱**: 묵직한 진동 (Heavy)
- **동작**: 액션 시트 표시

#### **Action Sheet Menu**
```
┌─────────────────────────────────┐
│ What would you like to do?      │
├─────────────────────────────────┤
│ Complete                        │
│ Postpone to Tomorrow            │
│ Cancel Task                     │
│ Delete (Red)                    │
│ Close                           │
└─────────────────────────────────┘
```

**Button Actions:**
1. **Complete**: TODO → DONE (Bold strikethrough)
2. **Postpone to Tomorrow**: Move task's due_date to tomorrow (original_due_date preserved)
3. **Cancel Task**: TODO → CANCEL (Light gray strikethrough)
4. **Delete**: Soft Delete execution (Confirmation dialog)
5. **Close**: No action

#### **DONE/CANCEL 상태에서**
- **동작**: 무반응 ❌
- **이유**: 복구는 탭으로만 가능하게 단순화

---

## 🎨 미니멀리즘 디자인

### **시각적 구조**
```
┌────────────────────────────────────────┐
│ [ ○ ]  Task Title           [HH:MM]    │  ← TODO
│ [ ✓ ]  Completed Task       [HH:MM]    │  ← DONE (굵은 취소선)
│ [ ✕ ]  Cancelled Task                  │  ← CANCEL (회색 취소선)
└────────────────────────────────────────┘
```

### **레이아웃**
- **좌측**: 체크박스 아이콘 (5×5 원형)
- **중앙**: 할 일 제목 (flex-1, 메인 컨텐츠)
- **우측**: 배지들 (시간 + 이월)
  - 시간 배지: 회색 배경, `due_time` 설정 시에만 표시
  - 이월 배지: 빨간 배경, 이월된 TODO 항목에 "+Nd" 표시

### **헬퍼 텍스트 제거**
- ~~"Long press for options"~~
- ~~"Tap to restore"~~
- 모든 가이드 텍스트 제거로 깔끔한 디자인
- 인터랙션은 명시적 설명 없이도 직관적
- 충분한 패딩으로 터치 영역 확보

---

## 🎮 햅틱 피드백

### Light Impact (가벼운 진동)
- **용도**: 일반적인 상태 전환
- **사용 시점**: 
  - TODO → DONE
  - DONE → TODO
  - CANCEL → TODO

### Heavy Impact (묵직한 진동)
- **용도**: 중요한 액션의 시작
- **사용 시점**: 
  - 롱프레스로 액션 시트 표시

### 구현 코드
```typescript
import * as Haptics from 'expo-haptics';

// 가벼운 진동
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

// 묵직한 진동
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
```

---

## 📱 플랫폼별 동작

### **iOS**
- **Short Tap**: 즉시 반응 (햅틱 + 상태 변경)
- **Long Press**: 0.5초 후 ActionSheetIOS 표시
  - 네이티브 iOS 스타일 액션 시트
  - 하단에서 올라오는 애니메이션

### **Android**
- **Short Tap**: 즉시 반응 (햅틱 + 상태 변경)
- **Long Press**: 0.5초 후 Alert 다이얼로그
  - 버튼식 다이얼로그
  - 취소 처리 / 삭제 / 닫기 버튼

### **Web**
- **Short Tap**: 즉시 반응 (햅틱 없음, 상태 변경)
- **Long Press**: 0.5초 후 prompt 표시
  - 텍스트 입력 prompt로 메뉴 표시
  - 1: Complete, 2: Postpone to Tomorrow, 3: Cancel Task, 4: Delete, 0: Close

---

## 🧪 사용자 시나리오

### 시나리오 1: 할 일 완료
```
1. TODO 태스크를 짧게 탭
2. [가벼운 진동]
3. ✓ 체크 + 굵은 취소선
4. 상태: DONE
```

### 시나리오 2: 완료 취소 (복구)
```
1. DONE 태스크를 짧게 탭
2. [가벼운 진동]
3. 체크 해제 + 취소선 제거
4. 상태: TODO
```

### 시나리오 3: 롱프레스로 완료
```
1. TODO 태스크를 0.5초 이상 길게 누름
2. [묵직한 진동]
3. 액션 시트 표시
4. "Complete" 선택
5. ✓ 체크 + 굵은 취소선
6. 상태: DONE
```

### 시나리오 4: 내일로 미루기 ⭐ NEW
```
1. TODO 태스크를 길게 누름
2. [묵직한 진동]
3. 액션 시트 표시
4. "Postpone to Tomorrow" 선택
5. due_date가 내일로 업데이트 (original_due_date는 유지)
6. 오늘 리스트에서 즉시 사라짐
7. "Task postponed to tomorrow" 메시지 표시
```

### 시나리오 5: 할 일 취소
```
1. TODO 태스크를 길게 누름
2. [묵직한 진동]
3. 액션 시트 표시
4. "Cancel Task" 선택
5. ✕ 표시 + 연한 회색 취소선
6. 상태: CANCEL
```

### 시나리오 6: 할 일 삭제
```
1. TODO 태스크를 길게 누름
2. [묵직한 진동]
3. 액션 시트 표시
4. "Delete" 선택
5. "Are you sure you want to delete this task?" 확인 다이얼로그
6. "Delete" 확인
7. 목록에서 사라짐 (Soft Delete)
```

### 시나리오 7: 취소된 할 일 복구
```
1. CANCEL 태스크를 짧게 탭
2. [가벼운 진동]
3. ✕ 제거 + 취소선 제거
4. 상태: TODO
```

---

## 🎨 Minimalist Design

### **Visual Hierarchy**
```
┌──────────────────────────────────────┐
│ [ ○ ]  Task Title         [HH:MM]    │  ← TODO
│ [ ✓ ]  Completed Task     [HH:MM]    │  ← DONE (Bold strikethrough)
│ [ ✕ ]  Cancelled Task                │  ← CANCEL (Gray strikethrough)
└──────────────────────────────────────┘
```

### **Layout Structure**
- **Left**: Checkbox icon (5×5 circle)
- **Center**: Task title (flex-1, main content)
- **Right**: Badges (time + overdue)
  - Time badge: Gray background, visible when `due_time` is set
  - Overdue badge: Red background, shows "+Nd" for overdue TODO items

### **No Helper Text**
- Removed all hint text ("Long press for options", "Tap to restore")
- Clean, minimal design
- Interactions are intuitive without explicit instructions
- Sufficient padding ensures good touch target size

---

## 📅 일정 관리 (Postpone to Tomorrow)

### **내일로 미루기 기능 ⭐**
```typescript
// API 함수: postponeTask
export async function postponeTask(taskId: string) {
  const tomorrow = addDays(new Date(), 1);
  const tomorrowFormatted = format(tomorrow, 'yyyy-MM-dd');
  
  // due_date만 업데이트, original_due_date는 유지
  await supabase
    .from('tasks')
    .update({ due_date: tomorrowFormatted })
    .eq('id', taskId);
}
```

### **핵심 로직**
1. **due_date 업데이트**: 현재 날짜 + 1일 (`date-fns.addDays` 사용)
2. **original_due_date 유지**: 최초 등록 날짜 보존 (롤오버 지연일수 계산용)
3. **리스트 새로고침**: Today 리스트에서 즉시 제거
4. **피드백**: "Task postponed to tomorrow" 메시지

### **사용 시나리오**
```
오늘 해야 할 일 (Jan 15):
[ ] 보고서 작성 (Due: Jan 15)

→ 롱프레스 → "Postpone to Tomorrow" 선택

내일 할 일로 이동 (Jan 16):
[ ] 보고서 작성 (Due: Jan 16, Original: Jan 15)
                                    ↑ 1일 지연됨을 추적 가능
```

### **롤오버(Rollover) 계산 예시**
```
Original Due: Jan 15
Current Date: Jan 20
Due Date: Jan 18 (2번 미뤘음)

→ 화면에 "+5d" 배지 표시 (Original 기준 5일 지연)
```

---

## 💡 Quick Complete vs Menu

### **Quick Complete (Short Tap)**
- Tap TODO task → Instantly mark as DONE
- Fastest and most common action

### **Complete via Menu (Long Press)**
- Long press TODO task → Select "Complete" from menu
- Useful when considering other options (cancel/delete)

**Recommendation**: Use short tap for quick completion!

---

## 💡 사용자 가이드

### 힌트 텍스트
각 상태별로 작은 힌트 텍스트가 표시됩니다:

- **TODO**: "길게 눌러 취소/삭제" (회색, 작은 글씨)
- **DONE**: "탭하여 TODO로 복구" (회색, 작은 글씨)
- **CANCEL**: "탭하여 TODO로 복구" (회색, 작은 글씨)

### 시각적 피드백
- **탭 시**: `active:opacity-50` - 50% 투명도로 눌림 표시
- **롱프레스 시**: iOS는 블러 효과, Android는 리플 효과

---

## 🔧 구현 세부사항

### Pressable Props
```typescript
<Pressable 
  onPress={handlePress}
  onLongPress={handleLongPress}
  delayLongPress={500} // 0.5초
  className="... active:opacity-50"
>
```

### 햅틱 피드백 타이밍
```typescript
// 탭 시: 상태 변경 전 즉시
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
changeStatus('DONE');

// 롱프레스 시: 액션 시트 표시 전
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
ActionSheetIOS.showActionSheetWithOptions(...);
```

---

## 📊 State Transition with New UX

```
         Tap
TODO ◄────────► DONE
  │
  │ Long Press
  │  ↓
  │ [취소 처리]
  │  ↓
  └────────► CANCEL
              │
              │ Tap (복구)
              ↓
             TODO
```

---

## 🐛 문제 해결

### Q: 롱프레스가 작동하지 않아요
**A**: 
1. `delayLongPress` 시간(500ms)이 충분한지 확인
2. `expo-haptics`가 설치되어 있는지 확인
3. 디바이스 설정에서 햅틱이 활성화되어 있는지 확인

### Q: 웹에서 prompt가 이상해요
**A**: 웹에서는 액션 시트 대신 prompt를 사용합니다.
더 나은 UX를 원한다면 `react-modal`이나 커스텀 웹 모달을 고려하세요.

### Q: DONE 상태에서 롱프레스가 안 돼요
**A**: 의도된 동작입니다. DONE/CANCEL 상태에서는 롱프레스가 비활성화됩니다.
복구는 탭으로만 가능합니다.

---

## 🎉 장점

### 1. **직관성**
- 탭 = 완료/복구 (가장 자주 사용)
- 롱프레스 = 취소/삭제 (덜 자주 사용)

### 2. **안전성**
- 삭제는 2단계 확인 (롱프레스 + 확인 다이얼로그)
- 실수로 삭제할 가능성 최소화

### 3. **발견 가능성**
- 힌트 텍스트로 기능 안내
- 햅틱 피드백으로 즉각적인 반응

### 4. **제스처 충돌 없음**
- Swipeable 제거로 스크롤과의 충돌 해결
- 모든 인터랙션이 명확하게 구분됨

---

## 🔮 향후 개선 가능성

### 1. 애니메이션 추가
```typescript
// 상태 변경 시 부드러운 애니메이션
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
```

### 2. 커스텀 액션 시트 (웹)
```typescript
// 웹에서도 네이티브처럼 보이는 Bottom Sheet
import { BottomSheet } from '@/components/BottomSheet';
```

### 3. 도움말 투어
```typescript
// 첫 사용자를 위한 가이드
import { Tour } from '@/components/Tour';
```
