// Supabase connection using MCP-style direct SQL execution
// Uses Supabase REST API (PostgREST) similar to MCP tools
let supabaseConfig = null;
let fetch = null;

try {
  // Try to use built-in fetch (Node 18+) or node-fetch
  if (typeof globalThis.fetch !== 'undefined') {
    fetch = globalThis.fetch;
  } else {
    fetch = require('node-fetch');
  }
} catch (e) {
  console.warn('Fetch not available, Supabase operations will fail');
}

// Try to load dotenv, but don't fail if it's not installed
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed, that's okay
}

const supabaseUrl = process.env.SUPABASE_URL || 'https://smryjxchwbfpjvpecffg.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtcnlqeGNod2JmcGp2cGVjZmZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MzcxOTAsImV4cCI6MjA3ODExMzE5MH0.M1jQK3TSWMaAspSOkR-x8FkIi_EECgSZjTpb9lks0hQ';

if (supabaseUrl && supabaseKey && fetch) {
  supabaseConfig = {
    url: supabaseUrl,
    key: supabaseKey,
    restUrl: `${supabaseUrl}/rest/v1`
  };
  console.log('Supabase configured for MCP-style SQL execution');
} else {
  console.warn('Supabase not configured, will use in-memory storage');
  supabaseConfig = null;
}

// Execute SQL query using Supabase REST API (MCP-style)
async function executeSQL(query, params = []) {
  if (!supabaseConfig || !fetch) {
    throw new Error('Supabase not configured');
  }

  try {
    // For SELECT queries, use PostgREST REST API
    if (query.trim().toUpperCase().startsWith('SELECT')) {
      // Parse simple SELECT queries and convert to REST API calls
      // For complex queries, we'll use the RPC endpoint or direct SQL
      const response = await fetch(`${supabaseConfig.restUrl}/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.key,
          'Authorization': `Bearer ${supabaseConfig.key}`
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        // Fallback: try direct table access for simple queries
        const tableMatch = query.match(/FROM\s+(\w+)/i);
        if (tableMatch) {
          const table = tableMatch[1];
          const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|$)/i);
          
          let restUrl = `${supabaseConfig.restUrl}/${table}?select=*`;
          if (whereMatch) {
            // Simple WHERE clause parsing
            const whereClause = whereMatch[1];
            if (whereClause.includes('=')) {
              const [key, value] = whereClause.split('=').map(s => s.trim().replace(/['"]/g, ''));
              restUrl += `&${key}=eq.${value}`;
            }
          }
          
          const restResponse = await fetch(restUrl, {
            headers: {
              'apikey': supabaseConfig.key,
              'Authorization': `Bearer ${supabaseConfig.key}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            }
          });

          if (restResponse.ok) {
            return { data: await restResponse.json(), error: null };
          }
        }
        
        const errorText = await response.text();
        throw new Error(`SQL execution failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      return { data: result, error: null };
    } else {
      // For INSERT/UPDATE/DELETE, use PostgREST REST API
      const response = await fetch(`${supabaseConfig.restUrl}/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseConfig.key,
          'Authorization': `Bearer ${supabaseConfig.key}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SQL execution failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      return { data: result, error: null };
    }
  } catch (error) {
    return { data: null, error: error.message };
  }
}

// Helper to use PostgREST REST API directly (more reliable than SQL for CRUD)
async function restRequest(method, table, data = null, filters = {}) {
  if (!supabaseConfig || !fetch) {
    throw new Error('Supabase not configured');
  }

  try {
    let url = `${supabaseConfig.restUrl}/${table}`;
    
    // Add filters as query parameters
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, `eq.${value}`);
      }
    });
    if (queryParams.toString()) {
      url += `?${queryParams.toString()}`;
    }

    const options = {
      method: method,
      headers: {
        'apikey': supabaseConfig.key,
        'Authorization': `Bearer ${supabaseConfig.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };

    if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`REST request failed: ${response.status} ${errorText}`);
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    }
    return null;
  } catch (error) {
    throw error;
  }
}

// Load room state from Supabase using MCP-style REST API
async function loadRoomState(roomId) {
  if (!supabaseConfig) {
    return null;
  }
  
  try {
    // Use REST API to fetch room data (MCP-style)
    const data = await restRequest('GET', 'rooms', null, { id: roomId });
    
    // Handle array response (PostgREST returns arrays)
    const roomData = Array.isArray(data) ? (data.length > 0 ? data[0] : null) : data;

    if (!roomData) {
      return null;
    }

    // Debug: Log what we got from Supabase
    console.log(`Loading room ${roomId} from Supabase:`, {
      queueType: typeof roomData.queue,
      queueIsArray: Array.isArray(roomData.queue),
      queueLength: Array.isArray(roomData.queue) ? roomData.queue.length : 'N/A',
      queueValue: roomData.queue
    });

    // Ensure queue is an array and validate/convert track format
    let queue = roomData.queue || [];
    if (!Array.isArray(queue)) {
      console.warn(`Queue for room ${roomId} is not an array, converting...`, queue);
      queue = [];
    }
    
    // Validate and normalize track objects in queue
    queue = queue.map((track, index) => {
      // Ensure track has required fields
      if (!track || typeof track !== 'object') {
        console.warn(`Invalid track at index ${index} in room ${roomId}, skipping`);
        return null;
      }
      
      // Ensure all required fields exist
      return {
        id: track.id || `track-${Date.now()}-${index}`,
        url: track.url || '',
        info: track.info || { title: 'Unknown Track', artist: null, fullTitle: 'Unknown Track', url: track.url || '', thumbnail: null },
        addedBy: track.addedBy || 'unknown',
        addedAt: track.addedAt || Date.now()
      };
    }).filter(track => track !== null); // Remove any null tracks

    // Validate current_track format
    let currentTrack = roomData.current_track;
    if (currentTrack && typeof currentTrack === 'object') {
      // Ensure current track has required fields
      if (!currentTrack.url || !currentTrack.id) {
        console.warn(`Current track in room ${roomId} is missing required fields, clearing`);
        currentTrack = null;
      } else {
        currentTrack = {
          id: currentTrack.id,
          url: currentTrack.url,
          info: currentTrack.info || { title: 'Unknown Track', artist: null, fullTitle: 'Unknown Track', url: currentTrack.url, thumbnail: null },
          addedBy: currentTrack.addedBy || 'unknown',
          addedAt: currentTrack.addedAt || Date.now()
        };
      }
    } else if (currentTrack !== null) {
      // If it's not null but also not an object, clear it
      currentTrack = null;
    }

    // Ensure history is an array and validate/convert track format
    let history = roomData.history || [];
    if (!Array.isArray(history)) {
      console.warn(`History for room ${roomId} is not an array, converting...`, history);
      history = [];
    }
    
    // Validate and normalize track objects in history
    history = history.map((track, index) => {
      // Ensure track has required fields
      if (!track || typeof track !== 'object') {
        console.warn(`Invalid track at index ${index} in history for room ${roomId}, skipping`);
        return null;
      }
      
      // Ensure all required fields exist
      return {
        id: track.id || `track-${Date.now()}-${index}`,
        url: track.url || '',
        info: track.info || { title: 'Unknown Track', artist: null, fullTitle: 'Unknown Track', url: track.url || '', thumbnail: null },
        addedBy: track.addedBy || 'unknown',
        addedAt: track.addedAt || Date.now(),
        playedAt: track.playedAt || Date.now()
      };
    }).filter(track => track !== null); // Remove any null tracks

    // Debug: Log normalized result
    console.log(`Room ${roomId} normalized from Supabase:`, {
      queueLength: queue.length,
      queueSample: queue.length > 0 ? queue[0] : null,
      hasCurrentTrack: !!currentTrack,
      historyLength: history.length
    });

    return {
      queue: queue,
      history: history,
      currentTrack: currentTrack,
      isPlaying: roomData.is_playing || false,
      position: roomData.position || 0,
      lastBroadcastPosition: roomData.last_broadcast_position || 0,
      hostUserId: roomData.host_user_id || null
    };
  } catch (error) {
    console.error('Error loading room state:', error);
    return null;
  }
}

// Save room state to Supabase using MCP-style REST API
async function saveRoomState(roomId, roomState) {
  if (!supabaseConfig) {
    return true; // Silently succeed if Supabase not available
  }
  
  try {
    // Ensure queue is an array
    let queue = roomState.queue || [];
    if (!Array.isArray(queue)) {
      console.warn(`Queue for room ${roomId} is not an array when saving, converting...`, queue);
      queue = [];
    }
    
    // Validate queue items before saving
    queue = queue.filter(track => {
      if (!track || typeof track !== 'object') {
        return false;
      }
      // Ensure track has at least id and url
      return track.id && track.url;
    });

    // Validate current_track before saving
    let currentTrack = roomState.currentTrack;
    if (currentTrack && (!currentTrack.id || !currentTrack.url)) {
      console.warn(`Current track for room ${roomId} is invalid, clearing`);
      currentTrack = null;
    }

    // Ensure history is an array
    let history = roomState.history || [];
    if (!Array.isArray(history)) {
      console.warn(`History for room ${roomId} is not an array when saving, converting...`, history);
      history = [];
    }
    
    // Validate history items before saving
    history = history.filter(track => {
      if (!track || typeof track !== 'object') {
        return false;
      }
      // Ensure track has at least id and url
      return track.id && track.url;
    });

    // Use REST API upsert (MCP-style)
    const roomData = {
      id: roomId,
      queue: queue,
      history: history,
      current_track: currentTrack,
      is_playing: roomState.isPlaying || false,
      position: roomState.position || 0,
      last_broadcast_position: roomState.lastBroadcastPosition || 0,
      host_user_id: roomState.hostUserId || null,
      updated_at: new Date().toISOString()
    };

    // Use PATCH with upsert behavior (PostgREST style)
    await restRequest('PATCH', 'rooms', roomData, { id: roomId });
    
    // If no rows were updated, insert new row
    try {
      await restRequest('POST', 'rooms', roomData);
    } catch (insertError) {
      // Ignore insert errors (likely means row already exists, which is fine)
    }
    
    console.log(`Successfully saved room ${roomId} state to Supabase (queue: ${queue.length} tracks, history: ${history.length} tracks)`);
    return true;
  } catch (error) {
    console.error('Error saving room state:', error);
    return false;
  }
}

// Load user volumes for a room using MCP-style REST API
async function loadUserVolumes(roomId) {
  if (!supabaseConfig) {
    return new Map();
  }
  
  try {
    const data = await restRequest('GET', 'user_volumes', null, { room_id: roomId });
    const volumesData = Array.isArray(data) ? data : (data ? [data] : []);

    const volumes = new Map();
    volumesData.forEach(item => {
      volumes.set(item.user_id, item.volume);
    });
    return volumes;
  } catch (error) {
    console.error('Error loading user volumes:', error);
    return new Map();
  }
}

// Save user volume using MCP-style REST API
async function saveUserVolume(roomId, userId, volume) {
  if (!supabaseConfig) {
    return true;
  }
  
  try {
    const volumeData = {
      room_id: roomId,
      user_id: userId,
      volume: volume,
      updated_at: new Date().toISOString()
    };

    // Try PATCH first (update existing)
    try {
      await restRequest('PATCH', 'user_volumes', volumeData, { room_id: roomId, user_id: userId });
    } catch (patchError) {
      // If PATCH fails, try POST (insert new)
      try {
        await restRequest('POST', 'user_volumes', volumeData);
      } catch (postError) {
        console.error('Error saving user volume:', postError);
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('Error saving user volume:', error);
    return false;
  }
}

// Delete user volume (when user leaves) using MCP-style REST API
async function deleteUserVolume(roomId, userId) {
  if (!supabaseConfig) {
    return true;
  }
  
  try {
    await restRequest('DELETE', 'user_volumes', null, { room_id: roomId, user_id: userId });
    return true;
  } catch (error) {
    console.error('Error deleting user volume:', error);
    return false;
  }
}

// Test Supabase connection using MCP-style REST API
async function testConnection() {
  if (!supabaseConfig) {
    return { connected: false, error: 'Supabase not configured' };
  }
  
  try {
    // Try a simple REST API call to test connection
    const data = await restRequest('GET', 'rooms', null, {});
    
    return { connected: true, message: 'Supabase connection successful (MCP-style)' };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

// Load room admins
async function loadRoomAdmins(roomId) {
  if (!supabaseConfig) {
    return [];
  }
  
  try {
    const data = await restRequest('GET', 'room_admins', null, { room_id: roomId });
    return Array.isArray(data) ? data.map(a => a.user_id) : [];
  } catch (error) {
    console.error('Error loading room admins:', error);
    return [];
  }
}

// Add room admin
async function addRoomAdmin(roomId, userId, addedBy) {
  if (!supabaseConfig) {
    return false;
  }
  
  try {
    const adminData = {
      room_id: roomId,
      user_id: userId,
      added_by: addedBy,
      added_at: new Date().toISOString()
    };
    await restRequest('POST', 'room_admins', adminData);
    return true;
  } catch (error) {
    console.error('Error adding room admin:', error);
    return false;
  }
}

// Remove room admin
async function removeRoomAdmin(roomId, userId) {
  if (!supabaseConfig) {
    return false;
  }
  
  try {
    await restRequest('DELETE', 'room_admins', null, { room_id: roomId, user_id: userId });
    return true;
  } catch (error) {
    console.error('Error removing room admin:', error);
    return false;
  }
}

// Load friends for a user
async function loadFriends(userId) {
  if (!supabaseConfig) {
    return [];
  }
  
  try {
    // PostgREST doesn't support $or in query params, need to make two requests
    // or use a different approach. For now, fetch all and filter client-side
    // In production, you'd want a database function or RPC endpoint
    const data1 = await restRequest('GET', 'friends', null, { user_id: userId });
    const data2 = await restRequest('GET', 'friends', null, { friend_id: userId });
    
    const allFriends = [
      ...(Array.isArray(data1) ? data1 : (data1 ? [data1] : [])),
      ...(Array.isArray(data2) ? data2 : (data2 ? [data2] : []))
    ];
    
    // Remove duplicates based on id
    const uniqueFriends = Array.from(
      new Map(allFriends.map(f => [f.id || `${f.user_id}-${f.friend_id}`, f])).values()
    );
    
    return uniqueFriends;
  } catch (error) {
    console.error('Error loading friends:', error);
    return [];
  }
}

// Add friend request
async function addFriendRequest(userId, friendId, requestedBy) {
  if (!supabaseConfig) {
    return { success: false, error: 'Supabase not configured' };
  }
  
  // Validate inputs
  if (!userId || !friendId) {
    return { success: false, error: 'User ID and Friend ID are required' };
  }

  if (userId === friendId) {
    return { success: false, error: 'Cannot add yourself as a friend' };
  }
  
  try {
    // Check if a friend request already exists
    const existing1 = await restRequest('GET', 'friends', null, { 
      user_id: userId, 
      friend_id: friendId 
    });
    const existing2 = await restRequest('GET', 'friends', null, { 
      user_id: friendId, 
      friend_id: userId 
    });

    // Handle array or single object response
    const checkExisting = (result) => {
      if (!result) return null;
      if (Array.isArray(result)) {
        return result.length > 0 ? result[0] : null;
      }
      return result;
    };

    const existing1Record = checkExisting(existing1);
    if (existing1Record) {
      if (existing1Record.status === 'pending') {
        return { success: false, error: 'Friend request already pending' };
      } else if (existing1Record.status === 'accepted') {
        return { success: false, error: 'Already friends with this user' };
      }
    }

    const existing2Record = checkExisting(existing2);
    if (existing2Record) {
      if (existing2Record.status === 'pending') {
        return { success: false, error: 'This user has already sent you a friend request' };
      } else if (existing2Record.status === 'accepted') {
        return { success: false, error: 'Already friends with this user' };
      }
    }

    const friendData = {
      user_id: userId,
      friend_id: friendId,
      status: 'pending',
      requested_by: requestedBy,
      created_at: new Date().toISOString()
    };
    
    await restRequest('POST', 'friends', friendData);
    return { success: true };
  } catch (error) {
    console.error('Error adding friend request:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to send friend request';
    if (error.message) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        errorMessage = 'Friend request already exists';
      } else if (error.message.includes('foreign key') || error.message.includes('violates')) {
        errorMessage = 'Invalid user ID';
      } else if (error.message.includes('permission') || error.message.includes('RLS')) {
        errorMessage = 'Permission denied. Please check your account settings.';
      } else {
        errorMessage = error.message;
      }
    }
    
    return { success: false, error: errorMessage };
  }
}

// Accept friend request
async function acceptFriendRequest(userId, friendId) {
  if (!supabaseConfig) {
    return false;
  }
  
  try {
    await restRequest('PATCH', 'friends', { status: 'accepted' }, { 
      user_id: friendId, 
      friend_id: userId 
    });
    return true;
  } catch (error) {
    console.error('Error accepting friend request:', error);
    return false;
  }
}

// Reject/Remove friend request
async function removeFriendRequest(userId, friendId) {
  if (!supabaseConfig) {
    return false;
  }
  
  try {
    await restRequest('DELETE', 'friends', null, { 
      $or: [
        { user_id: userId, friend_id: friendId },
        { user_id: friendId, friend_id: userId }
      ]
    });
    return true;
  } catch (error) {
    console.error('Error removing friend request:', error);
    return false;
  }
}

// Collaboration Requests
async function createCollaborationRequest(requesterId, collaboratorId) {
  if (!supabaseConfig) {
    return false;
  }
  
  try {
    // Check if there's already a pending request (check both directions)
    const existing1 = await restRequest('GET', 'collaboration_requests', null, {
      requester_id: requesterId,
      collaborator_id: collaboratorId,
      status: 'pending'
    });
    const existing2 = await restRequest('GET', 'collaboration_requests', null, {
      requester_id: collaboratorId,
      collaborator_id: requesterId,
      status: 'pending'
    });
    
    const allExisting = [
      ...(Array.isArray(existing1) ? existing1 : (existing1 ? [existing1] : [])),
      ...(Array.isArray(existing2) ? existing2 : (existing2 ? [existing2] : []))
    ];
    
    if (allExisting.length > 0) {
      return false; // Request already exists
    }
    
    const result = await restRequest('POST', 'collaboration_requests', {
      requester_id: requesterId,
      collaborator_id: collaboratorId,
      status: 'pending'
    });
    return !!result;
  } catch (error) {
    console.error('Error creating collaboration request:', error);
    return false;
  }
}

async function acceptCollaborationRequest(requesterId, collaboratorId) {
  if (!supabaseConfig) {
    return null;
  }
  
  try {
    // Find the pending request
    const existing = await restRequest('GET', 'collaboration_requests', null, {
      requester_id: requesterId,
      collaborator_id: collaboratorId,
      status: 'pending'
    });
    
    const request = Array.isArray(existing) ? existing[0] : existing;
    if (!request || !request.id) {
      return null;
    }
    
    // Update the collaboration request status using the ID
    const updated = await restRequest('PATCH', 'collaboration_requests', {
      status: 'accepted',
      responded_at: new Date().toISOString()
    }, {
      id: request.id
    });
    
    return Array.isArray(updated) ? updated[0] : updated;
  } catch (error) {
    console.error('Error accepting collaboration request:', error);
    return null;
  }
}

async function getCollaborationRequest(requesterId, collaboratorId) {
  if (!supabaseConfig) {
    return null;
  }
  
  try {
    // Check both directions
    const data1 = await restRequest('GET', 'collaboration_requests', null, {
      requester_id: requesterId,
      collaborator_id: collaboratorId
    });
    const data2 = await restRequest('GET', 'collaboration_requests', null, {
      requester_id: collaboratorId,
      collaborator_id: requesterId
    });
    
    const allRequests = [
      ...(Array.isArray(data1) ? data1 : (data1 ? [data1] : [])),
      ...(Array.isArray(data2) ? data2 : (data2 ? [data2] : []))
    ];
    
    return allRequests.length > 0 ? allRequests[0] : null;
  } catch (error) {
    console.error('Error getting collaboration request:', error);
    return null;
  }
}

// Track user joining a room
async function trackUserJoin(roomId, hostUserId, userId) {
  if (!supabaseConfig) {
    return true;
  }
  
  try {
    // Create session record
    const sessionData = {
      room_id: roomId,
      host_user_id: hostUserId || null,
      user_id: userId || null,
      was_host: userId === hostUserId,
      joined_at: new Date().toISOString()
    };
    
    await restRequest('POST', 'room_sessions', sessionData);
    
    // Update room analytics using RPC function
    const response = await fetch(`${supabaseConfig.restUrl}/rpc/update_room_analytics_on_join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.key,
        'Authorization': `Bearer ${supabaseConfig.key}`
      },
      body: JSON.stringify({
        p_room_id: roomId,
        p_host_user_id: hostUserId || null,
        p_user_id: userId || null
      })
    });
    
    if (!response.ok) {
      console.warn('Failed to update room analytics on join:', await response.text());
    }
    
    return true;
  } catch (error) {
    console.error('Error tracking user join:', error);
    return false;
  }
}

// Track user leaving a room
async function trackUserLeave(roomId, userId) {
  if (!supabaseConfig) {
    return true;
  }
  
  try {
    // Update session and analytics using RPC function
    const response = await fetch(`${supabaseConfig.restUrl}/rpc/update_room_analytics_on_leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.key,
        'Authorization': `Bearer ${supabaseConfig.key}`
      },
      body: JSON.stringify({
        p_room_id: roomId,
        p_user_id: userId || null
      })
    });
    
    if (!response.ok) {
      console.warn('Failed to update room analytics on leave:', await response.text());
    }
    
    return true;
  } catch (error) {
    console.error('Error tracking user leave:', error);
    return false;
  }
}

// Track track play
async function trackTrackPlay(roomId, hostUserId, userId, track) {
  if (!supabaseConfig) {
    return true;
  }
  
  try {
    // Determine platform
    let platform = 'soundcloud';
    if (track.url?.includes('spotify')) {
      platform = 'spotify';
    } else if (track.url?.includes('youtube') || track.url?.includes('youtu.be')) {
      platform = 'youtube';
    }
    
    // Extract track info
    const trackTitle = track.info?.fullTitle || track.info?.title || 'Unknown Track';
    const trackArtist = track.info?.artist || null;
    
    // Update analytics using RPC function
    const response = await fetch(`${supabaseConfig.restUrl}/rpc/update_analytics_on_track_play`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.key,
        'Authorization': `Bearer ${supabaseConfig.key}`
      },
      body: JSON.stringify({
        p_room_id: roomId,
        p_host_user_id: hostUserId || null,
        p_user_id: userId || null,
        p_track_id: track.id || track.url,
        p_track_url: track.url || '',
        p_track_title: trackTitle,
        p_track_artist: trackArtist,
        p_platform: platform,
        p_duration_seconds: null // Could be extracted from track info if available
      })
    });
    
    if (!response.ok) {
      console.warn('Failed to update analytics on track play:', await response.text());
    }
    
    // Increment songs_played_count for the user who added the track
    if (userId) {
      try {
        const incrementResponse = await fetch(`${supabaseConfig.restUrl}/user_profiles?id=eq.${userId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseConfig.key,
            'Authorization': `Bearer ${supabaseConfig.key}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            songs_played_count: supabaseConfig.key ? 'songs_played_count + 1' : null
          })
        });
        
        // Use RPC function for incrementing (more reliable)
        if (supabaseConfig.key) {
          const incrementRpcResponse = await fetch(`${supabaseConfig.restUrl}/rpc/increment_songs_played`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseConfig.key,
              'Authorization': `Bearer ${supabaseConfig.key}`
            },
            body: JSON.stringify({
              user_id: userId
            })
          });
          
          if (!incrementRpcResponse.ok) {
            console.warn('Failed to increment songs_played_count:', await incrementRpcResponse.text());
          }
        } else {
          // Fallback: direct update if RPC not available
          const directUpdateResponse = await fetch(`${supabaseConfig.restUrl}/user_profiles?id=eq.${userId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseConfig.key,
              'Authorization': `Bearer ${supabaseConfig.key}`,
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              songs_played_count: 'songs_played_count + 1'
            })
          });
        }
      } catch (error) {
        console.error('Error incrementing songs_played_count:', error);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error tracking track play:', error);
    return false;
  }
}

// Get leaderboard data
async function getLeaderboard(type = 'total_listeners', limit = 100) {
  if (!supabaseConfig) {
    return [];
  }
  
  try {
    let viewName = 'leaderboard_total_listeners';
    switch (type) {
      case 'peak_listeners':
        viewName = 'leaderboard_peak_listeners';
        break;
      case 'rooms_created':
        viewName = 'leaderboard_rooms_created';
        break;
      case 'tracks_played':
        viewName = 'leaderboard_tracks_played';
        break;
      default:
        viewName = 'leaderboard_total_listeners';
    }
    
    const data = await restRequest('GET', viewName, null, {});
    return Array.isArray(data) ? data : (data ? [data] : []);
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return [];
  }
}

// Get room analytics
async function getRoomAnalytics(roomId) {
  if (!supabaseConfig) {
    return null;
  }
  
  try {
    const data = await restRequest('GET', 'room_analytics', null, { room_id: roomId });
    return Array.isArray(data) ? (data.length > 0 ? data[0] : null) : data;
  } catch (error) {
    console.error('Error getting room analytics:', error);
    return null;
  }
}

// Get user analytics
async function getUserAnalytics(userId) {
  if (!supabaseConfig) {
    return null;
  }
  
  try {
    const data = await restRequest('GET', 'user_analytics', null, { user_id: userId });
    return Array.isArray(data) ? (data.length > 0 ? data[0] : null) : data;
  } catch (error) {
    console.error('Error getting user analytics:', error);
    return null;
  }
}

module.exports = {
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
  createCollaborationRequest,
  acceptCollaborationRequest,
  getCollaborationRequest,
  trackUserJoin,
  trackUserLeave,
  trackTrackPlay,
  getLeaderboard,
  getRoomAnalytics,
  getUserAnalytics
};

