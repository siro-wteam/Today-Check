# Horizontal Day Paging View Guide

**TodayCheck** uses a **horizontal paging view** for intuitive day-by-day task management with platform-optimized navigation.

---

## 🎯 Core Concept

Instead of vertical scrolling through sections, users **swipe left/right** to move between days:

```
← Swipe Right (Yesterday)  |  Swipe Left (Tomorrow) →
```

Each day is a **full-screen page** with its own task list.

---

## 📱 UI Structure

### **Horizontal FlatList**

```tsx
<FlatList
  data={datePages}              // Array of 15 days (-7 to +7)
  horizontal={true}              // Horizontal scrolling
  pagingEnabled={true}           // Snap to pages
  initialScrollIndex={7}         // Start at today (index 7)
  renderItem={renderDayPage}     // Each day is a page
/>
```

### **Page Layout**

```
┌─────────────────────────────────┐
│ Header (Date)                   │
├─────────────────────────────────┤
│                                 │
│  [ ○ ]  Task 1      [14:00]    │
│  [ ○ ]  Task 2      [16:00]    │
│  [ ✓ ]  Task 3                 │
│                                 │
│         (Full Screen)           │
│                                 │
└─────────────────────────────────┘
```

---

## 🗓️ Date Navigation

### **Mobile (Touch)**

```
Swipe Right → Go to Yesterday
Swipe Left  → Go to Tomorrow
```

**Gestures:**
- Native smooth scrolling
- Paging snaps to each day
- No buttons needed (intuitive swipe)

### **Web (Mouse + Keyboard)**

```
┌──────────────────────────────────┐
│  ‹   Jan 19 (Mon)   ›          │  ← Chevron buttons
└──────────────────────────────────┘

Keyboard:
  ← (ArrowLeft)  → Previous day
  → (ArrowRight) → Next day
```

**Features:**
- Chevron buttons (‹ ›) for mouse clicks
- Arrow key support for keyboard navigation
- Hover effects on buttons
- Disabled state at boundaries

---

## 📊 Data Structure

### **Date Pages Array**

```typescript
interface DayPage {
  date: string;           // "2026-01-19"
  dateObj: Date;          // Date object
  displayDate: string;    // "Jan 19 (Mon)" or "🔥 TODAY"
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  tasks: TimelineTask[];  // Filtered tasks for this day
}
```

### **Date Range**

```
Initial Load: Today -7 to +7 (15 days)

Index:  0   1   2   3   4   5   6   7   8   9  10  11  12  13  14
Date:  -7  -6  -5  -4  -3  -2  -1  [0] +1  +2  +3  +4  +5  +6  +7
                                 ↑
                              TODAY (Index 7)
```

---

## 🎨 Visual Design

### **Header Navigation (Top)**

#### **Mobile:**
```
┌──────────────────────────────────┐
│ Jan 19, Mon              Sign Out│
│ Timeline                          │
├──────────────────────────────────┤
│        Jan 19 (Mon)              │  ← Current date (center)
└──────────────────────────────────┘
```

#### **Web:**
```
┌──────────────────────────────────┐
│ Jan 19, Mon              Sign Out│
│ Timeline                          │
├──────────────────────────────────┤
│  ‹   Jan 19 (Mon)   ›            │  ← With navigation buttons
│  Use ← → arrow keys to navigate  │  ← Keyboard hint
└──────────────────────────────────┘
```

### **Day Page Header (In-page)**

```
┌─────────────────────────────────┐
│ 🔥 TODAY                        │  ← Blue highlight
├─────────────────────────────────┤
```

```
┌─────────────────────────────────┐
│ Jan 18 (Sun)                    │  ← Gray (past)
├─────────────────────────────────┤
```

```
┌─────────────────────────────────┐
│ Jan 20 (Tue)                    │  ← Normal (future)
├─────────────────────────────────┤
```

---

## 🔄 Page Transition Flow

### **User Swipes Left (Go to Tomorrow)**

```
Before:
┌──────┬──────┬──────┐
│ Jan  │ Jan  │ Jan  │
│ 18   │[19] │ 20   │
│      │ ↓   │      │
└──────┴──────┴──────┘

After:
┌──────┬──────┬──────┐
│ Jan  │ Jan  │ Jan  │
│ 18   │ 19   │[20] │
│      │      │ ↓   │
└──────┴──────┴──────┘
```

**Mechanism:**
1. User swipes left
2. FlatList scrolls to next index
3. `onViewableItemsChanged` fires
4. Header updates to "Jan 20 (Tue)"
5. Tasks for Jan 20 are displayed

### **User Swipes Right (Go to Yesterday)**

```
Before:
┌──────┬──────┬──────┐
│ Jan  │ Jan  │ Jan  │
│ 18   │[19] │ 20   │
│      │ ↓   │      │
└──────┴──────┴──────┘

After:
┌──────┬──────┬──────┐
│ Jan  │ Jan  │ Jan  │
│[18] │ 19   │ 20   │
│ ↓   │      │      │
└──────┴──────┴──────┘
```

---

## 🌐 Platform-Specific Features

### **Mobile (iOS/Android)**

```tsx
// No buttons needed
<View className="flex-row items-center justify-center">
  <Text>{currentDateDisplay}</Text>
</View>

// Native swipe gestures
<FlatList horizontal pagingEnabled />
```

**Benefits:**
- Natural touch gestures
- No UI clutter
- Familiar interaction pattern

### **Web (Browser)**

```tsx
// With navigation buttons
<View className="flex-row items-center justify-center">
  <Pressable onPress={goToPreviousDay}>
    <Text>‹</Text>  {/* Left chevron */}
  </Pressable>
  
  <Text>{currentDateDisplay}</Text>
  
  <Pressable onPress={goToNextDay}>
    <Text>›</Text>  {/* Right chevron */}
  </Pressable>
</View>

// Keyboard event listener
useEffect(() => {
  window.addEventListener('keydown', handleKeyDown);
}, []);
```

**Benefits:**
- Mouse-friendly navigation
- Keyboard shortcuts (← →)
- Discoverable controls
- Accessible (no gesture required)

### **Web Layout Optimization**

```tsx
// Constrain width on large screens
style={{
  maxWidth: 600,
  width: '100%',
  alignSelf: 'center'
}}
```

**Before (Web):**
```
┌────────────────────────────────────────────┐
│ Tasks spread across full monitor width    │
│ Hard to read on 1920px displays           │
└────────────────────────────────────────────┘
```

**After (Web):**
```
        ┌──────────────────┐
        │   Max 600px      │  ← Centered
        │   Readable       │
        │   Mobile-like    │
        └──────────────────┘
```

---

## 🎮 Interaction Examples

### **Example 1: Browse Past Days**

```
User opens app → Today (Jan 19)
Swipe right 3 times → Jan 16

Journey:
Jan 19 → Jan 18 → Jan 17 → Jan 16

Each swipe:
1. Page transitions smoothly
2. Header updates date
3. Tasks for that day appear
```

### **Example 2: Plan Future Days**

```
User opens app → Today (Jan 19)
Swipe left 2 times → Jan 21

Jan 19 → Jan 20 → Jan 21

On Jan 21 page:
- See future tasks
- Can complete them early (fully editable)
- Can postpone to Jan 22
```

### **Example 3: Web Keyboard Navigation**

```
User on web browser:
Opens app → Today (Jan 19)

Press ← key → Jan 18
Press ← key → Jan 17
Press → key → Jan 18
Press → key → Jan 19

Fast navigation without mouse!
```

### **Example 4: Web Mouse Navigation**

```
User clicks › button → Jan 20
User clicks › button → Jan 21
User clicks ‹ button → Jan 20

Clear, clickable controls
```

---

## 🛠️ Implementation Details

### **Auto Scroll to Today**

```typescript
useEffect(() => {
  setTimeout(() => {
    flatListRef.current?.scrollToIndex({
      index: 7,        // Today is at index 7
      animated: false, // Instant, no animation
    });
  }, 100);
}, [isLoading]);
```

**Why index 7?**
```
Array: [-7, -6, -5, -4, -3, -2, -1, [0], +1, +2, +3, +4, +5, +6, +7]
Index:  0   1   2   3   4   5   6  [7]  8   9  10  11  12  13  14
                                    ↑
                                  TODAY
```

### **Track Current Page**

```typescript
const onViewableItemsChanged = ({ viewableItems }) => {
  const visibleItem = viewableItems[0];
  const index = visibleItem.index;
  
  setCurrentDateIndex(index);
  setCurrentDateDisplay(datePages[index].displayDate);
};

<FlatList
  onViewableItemsChanged={onViewableItemsChanged}
  viewabilityConfig={{
    itemVisiblePercentThreshold: 50,  // Page is "visible" when 50%+ shown
  }}
/>
```

### **Keyboard Navigation (Web)**

```typescript
useEffect(() => {
  if (Platform.OS !== 'web') return;  // Only on web!
  
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      goToPreviousDay();
    } else if (event.key === 'ArrowRight') {
      goToNextDay();
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [goToPreviousDay, goToNextDay]);
```

### **Navigation Functions**

```typescript
const goToPreviousDay = () => {
  if (currentDateIndex > 0) {
    flatListRef.current?.scrollToIndex({
      index: currentDateIndex - 1,
      animated: true,  // Smooth animation
    });
  }
};

const goToNextDay = () => {
  if (currentDateIndex < datePages.length - 1) {
    flatListRef.current?.scrollToIndex({
      index: currentDateIndex + 1,
      animated: true,
    });
  }
};
```

---

## 📏 Responsive Design

### **Mobile (Full Width)**

```tsx
<View style={{ width: SCREEN_WIDTH }}>
  {/* Full screen width */}
</View>
```

### **Web (Constrained)**

```tsx
<View style={{ 
  width: Platform.OS === 'web' ? Math.min(SCREEN_WIDTH, 600) : SCREEN_WIDTH 
}}>
  {/* Max 600px on web, centered */}
</View>
```

### **FlatList Item Width**

```typescript
getItemLayout={(data, index) => ({
  length: Platform.OS === 'web' ? 600 : SCREEN_WIDTH,
  offset: (Platform.OS === 'web' ? 600 : SCREEN_WIDTH) * index,
  index,
})}
```

**Why `getItemLayout`?**
- Enables `scrollToIndex` without measuring
- Improves performance
- Required for `initialScrollIndex`

---

## 🎯 Benefits

### **1. Intuitive Navigation**
```
✅ Natural left/right metaphor (past/future)
✅ Familiar pattern (like calendar apps)
✅ One day at a time (focused view)
```

### **2. Mobile-First**
```
✅ Optimized for touch gestures
✅ No UI clutter (swipe is enough)
✅ Full-screen pages (immersive)
```

### **3. Web-Friendly**
```
✅ Mouse-friendly buttons
✅ Keyboard shortcuts (power users)
✅ Constrained width (readable)
✅ Accessible controls
```

### **4. Performance**
```
✅ FlatList virtualization
✅ Only 15 days loaded initially
✅ Instant page switches
✅ Smooth 60fps animations
```

---

## 🔮 Future Enhancements

### **1. Infinite Scrolling**
```typescript
// Load more days when reaching boundaries
if (currentDateIndex === 0) {
  // Prepend 7 more days to the past
}
if (currentDateIndex === datePages.length - 1) {
  // Append 7 more days to the future
}
```

### **2. Week View Toggle**
```typescript
// Switch between day view and week view
const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
```

### **3. Date Picker**
```typescript
// Jump to any date
<DatePicker onSelect={(date) => scrollToDate(date)} />
```

### **4. Swipe Gestures Customization**
```typescript
// Custom swipe velocity threshold
// Swipe down to refresh
```

---

## 📱 Platform Comparison

| Feature | Mobile | Web |
|---------|--------|-----|
| **Navigation** | Swipe gestures | Buttons + Keyboard + Swipe |
| **Width** | Full screen | Max 600px (centered) |
| **Keyboard** | N/A | ← → arrow keys |
| **Buttons** | None | ‹ › chevrons |
| **Hint Text** | None | "Use arrow keys..." |

---

This horizontal paging view provides an intuitive, platform-optimized experience for day-by-day task management! 🚀
