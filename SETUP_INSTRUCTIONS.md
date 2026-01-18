# Setup Instructions for Today-Check

## 1. Install Required Packages

```bash
npm install @tanstack/react-query @react-native-async-storage/async-storage
```

## 2. Configure Supabase

### Create .env.local file
```bash
cp env.example .env.local
```

### Fill in your Supabase credentials
Get these from your Supabase project dashboard:
- Project URL: Settings → API → Project URL
- Anon Key: Settings → API → Project API keys → anon/public

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## 3. Run Database Migration

Go to your Supabase project:
1. Navigate to SQL Editor
2. Copy and paste the contents from `supabase/migrations/20260118000000_create_tasks_table.sql`
3. Click "Run" to execute the migration

## 4. Start the Development Server

```bash
npx expo start --clear
```

## 5. Test the App

For now, the app will work without authentication (we'll add auth later).
You can test with:
- Creating tasks
- Toggling task status
- Viewing rollover items

Note: Without auth, you'll need to temporarily modify RLS policies or create a test user.
