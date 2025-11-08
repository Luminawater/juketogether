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

// Stripe webhook endpoint needs raw body for signature verification
// This must be BEFORE express.json() middleware
app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }));

// JSON parser for all other routes
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
let supabase = null;
try {
  authModule = require('./src/auth');
  chatModule = require('./src/chat');
  supabase = authModule.supabase;
} catch (error) {
  console.warn('Auth/Chat modules not available:', error.message);
}

// Initialize Stripe
let stripe = null;
try {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY_LIVE;
  if (stripeSecretKey) {
    stripe = require('stripe')(stripeSecretKey);
    console.log('✅ Stripe initialized');
  }
} catch (error) {
  console.warn('Stripe not configured:', error.message);
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
  removeFriendRequest,
  trackUserJoin,
  trackUserLeave,
  trackTrackPlay
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

// Helper function to get active boost for a room
async function getActiveRoomBoost(roomId) {
  if (!supabase) return null;
  
  try {
    const { data, error } = await supabase
      .rpc('get_active_room_boost', { room_id_param: roomId });
    
    if (error) {
      console.error('Error getting active boost:', error);
      return null;
    }
    
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error getting active boost:', error);
    return null;
  }
}

// Helper function to get room creator's subscription tier (considering boosts)
async function getRoomCreatorTier(roomId) {
  if (!supabase) return 'free';
  
  try {
    // Check for active boost first
    const activeBoost = await getActiveRoomBoost(roomId);
    if (activeBoost) {
      return 'pro'; // Boost gives tier 3 (pro) benefits
    }
    
    const room = await getRoom(roomId);
    const creatorId = room.hostUserId;
    
    if (!creatorId) return 'free';
    
    // Try to get creator ID from rooms table if hostUserId is not set
    const { data: roomData } = await supabase
      .from('rooms')
      .select('created_by, host_user_id')
      .eq('id', roomId)
      .single();
    
    const actualCreatorId = roomData?.created_by || roomData?.host_user_id || creatorId;
    
    if (!actualCreatorId) return 'free';
    
    // Get creator's subscription tier
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('subscription_tier')
      .eq('id', actualCreatorId)
      .single();
    
    return profile?.subscription_tier || 'free';
  } catch (error) {
    console.error('Error getting room creator tier:', error);
    return 'free';
  }
}

// Helper function to get tier settings
async function getTierSettings(tier) {
  if (!supabase) {
    // Return default settings if Supabase not available
    const defaults = {
      free: { queue_limit: 1, dj_mode: false, ads: true },
      standard: { queue_limit: 10, dj_mode: false, ads: true },
      pro: { queue_limit: null, dj_mode: true, ads: false },
    };
    return defaults[tier] || defaults.free;
  }
  
  try {
    const { data } = await supabase
      .from('subscription_tier_settings')
      .select('queue_limit, dj_mode, ads')
      .eq('tier', tier)
      .single();
    
    if (data) {
      return {
        queue_limit: data.queue_limit,
        dj_mode: data.dj_mode || false,
        ads: data.ads !== undefined ? data.ads : true,
      };
    }
    
    // Fallback to defaults if not found
    const defaults = {
      free: { queue_limit: 1, dj_mode: false, ads: true },
      standard: { queue_limit: 10, dj_mode: false, ads: true },
      pro: { queue_limit: null, dj_mode: true, ads: false },
    };
    return defaults[tier] || defaults.free;
  } catch (error) {
    console.error('Error getting tier settings:', error);
    // Return defaults on error
    const defaults = {
      free: { queue_limit: 1, dj_mode: false, ads: true },
      standard: { queue_limit: 10, dj_mode: false, ads: true },
      pro: { queue_limit: null, dj_mode: true, ads: false },
    };
    return defaults[tier] || defaults.free;
  }
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
    // Normalize both values to strings and trim whitespace for comparison
    const normalizedHostUserId = room.hostUserId ? String(room.hostUserId).trim() : null;
    const normalizedUserId = userId ? String(userId).trim() : null;
    const isOwner = normalizedHostUserId && normalizedUserId && normalizedHostUserId === normalizedUserId;
    const isAdmin = roomAdmins.some(adminId => adminId && String(adminId).trim() === normalizedUserId);
    
    // Debug logging for owner check
    console.log(`🔍 Owner check for room "${roomId}":`, {
      hostUserId: room.hostUserId,
      normalizedHostUserId: normalizedHostUserId,
      userId: userId,
      normalizedUserId: normalizedUserId,
      userIdType: typeof userId,
      hostUserIdType: typeof room.hostUserId,
      isOwner: isOwner,
      isAuthenticated: socket.isAuthenticated,
      socketUserId: socket.userId,
      roomAdmins: roomAdmins,
      isAdmin: isAdmin,
    });

    // Load room settings with defaults
    const settings = roomSettings ? {
      isPrivate: roomSettings.is_private || false,
      allowControls: roomSettings.allow_controls !== false,
      allowQueue: roomSettings.allow_queue !== false,
      djMode: roomSettings.dj_mode || false,
      djPlayers: roomSettings.dj_players || 0,
      admins: roomAdmins,
    } : {
      isPrivate: false,
      allowControls: true,
      allowQueue: true,
      djMode: false,
      djPlayers: 0,
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

    // Get creator tier and tier settings for the room
    const creatorTier = await getRoomCreatorTier(roomId);
    const tierSettings = await getTierSettings(creatorTier);
    const activeBoost = await getActiveRoomBoost(roomId);

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
      creatorTier,
      tierSettings: {
        queueLimit: tierSettings.queue_limit,
        djMode: tierSettings.dj_mode,
        ads: tierSettings.ads,
      },
      activeBoost: activeBoost ? {
        id: activeBoost.id,
        expiresAt: activeBoost.expires_at,
        minutesRemaining: activeBoost.minutes_remaining,
        purchasedBy: activeBoost.purchased_by,
      } : null,
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
    
    // Track user join for analytics
    if (trackUserJoin) {
      trackUserJoin(roomId, room.hostUserId, userId).catch(err => {
        console.error('Error tracking user join:', err);
      });
    }
    
    console.log(`User ${userId} joined room ${roomId}`);
  });

  socket.on('add-track', async (data) => {
    const { roomId, trackUrl, trackInfo, platform } = data;
    const room = await getRoom(roomId);

    const userId = socket.isAuthenticated ? socket.userId : socket.id;
    
    // Check if user can queue tracks
    const roomAdmins = await loadRoomAdmins(roomId);
    const isOwner = room.hostUserId === userId;
    const isAdmin = roomAdmins.includes(userId);
    
    // Load room settings
    let roomSettings = null;
    if (chatModule) {
      roomSettings = await chatModule.getRoomSettings(roomId);
    }
    
    // Check allowQueue permission (owners and admins can always queue)
    const canQueue = isOwner || isAdmin || (roomSettings?.allow_queue !== false);
    
    if (!canQueue) {
      socket.emit('error', { message: 'You do not have permission to add tracks to the queue' });
      return;
    }
    
    // Check queue limit based on room creator's tier
    const creatorTier = await getRoomCreatorTier(roomId);
    const tierSettings = await getTierSettings(creatorTier);
    const queueLimit = tierSettings.queue_limit;
    
    // Check if queue limit is reached (null means unlimited)
    if (queueLimit !== null && room.queue.length >= queueLimit) {
      socket.emit('error', { 
        message: `Queue limit reached (${queueLimit} songs). The room creator needs to upgrade to ${creatorTier === 'free' ? 'Standard or Pro' : 'Pro'} tier to increase the limit.` 
      });
      return;
    }
    
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
    // But only if room has boost or owner has tier 2/3
    const creatorTier = await getRoomCreatorTier(roomId);
    const canPlay = creatorTier !== 'free'; // Free tier needs boost to play
    
    if (!room.currentTrack && room.queue.length > 0 && canPlay) {
      room.currentTrack = room.queue.shift();
      room.isPlaying = true;
      room.position = 0;
      scheduleSave(roomId);
      
      io.to(roomId).emit('track-changed', room.currentTrack);
      io.to(roomId).emit('play-track');
      console.log(`Auto-playing first track in room ${roomId}`);
    } else if (!canPlay && room.isPlaying) {
      // Stop music if boost expired or no boost for free tier
      room.isPlaying = false;
      scheduleSave(roomId);
      io.to(roomId).emit('pause-track');
      console.log(`Music stopped in room ${roomId} - free tier requires boost`);
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
    
    // Check if room can play (has boost or owner has tier 2/3)
    const creatorTier = await getRoomCreatorTier(roomId);
    if (creatorTier === 'free') {
      socket.emit('error', { 
        message: 'Music playback requires a boost or room owner upgrade. Purchase a boost to continue playing.' 
      });
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
      
      // Track track play for analytics
      if (trackTrackPlay) {
        const trackUserId = room.currentTrack.addedBy || userId;
        trackTrackPlay(roomId, room.hostUserId, trackUserId, room.currentTrack).catch(err => {
          console.error('Error tracking track play:', err);
        });
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
      
      // Track user leave for analytics
      if (trackUserLeave) {
        trackUserLeave(roomId, userId).catch(err => {
          console.error('Error tracking user leave:', err);
        });
      }
      
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
        
        // Track user leave for analytics
        if (trackUserLeave) {
          trackUserLeave(roomId, userId).catch(err => {
            console.error('Error tracking user leave on disconnect:', err);
          });
        }

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

    // Check if DJ mode is allowed based on creator's tier
    if (settings.djMode) {
      const creatorTier = await getRoomCreatorTier(roomId);
      const tierSettings = await getTierSettings(creatorTier);
      
      if (!tierSettings.dj_mode) {
        socket.emit('error', { 
          message: `DJ Mode requires Pro tier. The room creator currently has ${creatorTier} tier. Please upgrade to Pro tier to enable DJ Mode.` 
        });
        return;
      }
    }

    // Convert camelCase to snake_case for database
    const dbSettings = {
      is_private: settings.isPrivate,
      allow_controls: settings.allowControls,
      allow_queue: settings.allowQueue,
      dj_mode: settings.djMode,
      dj_players: settings.djPlayers,
    };

    const updatedSettings = await chatModule.updateRoomSettings(roomId, dbSettings);

    if (updatedSettings) {
      // Convert snake_case back to camelCase for client
      const clientSettings = {
        isPrivate: updatedSettings.is_private || false,
        allowControls: updatedSettings.allow_controls !== false,
        allowQueue: updatedSettings.allow_queue !== false,
        djMode: updatedSettings.dj_mode || false,
        djPlayers: updatedSettings.dj_players || 0,
        admins: roomAdmins,
      };
      // Broadcast updated settings to all users in room
      io.to(roomId).emit('room-settings-updated', clientSettings);
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

    // Find user by username
    const userProfile = await authModule.findUserByUsername(username);
    if (!userProfile) {
      socket.emit('error', { message: 'User not found' });
      return;
    }

    const adminUserId = userProfile.id;
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

// Get user's Spotify access token from Supabase session
// This endpoint extracts the Spotify token from the user's Supabase session
app.get('/api/spotify/user-token', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authHeader.split(' ')[1];
    
    if (!supabase) {
      return res.status(500).json({ error: 'Supabase not configured' });
    }

    // Verify the Supabase token and get user
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    // Check if user signed in with Spotify
    const isSpotifyUser = user.app_metadata?.provider === 'spotify' || 
                         user.identities?.some(identity => identity.provider === 'spotify');
    
    if (!isSpotifyUser) {
      return res.status(403).json({ error: 'User is not signed in with Spotify' });
    }

    // Get the session to access provider_token
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      // Try to get provider token from user metadata or identities
      // Note: Supabase may store provider tokens in different places
      const providerToken = user.user_metadata?.spotify_access_token ||
                            user.identities?.find(i => i.provider === 'spotify')?.identity_data?.access_token;
      
      if (!providerToken) {
        return res.status(401).json({ 
          error: 'Spotify access token not available. Please reconnect your Spotify account.',
          requiresReauth: true
        });
      }
      
      return res.json({ access_token: providerToken });
    }

    // Provider token might be in session
    const providerToken = session.provider_token || 
                         session.user?.user_metadata?.spotify_access_token;
    
    if (!providerToken) {
      return res.status(401).json({ 
        error: 'Spotify access token not available. Please reconnect your Spotify account.',
        requiresReauth: true
      });
    }

    res.json({ access_token: providerToken });
  } catch (error) {
    console.error('Error getting Spotify user token:', error);
    res.status(500).json({ error: 'Failed to get Spotify token', details: error.message });
  }
});

// Get user's Spotify playlists
app.get('/api/spotify/playlists', async (req, res) => {
  if (!fetch) {
    return res.status(500).json({ error: 'Fetch not available' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const supabaseToken = authHeader.split(' ')[1];
    
    // First, get the user's Spotify access token
    const tokenResponse = await fetch(`${req.protocol}://${req.get('host')}/api/spotify/user-token`, {
      headers: {
        'Authorization': `Bearer ${supabaseToken}`
      }
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      return res.status(tokenResponse.status).json(errorData);
    }

    const { access_token } = await tokenResponse.json();

    if (!access_token) {
      return res.status(401).json({ error: 'No Spotify access token available' });
    }

    // Fetch user's playlists from Spotify API
    let allPlaylists = [];
    let nextUrl = 'https://api.spotify.com/v1/me/playlists?limit=50';

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          return res.status(401).json({ 
            error: 'Spotify access token expired. Please reconnect your Spotify account.',
            requiresReauth: true
          });
        }
        throw new Error(`Spotify API error: ${response.status}`);
      }

      const data = await response.json();
      allPlaylists = allPlaylists.concat(data.items || []);
      nextUrl = data.next;
    }

    res.json({ playlists: allPlaylists });
  } catch (error) {
    console.error('Error fetching Spotify playlists:', error);
    res.status(500).json({ error: 'Failed to fetch playlists', details: error.message });
  }
});

// Get tracks from a Spotify playlist
app.get('/api/spotify/playlists/:playlistId/tracks', async (req, res) => {
  if (!fetch) {
    return res.status(500).json({ error: 'Fetch not available' });
  }

  try {
    const { playlistId } = req.params;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const supabaseToken = authHeader.split(' ')[1];
    
    // First, get the user's Spotify access token
    const tokenResponse = await fetch(`${req.protocol}://${req.get('host')}/api/spotify/user-token`, {
      headers: {
        'Authorization': `Bearer ${supabaseToken}`
      }
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      return res.status(tokenResponse.status).json(errorData);
    }

    const { access_token } = await tokenResponse.json();

    if (!access_token) {
      return res.status(401).json({ error: 'No Spotify access token available' });
    }

    // Fetch playlist tracks from Spotify API
    let allTracks = [];
    let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`;

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          return res.status(401).json({ 
            error: 'Spotify access token expired. Please reconnect your Spotify account.',
            requiresReauth: true
          });
        }
        throw new Error(`Spotify API error: ${response.status}`);
      }

      const data = await response.json();
      const tracks = (data.items || []).map((item: any) => item.track).filter((track: any) => track !== null);
      allTracks = allTracks.concat(tracks);
      nextUrl = data.next;
    }

    res.json({ tracks: allTracks });
  } catch (error) {
    console.error('Error fetching playlist tracks:', error);
    res.status(500).json({ error: 'Failed to fetch playlist tracks', details: error.message });
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
    const shortCode = await generateShortCode();
    const { data, error } = await supabase
      .from('rooms')
      .insert({
        id: roomId,
        name,
        description,
        type: type || 'public',
        created_by: user.id,
        short_code: shortCode,
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

// Room boost endpoints
app.post('/api/rooms/:roomId/boost', async (req, res) => {
  try {
    const { roomId } = req.params;
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
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('id, created_by')
      .eq('id', roomId)
      .single();

    if (roomError || !roomData) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if there's already an active boost
    const activeBoost = await getActiveRoomBoost(roomId);
    if (activeBoost) {
      return res.status(400).json({ 
        error: 'Room already has an active boost',
        activeBoost: {
          expiresAt: activeBoost.expires_at,
          minutesRemaining: activeBoost.minutes_remaining,
        }
      });
    }

    // Create boost record (1 hour from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const { data: boostData, error: boostError } = await supabase
      .from('room_boosts')
      .insert({
        room_id: roomId,
        purchased_by: user.id,
        expires_at: expiresAt.toISOString(),
        amount_paid: 1.00,
        payment_status: 'pending', // Will be updated after payment confirmation
      })
      .select()
      .single();

    if (boostError) {
      return res.status(400).json({ error: boostError.message });
    }

    // In a real implementation, you would:
    // 1. Create a payment intent with Stripe/PayPal/etc.
    // 2. Return the payment intent client secret
    // 3. Update payment_status to 'completed' after payment confirmation
    
    // For now, we'll simulate payment completion (in production, this should be done via webhook)
    // TODO: Integrate with payment provider (Stripe, PayPal, etc.)
    
    // Simulate payment success for development
    // In production, this should be handled by a webhook from the payment provider
    const { error: updateError } = await supabase
      .from('room_boosts')
      .update({ 
        payment_status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', boostData.id);

    if (updateError) {
      console.error('Error updating boost payment status:', updateError);
    }

    // Broadcast boost activation to all users in room
    if (io) {
      const updatedBoost = await getActiveRoomBoost(roomId);
      io.to(roomId).emit('boost-activated', {
        boost: updatedBoost ? {
          id: updatedBoost.id,
          expiresAt: updatedBoost.expires_at,
          minutesRemaining: updatedBoost.minutes_remaining,
          purchasedBy: updatedBoost.purchased_by,
        } : null,
      });
    }

    res.json({
      success: true,
      boost: {
        id: boostData.id,
        expiresAt: expiresAt.toISOString(),
        minutesRemaining: 60,
      },
      message: 'Boost activated successfully! Room now has Pro tier benefits for 1 hour.',
    });
  } catch (error) {
    console.error('Boost purchase error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/rooms/:roomId/boost', async (req, res) => {
  try {
    const { roomId } = req.params;
    const activeBoost = await getActiveRoomBoost(roomId);
    
    res.json({
      activeBoost: activeBoost ? {
        id: activeBoost.id,
        expiresAt: activeBoost.expires_at,
        minutesRemaining: activeBoost.minutes_remaining,
        purchasedBy: activeBoost.purchased_by,
      } : null,
    });
  } catch (error) {
    console.error('Get boost error:', error);
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

// Create Stripe Checkout Session for subscription upgrade
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    const { tier } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!tier) {
      return res.status(400).json({ error: 'Tier is required' });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    // Get tier pricing from database
    const { data: tierData, error: tierError } = await supabase
      .from('subscription_tier_settings')
      .select('*')
      .eq('tier', tier)
      .single();

    if (tierError || !tierData) {
      return res.status(404).json({ error: 'Tier not found' });
    }

    const price = parseFloat(tierData.price || 0);
    if (price <= 0) {
      return res.status(400).json({ error: 'Invalid tier price' });
    }

    // Get user's email
    const userEmail = user.email || user.user_metadata?.email;

    // Determine success and cancel URLs based on platform
    const baseUrl = process.env.FRONTEND_URL || 'https://juketogether.vercel.app';
    const successUrl = `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/subscription?canceled=true`;

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${tierData.display_name || tier} Subscription`,
              description: tierData.description || `Upgrade to ${tier} tier`,
            },
            recurring: {
              interval: 'month',
            },
            unit_amount: Math.round(price * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      customer_email: userEmail,
      metadata: {
        user_id: user.id,
        tier: tier,
        display_name: tierData.display_name || tier,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    res.json({ 
      sessionId: session.id,
      url: session.url 
    });
  } catch (error) {
    console.error('Create checkout session error:', error);
    res.status(500).json({ error: error.message || 'Failed to create checkout session' });
  }
});

// Utility function to generate room IDs
function generateRoomId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// Utility function to generate unique short codes (5 characters, uppercase alphanumeric)
// Excludes confusing characters: 0, O, 1, I
async function generateShortCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Check if code already exists
    const { data, error } = await supabase
      .from('rooms')
      .select('short_code')
      .eq('short_code', code)
      .single();
    
    if (error && error.code === 'PGRST116') {
      // No rows found, code is unique
      return code;
    }
    
    attempts++;
  }
  
  // Fallback: add timestamp to ensure uniqueness
  const timestamp = Date.now().toString(36).substr(-2).toUpperCase();
  return chars.charAt(Math.floor(Math.random() * chars.length)) + 
         chars.charAt(Math.floor(Math.random() * chars.length)) + 
         chars.charAt(Math.floor(Math.random() * chars.length)) + 
         timestamp;
}

// HTML routes removed - now using Expo web app
// Room, dashboard, and auth are handled by React Navigation in the Expo app

// Stripe webhook endpoint
app.post('/api/stripe-webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  // Support multiple webhook secrets (snapshot and thin payload)
  const webhookSecrets = [
    process.env.STRIPE_WEBHOOK_SECRET,           // Snapshot payload secret
    process.env.STRIPE_WEBHOOK_SECRET_THIN,      // Thin payload secret
  ].filter(Boolean); // Remove undefined values

  if (webhookSecrets.length === 0) {
    console.error('No STRIPE_WEBHOOK_SECRET configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  if (!stripe) {
    console.error('Stripe is not initialized');
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  let event;
  let verified = false;

  // Try to verify with each webhook secret
  for (const webhookSecret of webhookSecrets) {
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      verified = true;
      break;
    } catch (err) {
      // Try next secret
      continue;
    }
  }

  if (!verified) {
    console.error('Webhook signature verification failed with all secrets');
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('PaymentIntent succeeded:', paymentIntent.id);
        // Handle successful payment
        // You can update user subscription here if needed
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object;
        console.log('Subscription event:', event.type, subscription.id);
        
        // Update user subscription tier in Supabase
        if (supabase && subscription.metadata?.user_id) {
          const userId = subscription.metadata.user_id;
          const tier = subscription.metadata.tier || 'standard';
          
          // Update user profile
          const { error: profileError } = await supabase
            .from('user_profiles')
            .update({
              subscription_tier: tier,
              subscription_updated_at: new Date().toISOString(),
              songs_played_count: 0, // Reset count on upgrade
            })
            .eq('id', userId);
          
          if (profileError) {
            console.error('Error updating subscription tier:', profileError);
          } else {
            console.log(`Updated subscription tier for user ${userId} to ${tier}`);
          }

          // Track payment in subscription_payments table (only on creation)
          if (event.type === 'customer.subscription.created') {
            const amount = subscription.items?.data[0]?.price?.unit_amount 
              ? subscription.items.data[0].price.unit_amount / 100 
              : 0;
            
            const { error: paymentError } = await supabase
              .from('subscription_payments')
              .insert({
                user_id: userId,
                tier: tier,
                amount_paid: amount,
                payment_provider: 'stripe',
                payment_provider_id: subscription.id,
                payment_date: new Date().toISOString(),
              });
            
            if (paymentError) {
              console.error('Error tracking payment:', paymentError);
            } else {
              console.log(`Tracked payment for user ${userId}, tier ${tier}, amount $${amount}`);
            }
          }
        }
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object;
        console.log('Subscription deleted:', deletedSubscription.id);
        
        // Downgrade user to free tier
        if (supabase && deletedSubscription.metadata?.user_id) {
          const userId = deletedSubscription.metadata.user_id;
          
          const { error } = await supabase
            .from('user_profiles')
            .update({
              subscription_tier: 'free',
              subscription_updated_at: new Date().toISOString(),
            })
            .eq('id', userId);
          
          if (error) {
            console.error('Error downgrading subscription:', error);
          } else {
            console.log(`Downgraded user ${userId} to free tier`);
          }
        }
        break;

      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('Checkout session completed:', session.id);
        
        // If it's a subscription, the subscription.created event will handle the tier update
        // But we can also track the checkout session here if needed
        if (session.mode === 'subscription' && session.metadata?.user_id) {
          console.log(`User ${session.metadata.user_id} completed checkout for tier ${session.metadata.tier}`);
        }
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Return a response to acknowledge receipt of the event
    res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook event:', error);
    res.status(500).json({ error: 'Error processing webhook' });
  }
});

// Status endpoint to check Supabase connection
app.get('/api/status', async (req, res) => {
  if (testConnection) {
    const connectionTest = await testConnection();
    res.json({
      supabase: connectionTest,
      server: 'running',
      auth: !!authModule,
      chat: !!chatModule,
      stripe: !!stripe
    });
  } else {
    res.json({
      supabase: { connected: false, error: 'Connection test not available' },
      server: 'running',
      auth: !!authModule,
      chat: !!chatModule,
      stripe: !!stripe
    });
  }
});

// Root route removed - Expo web app handles routing
// For local development, serve the Expo web build if available
// For Vercel, static build serves the Expo app

// Periodic check for expired boosts (every 5 minutes)
setInterval(async () => {
  if (!supabase) return;
  
  try {
    // Get all active boosts that have expired
    const now = new Date().toISOString();
    const { data: expiredBoosts, error } = await supabase
      .from('room_boosts')
      .select('room_id')
      .eq('payment_status', 'completed')
      .lt('expires_at', now);
    
    if (error) {
      console.error('Error checking expired boosts:', error);
      return;
    }
    
    if (expiredBoosts && expiredBoosts.length > 0) {
      // Check each room and stop music if owner is free tier
      for (const boost of expiredBoosts) {
        const room = await getRoom(boost.room_id);
        const creatorTier = await getRoomCreatorTier(boost.room_id);
        
        // Only stop if owner is free tier (boost was providing pro benefits)
        if (creatorTier === 'free' && room.isPlaying) {
          room.isPlaying = false;
          scheduleSave(boost.room_id);
          io.to(boost.room_id).emit('pause-track');
          io.to(boost.room_id).emit('boost-expired', { roomId: boost.room_id });
          console.log(`⏸️ Music stopped in room ${boost.room_id} - boost expired`);
        }
      }
    }
  } catch (error) {
    console.error('Error in boost expiration check:', error);
  }
}, 5 * 60 * 1000); // Check every 5 minutes

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Share this URL via ngrok to let others join!`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});

