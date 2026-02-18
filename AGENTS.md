# AGENTS.md - TodayCheck Development Guide

> **Purpose**: This file provides essential context for AI coding agents working on the TodayCheck project.
> **Last Updated**: 2026-02-12

---

## 🎯 Project Context

**TodayCheck** is a personal and group task management app with the philosophy: **"Simple like a To-do list, managed like pro"**.

- **Platform**: Cross-platform mobile app (iOS, Android, Web)
- **Framework**: Expo (Managed Workflow) + React Native
- **Core Features**: Timeline View, Ghost Tasks, Backlog Management, Group Collaboration

---

## 🛠️ Build, Lint, and Test Commands

### **Development**
```bash
# Start development server
npm start                          # Expo dev server (QR code)
npm run web                        # Web browser
npm run ios                        # iOS simulator
npm run android                    # Android emulator

# Device development
npm run ios:device                 # iOS physical device (with Metro)
npm run android:device             # Android physical device (with Metro)
npm run start:devices              # Start Metro bundler only
npm run ios:device:no-bundler      # iOS without Metro
npm run android:device:no-bundler  # Android without Metro
```

### **Linting and Type Checking**
```bash
# Lint
npm run lint                       # Run ESLint
npx eslint <file-path>             # Lint specific file

# Type check (no tests configured yet)
npx tsc --noEmit                   # TypeScript type check
```

### **Production Build**
```bash
npm run build                      # Web production build
npm run android:apk                # Android APK (release variant)

# EAS Build (for App Store / Play Store)
eas build --platform ios           # iOS build
eas build --platform android       # Android build
```

### **Running a Single Test**
⚠️ **No test framework configured yet.** Add Jest or React Native Testing Library if needed.

---

## 📐 Code Style Guidelines

### **1. Language and Type System**

#### **TypeScript**
- **Mode**: TypeScript (Strict mode is **OFF** in tsconfig.json)
- **Target**: ESNext
- **Module Resolution**: `bundler`

#### **Type Handling**
- ✅ **DO**: Use proper types from `lib/types.ts` (Task, TaskStatus, CreateTaskInput, etc.)
- ⚠️ **AVOID**: `any` type (ESLint warns on `@typescript-eslint/no-explicit-any`)
- ❌ **NEVER**: Suppress type errors with `@ts-ignore`, `@ts-expect-error`, or `as any`

```typescript
// ✅ Good
const task: Task = { ... }

// ⚠️ Warn (but allowed)
const data: any = response.data

// ❌ Never
// @ts-ignore
const x = unsafeOperation()
```

---

### **2. Styling**

#### **NativeWind (Tailwind CSS for React Native)**
- ✅ **ALWAYS** use `className` prop for styling
- ❌ **NEVER** use `StyleSheet.create({...})` (React Native default)

```tsx
// ✅ Good (NativeWind)
<View className="px-4 py-2 bg-primary rounded-md">
  <Text className="text-white font-semibold">Hello</Text>
</View>

// ❌ Bad (StyleSheet)
<View style={styles.container}>
  <Text style={styles.text}>Hello</Text>
</View>
```

#### **Tailwind Custom Colors** (from `tailwind.config.js`)
- `primary` → `#2563eb` (Blue-600)
- `background` → `#F8FAFC` (Slate-50)
- `text-main` → `#1e293b`
- `text-sub` → `#64748b`
- `error` → `#dc2626`
- `success` → `#16a34a`

#### **Border Radius**
- `rounded-sm` → 8px
- `rounded-md` → 12px
- `rounded-lg` → 16px
- `rounded-xl` → 20px

---

### **3. Component Structure**

#### **Functional Components**
- ✅ **ALWAYS** use functional components with Hooks
- ❌ **NEVER** use class components

```tsx
// ✅ Good
export function MyComponent({ title }: { title: string }) {
  const [count, setCount] = useState(0)
  return <Text>{title}: {count}</Text>
}

// ❌ Bad
class MyComponent extends React.Component { ... }
```

#### **Component Organization**
1. **Imports** (grouped by type)
   - React/React Native imports first
   - Third-party libraries (Expo, date-fns, lucide-react-native)
   - Local imports (`@/components`, `@/lib`, `@/constants`)

2. **Type Definitions** (interfaces, types)

3. **Component Function**
   - Props destructuring
   - Hooks (useState, useEffect, custom hooks)
   - Event handlers
   - Render logic

```tsx
// ✅ Example structure
import { View, Text, Pressable } from 'react-native'
import { format } from 'date-fns'
import { Calendar } from 'lucide-react-native'

import { useAuth } from '@/lib/hooks/use-auth'
import { colors } from '@/constants/colors'

interface MyComponentProps {
  title: string
  onPress: () => void
}

export function MyComponent({ title, onPress }: MyComponentProps) {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  const handlePress = () => {
    setIsLoading(true)
    onPress()
  }

  return (
    <View className="p-4">
      <Text className="text-lg font-semibold">{title}</Text>
      <Pressable onPress={handlePress} className="mt-2 bg-primary p-3 rounded-md">
        <Text className="text-white">Press me</Text>
      </Pressable>
    </View>
  )
}
```

---

### **4. Import Conventions**

#### **Path Aliases** (from `tsconfig.json`)
- `@/*` → Root directory
- `@/components/*` → `./components/*`
- `@/lib/*` → `./lib/*`
- `@/constants/*` → `./constants/*`
- `@/hooks/*` → `./hooks/*`

```typescript
// ✅ Good (use path aliases)
import { AddTaskModal } from '@/components/AddTaskModal'
import { useAuth } from '@/lib/hooks/use-auth'
import { colors } from '@/constants/colors'

// ❌ Bad (relative imports from nested files)
import { AddTaskModal } from '../../../components/AddTaskModal'
```

#### **Import Order**
1. React / React Native
2. Third-party libraries (alphabetical)
3. Local modules (alphabetical)

```typescript
// ✅ Good
import { useState, useEffect } from 'react'
import { View, Text } from 'react-native'
import { format } from 'date-fns'
import { Calendar } from 'lucide-react-native'
import { useAuth } from '@/lib/hooks/use-auth'
import { colors } from '@/constants/colors'
```

---

### **5. State Management**

#### **Server State** → React Query (TanStack Query)
- Use for data fetching, caching, and server synchronization
- Query keys format: `['resource', 'action', ...params]`

```typescript
// ✅ Good
const { data: tasks, isLoading } = useQuery({
  queryKey: ['tasks', 'timeline', selectedDate],
  queryFn: () => getActiveTasksAndTimeline()
})
```

#### **Local State** → Zustand Stores
- Use for UI state and cross-component state
- Stores: `useCalendarStore`, `useGroupStore`, `useTaskStore`

```typescript
// ✅ Good
const { selectedDate, setSelectedDate } = useCalendarStore()
```

#### **Component State** → useState
- Use for local, isolated component state

```typescript
// ✅ Good
const [isModalVisible, setIsModalVisible] = useState(false)
```

---

### **6. Naming Conventions**

#### **Files**
- **Components**: PascalCase (`AddTaskModal.tsx`, `AppHeader.tsx`)
- **Hooks**: kebab-case with `use-` prefix (`use-auth.ts`, `use-timeline-tasks.ts`)
- **Utilities**: kebab-case (`task-filtering.ts`, `task-notifications.ts`)
- **Constants**: kebab-case (`colors.ts`, `calendar.ts`)

#### **Variables and Functions**
- **camelCase** for variables and functions
- **PascalCase** for components and types
- **UPPER_SNAKE_CASE** for constants

```typescript
// ✅ Good
const taskTitle = 'My Task'
const MAX_RETRY_COUNT = 3
function handleSubmit() { ... }
interface TaskWithRollover { ... }
```

#### **Boolean Variables**
- Prefix with `is`, `has`, `should`

```typescript
// ✅ Good
const isLoading = false
const hasError = true
const shouldRetry = false
```

---

### **7. API and Data Fetching**

#### **API Functions** (`lib/api/`)
- Use Supabase client (`lib/supabase.ts`)
- Always return `{ data, error }` structure
- Handle `deleted_at IS NULL` for soft deletes

```typescript
// ✅ Good (from lib/api/tasks.ts)
export async function getTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .is('deleted_at', null)  // ✅ Soft delete filter
    .order('due_date', { ascending: true })

  if (error) {
    console.error('Error fetching tasks:', error)
    return { data: null, error }
  }

  return { data: data as Task[], error: null }
}
```

#### **Date Handling**
- ✅ **ALWAYS** use `date-fns` for date manipulation
- ✅ Store dates as `yyyy-MM-dd` strings in database
- ✅ Use `format()`, `parse()`, `parseISO()` for conversions

```typescript
// ✅ Good
import { format, parseISO, addDays } from 'date-fns'

const today = format(new Date(), 'yyyy-MM-dd')
const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
const dueDate = parseISO(task.due_date)
```

---

### **8. Error Handling**

#### **API Errors**
- Always check `error` field from Supabase responses
- Log errors with context
- Return error to caller (don't throw)

```typescript
// ✅ Good
const { data, error } = await supabase.from('tasks').select('*')
if (error) {
  console.error('Error fetching tasks:', error)
  return { data: null, error }
}
```

#### **UI Error Handling**
- Show toast notifications for user-facing errors
- Use `showToast()` from `@/utils/toast`

```typescript
// ✅ Good
import { showToast } from '@/utils/toast'

const handleDelete = async () => {
  const { error } = await deleteTask(taskId)
  if (error) {
    showToast('error', 'Failed to delete task')
    return
  }
  showToast('success', 'Task deleted')
}
```

#### **Empty Catch Blocks**
- ❌ **NEVER** use empty catch blocks

```typescript
// ❌ Bad
try {
  await riskyOperation()
} catch (e) {}

// ✅ Good
try {
  await riskyOperation()
} catch (e) {
  console.error('Operation failed:', e)
  showToast('error', 'Operation failed')
}
```

---

### **9. Supabase and Database**

#### **Row Level Security (RLS)**
- **Personal tasks**: Filter by `creator_id = auth.uid()`
- **Group tasks**: Filter by `group_id IN (user's groups)`
- **Soft delete**: Always filter `deleted_at IS NULL`

#### **Task Types**
- **Personal task**: `group_id = NULL`
- **Group task**: `group_id = <uuid>`
- **Backlog**: `due_date = NULL`
- **Scheduled**: `due_date != NULL`

#### **Task Assignees**
- Use `task_assignees` table for 1:N assignments
- Join with `tasks` table: `select('*, task_assignees(...)')`
- Enrich with profiles: Use `enrichTasksWithProfiles()` helper

```typescript
// ✅ Good (from lib/api/tasks.ts)
const { data, error } = await supabase
  .from('tasks')
  .select(`
    *,
    task_assignees (
      user_id,
      is_completed,
      completed_at
    )
  `)
  .eq('id', taskId)
  .is('deleted_at', null)
  .single()

// Enrich with profiles
const enrichedTasks = await enrichTasksWithProfiles([data])
```

---

### **10. React Query Patterns**

#### **Query Keys**
```typescript
// Tasks
['tasks', 'timeline']              // Timeline tasks
['tasks', 'backlog']               // Backlog tasks
['tasks', 'week', weekStartStr]    // Week tasks

// Groups
['groups', 'my']                   // User's groups
['groups', groupId]                // Specific group

// Notifications
['notifications', 'unread']        // Unread count
['notifications', 'list']          // Notification list
```

#### **Mutation Pattern**
```typescript
// ✅ Good
const mutation = useMutation({
  mutationFn: createTask,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    showToast('success', 'Task created')
  },
  onError: (error) => {
    console.error('Failed to create task:', error)
    showToast('error', 'Failed to create task')
  }
})
```

---

### **11. UX Patterns**

#### **Haptic Feedback**
- ✅ Use `expo-haptics` for tactile feedback
- **Light**: Short taps, status toggles
- **Heavy**: Long press, important actions

```typescript
import * as Haptics from 'expo-haptics'

// Light feedback
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

// Heavy feedback
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
```

#### **Toast Notifications**
- Use `showToast()` from `@/utils/toast` (burnt library)
- Types: `'success'`, `'error'`, `'info'`

```typescript
import { showToast } from '@/utils/toast'

showToast('success', 'Task completed!')
showToast('error', 'Failed to save task')
```

#### **Modal Patterns**
- Use `visible` prop for show/hide
- Include `ModalCloseButton` component
- Use `KeyboardAvoidingView` for forms

---

### **12. Performance Best Practices**

#### **Memoization**
- Use `useMemo` for expensive calculations
- Use `useCallback` for stable function references

```typescript
// ✅ Good
const groupedTasks = useMemo(() => 
  groupTasksByDate(tasks), 
  [tasks]
)

const handlePress = useCallback(() => {
  // handler logic
}, [dependencies])
```

#### **Data Fetching Optimization**
- Use `getAllTasksInRange()` for single API call (not multiple status queries)
- Enable background prefetching for smooth pagination
- Limit range: ±6 months max

---

### **13. Git and Version Control**

#### **Commit Messages** (if writing commits)
- Format: `type: description`
- Types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`

```bash
# ✅ Good
feat: add ghost task rendering for overdue items
fix: resolve timezone issue in date grouping
refactor: optimize task fetching with single API call
docs: update AGENTS.md with code style guidelines
```

---

### **14. Known Issues and Warnings**

#### **Type System**
- TypeScript strict mode is **OFF** (`tsconfig.json`)
- Some files have missing type definitions (accept warnings)
- Focus on correctness over perfect types

#### **ESLint Warnings**
- `@typescript-eslint/no-explicit-any` → Warn (not error)
- `@typescript-eslint/no-unused-vars` → Warn (not error)
- Clean up warnings when possible, but don't block development

---

### **15. Cursor/Copilot Rules** (from `.cursorrules`)

**Core Philosophy**: "Simple like a To-do list, managed like pro"

**Tech Stack**:
- Expo (Managed Workflow), Expo Router (File-based routing)
- TypeScript (Strict mode OFF)
- NativeWind (Tailwind CSS for React Native) - **DO NOT use StyleSheet.create**
- Supabase (PostgreSQL, Auth, RLS)
- React Query for server state, Zustand for local state
- Icons: lucide-react-native

**Key Features & Logic (MVP)**:
1. **Backlog & Today Logic**:
   - `due_date = NULL` → Backlog
   - `due_date = TODAY` → Today
   - **Rollover Logic**: `status = 'TODO'` AND `due_date < TODAY` → Display at top of Today's list with `+Nd` badge

2. **Database Schema (Tasks Table)**:
   - `id`, `title`, `status` (TODO, DONE, CANCEL), `due_date`, `due_time`, `created_at`

3. **UI/UX Pattern**:
   - Single Unified Timeline: [Rollover Items] → [Today's Items] → [Completed Items]
   - Backlog Drawer: Bottom sheet accessible from Home Screen
   - Swipe actions: Right to Done (Strikethrough), Left to Delete

**Coding Rules**:
- Use functional components and Hooks
- Always use `className` prop for styling (NativeWind)
- Prefer small, isolated components
- Handle loading and error states explicitly
- When creating Supabase queries, ensure they align with logical requirements (e.g., filtering for Rollover)

---

### **16. File Structure Reference**

```
lib/
├── api/                 # Supabase API functions
│   ├── tasks.ts         # Task CRUD (1496 lines - most complex)
│   ├── groups.ts        # Group management
│   ├── profiles.ts      # Profile management
│   └── notifications.ts # Notification management
├── hooks/               # Custom React hooks
│   ├── use-auth.ts
│   ├── use-timeline-tasks.ts
│   └── use-backlog-tasks.ts
├── stores/              # Zustand stores
│   ├── useCalendarStore.ts
│   ├── useGroupStore.ts
│   └── useTaskStore.ts
├── utils/               # Utility functions
│   ├── task-filtering.ts
│   └── task-notifications.ts
├── types.ts             # TypeScript type definitions
└── supabase.ts          # Supabase client setup
```

---

### **17. Quick Reference: Common Tasks**

#### **Add a new task**
1. Create form with `AddTaskModal` component
2. Call `createTask()` or `createTaskWithAssignees()` from `lib/api/tasks.ts`
3. Invalidate React Query cache: `queryClient.invalidateQueries(['tasks'])`

#### **Update a task**
1. Call `updateTask({ id, ...updates })` from `lib/api/tasks.ts`
2. Invalidate cache

#### **Toggle task completion**
- **Personal task**: `toggleTaskStatus(taskId, currentStatus)`
- **Group task**: `toggleAssigneeCompletion(taskId, userId, currentStatus)`

#### **Filter tasks**
- Use `groupTasksByDate()` from `lib/utils/task-filtering.ts`
- Returns `{ date: string, tasks: Task[] }[]`

---

## 📚 Additional Documentation

- `README.md` - Project overview and setup instructions
- `PROJECT_SUMMARY.md` - Comprehensive project summary (Korean)
- `NAVIGATION_GUIDE.md` - Navigation structure
- `HORIZONTAL_PAGING_GUIDE.md` - Swipe navigation implementation
- `TIMELINE_VIEW_GUIDE.md` - Timeline View and Ghost Tasks
- `PAGINATION_GUIDE.md` - Window-based pagination
- `TAP_LONGPRESS_UX_GUIDE.md` - Touch interaction patterns
- `STATE_MACHINE_GUIDE.md` - Task status transition rules

---

**Last Updated**: 2026-02-12
**Maintained by**: AI Agents working on TodayCheck
