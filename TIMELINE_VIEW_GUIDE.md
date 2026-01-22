# Timeline View Guide

**TodayCheck** uses a **Timeline Scroll View** with date-based sections to provide comprehensive task management with retrospective capabilities through the **Ghost Task** concept.

---

## 🎯 Core Concepts

### **Timeline Structure**

```
┌──────────────────────────────────┐
│ Jan 18, Sun (Past)               │  ← Gray, Dimmed
├──────────────────────────────────┤
│ [ ➡️ ]  Incomplete Task (Ghost)  │
│ [ ✓ ]  Completed Task            │
├──────────────────────────────────┤
│ 🔥 TODAY                         │  ← Blue, Bold, Highlighted
├──────────────────────────────────┤
│ [ ○ ]  Overdue Task      [+2d]   │  ← Real, from Jan 18
│ [ ○ ]  Today's Task      [14:00] │
│ [ ✓ ]  Completed Task            │
├──────────────────────────────────┤
│ Jan 20, Tue (Future)             │  ← Light Gray
├──────────────────────────────────┤
│ [🔒]  Upcoming Task       [10:00]│  ← Read-only, 60% opacity
└──────────────────────────────────┘
```

---

## 📊 Data Transformation Logic

### **groupTasksByDate Function**

Tasks are grouped into Past/Today/Future sections based on `due_date`:

```typescript
function groupTasksByDate(tasks: TaskWithRollover[]): TaskSection[] {
  const todayDate = startOfDay(new Date());
  
  tasks.forEach((task) => {
    const taskDate = parseISO(task.due_date);
    const isTaskPast = taskDate < todayDate;
    const isTaskToday = taskDate === todayDate;
    const isTaskFuture = taskDate > todayDate;
    
    // Classification logic...
  });
}
```

### **Task Classification Rules**

#### **Case 1: Past TODO (Incomplete)**
```
Condition: due_date < Today AND status == 'TODO'
Action: 
  1. Create GHOST item → Past section
  2. Create REAL item → Today section (overdue)
```

**Example:**
```
Task: "Write Report" (Due: Jan 18, Status: TODO)
Today: Jan 20

Result:
  - Jan 18 Section: [➡️] Write Report (Ghost)
  - TODAY Section: [○] Write Report [+2d] (Real, Overdue)
```

#### **Case 2: Past DONE/CANCEL**
```
Condition: due_date < Today AND status == 'DONE' or 'CANCEL'
Action: Place in Past section ONLY
```

**Example:**
```
Task: "Team Meeting" (Due: Jan 18, Status: DONE)
Today: Jan 20

Result:
  - Jan 18 Section: [✓] Team Meeting (Completed record)
```

#### **Case 3: Today Task (Any Status)**
```
Condition: due_date == Today
Action: Place in Today section
```

**Example:**
```
Task: "Call Client" (Due: Jan 20, Status: TODO)
Today: Jan 20

Result:
  - TODAY Section: [○] Call Client
```

#### **Case 4: Future Task**
```
Condition: due_date > Today
Action: Place in Future section with isFuture flag
```

**Example:**
```
Task: "Conference Prep" (Due: Jan 22, Status: TODO)
Today: Jan 20

Result:
  - Jan 22 Section: [🔒] Conference Prep (Read-only)
```

---

## 👻 Ghost Task Concept

### **What is a Ghost Task?**

A **Ghost Task** is a visual representation of an incomplete task that was due in the past. It serves as a **retrospective marker** showing "this task was planned for this day but wasn't completed."

### **Purpose:**
1. **Accountability**: See exactly what was planned vs. completed
2. **Retrospective**: Review past planning vs. execution
3. **Context Preservation**: Maintain historical timeline integrity

### **Visual Design:**

```
┌──────────────────────────────────────┐
│ Jan 18, Sun                          │
├──────────────────────────────────────┤
│ [ ➡️ ]  Write Report     [14:00]     │  ← Ghost
│        ↑ Arrow icon instead of checkbox
│        ↑ Gray, dimmed text
│        ↑ No strikethrough
└──────────────────────────────────────┘
```

### **Interaction:**
- **Tap**: Shows message "This task has been moved to Today"
- **Long Press**: Disabled (read-only)
- **Style**: Gray text, no strikethrough, arrow icon (➡️)

---

## 🔒 Future Task (Read-Only)

### **Visual Design:**

```
┌──────────────────────────────────────┐
│ Jan 22, Wed                          │
├──────────────────────────────────────┤
│ [🔒]  Conference Prep    [10:00]     │
│       ↑ Lock icon
│       ↑ 60% opacity
└──────────────────────────────────────┘
```

### **Interaction:**
- **Tap**: Shows message "Future tasks cannot be edited yet"
- **Long Press**: Disabled (read-only)
- **Style**: Normal text, 60% opacity, lock icon (🔒)

---

## 🗓️ Section Headers

### **Past Section:**
```css
Background: Gray (bg-gray-100)
Text: Small, Gray (text-gray-400)
Format: "Jan 18, Sun"
```

### **Today Section:**
```css
Background: Blue (bg-blue-50)
Border: Blue (border-blue-200)
Text: Large, Bold, Blue (text-blue-600)
Format: "🔥 TODAY"
```

### **Future Section:**
```css
Background: Gray (bg-gray-100)
Text: Small, Light Gray (text-gray-500)
Format: "Jan 20, Tue"
```

---

## ⚡ Auto Scroll to Today

### **Implementation:**

```typescript
useEffect(() => {
  if (!isLoading && sections.length > 0) {
    const todayIndex = sections.findIndex(s => s.isToday);
    if (todayIndex >= 0) {
      setTimeout(() => {
        sectionListRef.current?.scrollToLocation({
          sectionIndex: todayIndex,
          itemIndex: 0,
          animated: true,
          viewPosition: 0, // 0 = top of screen
        });
      }, 100);
    }
  }
}, [isLoading, sections]);
```

### **Behavior:**
- App launches → Auto scrolls to TODAY section
- Past tasks are above (scroll up to view)
- Future tasks are below (scroll down to view)

---

## 🎨 TaskItem Variations

### **1. Ghost Item (Past Incomplete)**

```tsx
<Pressable className="bg-gray-50 border-gray-200 opacity-70">
  <View className="flex-row items-center gap-3">
    <Text>➡️</Text>  {/* Arrow icon */}
    <Text className="text-gray-400">{task.title}</Text>
    {/* Time badge if exists */}
  </View>
</Pressable>
```

**Properties:**
- `isGhost: true`
- Gray background
- Arrow icon (➡️) instead of checkbox
- Dimmed text
- Tap → "Moved to Today" message

### **2. Future Item (Read-Only)**

```tsx
<Pressable className="bg-white border-gray-200 opacity-60">
  <View className="flex-row items-center gap-3">
    <Text>🔒</Text>  {/* Lock icon */}
    <Text className="text-gray-700">{task.title}</Text>
    {/* Time badge if exists */}
  </View>
</Pressable>
```

**Properties:**
- `isFuture: true`
- Normal background
- Lock icon (🔒)
- 60% opacity
- Tap → "Cannot edit yet" message

### **3. Actionable Item (Today)**

```tsx
<Pressable className="bg-white border-gray-200">
  <View className="flex-row items-center gap-3">
    {/* Checkbox */}
    <View className="w-5 h-5 rounded-full border-2">
      {isDone && <Text>✓</Text>}
      {isCancelled && <Text>✕</Text>}
    </View>
    
    {/* Title */}
    <Text className={isDone ? 'line-through font-bold' : ''}>
      {task.title}
    </Text>
    
    {/* Badges */}
    <View>
      {/* Time badge */}
      {/* Overdue badge: +2d */}
    </View>
  </View>
</Pressable>
```

**Properties:**
- Full interactivity
- Short Tap: Toggle status
- Long Press: Action Sheet (Complete/Postpone/Cancel/Delete)
- Overdue badge: `+Nd` in red

---

## 🧪 Example Scenarios

### **Scenario 1: Task Planned but Not Done**

```
Initial State (Jan 18):
[ ] Write Report (Due: Jan 18)

Next Day (Jan 19):
======================
Jan 18, Sun
  [➡️] Write Report (Ghost - shows what was planned)

🔥 TODAY (Jan 19)
  [○] Write Report [+1d] (Real - overdue by 1 day)
```

### **Scenario 2: Task Postponed Multiple Times**

```
Original: Jan 15
Postponed: Jan 16 → Jan 17 → Jan 18
Today: Jan 20

======================
Jan 15, Wed
  [➡️] Write Report (Ghost - original plan)

🔥 TODAY (Jan 20)
  [○] Write Report [+5d] (Overdue by 5 days from original)
```

### **Scenario 3: Task Completed in the Past**

```
Task: Team Meeting (Due: Jan 18, Status: DONE)
Today: Jan 20

======================
Jan 18, Sun
  [✓] Team Meeting (Completed record)

🔥 TODAY (Jan 20)
  (No duplicate - DONE tasks stay in their section)
```

### **Scenario 4: Future Task**

```
Task: Conference (Due: Jan 25)
Today: Jan 20

======================
Jan 25, Sun
  [🔒] Conference [10:00] (Read-only, locked)
```

---

## 📱 UX Flow

### **App Launch:**
1. Load all tasks with `deleted_at IS NULL`
2. Group tasks by date into sections
3. Render SectionList
4. Auto scroll to TODAY section (100ms delay)

### **Task Interaction:**

#### **Ghost Task Tap:**
```
1. User taps ghost task in past section
2. 📳 Light haptic
3. Alert: "This task has been moved to Today"
4. User scrolls to TODAY section to find real task
```

#### **Future Task Tap:**
```
1. User taps future task
2. 📳 Light haptic
3. Alert: "Future tasks cannot be edited yet"
```

#### **Today Task - Short Tap:**
```
1. User taps TODO task
2. 📳 Light haptic
3. Status: TODO → DONE
4. Visual: Checkbox ✓ + Bold strikethrough
```

#### **Today Task - Long Press:**
```
1. User long presses TODO task (0.5s)
2. 📳 Heavy haptic
3. Action Sheet appears:
   - Complete
   - Postpone to Tomorrow
   - Cancel Task
   - Delete
   - Close
```

---

## 🔄 Data Flow

### **Postpone to Tomorrow:**

```
Before (Jan 20):
======================
🔥 TODAY
  [○] Write Report [+2d]

After Postpone:
======================
🔥 TODAY
  (Task disappears)

Jan 21, Wed
  [○] Write Report [+3d] (Moved to tomorrow, +3d from original)
```

### **Complete Task:**

```
Before:
======================
🔥 TODAY
  [○] Team Meeting [14:00]

After Complete (Short Tap):
======================
🔥 TODAY
  [✓] Team Meeting [14:00] (Bold strikethrough)
```

---

## 🎯 Key Benefits

### **1. Retrospective Capability**
- See exactly what was planned for each day
- Compare planned vs. actual execution
- Accountability for delayed tasks

### **2. Context Preservation**
- Historical timeline remains intact
- Ghost tasks show original planning
- Real tasks show current status

### **3. Focus on Today**
- Auto scroll to TODAY section
- Clear visual separation (🔥 TODAY)
- Overdue items prominently displayed

### **4. Future Planning**
- Preview upcoming tasks
- Read-only to prevent accidental edits
- Clear visual indication (🔒 lock icon)

---

## 📐 Technical Details

### **Libraries:**
- `date-fns`: Date calculations and formatting
- `expo-haptics`: Haptic feedback
- `@tanstack/react-query`: Data caching and invalidation

### **Key Functions:**
- `groupTasksByDate()`: Transform flat task list into sectioned data
- `scrollToLocation()`: Auto scroll to TODAY section
- `parseISO()`, `format()`, `startOfDay()`: Date utilities

### **Performance:**
- **SectionList**: Virtualized rendering for large datasets
- **Window-Based Pagination**: Efficient data loading (see [PAGINATION_GUIDE.md](PAGINATION_GUIDE.md))
  - Initial load: Active tasks + ±7 days timeline
  - Incremental loading: 14-day chunks on scroll
  - Deduplication: Map-based ID merging
- **Memoized sections**: Avoid unnecessary recalculations
- **Optimistic updates**: Immediate UI feedback

### **Data Loading Strategy:**

```
Initial Load (Parallel):
  Query 1: Active TODO tasks (all time)
  Query 2: Timeline window (±7 days)
  Result: Merged & deduplicated

Infinite Scroll:
  Top: Load 14 days past
  Bottom: Load 14 days future
```

**Benefit**: Fast load even with thousands of tasks!

---

This timeline view provides a comprehensive task management experience with historical context and future visibility! 🚀
