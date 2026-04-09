# Supabase Setup Guide

This guide will help you set up Supabase to sync golf data across multiple devices.

## Step 1: Create a Supabase Project

1. Go to https://supabase.com
2. Sign up or log in
3. Click "New Project"
4. Fill in the project details:
   - Name: `Golf Score Tracker` (or any name you prefer)
   - Database Password: Create a strong password and save it
   - Region: Choose the closest region to you
5. Click "Create new project"
6. Wait for the project to be initialized (2-3 minutes)

## Step 2: Get Your API Keys

1. In your Supabase project, go to **Settings** → **API**
2. Copy these values:
   - `Project URL` - This goes in `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key under "Project API keys" - This goes in `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Step 3: Create Environment Variables

1. In your project root, create or edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=YOUR_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Replace the values with your actual keys from Step 2.

## Step 4: Create Database Tables

1. In Supabase, go to **SQL Editor**
2. Click "New query"
3. Copy and paste this SQL to create the `users` table:

```sql
-- Create users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create rounds table
CREATE TABLE rounds (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  course_id TEXT NOT NULL,
  course_name TEXT NOT NULL,
  date TEXT NOT NULL,
  scores INTEGER[] NOT NULL,
  total_score INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create index for faster queries
CREATE INDEX rounds_user_id_idx ON rounds(user_id);
```

4. Click "Run" to execute the query
5. You should see "Success" message

## Step 5: Update Your useAuth Hook

The app now uses a Supabase-compatible auth system. When you have Supabase set up with the environment variables, it will automatically sync data between devices.

If Supabase is not configured (missing environment variables), the app will fall back to localStorage (single device only).

## Step 6: Deploy to Vercel

When you push to GitHub:

1. Go to your Vercel project
2. Go to **Settings** → **Environment Variables**
3. Add both environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. Redeploy the project

## Testing

1. Create a user on your computer
2. Go to your phone and access the same Vercel URL
3. The user list should now show the user created on your computer!
4. Create a round on your computer
5. Go to your phone and see the round on their profile

## Troubleshooting

If you're not seeing synced data:

1. Check that `.env.local` has the correct Supabase URL and API key
2. Check the browser console for errors (F12 → Console tab)
3. Make sure the Supabase tables were created (go to Supabase SQL Editor and verify)
4. Try refreshing the page
5. Clear localStorage: Open DevTools (F12) → Application → Local Storage → Clear All

## Notes

- The app still uses localStorage as a cache for faster loading
- New users and rounds are synced to Supabase immediately
- Old data in localStorage will be migrated when you log in
- Your 4-digit passwords are stored in plain text in the database (not recommended for production - this is for demo purposes)
