// Bypass localtunnel password - set custom user agent for all requests
// Note: This only works for fetch/XHR, not for the initial page load
if (navigator.userAgent.includes('Mozilla')) {
    // Try to modify user agent (limited browser support)
    try {
        Object.defineProperty(navigator, 'userAgent', {
            get: () => 'SoundCloud-Jukebox-Client/1.0 (Custom)'
        });
    } catch(e) {
        console.log('Could not modify user agent');
    }
}

// Import all modules
import { initSupabaseStatus } from './js/modules/supabase-status.js';
import { initRoomManager } from './js/modules/room-manager.js';
import { initVolumeController } from './js/modules/volume-controller.js';
import { initQueueManager } from './js/modules/queue-manager.js';
import { initHistoryManager } from './js/modules/history-manager.js';
import { initSoundCloudManager } from './js/modules/soundcloud-manager.js';
import { initSpotifyManager } from './js/modules/spotify-manager.js';
import { initSocketManager } from './js/modules/socket-manager.js';
import { showError, showSuccess } from './js/modules/ui-utils.js';

// Global session management variables
let isUserSyncedToSession = false;
let pendingRoomState = null;

// Session management functions
function showSessionJoinModal(state) {
    const modal = document.getElementById('session-join-modal');
    const sessionDetails = document.getElementById('session-details');

    // Store the pending room state
    pendingRoomState = state;

    // Populate session details
    const trackInfo = state.currentTrack?.info || {};
    const trackTitle = trackInfo.fullTitle || trackInfo.title || 'Unknown Track';
    const positionSeconds = Math.floor(state.position / 1000);
    const minutes = Math.floor(positionSeconds / 60);
    const seconds = positionSeconds % 60;
    const positionStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    sessionDetails.innerHTML = `
        <p><strong>Current Track:</strong> <span class="track-title">${trackTitle}</span></p>
        <p><strong>Status:</strong> ${state.isPlaying ? 'Playing' : 'Paused'}</p>
        <p><strong>Position:</strong> ${positionStr}</p>
    `;

    // Show modal
    modal.style.display = 'flex';

    // Focus on join button
    setTimeout(() => {
        document.getElementById('join-session-btn').focus();
    }, 100);
}

function hideSessionJoinModal() {
    const modal = document.getElementById('session-join-modal');
    modal.style.display = 'none';
    pendingRoomState = null;
}

function joinSession() {
    if (pendingRoomState) {
        isUserSyncedToSession = true;
        updateSessionStatusIndicator(true);
        processRoomState(pendingRoomState);
        hideSessionJoinModal();
        showSuccess('Joined music session! Your player is now synced.');
    }
}

function skipSession() {
    isUserSyncedToSession = false;
    updateSessionStatusIndicator(false);
    hideSessionJoinModal();
    showSuccess('Session join skipped. You can sync anytime with the Sync button.');
}

function processRoomState(state) {
    // This function contains the original room-state processing logic
    // Store the room's playing state from Supabase
    currentRoomIsPlaying = state.isPlaying || false;

    // Save room state to localStorage for backup
    try {
        localStorage.setItem('soundcloud-jukebox-state', JSON.stringify({
            queue: state.queue || [],
            currentTrack: state.currentTrack,
            isPlaying: state.isPlaying,
            position: state.position,
            timestamp: Date.now()
        }));
    } catch (e) {
        console.warn('Could not save state to localStorage:', e);
    }

    // Update queue display
    if (state.queue && state.queue.length > 0) {
        queueManager.updateQueueDisplay(state.queue);
        console.log('Queue updated with', state.queue.length, 'tracks');
    } else {
        // Clear queue display if empty
        const queueList = document.getElementById('queue-list');
        if (queueList) {
            queueList.innerHTML = '<p class="empty-queue">Queue is empty. Add a track to get started!</p>';
        }
        console.log('Queue is empty');
    }

    // Update history display
    if (state.history && state.history.length > 0) {
        historyManager.updateHistoryDisplay(state.history);
        console.log('History updated with', state.history.length, 'tracks');
    } else {
        // Clear history display if empty
        const historyList = document.getElementById('history-list');
        if (historyList) {
            historyList.innerHTML = '<p class="empty-history">No tracks played yet</p>';
        }
        console.log('History is empty');
    }

    // Load current track if exists and user is synced to session
    if (state.currentTrack && state.currentTrack.url && isUserSyncedToSession) {
        console.log('Loading current track:', state.currentTrack.url);
        console.log('Syncing to position from Supabase (source of truth):', state.position, 'ms');

        // Mark as initial load - prevent position syncs from affecting others
        soundCloudManager.isInitialLoad = true;
        soundCloudManager.initialLoadComplete = false;

        // Stop any ongoing sync operations
        soundCloudManager.isSyncing = false;

        // Clear position sync interval to prevent interference
        if (soundCloudManager.positionSyncInterval) {
            clearInterval(soundCloudManager.positionSyncInterval);
            soundCloudManager.positionSyncInterval = null;
        }

        soundCloudManager.loadTrack(state.currentTrack.url, state.currentTrack.info, () => {
            // After track loads, sync to position from Supabase (source of truth)
            // Only sync if position is significant (> 1 second) to avoid unnecessary seeks
            if (state.position > 1000 && soundCloudManager.widget) {
                // Wait a bit longer to ensure widget is fully ready and "listen in browser" is handled
                setTimeout(() => {
                    if (soundCloudManager.widget && !soundCloudManager.isSyncing) {
                        // Set syncing flag to prevent position broadcasts during seek
                        soundCloudManager.isSyncing = true;
                        soundCloudManager.widget.seekTo(state.position);
                        console.log('Synced to authoritative position from Supabase:', state.position, 'ms');

                        // Sync play state after seeking
                        if (state.isPlaying) {
                            setTimeout(() => {
                                if (soundCloudManager.widget) {
                                    soundCloudManager.playTrack();
                                }
                                // Allow position syncs after initial load is complete
                                setTimeout(() => {
                                    soundCloudManager.isInitialLoad = false;
                                    soundCloudManager.initialLoadComplete = true;
                                    soundCloudManager.isSyncing = false;
                                }, 2000); // 2 second grace period after initial load
                            }, 500);
                        } else {
                            // Not playing, just mark initial load complete
                            setTimeout(() => {
                                soundCloudManager.isInitialLoad = false;
                                soundCloudManager.initialLoadComplete = true;
                                soundCloudManager.isSyncing = false;
                            }, 2000);
                        }
                    }
                }, 2000); // Increased delay to allow "listen in browser" to complete
            } else if (state.isPlaying) {
                // If no position or position is small, just play from start
                setTimeout(() => {
                    if (soundCloudManager.widget) {
                        soundCloudManager.playTrack();
                    }
                    // Allow position syncs after initial load is complete
                    setTimeout(() => {
                        soundCloudManager.isInitialLoad = false;
                        soundCloudManager.initialLoadComplete = true;
                    }, 2000); // 2 second grace period after initial load
                }, 500);
            } else {
                // Not playing, just mark initial load complete
                setTimeout(() => {
                    soundCloudManager.isInitialLoad = false;
                    soundCloudManager.initialLoadComplete = true;
                }, 2000);
            }
        });
    } else if (!isUserSyncedToSession) {
        // User not synced to session, just update displays but don't load tracks
        updateCurrentTrackDisplay('Not synced to session', '');
        console.log('User not synced to session - not loading track');
    } else {
        // Clear current track display if no track
        updateCurrentTrackDisplay('No track playing', '');
        console.log('No current track - state.currentTrack is:', state.currentTrack);

        // If we have a position but no track, something went wrong
        if (state.position > 0) {
            console.warn('Warning: Position exists but no current track. State may be inconsistent.');
        }
    }
}

function updateSessionStatusIndicator(synced) {
    const roomInfoDiv = document.querySelector('.room-info');
    if (!roomInfoDiv) return;

    // Remove existing session status
    const existingStatus = roomInfoDiv.querySelector('.session-status');
    if (existingStatus) {
        existingStatus.remove();
    }

    // Add new status indicator
    const statusDiv = document.createElement('span');
    statusDiv.className = `session-status ${synced ? 'synced' : 'not-synced'}`;

    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = synced ? 'sync' : 'sync_disabled';

    const text = document.createTextNode(synced ? 'Synced' : 'Not Synced');

    statusDiv.appendChild(icon);
    statusDiv.appendChild(text);

    roomInfoDiv.appendChild(statusDiv);
}

// Initialize application
async function initApp() {
    // Initialize Supabase status checker
    const supabaseStatus = initSupabaseStatus();

    // Get DOM elements that will be shared
    const queueList = document.getElementById('queue-list');
    const currentTrackDiv = document.getElementById('current-track');

    // Initialize volume controller
    const volumeController = initVolumeController();

    // Initialize queue manager
    const queueManager = initQueueManager();

    // Initialize history manager
    const historyManager = initHistoryManager();

    // Initialize SoundCloud manager
    const soundCloudManager = initSoundCloudManager({
        updateCurrentTrackDisplay: (title, url) => {
            currentTrackDiv.innerHTML = `
                <p><strong>Now Playing:</strong> ${title}</p>
                <p style="font-size: 0.9em; margin-top: 5px;"><a href="${url}" target="_blank">View on SoundCloud</a></p>
            `;
        }
    });

    // Initialize Spotify manager
    const spotifyManager = initSpotifyManager({
        updateCurrentTrackDisplay: (title, url) => {
            currentTrackDiv.innerHTML = `
                <p><strong>Now Playing:</strong> ${title}</p>
                <p style="font-size: 0.9em; margin-top: 5px;"><a href="${url}" target="_blank">View on Spotify</a></p>
            `;
        }
    });

    // Initialize room manager
    const roomManager = initRoomManager({
        socket: null, // Will be set after socket initialization
        queueList: queueList,
        widget: soundCloudManager.widget,
        showError: showError,
        updateCurrentTrackDisplay: soundCloudManager.updateCurrentTrackDisplay
    });

    // Initialize socket manager (needs to be last as it depends on others)
    const socketManager = initSocketManager({
        roomManager: roomManager,
        queueManager: queueManager,
        historyManager: historyManager,
        soundCloudManager: soundCloudManager,
        spotifyManager: spotifyManager,
        volumeController: volumeController,
        updateCurrentTrackDisplay: soundCloudManager.updateCurrentTrackDisplay,
        showError: showError,
        processRoomState: processRoomState
    });

    // Update room manager with socket reference
    roomManager.socket = socketManager.socket;

    // Set up global references for functions that need to be called from HTML
    window.socket = socketManager.socket;
    window.roomId = roomManager.roomId;
    window.removeTrack = queueManager.removeTrack;
    window.replayTrack = historyManager.replayTrack;

    // Make session variables globally accessible
    window.isUserSyncedToSession = isUserSyncedToSession;
    window.updateSessionStatusIndicator = updateSessionStatusIndicator;

    // Set up track input handlers
    const trackUrlInput = document.getElementById('track-url-input');
    const addTrackBtn = document.getElementById('add-track-btn');

    addTrackBtn.addEventListener('click', () => {
        const text = trackUrlInput.value.trim();
        if (!text) {
            return;
        }

        // Extract all URLs from the pasted text (both SoundCloud and Spotify)
        const soundCloudUrls = soundCloudManager.extractSoundCloudUrls(text);
        const spotifyUrls = spotifyManager.extractSpotifyUrls(text);
        const allUrls = [...soundCloudUrls, ...spotifyUrls];

        if (allUrls.length === 0) {
            // If no URLs found, try to treat the whole input as a single URL
            const normalizedSoundCloudUrl = soundCloudManager.normalizeSoundCloudUrl(text);
            const normalizedSpotifyUrl = spotifyManager.normalizeSpotifyUrl(text);

            if (normalizedSoundCloudUrl && soundCloudManager.isValidSoundCloudUrl(normalizedSoundCloudUrl)) {
                soundCloudManager.addTrack(normalizedSoundCloudUrl);
                trackUrlInput.value = '';
            } else if (normalizedSpotifyUrl && spotifyManager.isValidSpotifyUrl(normalizedSpotifyUrl)) {
                spotifyManager.addTrack(normalizedSpotifyUrl);
                trackUrlInput.value = '';
            } else {
                showError('No valid SoundCloud or Spotify URLs found. Please paste a URL from either platform.');
            }
            return;
        }

        // Add all valid URLs to the queue
        let addedCount = 0;
        let invalidCount = 0;

        allUrls.forEach(url => {
            const normalizedSoundCloudUrl = soundCloudManager.normalizeSoundCloudUrl(url);
            const normalizedSpotifyUrl = spotifyManager.normalizeSpotifyUrl(url);

            if (normalizedSoundCloudUrl && soundCloudManager.isValidSoundCloudUrl(normalizedSoundCloudUrl)) {
                soundCloudManager.addTrack(normalizedSoundCloudUrl);
                addedCount++;
            } else if (normalizedSpotifyUrl && spotifyManager.isValidSpotifyUrl(normalizedSpotifyUrl)) {
                spotifyManager.addTrack(normalizedSpotifyUrl);
                addedCount++;
            } else {
                invalidCount++;
            }
        });

        // Clear input
        trackUrlInput.value = '';

        // Show feedback
        if (addedCount > 0) {
            if (addedCount === 1) {
                showSuccess(`Added 1 track to queue`);
            } else {
                showSuccess(`Added ${addedCount} tracks to queue`);
            }
        }

        if (invalidCount > 0) {
            console.warn(`Skipped ${invalidCount} invalid URL(s)`);
        }
    });

    // Enter key handler
    trackUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTrackBtn.click();
        }
    });

    // Set up playback controls
    const playPauseBtn = document.getElementById('play-pause-btn');
    const restartBtn = document.getElementById('restart-btn');
    const nextBtn = document.getElementById('next-btn');
    const syncBtn = document.getElementById('sync-btn');

    playPauseBtn.addEventListener('click', () => {
        if (!isUserSyncedToSession) {
            showError('You must join the music session to control playback. Click the Sync button to join.');
            return;
        }

        // Determine which manager to use based on current platform
        const currentManager = socketManager.currentPlatform === 'spotify' ? spotifyManager : soundCloudManager;
        const widget = socketManager.currentPlatform === 'spotify' ? currentManager.player : currentManager.widget;

        if (widget) {
            // Toggle based on current playing state
            if (currentManager.isCurrentlyPlaying) {
                // Pause locally first for immediate feedback
                if (socketManager.currentPlatform === 'spotify') {
                    currentManager.player.pause();
                } else {
                    currentManager.widget.pause();
                }
                currentManager.isCurrentlyPlaying = false;
                currentManager.updatePlayPauseButton(false);
                // Then broadcast to others
                socketManager.socket.emit('pause', { roomId: roomManager.roomId });
            } else {
                // Play locally first for immediate feedback
                if (socketManager.currentPlatform === 'spotify') {
                    currentManager.playTrack();
                } else {
                    currentManager.widget.play();
                }
                currentManager.isCurrentlyPlaying = true;
                currentManager.updatePlayPauseButton(true);
                // Then broadcast to others
                socketManager.socket.emit('play', { roomId: roomManager.roomId });
            }
        }
    });

    // Restart button handler
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            if (!isUserSyncedToSession) {
                showError('You must join the music session to control playback. Click the Sync button to join.');
                return;
            }

            // Determine which manager to use based on current platform
            const currentManager = socketManager.currentPlatform === 'spotify' ? spotifyManager : soundCloudManager;
            const widget = socketManager.currentPlatform === 'spotify' ? currentManager.player : currentManager.widget;

            if (widget) {
                // Seek to position 0 and broadcast to all users
                // Only restart if there's a current track
                if (currentManager.currentTrackId) {
                    socketManager.socket.emit('restart-track', { roomId: roomManager.roomId });
                }
            }
        });
    }

    // Next button handler
    nextBtn.addEventListener('click', () => {
        if (!isUserSyncedToSession) {
            showError('You must join the music session to control playback. Click the Sync button to join.');
            return;
        }

        socketManager.socket.emit('next-track', { roomId: roomManager.roomId });
    });

    // Sync button - sync all users to current position
    syncBtn.addEventListener('click', () => {
        // Determine which manager to use based on current platform
        const currentManager = socketManager.currentPlatform === 'spotify' ? spotifyManager : soundCloudManager;
        const widget = socketManager.currentPlatform === 'spotify' ? currentManager.player : currentManager.widget;

        if (widget) {
            if (socketManager.currentPlatform === 'spotify') {
                // For Spotify, we need to get position from the player state
                currentManager.player.getCurrentState().then(state => {
                    if (state && state.position !== null && state.position !== undefined) {
                        // Emit sync request to server
                        socketManager.socket.emit('sync-all-users', {
                            roomId: roomManager.roomId,
                            position: state.position
                        });
                        console.log('Spotify sync requested at position:', state.position);

                        // Update session sync status
                        if (!isUserSyncedToSession) {
                            isUserSyncedToSession = true;
                            updateSessionStatusIndicator(true);
                            showSuccess('Synced to music session!');
                        }
                    }
                });
            } else {
                // SoundCloud logic
                currentManager.widget.getPosition((position) => {
                    if (position !== null && position !== undefined) {
                        // Emit sync request to server
                        socketManager.socket.emit('sync-all-users', {
                            roomId: roomManager.roomId,
                            position: position
                        });
                        console.log('SoundCloud sync requested at position:', position);

                        // Update session sync status
                        if (!isUserSyncedToSession) {
                            isUserSyncedToSession = true;
                            updateSessionStatusIndicator(true);
                            showSuccess('Synced to music session!');
                        }
                    }
                });
            }
        }
    });

    // Set up volume controls
    volumeController.setupVolumeControls(socketManager.socket, roomManager.roomId);

    // Set up session join modal handlers
    const joinSessionBtn = document.getElementById('join-session-btn');
    const skipSessionBtn = document.getElementById('skip-session-btn');
    const sessionModal = document.getElementById('session-join-modal');

    if (joinSessionBtn) {
        joinSessionBtn.addEventListener('click', joinSession);
    }

    if (skipSessionBtn) {
        skipSessionBtn.addEventListener('click', skipSession);
    }

    // Close modal when clicking outside
    if (sessionModal) {
        sessionModal.addEventListener('click', (e) => {
            if (e.target === sessionModal) {
                skipSession();
            }
        });
    }

    // Handle Escape key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sessionModal && sessionModal.style.display === 'flex') {
            skipSession();
        }
    });

    console.log('SoundCloud Jukebox initialized successfully');
}

// Initialize the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}