# Supabase Database Setup

This directory contains database migrations for the Today-Check app.

## Setup Instructions

### 1. Create a Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and anon key

### 2. Run the Migration
You can run the migration in two ways:

#### Option A: Using Supabase Dashboard (Recommended for MVP)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `migrations/20260118000000_create_tasks_table.sql`
4. Paste and run the SQL

#### Option B: Using Supabase CLI
```bash
# Install Supabase CLI
npm install -g supabase

# Initialize Supabase in your project
supabase init

# Link to your remote project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### 3. Configure Environment Variables
1. Copy `.env.local.example` to `.env.local`
2. Fill in your Supabase credentials:
   - `EXPO_PUBLIC_SUPABASE_URL`: Your project URL
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your anon/public key

### 4. Install Supabase Client
```bash
npm install @supabase/supabase-js
```

## Database Schema

### `tasks` Table
Main table for storing all tasks (Today items and Backlog).

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | Foreign key to auth.users |
| `title` | text | Task title/description |
| `status` | text | TODO, DONE, or CANCEL |
| `due_date` | date | NULL = Backlog, NOT NULL = Today/Calendar |
| `due_time` | time | Optional time for the task |
| `original_due_date` | date | Original due date (for rollover calculation) |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last update timestamp (auto-updated) |

### Key Logic
- **Backlog items**: `due_date IS NULL`
- **Today's items**: `due_date = CURRENT_DATE`
- **Rollover items**: `status = 'TODO' AND due_date < CURRENT_DATE`
- **Days overdue**: `CURRENT_DATE - original_due_date`

### Security (RLS)
Row Level Security is enabled. Users can only access their own tasks (`user_id = auth.uid()`).

### Indexes
Optimized for common queries:
- `idx_tasks_user_id`: Fast lookup by user
- `idx_tasks_due_date`: Fast lookup by date
- `idx_tasks_user_due_date`: Combined index for user + date queries
- `idx_tasks_status`: Fast filtering by status
