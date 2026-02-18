# TodayCheck 📅

> **Simple like a To-do list, managed like pro**

A personal task management app with **Timeline View** and **Ghost Task** retrospective capabilities. Built with Expo, React Native, and Supabase.

---

## ✨ Key Features

### 🌊 **Horizontal Day Paging View**
- **Swipe Navigation**: Intuitive left/right swipe to move between days
- **Focused View**: One day per screen for distraction-free task management
- **Platform-Optimized**: Touch gestures on mobile, buttons + keyboard on web
- **Retrospective Capability**: See what was planned vs. accomplished

### 📦 **Backlog Management**
- **Inbox Zero Approach**: Collect tasks without dates, schedule them later
- **Quick Scheduling**: Swipe to schedule, long-press for quick actions
- **Flexible Planning**: Do Today, Do Tomorrow, or Pick Date options

### 👻 **Ghost Tasks**
- **Visual Accountability**: Past incomplete tasks appear as "ghosts" in their original date sections
- **Dual Display**: Ghost in past section + Real overdue item in TODAY section
- **Historical Context**: Maintain timeline integrity while showing current actionable items

### ⚡ **Smart Task Management**
- **Tap & Long Press**: Intuitive interactions without gesture conflicts
- **Postpone to Tomorrow**: Easily reschedule tasks while preserving original due dates
- **Rollover Tracking**: See exactly how many days a task has been delayed (+Nd badges)

### 🔒 **Future Tasks (Read-Only)**
- **Preview Mode**: View upcoming tasks without accidental edits
- **Lock Icon**: Clear visual indication of read-only status

---

## 🏗️ Tech Stack

### **Frontend**
- **Framework**: Expo (Managed Workflow) + Expo Router (File-based routing)
- **Language**: TypeScript (Strict mode)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **State Management**: 
  - React Query (TanStack Query) for server state
  - Zustand for local state
- **Icons**: lucide-react-native
- **Date Handling**: date-fns

### **Backend**
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Features**: 
  - Row Level Security (RLS)
  - Soft Delete pattern
  - Real-time capabilities

---

## 📐 Architecture

### **Core Philosophy**
```
Timeline = Past Context + Today's Focus + Future Preview
```

### **Data Flow**
```
Supabase DB
    ↓
getTodayTasks() (due_date <= today, deleted_at IS NULL)
    ↓
groupTasksByDate() (Transform into sections)
    ↓
SectionList UI (Render with auto-scroll)
```

### **Ghost Task Logic**
```typescript
if (due_date < today && status === 'TODO') {
  // Create Ghost in past section
  pastSection.push({ ...task, isGhost: true });
  
  // Create Real item in Today section
  todaySection.push({ ...task, isGhost: false });
}
```

---

## 🚀 Getting Started

### **Prerequisites**
- Node.js 18+
- npm or yarn
- Expo CLI
- Supabase account

### **Installation**

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/TodayCheck.git
   cd TodayCheck
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env.local
   ```
   
   Fill in your Supabase credentials:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up Supabase**
   - Run migrations in `supabase/migrations/` directory
   - Enable Row Level Security (RLS)
   - See `SUPABASE_AUTH_SETUP.md` for detailed instructions

5. **Start the development server**
   ```bash
   npx expo start
   ```

6. **Run on your device**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app

---

## 📚 Documentation

- **[Setup Instructions](SETUP_INSTRUCTIONS.md)**: Initial setup guide
- **[Supabase Auth Setup](SUPABASE_AUTH_SETUP.md)**: Authentication configuration
- **[Navigation Guide](NAVIGATION_GUIDE.md)**: ⭐ Bottom tab navigation and Week view
- **[Horizontal Paging Guide](HORIZONTAL_PAGING_GUIDE.md)**: ⭐ Day-by-day swipe navigation with platform-optimized controls
- **[Completed At Guide](COMPLETED_AT_GUIDE.md)**: ⭐ Completion date grouping and late completion tracking
- **[Timezone Guide](TIMEZONE_GUIDE.md)**: ⭐ Timezone-safe date handling and grouping logic
- **[Timeline View Guide](TIMELINE_VIEW_GUIDE.md)**: Comprehensive guide to Timeline View and Ghost Tasks
- **[Pagination Guide](PAGINATION_GUIDE.md)**: Window-based pagination for efficient data loading
- **[Tap & Long Press UX](TAP_LONGPRESS_UX_GUIDE.md)**: Interaction patterns and haptic feedback
- **[State Machine Guide](STATE_MACHINE_GUIDE.md)**: Task status transition rules

---

## 🎨 UI/UX Patterns

### **Minimalist Design**
- No helper text or hints
- Clean, spacious layout
- Intuitive interactions without explicit instructions

### **Interaction Patterns**
- **Short Tap**: Toggle task status (TODO ↔ DONE)
- **Long Press**: Open action sheet (Complete/Postpone/Cancel/Delete)
- **Haptic Feedback**: Light for taps, Heavy for long press

### **Visual Hierarchy**
```
🔥 TODAY (Blue, Large, Bold)
   ↑ Focus area
   
Jan 18, Sun (Gray, Small)
   ↑ Past context
   
Jan 20, Tue (Light Gray, Small)
   ↑ Future preview
```

---

## 🗂️ Project Structure

```
TodayCheck/
├── app/                          # Expo Router pages
│   ├── (tabs)/                   # Tab navigation
│   │   ├── index.tsx             # Timeline View (Home)
│   │   └── explore.tsx           # Explore screen
│   ├── auth.tsx                  # Authentication screen
│   └── _layout.tsx               # Root layout
├── components/                   # React components
│   ├── AddTaskModal.tsx          # Task creation modal
│   └── ui/                       # UI components
├── lib/                          # Core logic
│   ├── api/                      # API functions
│   │   ├── tasks.ts              # CRUD operations
│   │   └── task-state-machine.ts # Status transition logic
│   ├── hooks/                    # Custom hooks
│   │   ├── use-auth.ts           # Authentication hook
│   │   ├── use-today-tasks.ts    # Task fetching hook
│   │   └── use-create-task.ts    # Task creation hook
│   ├── supabase.ts               # Supabase client
│   ├── types.ts                  # TypeScript types
│   └── query-client.tsx          # React Query setup
├── supabase/                     # Database
│   └── migrations/               # SQL migrations
│       ├── 20260118000000_create_tasks_table.sql
│       └── 20260119000000_add_soft_delete.sql
└── global.css                    # Tailwind directives
```

---

## 🛠️ Key Technologies

### **React Native / Expo**
- Cross-platform (iOS, Android, Web)
- Hot reload for fast development
- Native modules for haptics, alerts, etc.

### **NativeWind (Tailwind CSS)**
- Utility-first styling
- Consistent design system
- Dark mode support

### **Supabase**
- PostgreSQL database
- Row Level Security
- Real-time subscriptions (optional)
- Built-in authentication

### **React Query (TanStack Query)**
- Server state management
- Automatic caching
- Optimistic updates
- Query invalidation

### **date-fns**
- Lightweight date utilities
- Timezone-safe operations
- Intuitive API

---

## 🧪 Testing

```bash
# Run linter
npm run lint

# Type check
npx tsc --noEmit

# Build for production
npx expo build
```

---

## 🚢 Deployment

### **Web (Vercel)**
```bash
npx expo export:web
# Deploy to Vercel
```

### **iOS (TestFlight / App Store)**
```bash
eas build --platform ios
eas submit --platform ios
```

### **Android (Play Store)**
```bash
eas build --platform android
eas submit --platform android
```

---

## 📝 License

MIT License - See LICENSE file for details

---

## 🤝 Contributing

Contributions are welcome! Please read the contributing guidelines before submitting PRs.

---

## 📧 Contact

- **Author**: Your Name
- **Email**: your.email@example.com
- **GitHub**: [@yourusername](https://github.com/yourusername)

---

## 🙏 Acknowledgments

- Built with [Expo](https://expo.dev)
- Powered by [Supabase](https://supabase.com)
- Styled with [NativeWind](https://www.nativewind.dev)
- State managed by [TanStack Query](https://tanstack.com/query)

---

**Made with ❤️ for productive task management**
