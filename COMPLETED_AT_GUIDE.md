# Completed At - Completion Date Grouping Guide

**TodayCheck** uses the `completed_at` timestamp to group **DONE** tasks by their **actual completion date** instead of their original `due_date`. This ensures completed tasks stay visible on the day you finished them.

---

## 🎯 Problem Statement

### **Before (Without `completed_at`)**

```
Scenario:
- Task: "Write Report"
- Due Date: Jan 10
- User completes it on Jan 13

Problem:
- After marking as DONE, the task disappears from Jan 13
- It appears in Jan 10's page (the original due_date)
- User can't see what they accomplished today

Result: Confusion and poor retrospective experience
```

### **After (With `completed_at`)**

```
Scenario:
- Task: "Write Report"
- Due Date: Jan 10
- Completed: Jan 13 (14:30)

Solution:
- Task appears in Jan 13's page (completion date)
- Shows "Late +3d" badge (completed 3 days late)
- User sees what they actually finished today

Result: Clear daily accomplishment tracking
```

---

## 📊 Database Schema

### **Migration**

```sql
-- Add completed_at column
ALTER TABLE public.tasks 
ADD COLUMN completed_at timestamptz NULL;

-- Create index for efficient filtering
CREATE INDEX tasks_completed_at_idx 
ON public.tasks USING btree (completed_at);
```

**File:** `supabase/migrations/20260120000000_add_completed_at.sql`

### **Table Structure**

```
tasks:
  - id (uuid, PK)
  - user_id (uuid, FK)
  - title (text)
  - status ('TODO' | 'DONE' | 'CANCEL')
  - due_date (date, nullable)          ← Original planned date
  - due_time (time, nullable)
  - original_due_date (date, nullable) ← For rollover calculation
  - completed_at (timestamptz, NULL)   ← NEW: Actual completion timestamp
  - created_at (timestamptz)
  - updated_at (timestamptz)
  - deleted_at (timestamptz, nullable)
```

---

## 🔄 Automatic Logic

### **Status Change Behavior**

The `updateTask()` function automatically manages `completed_at`:

```typescript
// lib/api/tasks.ts

export async function updateTask(input: UpdateTaskInput) {
  const { id, ...updates } = input;

  // Auto-manage completed_at based on status changes
  if (updates.status && !('completed_at' in updates)) {
    if (updates.status === 'DONE') {
      // Task marked as done → set completed_at to now
      updates.completed_at = new Date().toISOString();
    } else {
      // Task marked as TODO/CANCEL → clear completed_at
      updates.completed_at = null;
    }
  }

  // ... update database
}
```

### **User Actions**

| Action | Status Transition | `completed_at` |
|--------|------------------|----------------|
| **Tap (Complete)** | `TODO` → `DONE` | Set to **now** |
| **Tap (Undo)** | `DONE` → `TODO` | Set to **null** |
| **Cancel Task** | `TODO` → `CANCEL` | Set to **null** |
| **Reactivate** | `CANCEL` → `TODO` | Set to **null** |

---

## 📍 Grouping Logic

### **Date Page Assignment Rules**

Each task is assigned to a **specific day page** based on these rules:

```typescript
// app/(tabs)/index.tsx - generateDatePages()

tasks.forEach((task) => {
  if (task.status === 'DONE') {
    // ✅ RULE 1: DONE tasks → Group by completed_at
    if (!task.completed_at) return; // Skip if no timestamp
    
    const completedDateStr = format(
      parseISO(task.completed_at), 
      'yyyy-MM-dd'
    );
    
    if (completedDateStr === currentPageDate) {
      pageTasks.push(task);  // Add to completion date page
    }
  } else {
    // ✅ RULE 2: TODO/CANCEL tasks → Group by due_date
    if (!task.due_date) return;
    
    if (task.due_date === currentPageDate) {
      pageTasks.push(task);  // Add to due date page
    }
    
    // Special: Overdue TODO tasks also appear in TODAY
    if (task.status === 'TODO' && task.due_date < today) {
      if (currentPageDate === today) {
        pageTasks.push(task);  // Add to today page
      }
    }
  }
});
```

### **Visual Flow**

```
Task: "Write Report"
Due: Jan 10
Status: TODO

↓ User completes on Jan 13 (14:30)

Status: DONE
completed_at: 2026-01-13T14:30:00Z

↓ Grouping Logic

Jan 10 Page:  [Empty]         ← Not shown (completed_at ≠ Jan 10)
Jan 13 Page:  [✓ Write Report]  ← Shows here (completed_at = Jan 13)
              [Late +3d]       ← Badge shows it was 3 days late
```

---

## 🎨 UI Indicators

### **Late Completion Badge**

Tasks completed after their `due_date` show an **orange "Late" badge**:

```typescript
// Calculate late completion days
const isLateCompletion = isDone && task.completed_at && task.due_date 
  ? (() => {
      const completedDate = parseISO(task.completed_at);
      const dueDate = parseISO(task.due_date);
      const daysLate = differenceInCalendarDays(completedDate, dueDate);
      return daysLate > 0 ? daysLate : 0;
    })()
  : 0;
```

**Render:**

```tsx
{isLateCompletion > 0 && (
  <View className="bg-orange-500 px-2 py-1 rounded-md">
    <Text className="text-white text-xs font-semibold">
      Late +{isLateCompletion}d
    </Text>
  </View>
)}
```

### **Visual Examples**

#### **On-Time Completion**

```
┌────────────────────────────────┐
│ Jan 19 (Mon)                   │
├────────────────────────────────┤
│ [✓] Write Report               │  ← Completed on due date
│                                │     No badge (on time)
└────────────────────────────────┘
```

#### **Late Completion**

```
┌────────────────────────────────┐
│ Jan 22 (Thu)                   │
├────────────────────────────────┤
│ [✓] Write Report  [Late +3d]   │  ← Completed 3 days late
│                   ^^^^^^^^^^^     Orange badge
└────────────────────────────────┘
```

#### **Early Completion**

```
┌────────────────────────────────┐
│ Jan 17 (Fri)                   │
├────────────────────────────────┤
│ [✓] Write Report               │  ← Completed 2 days early
│                                │     No badge (early is good!)
└────────────────────────────────┘
```

---

## 🔍 Example Scenarios

### **Scenario 1: Normal Workflow**

```
1. Create task "Buy Groceries" for Jan 19
   → due_date: 2026-01-19
   → completed_at: null

2. Jan 19: Complete the task
   → status: DONE
   → completed_at: 2026-01-19T10:30:00Z

3. View Jan 19 page:
   → [✓] Buy Groceries  (no badge, completed on time)
```

### **Scenario 2: Delayed Completion**

```
1. Create task "Submit Taxes" for Jan 15
   → due_date: 2026-01-15
   → completed_at: null

2. Jan 15-18: Task remains TODO (overdue)
   → Shows in Jan 15 page as [○ Submit Taxes]
   → Also shows in TODAY with [+Nd] badge

3. Jan 19: Finally complete it
   → status: DONE
   → completed_at: 2026-01-19T14:00:00Z

4. View Jan 19 page:
   → [✓] Submit Taxes  [Late +4d]
   
5. View Jan 15 page:
   → [Empty] (task no longer grouped by due_date)
```

### **Scenario 3: Early Completion**

```
1. Create task "Prepare Presentation" for Jan 25
   → due_date: 2026-01-25

2. Jan 20: Complete early
   → status: DONE
   → completed_at: 2026-01-20T16:00:00Z

3. View Jan 20 page:
   → [✓] Prepare Presentation  (no badge)
   
4. View Jan 25 page:
   → [Empty] (task grouped by completion date, not due date)
```

### **Scenario 4: Uncomplete (Undo)**

```
1. Task was DONE on Jan 19
   → completed_at: 2026-01-19T10:00:00Z
   
2. User taps to undo (DONE → TODO)
   → status: TODO
   → completed_at: null  (cleared!)

3. Task moves back to due_date grouping
   → Appears in original due_date page
   → No longer in Jan 19
```

---

## 🎯 Benefits

### **1. Clear Retrospective**

```
User can look back at any day and see:
✅ What they actually accomplished (DONE tasks)
✅ What was planned but postponed (Ghost tasks)
✅ What's planned for the future (TODO tasks)
```

### **2. Honest Tracking**

```
✅ Late completions are visible (orange badge)
✅ Can analyze delay patterns
✅ Can improve time estimation
```

### **3. Accurate Daily Summary**

```
Before:
Jan 20: [No tasks]  ← Misleading (did complete 3 tasks)

After:
Jan 20: 
  [✓] Task A
  [✓] Task B  [Late +2d]
  [✓] Task C
  
Clear view of daily productivity!
```

### **4. No Lost Tasks**

```
Before:
- Complete task on Jan 15
- Task moves to original due_date (Jan 10)
- User thinks "Where did it go?"

After:
- Complete task on Jan 15
- Task stays in Jan 15
- User sees immediate feedback
```

---

## 🔧 Implementation Details

### **Type Definitions**

```typescript
// lib/types.ts

export interface Task {
  id: string;
  user_id: string;
  title: string;
  status: TaskStatus;
  due_date: string | null;
  due_time: string | null;
  original_due_date: string | null;
  completed_at: string | null;  // ← NEW
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface UpdateTaskInput {
  id: string;
  title?: string;
  status?: TaskStatus;
  due_date?: string | null;
  due_time?: string | null;
  completed_at?: string | null;  // ← NEW (optional manual override)
}
```

### **Auto-Update Logic**

```typescript
// Automatic in updateTask()
if (updates.status === 'DONE') {
  updates.completed_at = new Date().toISOString();
}

// Manual override (if needed)
updateTask({
  id: taskId,
  status: 'DONE',
  completed_at: customTimestamp,  // Override auto-set value
});
```

### **Date Extraction**

```typescript
// Extract date from completed_at timestamp
const completedDate = parseISO(task.completed_at);  // Full Date object
const completedDateStr = format(completedDate, 'yyyy-MM-dd');  // Date only
```

---

## 📊 Comparison Table

| Aspect | TODO Tasks | DONE Tasks |
|--------|-----------|-----------|
| **Grouping Basis** | `due_date` | `completed_at` |
| **Date Display** | When it should be done | When it was finished |
| **Overdue Logic** | Show in TODAY if `due_date < today` | N/A |
| **Badge** | `+Nd` (overdue days) | `Late +Nd` (completion delay) |
| **Color** | Red (overdue) | Orange (late) |
| **Ghost** | Yes (if past TODO) | No |

---

## 🚀 User Flow Summary

```
1. Create Task
   ↓
   due_date: Set
   completed_at: null
   
2. View in Timeline
   ↓
   Grouped by due_date
   
3. Complete Task (Tap)
   ↓
   status: DONE
   completed_at: NOW
   
4. View in Timeline
   ↓
   Grouped by completed_at
   Shows "Late +Nd" if delayed
   
5. Undo (Tap again)
   ↓
   status: TODO
   completed_at: null
   
6. Back to due_date grouping
```

---

This `completed_at` system provides honest, clear, and useful daily retrospectives for productivity tracking! 🎯
