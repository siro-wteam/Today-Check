# Timezone Handling Guide

**TodayCheck** uses a **hybrid approach** for timezone handling to ensure accurate date grouping across different timezones while maintaining data integrity.

---

## 🌍 Core Principles

### **Storage: UTC (Universal)**
```
All timestamps are stored in UTC (timestamptz) in the database.
This ensures consistent storage regardless of user location.
```

### **Display: Local Time (User's Device)**
```
All dates are displayed and grouped using the user's local timezone.
This ensures users see tasks based on their local calendar.
```

### **Date-Only Fields: No Timezone**
```
Fields like due_date are stored as date-only strings (YYYY-MM-DD).
No timezone conversion is needed for these fields.
```

---

## 📊 Data Storage Schema

### **Database Columns**

| Column | Type | Storage | Example |
|--------|------|---------|---------|
| `due_date` | date | Date-only string | `"2026-01-20"` |
| `due_time` | time | Time-only string | `"14:30:00"` |
| `completed_at` | timestamptz | UTC timestamp | `"2026-01-19T23:00:00Z"` |
| `created_at` | timestamptz | UTC timestamp | `"2026-01-18T10:00:00Z"` |
| `updated_at` | timestamptz | UTC timestamp | `"2026-01-19T15:30:00Z"` |

### **Why This Hybrid?**

```
✅ due_date: Date-only
   - Represents a calendar day (no time)
   - Timezone-independent
   - User thinks "Jan 20" = Jan 20 everywhere

✅ completed_at: UTC timestamp
   - Represents an exact moment
   - Needs timezone conversion for display
   - User in KST completes at "Jan 20 01:00 KST" = "Jan 19 16:00 UTC"
```

---

## ⚠️ The Timezone Problem

### **Scenario: Without Timezone Conversion**

```
User in Seoul (UTC+9):
- Completes task on Jan 20 at 01:00 KST
- System saves: completed_at = "2026-01-19T16:00:00Z" (UTC)

BAD Grouping Logic:
const dateStr = task.completed_at.substring(0, 10);  // "2026-01-19"
// Groups task into Jan 19 page ❌

User thinks:
"I completed this on Jan 20, why is it in Jan 19?" 😕
```

### **Scenario: With Timezone Conversion**

```
User in Seoul (UTC+9):
- Completes task on Jan 20 at 01:00 KST
- System saves: completed_at = "2026-01-19T16:00:00Z" (UTC)

GOOD Grouping Logic:
const completedDate = parseISO(task.completed_at);  // Parse UTC
const dateStr = format(completedDate, 'yyyy-MM-dd');  // "2026-01-20" (Local)
// Groups task into Jan 20 page ✅

User thinks:
"I completed this on Jan 20, and it's in Jan 20!" ✅
```

---

## 🔧 Implementation Rules

### **Rule 1: Use `date-fns` for Date Extraction**

❌ **BAD (String Manipulation):**
```typescript
// This uses UTC date, not local date!
const dateStr = task.completed_at.substring(0, 10); // Wrong timezone
```

✅ **GOOD (Date-fns Conversion):**
```typescript
import { parseISO, format } from 'date-fns';

// Parse UTC timestamp and convert to local date
const completedDate = parseISO(task.completed_at); // UTC -> Local Date object
const dateStr = format(completedDate, 'yyyy-MM-dd'); // Extract local date string
```

### **Rule 2: Date-Only Fields Need No Conversion**

✅ **GOOD (Already in correct format):**
```typescript
// due_date is already "yyyy-MM-dd", use directly
const dateStr = task.due_date; // "2026-01-20"
```

### **Rule 3: Use `differenceInCalendarDays` for Day Differences**

✅ **GOOD (Ignores time, compares calendar dates):**
```typescript
import { differenceInCalendarDays, parseISO } from 'date-fns';

const completedDate = parseISO(task.completed_at); // Local date
const dueDate = parseISO(task.due_date); // Local date

const daysLate = differenceInCalendarDays(completedDate, dueDate);
// Returns: 3 (if completed 3 calendar days late)
```

---

## 💻 Code Examples

### **Grouping DONE Tasks by Completion Date**

```typescript
// app/(tabs)/index.tsx - generateDatePages()

if (task.status === 'DONE') {
  if (!task.completed_at) return;
  
  // ✅ TIMEZONE-SAFE: Convert UTC to local date
  const completedDate = parseISO(task.completed_at); // Parse UTC
  const completedDateStr = format(completedDate, 'yyyy-MM-dd'); // Local date
  
  if (completedDateStr === dateStr) {
    pageTasks.push({ ...task, isGhost: false });
  }
}
```

**How it works:**
```
Input: task.completed_at = "2026-01-19T23:00:00Z" (UTC)

Step 1: parseISO()
→ Date object representing "2026-01-19 23:00 UTC"
→ JS converts to local timezone: "2026-01-20 08:00 KST" (UTC+9)

Step 2: format(date, 'yyyy-MM-dd')
→ Extracts date portion in local timezone: "2026-01-20"

Result: Task grouped into Jan 20 page ✅
```

### **Grouping TODO Tasks by Due Date**

```typescript
// app/(tabs)/index.tsx - generateDatePages()

if (task.status === 'TODO') {
  if (!task.due_date) return;
  
  // ✅ NO CONVERSION NEEDED: due_date is already in yyyy-MM-dd format
  const taskDateStr = task.due_date; // "2026-01-20"
  
  if (taskDateStr === dateStr) {
    pageTasks.push({ ...task, isGhost: false });
  }
}
```

**How it works:**
```
Input: task.due_date = "2026-01-20" (date-only string)

No parsing needed!
→ Already in correct format
→ No timezone conversion required

Result: Task grouped into Jan 20 page ✅
```

### **Calculating Late Completion**

```typescript
// app/(tabs)/index.tsx - TaskItem component

const isLateCompletion = isDone && task.completed_at && task.due_date 
  ? (() => {
      // ✅ Parse both dates to local time
      const completedDate = parseISO(task.completed_at); // UTC -> Local
      const dueDate = parseISO(task.due_date); // Date string -> Local
      
      // ✅ Compare calendar dates (ignores time)
      const daysLate = differenceInCalendarDays(completedDate, dueDate);
      return daysLate > 0 ? daysLate : 0;
    })()
  : 0;
```

**How it works:**
```
Input:
- due_date: "2026-01-15"
- completed_at: "2026-01-19T05:00:00Z" (UTC)

Step 1: Parse both dates
- dueDate: Jan 15, 2026 (local)
- completedDate: Jan 19, 2026 14:00 KST (local, converted from UTC)

Step 2: differenceInCalendarDays()
- Ignores time component
- Compares calendar dates only
- Result: 4 days late

Badge displays: "Late +4d" ✅
```

---

## 🌐 Timezone Flow Diagram

### **Task Completion Flow**

```
User Action (Local Time):
┌─────────────────────────────────┐
│ User completes task             │
│ Jan 20, 2026 01:00 KST (UTC+9) │
└─────────────────────────────────┘
           ↓
Server Storage (UTC):
┌─────────────────────────────────┐
│ Database stores:                │
│ completed_at =                  │
│ "2026-01-19T16:00:00Z"         │
│ (UTC, previous day!)           │
└─────────────────────────────────┘
           ↓
Client Display (Local Time):
┌─────────────────────────────────┐
│ parseISO() → Date object        │
│ format() → "2026-01-20"        │
│ (Back to user's local date)    │
└─────────────────────────────────┘
           ↓
UI Rendering:
┌─────────────────────────────────┐
│ Jan 20 Page:                    │
│ [✓] Task completed              │
│ (Correct date!)                │
└─────────────────────────────────┘
```

---

## 📋 Best Practices

### **✅ DO**

```typescript
// Use date-fns for all date operations
import { parseISO, format, differenceInCalendarDays } from 'date-fns';

// Parse UTC timestamps to Date objects
const date = parseISO(task.completed_at);

// Extract local date strings
const dateStr = format(date, 'yyyy-MM-dd');

// Compare calendar dates (ignores time)
const daysDiff = differenceInCalendarDays(date1, date2);
```

### **❌ DON'T**

```typescript
// Don't use string manipulation for dates
const dateStr = task.completed_at.substring(0, 10); // ❌ Wrong timezone!

// Don't use string comparison for timestamps
if (task.completed_at > task.due_date) // ❌ Comparing strings!

// Don't ignore timezone when grouping
const completedDate = new Date(task.completed_at).toISOString().slice(0, 10); // ❌ UTC only!
```

---

## 🧪 Testing Scenarios

### **Test 1: Late Night Completion (Edge Case)**

```
Setup:
- User in Tokyo (UTC+9)
- due_date: "2026-01-19"
- User completes at Jan 20, 00:30 JST

Expected Behavior:
1. completed_at saved as: "2026-01-19T15:30:00Z" (UTC)
2. Grouping: parseISO + format → "2026-01-20" (Local)
3. Task appears in Jan 20 page ✅
4. Late calculation: Jan 20 - Jan 19 = 1 day
5. Badge: "Late +1d" ✅
```

### **Test 2: Early Morning Completion**

```
Setup:
- User in New York (UTC-5)
- due_date: "2026-01-20"
- User completes at Jan 20, 02:00 EST

Expected Behavior:
1. completed_at saved as: "2026-01-20T07:00:00Z" (UTC)
2. Grouping: parseISO + format → "2026-01-20" (Local)
3. Task appears in Jan 20 page ✅
4. Late calculation: Jan 20 - Jan 20 = 0 days
5. No badge (on time) ✅
```

### **Test 3: Cross-Date Boundary**

```
Setup:
- User in Sydney (UTC+11)
- due_date: "2026-01-19"
- User completes at Jan 19, 23:30 AEDT

Expected Behavior:
1. completed_at saved as: "2026-01-19T12:30:00Z" (UTC, same day!)
2. Grouping: parseISO + format → "2026-01-19" (Local, same day)
3. Task appears in Jan 19 page ✅
4. Late calculation: Jan 19 - Jan 19 = 0 days
5. No badge (on time) ✅
```

---

## 🔍 Debugging Tips

### **Check Current Timezone**

```typescript
// In browser console or React Native debugger
console.log('Current Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone);
console.log('UTC Offset:', new Date().getTimezoneOffset() / -60, 'hours');
```

### **Verify Date Conversion**

```typescript
const utcTimestamp = "2026-01-19T23:00:00Z";
const localDate = parseISO(utcTimestamp);
console.log('UTC:', utcTimestamp);
console.log('Local:', format(localDate, 'yyyy-MM-dd HH:mm:ss'));
console.log('Date Only:', format(localDate, 'yyyy-MM-dd'));
```

### **Test Different Timezones**

```bash
# Test in different timezones (macOS/Linux)
TZ="Asia/Seoul" npm start       # UTC+9
TZ="America/New_York" npm start # UTC-5
TZ="Europe/London" npm start    # UTC+0
```

---

## 📊 Summary Table

| Operation | Input | Process | Output |
|-----------|-------|---------|--------|
| **Store Completion** | Local time | Convert to UTC | `timestamptz` in DB |
| **Group by Completion** | UTC timestamp | `parseISO()` + `format()` | Local date string |
| **Group by Due Date** | Date string | Use directly | Date string (no conversion) |
| **Calculate Late** | UTC + Date | `parseISO()` both + `differenceInCalendarDays()` | Days difference |
| **Display Time** | UTC timestamp | `format()` with time | Local time string |

---

## 🎯 Key Takeaways

1. **Always use `date-fns`** for date operations (never string manipulation)
2. **`parseISO()` converts UTC to local** Date object automatically
3. **`format()` extracts local date/time** from Date object
4. **`differenceInCalendarDays()` ignores time** and compares calendar dates
5. **Date-only fields (`due_date`)** need no timezone conversion
6. **Timestamp fields (`completed_at`)** always need UTC → Local conversion for display

This approach ensures **timezone-safe** date grouping and prevents the "off-by-one-day" bug! 🌍✅
