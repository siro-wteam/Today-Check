# Window-Based Pagination Guide

**TodayCheck** implements **window-based pagination** for efficient data loading, ensuring smooth performance even with thousands of tasks.

---

## 🎯 Core Concept

Instead of loading all tasks at once, we load data in **windows** based on date ranges:

```
Initial Load: Active Tasks + Timeline Window (±7 days)
Additional Load: 14-day chunks as user scrolls
```

This approach balances:
- **Completeness**: All incomplete tasks are visible
- **Performance**: Only relevant data is loaded initially
- **Scalability**: Supports unlimited task history

---

## 📊 Loading Strategy

### **Phase 1: Initial Load (Parallel Queries)**

Two queries run in parallel using `Promise.all()`:

#### **Query 1: Active Tasks (All Time)**
```typescript
// Condition: status == 'TODO' AND due_date <= Today
getActiveTasks()
```

**Purpose**: Ensure all incomplete tasks are visible, regardless of age.

**Example:**
```
Today: Jan 20, 2026

Active Tasks:
- [ ] Task from Dec 1, 2025 (TODO)
- [ ] Task from Jan 5, 2026 (TODO)
- [ ] Task from Jan 18, 2026 (TODO)
- [ ] Task from Jan 20, 2026 (TODO)
```

#### **Query 2: Timeline Window (±7 Days)**
```typescript
// Range: Today - 7 days ~ Today + 7 days
getTimelineTasks(startDate, endDate)
```

**Purpose**: Provide visual context with past/future tasks.

**Example:**
```
Today: Jan 20, 2026

Timeline Window: Jan 13 - Jan 27
- All tasks (TODO, DONE, CANCEL) in this range
```

### **Phase 2: Data Merging & Deduplication**

```typescript
const taskMap = new Map<string, Task>();

// Add active tasks first
activeTasks.forEach(task => taskMap.set(task.id, task));

// Add timeline tasks (won't overwrite)
timelineTasks.forEach(task => {
  if (!taskMap.has(task.id)) {
    taskMap.set(task.id, task);
  }
});

const mergedTasks = Array.from(taskMap.values());
```

**Result**: Single deduplicated list covering all active tasks + timeline window.

---

## 🔄 Infinite Scroll (Additional Loading)

### **Load More Past (Top Scroll)**

**Trigger**: User scrolls within 100px of the top

```typescript
const handleScroll = (event) => {
  if (contentOffset.y < 100) {
    loadMorePast(); // Load 14 days earlier
  }
};
```

**Query:**
```typescript
const oldestDate = currentOldestDate;
const newStartDate = oldestDate - 14 days;
const newEndDate = oldestDate - 1 day;

getTimelineTasks(newStartDate, newEndDate);
```

**Example:**
```
Current Range: Jan 13 - Jan 27
User scrolls to top
→ Load: Dec 30 - Jan 12 (14 days)
New Range: Dec 30 - Jan 27
```

### **Load More Future (Bottom Scroll)**

**Trigger**: `onEndReached` (50% from bottom)

```typescript
const handleEndReached = () => {
  loadMoreFuture(); // Load 14 days later
};
```

**Query:**
```typescript
const newestDate = currentNewestDate;
const newStartDate = newestDate + 1 day;
const newEndDate = newestDate + 14 days;

getTimelineTasks(newStartDate, newEndDate);
```

**Example:**
```
Current Range: Jan 13 - Jan 27
User scrolls to bottom
→ Load: Jan 28 - Feb 10 (14 days)
New Range: Jan 13 - Feb 10
```

---

## 🛠️ Implementation Details

### **1. API Functions** (`lib/api/tasks.ts`)

```typescript
// Query 1: Active tasks (TODO, overdue)
export async function getActiveTasks(): Promise<...> {
  return await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'TODO')
    .lte('due_date', today)
    .is('deleted_at', null);
}

// Query 2: Timeline window
export async function getTimelineTasks(
  startDate: string,
  endDate: string
): Promise<...> {
  return await supabase
    .from('tasks')
    .select('*')
    .gte('due_date', startDate)
    .lte('due_date', endDate)
    .is('deleted_at', null);
}

// Initial fetch: Parallel + Merge
export async function getActiveTasksAndTimeline(): Promise<...> {
  const [activeResult, timelineResult] = await Promise.all([
    getActiveTasks(),
    getTimelineTasks(today - 7, today + 7),
  ]);
  
  // Deduplicate and return
  return mergeAndDeduplicate(activeResult.data, timelineResult.data);
}
```

### **2. Custom Hook** (`lib/hooks/use-timeline-tasks.ts`)

```typescript
export function useTimelineTasks() {
  const [dateRange, setDateRange] = useState({
    oldest: format(today - 7, 'yyyy-MM-dd'),
    newest: format(today + 7, 'yyyy-MM-dd'),
  });

  // Initial load
  const query = useQuery({
    queryKey: ['tasks', 'timeline'],
    queryFn: getActiveTasksAndTimeline,
  });

  // Load more past
  const loadMorePast = async () => {
    const newData = await getTimelineTasks(
      oldest - 14 days,
      oldest - 1 day
    );
    
    // Merge with existing data
    updateQueryData(newData);
    
    // Update range
    setDateRange(prev => ({ ...prev, oldest: oldest - 14 }));
  };

  // Load more future
  const loadMoreFuture = async () => {
    const newData = await getTimelineTasks(
      newest + 1 day,
      newest + 14 days
    );
    
    // Merge with existing data
    updateQueryData(newData);
    
    // Update range
    setDateRange(prev => ({ ...prev, newest: newest + 14 }));
  };

  return { tasks, loadMorePast, loadMoreFuture, isLoadingMore };
}
```

### **3. UI Component** (`app/(tabs)/index.tsx`)

```tsx
export default function HomeScreen() {
  const { tasks, loadMorePast, loadMoreFuture, isLoadingMore } = useTimelineTasks();

  // Handle top scroll
  const handleScroll = (event) => {
    if (contentOffset.y < 100) {
      loadMorePast();
    }
  };

  // Handle bottom scroll
  const handleEndReached = () => {
    loadMoreFuture();
  };

  return (
    <SectionList
      sections={sections}
      onScroll={handleScroll}
      onEndReached={handleEndReached}
      ListFooterComponent={
        isLoadingMore ? <LoadingIndicator /> : null
      }
    />
  );
}
```

---

## 📈 Performance Benefits

### **Initial Load**

**Before (Load All):**
```
Query: SELECT * FROM tasks WHERE deleted_at IS NULL
Result: 10,000 rows
Time: ~2-3 seconds
Memory: High
```

**After (Window-Based):**
```
Query 1: SELECT * WHERE status='TODO' AND due_date<=today
Query 2: SELECT * WHERE due_date BETWEEN today-7 AND today+7
Result: ~50-200 rows (typically)
Time: ~200-500ms
Memory: Low
```

### **Scroll Performance**

**SectionList Virtualization:**
- Only renders visible items
- Recycles item components
- Smooth 60fps scrolling

**Incremental Loading:**
- Load 14 days at a time
- User rarely needs full history at once
- Data loads seamlessly as needed

---

## 🎯 Edge Cases Handled

### **1. Very Old TODO Task**

```
Scenario: Task from 6 months ago still TODO
Solution: Query 1 (Active Tasks) ensures it's loaded
Display: Appears in Today section with large +Nd badge
```

### **2. Many Tasks in Timeline Window**

```
Scenario: 500 tasks in ±7 day window
Solution: Still loads all (important for context)
Optimization: SectionList virtualization handles rendering
```

### **3. Rapid Scrolling**

```
Scenario: User quickly scrolls past/future
Solution: Throttling + debouncing prevents duplicate loads
Implementation: 
  - scrollEventThrottle={400}
  - 1-second cooldown after loadMorePast
```

### **4. Duplicate Tasks**

```
Scenario: TODO task from Jan 10 appears in both queries
Solution: Map-based deduplication by task.id
Result: Single instance in merged data
```

---

## 🔍 Example Scenarios

### **Scenario 1: User with 3-Year History**

```
Total Tasks: 5,000
Active TODO: 20

Initial Load:
  Query 1: 20 active tasks (any date)
  Query 2: ~100 tasks (±7 days)
  Total: ~120 tasks loaded

User Experience:
  - Sees all 20 incomplete tasks in Today
  - Sees recent history/future
  - Past history loads on demand
```

### **Scenario 2: Fresh User**

```
Total Tasks: 5
Active TODO: 3

Initial Load:
  Query 1: 3 active tasks
  Query 2: 5 tasks (all within ±7 days)
  Total: 5 tasks loaded (3 duplicates removed)

User Experience:
  - Fast, instant load
  - All data visible
  - No pagination needed
```

### **Scenario 3: Heavy Retrospective User**

```
Total Tasks: 2,000
Active TODO: 5
User scrolls to 1 year ago

Initial Load: ~120 tasks
After scrolling: 
  - Loads 14 days at a time
  - ~26 pagination loads to reach 1 year
  - Total loaded: ~500 tasks

User Experience:
  - Smooth scrolling
  - Progressive loading
  - No lag or freeze
```

---

## 📊 Query Optimization

### **Database Indexes**

Ensure these indexes exist on `tasks` table:

```sql
CREATE INDEX idx_tasks_user_status_date 
  ON tasks (user_id, status, due_date);

CREATE INDEX idx_tasks_user_date_range 
  ON tasks (user_id, due_date, deleted_at);
```

### **Query Performance**

```
Query 1 (Active):
  Condition: WHERE user_id=X AND status='TODO' AND due_date<=Y
  Uses: idx_tasks_user_status_date
  Performance: <50ms (even with 10,000 rows)

Query 2 (Timeline):
  Condition: WHERE user_id=X AND due_date BETWEEN Y AND Z
  Uses: idx_tasks_user_date_range
  Performance: <100ms (scans narrow range)
```

---

## 🚀 Benefits Summary

### **1. Fast Initial Load**
- Parallel queries (~200-500ms)
- Only essential data loaded
- Immediate UI render

### **2. Scalability**
- Supports unlimited task history
- Performance independent of total task count
- Efficient memory usage

### **3. User Experience**
- No "loading all tasks..." spinner
- Smooth infinite scroll
- Progressive disclosure of data

### **4. Network Efficiency**
- Smaller payload sizes
- Reduced bandwidth usage
- Better mobile performance

---

## 🔮 Future Enhancements

### **1. Predictive Prefetching**
```typescript
// Preload next chunk when 70% scrolled
if (scrollPosition > 0.7 * contentHeight) {
  prefetchMoreFuture();
}
```

### **2. Smart Window Size**
```typescript
// Adjust window based on task density
const taskDensity = tasksInWindow / windowSize;
const adaptiveWindowSize = taskDensity < 5 ? 14 : 7;
```

### **3. Background Refresh**
```typescript
// Refresh active tasks every 5 minutes
useQuery({
  queryKey: ['tasks', 'active'],
  queryFn: getActiveTasks,
  refetchInterval: 5 * 60 * 1000,
});
```

---

This pagination strategy ensures **TodayCheck** remains fast and responsive, regardless of how many tasks you accumulate! 🚀
