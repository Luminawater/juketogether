# Authentication & Room Management Setup

This guide explains how to set up and use the authentication and room management system for the SoundCloud & Spotify Jukebox.

## Overview

The application now requires user authentication to create and join music rooms. Here's how the flow works:

1. **Unauthenticated users** → Redirected to `/auth` (login/signup)
2. **Authenticated users** → Can access `/dashboard` (create/join rooms)
3. **Room access** → Users can join rooms via unique URLs like `/room/abc123`

## Database Setup

### Required Supabase Tables

Create these tables in your Supabase SQL editor:

```sql
-- User profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rooms table
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN ('public', 'private')) DEFAULT 'public',
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Room members table (for private rooms)
CREATE TABLE room_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for rooms
CREATE POLICY "Anyone can view public rooms" ON rooms
  FOR SELECT USING (type = 'public');

CREATE POLICY "Users can view rooms they created" ON rooms
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Authenticated users can create rooms" ON rooms
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Room creators can update their rooms" ON rooms
  FOR UPDATE USING (auth.uid() = created_by);

-- RLS Policies for room members
CREATE POLICY "Users can view room memberships" ON room_members
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can join rooms" ON room_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

## Server Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Spotify Configuration (optional)
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
SPOTIFY_REDIRECT_URI=https://your-domain.com/spotify/callback

# Server Configuration
PORT=8080
```

### Supabase Configuration

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Copy your project URL and anon key
3. Enable email authentication in Authentication > Providers
4. Run the SQL scripts above in the SQL Editor

## Application Flow

### 1. Landing Page (`/`)

- Automatically redirects based on authentication status
- Authenticated users → `/dashboard`
- Unauthenticated users → `/auth`

### 2. Authentication (`/auth`)

**Features:**
- Sign up with email/password
- Sign in with existing account
- Form validation
- Error handling

**API Endpoints:**
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/signin` - Sign in to existing account
- `GET /api/auth/session` - Get current session

### 3. Dashboard (`/dashboard`)

**Features:**
- View user's created rooms
- Create new public/private rooms
- Join existing rooms by URL/ID
- Room sharing links

**API Endpoints:**
- `GET /api/rooms` - Get user's rooms
- `POST /api/rooms` - Create new room
- `GET /api/profile` - Get user profile
- `PUT /api/profile` - Update user profile

### 4. Room Page (`/room/:id`)

**Features:**
- Real-time music synchronization
- Queue management
- Playback controls
- User presence
- Cross-platform support (SoundCloud + Spotify)

**Access Control:**
- Public rooms: Anyone with the link can join
- Private rooms: Only invited members can join

## API Reference

### Authentication Endpoints

#### `POST /api/auth/signup`
Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": { "id": "uuid", "email": "user@example.com" },
  "session": { "access_token": "jwt-token", "refresh_token": "refresh-token" }
}
```

#### `POST /api/auth/signin`
Sign in to an existing account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": { "id": "uuid", "email": "user@example.com" },
  "session": { "access_token": "jwt-token", "refresh_token": "refresh-token" }
}
```

#### `POST /api/auth/signout`
Sign out the current user.

**Headers:**
```
Authorization: Bearer <access-token>
```

### Room Management Endpoints

#### `POST /api/rooms`
Create a new music room.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Request:**
```json
{
  "name": "Friday Night Vibes",
  "description": "Chill beats for the weekend",
  "type": "public"
}
```

**Response:**
```json
{
  "id": "abc123def456",
  "name": "Friday Night Vibes",
  "description": "Chill beats for the weekend",
  "type": "public",
  "created_by": "user-uuid",
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### `GET /api/rooms`
Get all rooms created by the authenticated user.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
[
  {
    "id": "abc123def456",
    "name": "Friday Night Vibes",
    "description": "Chill beats for the weekend",
    "type": "public",
    "created_by": "user-uuid",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

#### `GET /api/rooms/:id`
Get details of a specific room.

**Headers:**
```
Authorization: Bearer <access-token> (optional for public rooms)
```

**Response:**
```json
{
  "id": "abc123def456",
  "name": "Friday Night Vibes",
  "description": "Chill beats for the weekend",
  "type": "public",
  "created_by": "user-uuid",
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### `POST /api/rooms/:id/join`
Join a room (for access control).

**Headers:**
```
Authorization: Bearer <access-token>
```

### Profile Endpoints

#### `GET /api/profile`
Get the authenticated user's profile.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "display_name": "John Doe",
  "avatar_url": "https://example.com/avatar.jpg"
}
```

#### `PUT /api/profile`
Update the authenticated user's profile.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Request:**
```json
{
  "display_name": "John Doe",
  "avatar_url": "https://example.com/avatar.jpg"
}
```

## Client-Side Authentication

### Token Management

The client stores authentication data in localStorage:

```javascript
// After successful login/signup
localStorage.setItem('auth_token', session.access_token);
localStorage.setItem('user', JSON.stringify(user));

// Check authentication
const token = localStorage.getItem('auth_token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

// API calls include authorization header
fetch('/api/rooms', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### Route Protection

All authenticated routes check for valid tokens:

```javascript
window.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('auth_token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (!token || !user) {
    window.location.href = '/auth.html';
    return;
  }

  // Load authenticated content
  loadDashboard();
});
```

## Room URL Structure

Rooms are accessed via unique URLs:

- **Room URL**: `https://yourapp.com/room/abc123def456`
- **Dashboard**: `https://yourapp.com/dashboard`
- **Authentication**: `https://yourapp.com/auth`

## Security Considerations

### Row Level Security (RLS)

All database tables use RLS policies to ensure:
- Users can only access their own data
- Public rooms are visible to everyone
- Private rooms require membership

### Authentication Tokens

- JWT tokens are validated on each API request
- Tokens expire and need refresh (handled by Supabase client)
- Invalid tokens result in 401 responses

### Private Room Access

Private rooms implement additional access control:
- Only invited members can join
- Room membership is tracked in `room_members` table
- Access denied for unauthorized users

## Troubleshooting

### Common Issues

**"Authentication required" error:**
- Check that Authorization header is included
- Verify token hasn't expired
- Ensure user is signed in

**"Room not found" error:**
- Verify room ID is correct
- Check if room exists in database
- Ensure proper permissions for private rooms

**"Invalid authentication token" error:**
- Try signing out and signing back in
- Check Supabase project configuration
- Verify RLS policies are correct

### Debug Steps

1. **Check browser console** for JavaScript errors
2. **Verify API endpoints** are responding correctly
3. **Check Supabase dashboard** for authentication events
4. **Review RLS policies** for data access issues
5. **Test with different browsers** to rule out caching issues

## Deployment

### Environment Setup

For production deployment:

1. Set environment variables on your hosting platform
2. Configure Supabase project for production
3. Set up proper CORS policies
4. Enable HTTPS for security

### Scaling Considerations

- **Database**: Supabase handles scaling automatically
- **Real-time**: Socket.io can be scaled with Redis adapter
- **File Storage**: Use Supabase Storage for user avatars
- **CDN**: Serve static assets via CDN for better performance

## Next Steps

After authentication is working:

1. **Test room creation** and sharing
2. **Implement real-time features** in rooms
3. **Add user profiles** and avatars
4. **Create admin panel** for room management
5. **Add social features** like friend requests

This authentication system provides a solid foundation for a social music application with proper access control and user management.



