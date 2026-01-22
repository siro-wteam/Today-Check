# Navigation & Week View Guide

**TodayCheck** uses a **bottom tab navigation** structure with 4 main tabs, featuring a **Week Summary view** for weekly task overview.

---

## 📱 Navigation Structure

### **Bottom Tab Bar (5 Tabs)**

```
┌────────────────────────────────┐
│         App Content            │
│                                │
└────────────────────────────────┘
┌────────────────────────────────┐
│ Day  Week  ⊕  Backlog  Profile │
│  📅   📊   ●    📦      👤     │
└────────────────────────────────┘
```

### **Tab Configuration**

| Tab | Icon | Label | Action |
|-----|------|-------|--------|
| **Day** | Calendar | "Day" | Navigate to Day view |
| **Week** | CalendarRange | "Week" | Navigate to Week view |
| **Add** | Plus (Circle) | "" | Open Add Task Modal |
| **Backlog** | Archive | "Backlog" | Navigate to Backlog view |
| **Profile** | User | "Profile" | Navigate to Profile |

---

---

## 📦 Tab 4: Backlog (NEW!)

### **Purpose**
Collection of tasks without due dates - ideas, someday/maybe items.

### **Layout**

```
┌────────────────────────────────┐
│ BZ                         🔔  │ ← AppHeader
├────────────────────────────────┤
│ 📦 Backlog                     │ ← Title
│ Tasks without dates            │
├────────────────────────────────┤
│                                │
│ ○ Task A              ›        │ ← Swipeable
│ ○ Task B              ›        │
│ ✓ Task C              ›        │
│                                │
└────────────────────────────────┘
```

### **Swipe Actions**

**Swipe Right → Schedule:**
```
┌────────────────────────────────┐
│     [Schedule]                 │
│ ○ Task A      ››››             │
└────────────────────────────────┘

Action: Opens Date Picker Modal
Result: Assigns due_date, moves to Day/Week view
```

### **Long Press Actions**

```
Action Sheet:
  [ Do Today ]        → due_date = today
  [ Do Tomorrow ]     → due_date = tomorrow
  [ Pick Date ]       → Open date picker
  [ Delete ]          → Soft delete
  [ Cancel ]
```

### **Empty State**

```
┌────────────────────────────────┐
│                                │
│           📝                   │
│                                │
│    Your backlog is empty       │
│                                │
│  Add ideas and tasks without   │
│  dates here. Schedule later!   │
│                                │
└────────────────────────────────┘
```

### **Data Query**

```typescript
// Fetch backlog tasks
getBacklogTasks()
→ WHERE due_date IS NULL
  AND deleted_at IS NULL
```

---

## 🏠 Tab 1: Day (Home)

### **Content**
- Horizontal Day Paging View (기존 구현)
- Swipe left/right to navigate between days
- Shows tasks grouped by date

### **Features**
- All existing Day view features
- Jump to specific date (from Week view)

```
┌────────────────────────────────┐
│ BZ                         🔔  │ ← AppHeader
├────────────────────────────────┤
│  ‹   Jan 20 (Mon)   ›          │ ← Date Navigator
├────────────────────────────────┤
│                                │
│ [ ○ ] Task A      [14:00]      │
│ [ ○ ] Task B      [16:00]      │
│ [ ✓ ] Task C                   │
│                                │
└────────────────────────────────┘
```

---

## 📊 Tab 2: Week (Summary)

### **Purpose**
Weekly overview of tasks with completion tracking.

### **Layout**

```
┌────────────────────────────────┐
│ BZ                         🔔  │ ← AppHeader
├────────────────────────────────┤
│  ‹  Jan 19 - Jan 25  ›         │ ← Week Navigator
├────────────────────────────────┤
│                                │
│ ┌────────────────────────────┐ │
│ │ Jan 19 (Sun)        0/3    │ │ ← Daily Card
│ │ ○ Task A                   │ │
│ │ ○ Task B                   │ │
│ │ ○ Task C                   │ │
│ └────────────────────────────┘ │
│                                │
│ ┌────────────────────────────┐ │
│ │ Jan 20 (Mon) (Today)  2/5  │ │
│ │ ✓ Task D                   │ │
│ │ ✓ Task E                   │ │
│ │ ○ Task F                   │ │
│ │ + 2 more tasks...          │ │
│ └────────────────────────────┘ │
│                                │
└────────────────────────────────┘
```

### **Week Navigator**

```typescript
Week Range Display: "Jan 19 - Jan 25"

Controls:
  ‹ (Left) → Previous week
  › (Right) → Next week
```

### **Daily Card Structure**

Each day has a card with:

#### **Header:**
```
┌────────────────────────────────┐
│ Jan 20 (Mon) (Today)      2/5  │
│ ^^^^^^^^^^^^             ^^^^^  │
│ Date + Today flag    Completion │
└────────────────────────────────┘
```

#### **Body:**
```
Task List (Max 3 visible):
  ✓ Completed task (grayed out)
  ○ Active task (normal)
  ○ Cancelled task (strikethrough)

If more than 3 tasks:
  "+ 2 more tasks..."
```

#### **Interaction:**
```typescript
Tap on card → Jump to Day tab, scroll to that date
```

---

## ➕ Tab 3: Add (Center Button)

### **Design**
- **Position:** Center of tab bar
- **Style:** Circular, elevated, larger than other icons
- **Color:** Blue (#3B82F6)
- **Shadow:** Prominent shadow for emphasis

### **Behavior**
```typescript
Tab Press → Open AddTaskModal (from _layout.tsx)

Note: Does NOT navigate to a screen
      Just triggers modal overlay
```

---

## 👤 Tab 4: Profile

### **Content**

```
┌────────────────────────────────┐
│ BZ                         🔔  │ ← AppHeader
├────────────────────────────────┤
│                                │
│       ┌─────────────┐          │
│       │     👤      │          │ ← Avatar
│       └─────────────┘          │
│                                │
│       username                 │
│       user@email.com           │
│                                │
│ ──────────────────────────────│
│                                │
│  Completed  │  Active  │ Streak│ ← Stats
│      —      │     —    │   —   │
│                                │
├────────────────────────────────┤
│ SETTINGS                       │
│                                │
│ 🔔 Notifications               │
│    Manage your notifications   │
│                                │
│ 🎨 Appearance                  │
│    Theme and display settings  │
│                                │
│ ℹ️  About                      │
│    Version and info            │
│                                │
├────────────────────────────────┤
│                                │
│    🚪  Sign Out                │
│                                │
└────────────────────────────────┘
```

### **Features**
- User info display
- Stats (placeholder for future)
- Settings options (placeholder)
- Sign out button

---

## 🎨 Common UI: AppHeader

### **Design (YouTube Style)**

```
┌────────────────────────────────┐
│ BZ                         🔔  │
│ ^^                         ^^  │
│ Logo                      Bell │
└────────────────────────────────┘
```

### **Components**
- **Left:** "BZ" logo (bold text)
- **Right:** Bell icon (notifications)
- **Style:** White bg, bottom border

### **Code**
```tsx
<AppHeader onNotificationPress={handleNotificationPress} />
```

---

## 🔄 Navigation Flow

### **Scenario 1: Normal Day-to-Day Use**

```
User opens app
→ Day tab (default)
→ Swipe through days
→ Tap + to add task
→ View week summary via Week tab
```

### **Scenario 2: Weekly Planning**

```
User goes to Week tab
→ See weekly overview
→ Identify busy days (high task count)
→ Tap on a specific day card
→ Jump to Day tab for that date
→ Manage tasks for that day
```

### **Scenario 3: Quick Task Add**

```
User in any tab
→ Tap + button (center)
→ AddTaskModal appears
→ Fill in task details
→ Submit
→ Modal closes
→ Stay in current tab
→ Task appears in appropriate date
```

---

## 📊 Week View Data Logic

### **Data Fetching**

```typescript
// lib/hooks/use-week-tasks.ts

const weekStart = startOfWeek(targetWeek); // Sunday
const weekEnd = endOfWeek(targetWeek);     // Saturday

// Fetch all tasks in this range
const tasks = await getTimelineTasks(weekStartStr, weekEndStr);
```

### **Grouping Logic**

```typescript
// Same as Day view grouping:
// - DONE tasks: Group by completed_at (when finished)
// - TODO tasks: Group by due_date (when planned)

dailyGroups = eachDayOfInterval({ start: weekStart, end: weekEnd }).map((date) => {
  const dayTasks = tasks.filter((task) => {
    if (task.status === 'DONE') {
      const completedDateStr = format(parseISO(task.completed_at), 'yyyy-MM-dd');
      return completedDateStr === dateStr;
    } else {
      return task.due_date === dateStr;
    }
  });
  
  return {
    date: dateStr,
    tasks: dayTasks,
    completedCount: dayTasks.filter(t => t.status === 'DONE').length,
    totalCount: dayTasks.length,
  };
});
```

### **Week Navigation**

```typescript
const [weekOffset, setWeekOffset] = useState(0);

// 0 = this week
// -1 = last week
// +1 = next week

goToPreviousWeek() → weekOffset--
goToNextWeek() → weekOffset++
```

---

## 🎯 Jump to Date Feature

### **From Week View to Day View**

```typescript
// Week Screen - Card Press Handler
const handleDateCardPress = (dateStr: string) => {
  router.push({
    pathname: '/(tabs)',
    params: { jumpToDate: dateStr },
  });
};
```

### **In Day Screen (Future Enhancement)**

```typescript
// Receive jumpToDate param
// Scroll FlatList to that date's index
// Calculate index from date difference
```

---

## 🏗️ File Structure

```
app/
├── (tabs)/
│   ├── _layout.tsx       ← Tab Navigator Config
│   ├── index.tsx         ← Day View (Home)
│   ├── week.tsx          ← Week View
│   ├── profile.tsx       ← Profile View
│   ├── add.tsx           ← Placeholder (triggers modal)
│   └── placeholder.tsx   ← Hidden (layout balance)
│
components/
├── AppHeader.tsx         ← Common header
└── AddTaskModal.tsx      ← Task creation modal

lib/
├── hooks/
│   └── use-week-tasks.ts ← Week data hook
└── api/
    └── tasks.ts          ← API functions
```

---

## 🎨 Tab Bar Styling

### **Active Tab**
```
Color: #3B82F6 (Blue)
Icon: 24px, stroke-width: 2
Label: Bold, 12px
```

### **Inactive Tab**
```
Color: #9CA3AF (Gray)
Icon: 24px, stroke-width: 2
Label: Normal, 12px
```

### **Add Button (Special)**
```
Size: 56x56px (larger)
Position: Elevated (-20px margin-top)
Background: Blue gradient
Shadow: Prominent
Icon: White Plus, 28px
```

---

## 📱 Platform-Specific UI

### **Mobile (iOS/Android)**
```
Tab Bar Height: 90px (iOS), 70px (Android)
Bottom Padding: 20px (iOS), 10px (Android)
Header: Full width
```

### **Web**
```
Tab Bar Height: 70px
Bottom Padding: 10px
Header: Max 600px, centered
Content: Max 600px, centered
```

---

## 🚀 Future Enhancements

### **Week View**
- [ ] Drag-and-drop tasks between days
- [ ] Week completion progress bar
- [ ] Filter by task status (DONE/TODO)
- [ ] Export week summary

### **Navigation**
- [ ] Swipe gestures between tabs (mobile)
- [ ] Keyboard shortcuts (web: 1/2/3/4 for tabs)
- [ ] Deep linking to specific dates
- [ ] Breadcrumb navigation

### **Profile**
- [ ] Real stats calculation
- [ ] Task completion charts
- [ ] Streak tracking
- [ ] Theme switcher
- [ ] Export data

---

This navigation structure provides an intuitive, mobile-first experience with clear information hierarchy and easy access to all features! 📱✨
