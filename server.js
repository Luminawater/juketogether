const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

// Use node-fetch for older Node versions, or built-in fetch for Node 18+
let fetch;
try {
  // Try to use built-in fetch (Node 18+)
  if (typeof globalThis.fetch !== 'undefined') {
    fetch = globalThis.fetch;
  } else {
    // Fallback to node-fetch for older Node versions
    fetch = require('node-fetch');
  }
} catch (e) {
  // Fallback: install node-fetch if needed
  console.warn('Fetch not available. Install node-fetch: npm install node-fetch@2');
  console.warn('Error:', e.message);
  fetch = null;
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Import Supabase functions (with error handling)
let supabaseFunctions = null;
try {
  supabaseFunctions = require('./src/supabase');
} catch (error) {
  console.warn('Supabase not configured, using in-memory storage only:', error.message);
  // Create stub functions if Supabase fails to load
  supabaseFunctions = {
    loadRoomState: async () => null,
    saveRoomState: async () => true,
    loadUserVolumes: async () => new Map(),
    saveUserVolume: async () => true,
    deleteUserVolume: async () => true,
    testConnection: async () => ({ connected: false, error: 'Supabase not configured' })
  };
}

// Import authentication and chat modules
let authModule = null;
let chatModule = null;
try {
  authModule = require('./src/auth');
  chatModule = require('./src/chat');
} catch (error) {
  console.warn('Auth/Chat modules not available:', error.message);
}

// Use authentication middleware if available (after authModule is defined)
if (authModule) {
  io.use(authModule.authenticateSocket);
}

const {
  loadRoomState,
  saveRoomState,
  loadUserVolumes,
  saveUserVolume,
  deleteUserVolume,
  testConnection,
  loadRoomAdmins,
  addRoomAdmin,
  removeRoomAdmin,
  loadFriends,
  addFriendRequest,
  acceptFriendRequest,
  removeFriendRequest
} = supabaseFunctions;

// Test Supabase connection on startup
(async () => {
  if (testConnection) {
    const connectionTest = await testConnection();
    if (connectionTest.connected) {
      console.log('✅ Supabase connection verified:', connectionTest.message);
    } else {
      console.error('❌ Supabase connection failed:', connectionTest.error);
      console.warn('⚠️  Server will continue with in-memory storage only');
    }
  }
})();

// Store room state (in-memory cache, synced with Supabase)
const rooms = new Map();

// Initialize room if it doesn't exist (loads from Supabase if available)
async function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    // Try to load from Supabase first
    const savedState = await loadRoomState(roomId);
    const savedVolumes = await loadUserVolumes(roomId);
    
    rooms.set(roomId, {
      queue: savedState?.queue || [],
      history: savedState?.history || [],
      currentTrack: savedState?.currentTrack || null,
      isPlaying: savedState?.isPlaying || false,
      position: savedState?.position || 0,
      lastBroadcastPosition: savedState?.lastBroadcastPosition || 0,
      hostUserId: savedState?.hostUserId || null,
      users: new Set(),
      userVolumes: savedVolumes || new Map(), // Map of socket.id -> volume (0-100)
      needsSave: false, // Flag to track if room needs saving
      loadedFromSupabase: true // Track that this room was loaded from Supabase
    });
    
    const loadedRoom = rooms.get(roomId);
    console.log(`📥 Room "${roomId}" loaded from Supabase:`, {
      queueLength: loadedRoom.queue.length,
      historyLength: loadedRoom.history.length,
      hasCurrentTrack: !!loadedRoom.currentTrack,
      isPlaying: loadedRoom.isPlaying,
      position: loadedRoom.position
    });
  }
  return rooms.get(roomId);
}

// Save room state to Supabase (debounced)
const saveQueue = new Map();
function scheduleSave(roomId) {
  // Clear existing timeout
  if (saveQueue.has(roomId)) {
    clearTimeout(saveQueue.get(roomId));
  }
  
  // Schedule save after 1 second of inactivity
  const timeout = setTimeout(async () => {
    const room = rooms.get(roomId);
    if (room) {
      console.log(`💾 Saving room "${roomId}" to Supabase...`);
      const saved = await saveRoomState(roomId, {
        queue: room.queue,
        history: room.history,
        currentTrack: room.currentTrack,
        isPlaying: room.isPlaying,
        position: room.position,
        lastBroadcastPosition: room.lastBroadcastPosition,
        hostUserId: room.hostUserId
      });
      if (saved) {
        console.log(`✅ Room "${roomId}" synced to Supabase: ${room.queue.length} tracks in queue, ${room.history.length} in history`);
      } else {
        console.error(`❌ Room "${roomId}" failed to sync to Supabase!`);
      }
    }
    saveQueue.delete(roomId);
  }, 1000);
  
  saveQueue.set(roomId, timeout);
}

// Helper function to check if user can control playback
async function canUserControl(roomId, userId) {
  const room = await getRoom(roomId);
  const roomAdmins = await loadRoomAdmins(roomId);
  const isOwner = room.hostUserId === userId;
  const isAdmin = roomAdmins.includes(userId);

  if (isOwner || isAdmin) {
    return true;
  }

  // Check room settings
  let roomSettings = null;
  if (chatModule) {
    roomSettings = await chatModule.getRoomSettings(roomId);
  }

  return roomSettings?.allowControls !== false;
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id, socket.isAuthenticated ? '(authenticated)' : '(anonymous)');

  // Ensure user profile exists for authenticated users
  if (socket.isAuthenticated && authModule) {
    authModule.ensureUserProfile(socket.userId, socket.handshake.auth?.user?.user_metadata);
  }

  socket.on('join-room', async (roomId) => {
    socket.join(roomId);

    // Always load latest state from Supabase (source of truth)
    console.log(`🔄 Syncing room "${roomId}" from Supabase...`);
    const latestState = await loadRoomState(roomId);
    const savedVolumes = await loadUserVolumes(roomId);

    // Load chat messages and room settings if available
    let chatMessages = [];
    let roomSettings = null;
    if (chatModule) {
      chatMessages = await chatModule.loadChatMessages(roomId);
      roomSettings = await chatModule.getRoomSettings(roomId);
    }
    
    // Get or create room
    let room = rooms.get(roomId);
    if (!room) {
      // Create new room from Supabase data
      // If no host exists, first user becomes host
      const hostUserId = latestState?.hostUserId || (latestState ? null : socket.id);
      
      room = {
        queue: latestState?.queue || [],
        history: latestState?.history || [],
        currentTrack: latestState?.currentTrack || null,
        isPlaying: latestState?.isPlaying || false,
        position: latestState?.position || 0,
        lastBroadcastPosition: latestState?.lastBroadcastPosition || 0,
        hostUserId: hostUserId,
        users: new Set(),
        userVolumes: new Map(),
        needsSave: false,
        loadedFromSupabase: true
      };
      rooms.set(roomId, room);
      
      // If we set a new host, save it to Supabase
      if (!latestState?.hostUserId && hostUserId) {
        await saveRoomState(roomId, {
          queue: room.queue,
          history: room.history,
          currentTrack: room.currentTrack,
          isPlaying: room.isPlaying,
          position: room.position,
          lastBroadcastPosition: room.lastBroadcastPosition,
          hostUserId: hostUserId
        });
        console.log(`👑 User ${socket.id} set as host for room "${roomId}"`);
      }
    } else {
      // Update existing room with latest Supabase data (always sync from Supabase)
      if (latestState) {
        room.queue = latestState.queue || [];
        room.history = latestState.history || [];
        room.currentTrack = latestState.currentTrack || null;
        room.isPlaying = latestState.isPlaying || false;
        room.position = latestState.position || 0;
        room.lastBroadcastPosition = latestState.lastBroadcastPosition || 0;
        // Update host from Supabase (source of truth)
        if (latestState.hostUserId) {
          room.hostUserId = latestState.hostUserId;
        }
        console.log(`✅ Room "${roomId}" synced from Supabase: ${room.queue.length} tracks in queue, ${room.history.length} in history`);
      }
    }
    
    // Add user to room
    const userId = socket.isAuthenticated ? socket.userId : socket.id;
    room.users.add(userId);

    // Load user volume from Supabase or default to 50
    const savedVolume = savedVolumes.get(userId) || 50;
    room.userVolumes.set(userId, savedVolume);
    
    const authoritativePosition = room.position;
    const authoritativeIsPlaying = room.isPlaying;
    
    // Log room state for debugging
    console.log(`📊 Room "${roomId}" synced state:`, {
      queueLength: room.queue.length,
      historyLength: room.history.length,
      currentTrack: room.currentTrack ? room.currentTrack.url : 'null',
      isPlaying: authoritativeIsPlaying,
      position: authoritativePosition,
      users: room.users.size
    });
    
    // Load room admins from Supabase
    const roomAdmins = await loadRoomAdmins(roomId);

    // Check if user is owner or admin
    const isOwner = room.hostUserId === userId;
    const isAdmin = roomAdmins.includes(userId);

    // Load room settings with defaults
    const settings = roomSettings || {
      isPrivate: false,
      allowControls: true,
      admins: roomAdmins,
    };

    // Build users list with profiles
    const usersList = [];
    for (const roomUserId of room.users) {
      let userProfile = null;
      if (authModule) {
        userProfile = await authModule.getUserProfile(roomUserId);
      }
      usersList.push({
        userId: roomUserId,
        userProfile: userProfile || { username: 'Anonymous User' },
        isOwner: room.hostUserId === roomUserId,
        isAdmin: roomAdmins.includes(roomUserId),
        volume: room.userVolumes.get(roomUserId) || 50,
      });
    }

    socket.emit('room-state', {
      queue: room.queue,
      history: room.history,
      currentTrack: room.currentTrack,
      isPlaying: authoritativeIsPlaying,
      position: authoritativePosition,
      chatMessages,
      roomSettings: {
        ...settings,
        admins: roomAdmins,
      },
      users: usersList,
      isOwner,
      isAdmin,
    });

    console.log(`📤 Room "${roomId}" state sent to user (synced from Supabase)`);

    // Send current user volumes to the new user
    const userVolumes = Array.from(room.userVolumes.entries()).map(([userId, volume]) => ({
      userId,
      volume,
      isMe: userId === userId
    }));
    socket.emit('user-volumes', userVolumes);

    // Broadcast new user joined to others (only send to others, not the new joiner)
    socket.to(roomId).emit('user-joined', {
      userId,
      userProfile: socket.userProfile,
      volume: savedVolume
    });
    
    // Update user count for all users
    io.to(roomId).emit('user-count', room.users.size);
    
    // Send updated users list to all users in room
    io.to(roomId).emit('users-list-updated', usersList);
    
    console.log(`User ${userId} joined room ${roomId}`);
  });

  socket.on('add-track', async (data) => {
    const { roomId, trackUrl, trackInfo, platform } = data;
    const room = await getRoom(roomId);

    const userId = socket.isAuthenticated ? socket.userId : socket.id;
    const track = {
      id: Date.now().toString(),
      url: trackUrl,
      info: trackInfo,
      addedBy: userId,
      addedAt: Date.now()
    };
    
    room.queue.push(track);
    
    // Schedule save to Supabase
    scheduleSave(roomId);
    console.log(`📥 Track added to room "${roomId}" (queue now has ${room.queue.length} tracks, saving to Supabase in 1 second...)`);
    console.log(`   Track: ${trackInfo?.fullTitle || trackInfo?.title || trackUrl}`);

    // Include user profile in track data for display
    const trackWithUser = {
      ...track,
      userProfile: socket.userProfile
    };

    io.to(roomId).emit('track-added', trackWithUser);
    console.log(`✅ Track added to room "${roomId}":`, trackUrl);
    
    // Auto-play first track if no track is currently playing
    if (!room.currentTrack && room.queue.length > 0) {
      room.currentTrack = room.queue.shift();
      room.isPlaying = true;
      room.position = 0;
      scheduleSave(roomId);
      
      io.to(roomId).emit('track-changed', room.currentTrack);
      io.to(roomId).emit('play-track');
      console.log(`Auto-playing first track in room ${roomId}`);
    }
  });

  socket.on('play', async (data) => {
    const { roomId } = data;
    const room = await getRoom(roomId);
    const userId = socket.isAuthenticated ? socket.userId : socket.id;
    
    // Check permissions
    const canControl = await canUserControl(roomId, userId);
    if (!canControl) {
      socket.emit('error', { message: 'You do not have permission to control playback' });
      return;
    }
    
    room.isPlaying = true;
    scheduleSave(roomId);
    
    // Broadcast to ALL users in the room (including the sender to ensure sync)
    io.to(roomId).emit('play-track');
    console.log(`▶️ Play command in room ${roomId} by user ${socket.id}`);
  });

  socket.on('pause', async (data) => {
    const { roomId } = data;
    const room = await getRoom(roomId);
    const userId = socket.isAuthenticated ? socket.userId : socket.id;
    
    // Check permissions
    const canControl = await canUserControl(roomId, userId);
    if (!canControl) {
      socket.emit('error', { message: 'You do not have permission to control playback' });
      return;
    }
    
    room.isPlaying = false;
    scheduleSave(roomId);
    
    // Broadcast to ALL users in the room (including the sender to ensure sync)
    io.to(roomId).emit('pause-track');
    console.log(`⏸️ Pause command in room ${roomId} by user ${socket.id}`);
  });

  socket.on('seek', async (data) => {
    const { roomId, position } = data;
    const room = await getRoom(roomId);
    
    room.position = position;
    scheduleSave(roomId);
    
    socket.to(roomId).emit('seek-track', position);
    console.log(`⏩ Seek in room ${roomId} to ${position} by user ${socket.id}`);
  });

  socket.on('next-track', async (data) => {
    const { roomId } = data;
    const room = await getRoom(roomId);
    const userId = socket.isAuthenticated ? socket.userId : socket.id;
    
    // Check permissions
    const canControl = await canUserControl(roomId, userId);
    if (!canControl) {
      socket.emit('error', { message: 'You do not have permission to control playback' });
      return;
    }
    
    // Prevent multiple next-track calls from interfering
    if (room.isTransitioning) {
      console.log(`Room ${roomId} is already transitioning, ignoring next-track`);
      return;
    }
    
    room.isTransitioning = true;
    
    // Move current track to history if it exists
    if (room.currentTrack) {
      const historyTrack = {
        ...room.currentTrack,
        playedAt: Date.now()
      };
      room.history.unshift(historyTrack); // Add to beginning of history
      // Limit history to last 100 tracks to prevent database bloat
      if (room.history.length > 100) {
        room.history = room.history.slice(0, 100);
      }
      console.log(`Moved track to history in room ${roomId}:`, room.currentTrack.url);
    }
    
    if (room.queue.length > 0) {
      room.currentTrack = room.queue.shift();
      room.isPlaying = true;
      room.position = 0; // Reset position for new track
      room.lastBroadcastPosition = 0; // Reset broadcast position too
      
      // Emit track change first, then play after a delay
      io.to(roomId).emit('track-changed', room.currentTrack);
      io.to(roomId).emit('history-updated', room.history);
      
      // Delay before playing to ensure track is loaded (increased for reliability)
      setTimeout(() => {
        io.to(roomId).emit('play-track');
        room.isTransitioning = false;
      }, 1500);
      
      scheduleSave(roomId);
      console.log(`Next track in room ${roomId}:`, room.currentTrack.url);
    } else {
      // No more tracks in queue - keep current track but stop playing
      room.isPlaying = false;
      room.currentTrack = null; // Clear current track when queue is empty
      room.position = 0;
      room.lastBroadcastPosition = 0;
      room.isTransitioning = false;
      
      io.to(roomId).emit('history-updated', room.history);
      io.to(roomId).emit('pause-track');
      scheduleSave(roomId);
      console.log(`No more tracks in queue for room ${roomId}, stopping playback`);
    }
  });

  socket.on('remove-track', async (data) => {
    const { roomId, trackId } = data;
    const room = await getRoom(roomId);
    
    room.queue = room.queue.filter(track => track.id !== trackId);
    scheduleSave(roomId);
    io.to(roomId).emit('track-removed', trackId);
    console.log(`Track removed from room ${roomId}: ${trackId}`);
  });

  socket.on('replay-track', async (data) => {
    const { roomId, trackId } = data;
    const room = await getRoom(roomId);
    
    // Find track in history
    const historyTrack = room.history.find(track => track.id === trackId);
    if (historyTrack) {
      // Create new track object for replay
      const replayTrack = {
        ...historyTrack,
        id: Date.now().toString(), // New ID for the replay
        addedBy: socket.id,
        addedAt: Date.now()
      };
      
      // If there's a current track, move it to history first
      if (room.currentTrack) {
        const currentHistoryTrack = {
          ...room.currentTrack,
          playedAt: Date.now()
        };
        room.history.unshift(currentHistoryTrack);
        console.log(`Moved current track to history in room ${roomId}:`, room.currentTrack.url);
      }
      
      // Replace current track with the replayed track
      room.currentTrack = replayTrack;
      room.isPlaying = true;
      room.position = 0;
      room.lastBroadcastPosition = 0;
      
      scheduleSave(roomId);
      
      // Broadcast track change and history update
      io.to(roomId).emit('track-changed', room.currentTrack);
      io.to(roomId).emit('history-updated', room.history);
      
      // Small delay before playing to ensure track is loaded
      setTimeout(() => {
        io.to(roomId).emit('play-track');
      }, 500);
      
      console.log(`Track replayed and replaced current track in room ${roomId}:`, historyTrack.url);
    } else {
      console.log(`Track not found in history for room ${roomId}: ${trackId}`);
    }
  });

  socket.on('clear-history', async (data) => {
    const { roomId } = data;
    const room = await getRoom(roomId);
    
    // Clear history
    room.history = [];
    scheduleSave(roomId);
    
    // Broadcast to all users in the room
    io.to(roomId).emit('history-updated', []);
    console.log(`History cleared in room ${roomId} by user ${socket.id}`);
  });

  socket.on('sync-position', async (data) => {
    const { roomId, position } = data;
    const room = await getRoom(roomId);
    
    // Don't save position 0 or very small positions if track is playing
    // This prevents overwriting a good position with 0 when track restarts
    if (position < 1000 && room.isPlaying && room.position > 5000) {
      console.log(`Ignoring position sync to ${position}ms - track is playing at ${room.position}ms`);
      return;
    }
    
    // Don't save position 0 if we're far into the track (likely stale or error)
    if (position === 0 && room.isPlaying && room.position > 10000) {
      console.log(`Ignoring position sync to 0ms - track is playing at ${room.position}ms (likely stale data)`);
      return;
    }
    
    // Update room position
    room.position = position;
    
    // Save position to Supabase (source of truth) - debounced
    scheduleSave(roomId);
    
    // Broadcast position to all other users in the room for synchronization
    // Only broadcast if position changed significantly (5 seconds) to reduce lag
    // This prevents constant seeking that causes playback interruptions
    // Increased threshold to prevent micro-adjustments that cause stuttering
    // Also don't broadcast position 0 if we're far into the track
    if (Math.abs(room.lastBroadcastPosition - position) > 5000) {
      // Don't broadcast position 0 if we're far into the track (prevent unwanted restarts)
      if (position === 0 && room.isPlaying && room.position > 10000) {
        console.log(`Not broadcasting position 0 - track is playing at ${room.position}ms`);
        return;
      }
      socket.to(roomId).emit('seek-track', position);
      room.lastBroadcastPosition = position;
    }
  });

  socket.on('volume-change', async (data) => {
    const { roomId, volume } = data;
    const room = await getRoom(roomId);

    const userId = socket.isAuthenticated ? socket.userId : socket.id;

    // Update user's volume
    room.userVolumes.set(userId, volume);

    // Save to Supabase
    await saveUserVolume(roomId, userId, volume);

    // Broadcast volume change to all other users in the room
    socket.to(roomId).emit('user-volume-changed', {
      userId,
      volume: volume
    });

    console.log(`User ${userId} changed volume to ${volume}% in room ${roomId}`);
  });

  socket.on('sync-all-users', async (data) => {
    const { roomId, position } = data;
    const room = await getRoom(roomId);
    
    // Update room position
    room.position = position;
    room.lastBroadcastPosition = position;
    
    // Save position to Supabase immediately (source of truth)
    await saveRoomState(roomId, {
      queue: room.queue,
      history: room.history,
      currentTrack: room.currentTrack,
      isPlaying: room.isPlaying,
      position: position,
      lastBroadcastPosition: position,
      hostUserId: room.hostUserId
    });
    
    // Broadcast sync command to ALL users in the room (including the one who requested it)
    // This ensures everyone, including the requester, is synced
    io.to(roomId).emit('sync-all-users', {
      position: position
    });
    
    console.log(`🔄 User ${socket.id} requested sync to position ${position} in room ${roomId} (saved to Supabase)`);
  });

  socket.on('get-authoritative-position', async (data) => {
    const { roomId } = data;
    
    // Get latest position from Supabase (source of truth)
    const latestState = await loadRoomState(roomId);
    if (latestState && latestState.position !== undefined) {
      const authoritativePosition = latestState.position;
      const room = await getRoom(roomId);
      
      // Don't sync to position 0 or very small positions if track is actively playing
      // This prevents jumping back to start when Supabase has stale data
      if (authoritativePosition < 1000 && room.isPlaying && room.position > 5000) {
        console.log(`Ignoring authoritative position ${authoritativePosition}ms - track is playing at ${room.position}ms`);
        return;
      }
      
      // Only sync if there's a significant difference (> 5 seconds) to reduce lag
      // This prevents frequent seeks that interrupt smooth playback
      // Increased threshold to prevent micro-adjustments that cause stuttering
      if (Math.abs(room.position - authoritativePosition) > 5000) {
        room.position = authoritativePosition;
        room.lastBroadcastPosition = authoritativePosition;
        socket.emit('seek-track', authoritativePosition);
        console.log(`Syncing user ${socket.id} to authoritative position from Supabase: ${authoritativePosition}ms`);
      }
    }
  });

  socket.on('restart-track', async (data) => {
    const { roomId } = data;
    const room = await getRoom(roomId);
    
    // Reset position to 0
    room.position = 0;
    room.lastBroadcastPosition = 0;
    scheduleSave(roomId);
    
    // Broadcast restart to all users in the room
    // Use a special restart event that preserves playback state
    io.to(roomId).emit('restart-track', {
      position: 0,
      keepPlaying: room.isPlaying
    });
    console.log(`🔄 Restart track requested in room ${roomId} by user ${socket.id} (keepPlaying: ${room.isPlaying})`);
  });

  socket.on('leave-room', async (data) => {
    const { roomId } = data;
    const room = await getRoom(roomId);

    const userId = socket.isAuthenticated ? socket.userId : socket.id;

    if (room.users.has(userId)) {
      room.users.delete(userId);
      room.userVolumes.delete(userId);

      // Delete from Supabase
      await deleteUserVolume(roomId, userId);

      // Notify others that user left
      socket.to(roomId).emit('user-left', {
        userId
      });

      io.to(roomId).emit('user-count', room.users.size);
      console.log(`User ${userId} left room ${roomId}`);
    }

    socket.leave(roomId);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    const userId = socket.isAuthenticated ? socket.userId : socket.id;

    // Remove user from all rooms
    rooms.forEach(async (room, roomId) => {
      if (room.users.has(userId)) {
        room.users.delete(userId);
        room.userVolumes.delete(userId);

        // Delete from Supabase
        await deleteUserVolume(roomId, userId);

        // Notify others that user left
        socket.to(roomId).emit('user-left', {
          userId
        });

        io.to(roomId).emit('user-count', room.users.size);

        // Clean up empty rooms after 5 minutes
        if (room.users.size === 0) {
          setTimeout(() => {
            if (rooms.has(roomId) && rooms.get(roomId).users.size === 0) {
              rooms.delete(roomId);
              console.log(`Room ${roomId} cleaned up`);
            }
          }, 300000);
        }
      }
    });
  });

  // Chat message endpoint
  socket.on('send-message', async (data) => {
    const { roomId, message, messageType = 'text', trackId = null } = data;

    if (!chatModule) {
      socket.emit('error', { message: 'Chat not available' });
      return;
    }

    const userId = socket.isAuthenticated ? socket.userId : socket.id;

    // Save message to database
    const savedMessage = await chatModule.saveChatMessage(roomId, userId, message, messageType, trackId);

    if (savedMessage) {
      // Get user profile for display
      const userProfile = socket.userProfile || { username: `User ${userId.substring(0, 8)}` };

      // Broadcast message to all users in room
      io.to(roomId).emit('chat-message', {
        id: savedMessage.id,
        userId,
        userProfile,
        message,
        messageType,
        trackId,
        timestamp: savedMessage.created_at
      });
    }
  });

  // Room settings endpoints
  socket.on('update-room-settings', async (data) => {
    const { roomId, settings } = data;

    if (!chatModule) {
      socket.emit('error', { message: 'Room settings not available' });
      return;
    }

    // Only authenticated users can update room settings
    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required to update room settings' });
      return;
    }

    const room = await getRoom(roomId);
    const userId = socket.isAuthenticated ? socket.userId : socket.id;
    const roomAdmins = await loadRoomAdmins(roomId);
    const isOwner = room.hostUserId === userId;
    const isAdmin = roomAdmins.includes(userId);

    // Only owner and admins can update settings
    if (!isOwner && !isAdmin) {
      socket.emit('error', { message: 'Only room owner and admins can update settings' });
      return;
    }

    const updatedSettings = await chatModule.updateRoomSettings(roomId, settings);

    if (updatedSettings) {
      // Broadcast updated settings to all users in room
      io.to(roomId).emit('room-settings-updated', updatedSettings);
    }
  });

  // Friends endpoints
  socket.on('get-friends', async () => {
    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const userId = socket.userId;
    const friends = await loadFriends(userId);
    socket.emit('friends-list', friends);
  });

  socket.on('add-friend', async (data) => {
    const { friendId } = data;

    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const userId = socket.userId;
    const success = await addFriendRequest(userId, friendId, userId);
    
    if (success) {
      socket.emit('friend-request-sent', { friendId });
      // Notify the friend
      const friendSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.isAuthenticated && s.userId === friendId);
      if (friendSocket) {
        const friends = await loadFriends(friendId);
        friendSocket.emit('friends-list', friends);
      }
    } else {
      socket.emit('error', { message: 'Failed to send friend request' });
    }
  });

  socket.on('accept-friend-request', async (data) => {
    const { friendId } = data;

    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const userId = socket.userId;
    const success = await acceptFriendRequest(userId, friendId);
    
    if (success) {
      // Send updated friends list to both users
      const friends = await loadFriends(userId);
      socket.emit('friends-list', friends);
      
      const friendSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.isAuthenticated && s.userId === friendId);
      if (friendSocket) {
        const friendFriends = await loadFriends(friendId);
        friendSocket.emit('friends-list', friendFriends);
      }
    } else {
      socket.emit('error', { message: 'Failed to accept friend request' });
    }
  });

  socket.on('reject-friend-request', async (data) => {
    const { friendId } = data;

    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const userId = socket.userId;
    const success = await removeFriendRequest(userId, friendId);
    
    if (success) {
      const friends = await loadFriends(userId);
      socket.emit('friends-list', friends);
    } else {
      socket.emit('error', { message: 'Failed to reject friend request' });
    }
  });

  socket.on('remove-friend', async (data) => {
    const { friendId } = data;

    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const userId = socket.userId;
    const success = await removeFriendRequest(userId, friendId);
    
    if (success) {
      const friends = await loadFriends(userId);
      socket.emit('friends-list', friends);
    } else {
      socket.emit('error', { message: 'Failed to remove friend' });
    }
  });

  // Room admin endpoints
  socket.on('add-room-admin', async (data) => {
    const { roomId, username } = data;

    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const room = await getRoom(roomId);
    const userId = socket.userId;
    const isOwner = room.hostUserId === userId;

    if (!isOwner) {
      socket.emit('error', { message: 'Only room owner can add admins' });
      return;
    }

    // Find user by username
    if (!authModule) {
      socket.emit('error', { message: 'Auth module not available' });
      return;
    }

    // This would need a function to find user by username
    // For now, we'll assume friendId is passed instead of username
    const adminUserId = username; // This should be userId, not username
    const success = await addRoomAdmin(roomId, adminUserId, userId);

    if (success) {
      // Broadcast updated admins list
      const roomAdmins = await loadRoomAdmins(roomId);
      io.to(roomId).emit('room-admins-updated', roomAdmins);
    } else {
      socket.emit('error', { message: 'Failed to add admin' });
    }
  });

  socket.on('remove-room-admin', async (data) => {
    const { roomId, adminId } = data;

    if (!socket.isAuthenticated) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const room = await getRoom(roomId);
    const userId = socket.userId;
    const isOwner = room.hostUserId === userId;

    if (!isOwner) {
      socket.emit('error', { message: 'Only room owner can remove admins' });
      return;
    }

    const success = await removeRoomAdmin(roomId, adminId);

    if (success) {
      // Broadcast updated admins list
      const roomAdmins = await loadRoomAdmins(roomId);
      io.to(roomId).emit('room-admins-updated', roomAdmins);
    } else {
      socket.emit('error', { message: 'Failed to remove admin' });
    }
  });

});

// Proxy endpoint for SoundCloud oEmbed API (to avoid CORS issues)
// Supports both POST (with JSON body) and GET (with query params)
app.post('/api/soundcloud-oembed', async (req, res) => {
  if (!fetch) {
    return res.status(500).json({ error: 'Fetch not available. Please install node-fetch' });
  }
  
  try {
    const { url, maxheight, auto_play, show_comments } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // Use URLSearchParams for form data (as per SoundCloud docs)
    const formData = new URLSearchParams();
    formData.append('format', 'json');
    formData.append('url', url);
    if (maxheight) formData.append('maxheight', maxheight);
    if (auto_play !== undefined) formData.append('auto_play', auto_play);
    if (show_comments !== undefined) formData.append('show_comments', show_comments);
    
    const response = await fetch('https://soundcloud.com/oembed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (compatible; SoundCloud-Jukebox/1.0)'
      },
      body: formData.toString()
    });
    
    if (!response.ok) {
      throw new Error(`SoundCloud API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('oEmbed response for', url, ':', JSON.stringify(data).substring(0, 200));
    res.json(data);
  } catch (error) {
    console.error('Error proxying oEmbed request:', error);
    res.status(500).json({ error: 'Failed to fetch oEmbed data', details: error.message });
  }
});

// GET endpoint for oEmbed (alternative to POST)
app.get('/api/soundcloud-oembed', async (req, res) => {
  if (!fetch) {
    return res.status(500).json({ error: 'Fetch not available. Please install node-fetch' });
  }
  
  try {
    const { url, maxheight, auto_play, show_comments } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // Build query string for SoundCloud oEmbed API
    const params = new URLSearchParams();
    params.append('format', 'json');
    params.append('url', url);
    if (maxheight) params.append('maxheight', maxheight);
    if (auto_play !== undefined) params.append('auto_play', auto_play);
    if (show_comments !== undefined) params.append('show_comments', show_comments);
    
    const oembedUrl = `https://soundcloud.com/oembed?${params.toString()}`;
    const response = await fetch(oembedUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SoundCloud-Jukebox/1.0)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`SoundCloud API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('oEmbed GET response for', url, ':', JSON.stringify(data).substring(0, 200));
    res.json(data);
  } catch (error) {
    console.error('Error proxying oEmbed request (GET):', error);
    res.status(500).json({ error: 'Failed to fetch oEmbed data', details: error.message });
  }
});

// Resolve endpoint for SoundCloud tracks (requires client_id)
// This is a fallback when oEmbed doesn't return metadata
app.post('/api/soundcloud-resolve', async (req, res) => {
  if (!fetch) {
    return res.status(500).json({ error: 'Fetch not available. Please install node-fetch' });
  }
  
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  if (!clientId) {
    return res.status(503).json({ error: 'SoundCloud client_id not configured. Set SOUNDCLOUD_CLIENT_ID environment variable.' });
  }
  
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // Use SoundCloud resolve endpoint
    const resolveUrl = `https://api.soundcloud.com/resolve?url=${encodeURIComponent(url)}&client_id=${clientId}`;
    const response = await fetch(resolveUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SoundCloud-Jukebox/1.0)',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`SoundCloud Resolve API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Resolve response for', url, ':', JSON.stringify(data).substring(0, 200));
    res.json(data);
  } catch (error) {
    console.error('Error proxying resolve request:', error);
    res.status(500).json({ error: 'Failed to resolve track', details: error.message });
  }
});

// Endpoint to fetch playlist tracks from SoundCloud (using Python scraper)
app.post('/api/soundcloud-playlist', async (req, res) => {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  const path = require('path');
  
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // Use Python scraper
    const scriptPath = path.join(__dirname, 'scripts', 'scrape_soundcloud.py');
    const { stdout, stderr } = await execAsync(`python "${scriptPath}" playlist "${url}"`);
    
    if (stderr && !stderr.includes('DeprecationWarning')) {
      console.error('Python scraper stderr:', stderr);
    }
    
    const result = JSON.parse(stdout);
    
    if (result.error) {
      return res.status(500).json({ error: result.error });
    }
    
    if (!Array.isArray(result) || result.length === 0) {
      return res.status(404).json({ error: 'No tracks found in this playlist' });
    }
    
    // Extract playlist name from URL
    const playlistMatch = url.match(/soundcloud\.com\/[^/]+\/(?:sets|playlists)\/([^/?]+)/);
    const playlistTitle = playlistMatch 
      ? playlistMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      : 'Untitled Playlist';
    
    res.json({
      playlistTitle: playlistTitle,
      playlistUrl: url,
      tracks: result
    });
  } catch (error) {
    console.error('Error fetching playlist:', error);
    res.status(500).json({ error: 'Failed to fetch playlist', details: error.message });
  }
});

// Endpoint to fetch profile tracks from SoundCloud (using Python scraper)
app.post('/api/soundcloud-profile', async (req, res) => {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  const path = require('path');
  
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    // Use Python scraper
    const scriptPath = path.join(__dirname, 'scripts', 'scrape_soundcloud.py');
    const { stdout, stderr } = await execAsync(`python "${scriptPath}" profile "${url}"`);
    
    if (stderr && !stderr.includes('DeprecationWarning')) {
      console.error('Python scraper stderr:', stderr);
    }
    
    const result = JSON.parse(stdout);
    
    if (result.error) {
      return res.status(500).json({ error: result.error });
    }
    
    if (!Array.isArray(result) || result.length === 0) {
      return res.status(404).json({ error: 'No tracks found on this profile' });
    }
    
    // Extract profile name from URL
    const profileMatch = url.match(/soundcloud\.com\/([^/]+)/);
    const profileName = profileMatch 
      ? profileMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      : 'Unknown User';
    
    res.json({
      profileName: profileName,
      profileUrl: url,
      tracks: result
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile tracks', details: error.message });
  }
});

// Spotify OAuth callback endpoint
app.get('/spotify/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error('Spotify OAuth error:', error);
    return res.status(400).send('Authentication failed');
  }

  if (!code) {
    return res.status(400).send('No authorization code received');
  }

  try {
    // Exchange code for access token
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI || `${req.protocol}://${req.get('host')}/spotify/callback`;

    if (!clientId || !clientSecret) {
      console.error('Spotify credentials not configured');
      return res.status(500).send('Spotify credentials not configured');
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    const tokenData = await response.json();

    // Store the access token (in a real app, you'd store this securely)
    global.spotifyAccessToken = tokenData.access_token;
    global.spotifyRefreshToken = tokenData.refresh_token;

    console.log('Spotify access token obtained successfully');

    // Redirect to main app
    res.redirect('/?spotify=connected');

  } catch (error) {
    console.error('Error in Spotify callback:', error);
    res.status(500).send('Authentication failed');
  }
});

// Get Spotify access token
app.get('/api/spotify-token', async (req, res) => {
  if (global.spotifyAccessToken) {
    res.json({ access_token: global.spotifyAccessToken });
  } else {
    res.status(401).json({ error: 'No Spotify access token available' });
  }
});

// Proxy endpoint for Spotify Web API metadata
app.post('/api/spotify-metadata', async (req, res) => {
  if (!fetch) {
    return res.status(500).json({ error: 'Fetch not available' });
  }

  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint parameter is required' });
    }

    if (!global.spotifyAccessToken) {
      return res.status(401).json({ error: 'No Spotify access token available' });
    }

    const response = await fetch(`https://api.spotify.com/v1/${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${global.spotifyAccessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token might be expired, clear it
        global.spotifyAccessToken = null;
        global.spotifyRefreshToken = null;
        return res.status(401).json({ error: 'Spotify access token expired' });
      }
      throw new Error(`Spotify API error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error proxying Spotify API request:', error);
    res.status(500).json({ error: 'Failed to fetch Spotify data', details: error.message });
  }
});

// Supabase authentication endpoints
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ user: data.user, session: data.session });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ user: data.user, session: data.session });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/signout', async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Signout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/session', async (req, res) => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    res.json({ session });
  } catch (error) {
    console.error('Session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Room management endpoints
app.post('/api/rooms', async (req, res) => {
  try {
    const { name, description, type } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    const roomId = generateRoomId();
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        id: roomId,
        name,
        description,
        type: type || 'public',
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/rooms', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/rooms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;

    let user = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user: authUser } } = await supabase.auth.getUser(token);
      user = authUser;
    }

    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if user can access this room
    if (data.type === 'private' && (!user || data.created_by !== user.id)) {
      // For private rooms, check if user is a member
      const { data: membership } = await supabase
        .from('room_members')
        .select('*')
        .eq('room_id', id)
        .eq('user_id', user?.id)
        .single();

      if (!membership) {
        return res.status(403).json({ error: 'Access denied to private room' });
      }
    }

    res.json(data);
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/rooms/:id/join', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    // Check if room exists
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .single();

    if (roomError || !room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // For private rooms, user must be invited
    if (room.type === 'private') {
      const { data: membership } = await supabase
        .from('room_members')
        .select('*')
        .eq('room_id', id)
        .eq('user_id', user.id)
        .single();

      if (!membership) {
        return res.status(403).json({ error: 'Access denied to private room' });
      }
    }

    res.json({ success: true, room });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User profile endpoints
app.get('/api/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      return res.status(400).json({ error: error.message });
    }

    res.json({
      id: user.id,
      email: user.email,
      ...data
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/profile', async (req, res) => {
  try {
    const { display_name, avatar_url } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        display_name,
        avatar_url,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Utility function to generate room IDs
function generateRoomId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// HTML routes removed - now using Expo web app
// Room, dashboard, and auth are handled by React Navigation in the Expo app

// Status endpoint to check Supabase connection
app.get('/api/status', async (req, res) => {
  if (testConnection) {
    const connectionTest = await testConnection();
    res.json({
      supabase: connectionTest,
      server: 'running',
      auth: !!authModule,
      chat: !!chatModule
    });
  } else {
    res.json({
      supabase: { connected: false, error: 'Connection test not available' },
      server: 'running',
      auth: !!authModule,
      chat: !!chatModule
    });
  }
});

// Root route removed - Expo web app handles routing
// For local development, serve the Expo web build if available
// For Vercel, static build serves the Expo app

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Share this URL via ngrok to let others join!`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});

