# Cloudflare Pages + Supabase Realtime Setup

Since you're using **only Cloudflare Pages** (static hosting), you cannot run a WebSocket server directly. However, you can use **Supabase Realtime** for all real-time features instead of Socket.io.

## Current Situation

- ✅ **Chat**: Already using Supabase Realtime (working)
- ❌ **Room State**: Currently using Socket.io (needs separate server)
- ❌ **Playback Sync**: Currently using Socket.io (needs separate server)

## Solution: Migrate to Supabase Realtime

### Why Supabase Realtime?

1. **No separate server needed** - Supabase handles WebSockets
2. **Already set up** - You're using it for chat
3. **Works with Cloudflare Pages** - No backend required
4. **Free tier available** - Supabase includes Realtime

### What Needs to Change

1. **Room State Management**: Store room state in Supabase `rooms` table
2. **Realtime Subscriptions**: Subscribe to room state changes
3. **Remove Socket.io**: Replace all Socket.io calls with Supabase Realtime

### Implementation Steps

#### 1. Update Room State in Supabase

Instead of Socket.io events, update the `rooms` table:

```typescript
// Instead of: socket.emit('play', { position })
await supabase
  .from('rooms')
  .update({ 
    is_playing: true, 
    position: position,
    updated_at: new Date().toISOString()
  })
  .eq('id', roomId);
```

#### 2. Subscribe to Room State Changes

```typescript
const channel = supabase
  .channel(`room:${roomId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'rooms',
    filter: `id=eq.${roomId}`,
  }, (payload) => {
    // Handle state change
    const newState = payload.new;
    if (newState.is_playing) {
      // Play track
    } else {
      // Pause track
    }
  })
  .subscribe();
```

#### 3. Queue Management

Store queue in `rooms.queue` JSONB column and subscribe to changes:

```typescript
// Add track to queue
await supabase
  .from('rooms')
  .update({ 
    queue: [...currentQueue, newTrack],
    updated_at: new Date().toISOString()
  })
  .eq('id', roomId);
```

### Benefits

- ✅ No separate WebSocket server needed
- ✅ Works with Cloudflare Pages (static hosting)
- ✅ Already have Supabase set up
- ✅ Consistent with your chat implementation
- ✅ Free tier available

### Migration Path

1. **Phase 1**: Keep Socket.io as fallback, add Supabase Realtime alongside
2. **Phase 2**: Migrate room state to Supabase
3. **Phase 3**: Remove Socket.io dependency

### Alternative: Cloudflare Workers

If you need Socket.io specifically, you would need to:
1. Deploy a Cloudflare Worker with Durable Objects
2. Handle WebSocket connections in the Worker
3. This requires a Workers subscription (paid)

**Recommendation**: Use Supabase Realtime since you already have it set up and it works with your Cloudflare Pages deployment.

## Next Steps

1. Update `socketService.ts` to use Supabase Realtime instead of Socket.io
2. Create Supabase database triggers for room state changes
3. Test real-time synchronization
4. Remove Socket.io dependency

Would you like me to help implement the Supabase Realtime migration?

