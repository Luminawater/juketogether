# Supabase Integration Setup

This app now uses Supabase for persistent room state storage. Rooms, queues, and user preferences are saved to Supabase and persist across server restarts.

## Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Supabase database:**
   - Go to your Supabase project: https://supabase.com/dashboard
   - Open the SQL Editor
   - Run the SQL from `supabase-setup.sql` to create the tables

3. **Configure environment variables:**
   - Copy `.env.example` to `.env`
   - The `.env` file should contain:
     ```
     SUPABASE_URL=https://smryjxchwbfpjvpecffg.supabase.co
     SUPABASE_ANON_KEY=your_anon_key_here
     ```
   - Or the keys are already hardcoded in `supabase.js` as fallback

4. **Start the server:**
   ```bash
   npm start
   # or
   npm run dev
   ```

## How It Works

- **Room State**: Automatically saved to Supabase whenever:
  - Tracks are added/removed
  - Playback state changes (play/pause)
  - Position changes
  - Current track changes

- **User Volumes**: Saved per user per room

- **Persistence**: All room data survives server restarts

- **Real-time**: Still uses Socket.io for real-time updates, Supabase is just for persistence

## Database Schema

- `rooms` table: Stores room state (queue, current track, position, etc.)
- `user_volumes` table: Stores user volume preferences per room

See `supabase-setup.sql` for the full schema.

