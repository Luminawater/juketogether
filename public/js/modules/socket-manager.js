// Socket.io event handlers and management
let socket;
let myUserId = '';
let currentPlatform = 'soundcloud'; // Track which platform is currently active

// Helper function to detect platform from URL
function detectPlatform(url) {
    if (!url) return 'soundcloud'; // Default to SoundCloud

    if (url.includes('spotify.com') || url.includes('spotify:')) {
        return 'spotify';
    }
    return 'soundcloud';
}

// Initialize socket manager
function initSocketManager(deps) {
    // Dependencies
    const roomManager = deps.roomManager;
    const queueManager = deps.queueManager;
    const historyManager = deps.historyManager;
    const soundCloudManager = deps.soundCloudManager;
    const spotifyManager = deps.spotifyManager;
    const volumeController = deps.volumeController;
    const updateCurrentTrackDisplay = deps.updateCurrentTrackDisplay;
    const showError = deps.showError;
    const processRoomState = deps.processRoomState;

    // Initialize Socket.io
    socket = io({
        extraHeaders: {
            'bypass-tunnel-reminder': 'true'
        }
    });

    // Join room on connection
    socket.on('connect', () => {
        myUserId = socket.id;
        const currentRoom = roomManager.roomId;
        socket.emit('join-room', currentRoom);
        console.log('Joined room:', currentRoom);

        // Set initial volume when connected
        const volumeSlider = document.getElementById('volume-slider');
        const volumeValue = document.getElementById('volume-value');
        if (volumeSlider) {
            volumeSlider.value = volumeController.currentVolume;
            if (volumeValue) volumeValue.textContent = volumeController.currentVolume + '%';
        }

        // Apply initial volume
        if (volumeController.volumeController) {
            volumeController.volumeController.setVolume(volumeController.currentVolume);
        }
        volumeController.applyVolumeVisualFeedback(volumeController.currentVolume);
    });

    // Receive room state
    socket.on('room-state', (state) => {
        console.log('Room state received:', state);
        console.log('Queue:', state.queue);
        console.log('Current track:', state.currentTrack);
        console.log('Is playing:', state.isPlaying);
        console.log('Position:', state.position);

        // Store the room's playing state from Supabase
        soundCloudManager.currentRoomIsPlaying = state.isPlaying || false;

        // Delegate room state processing to the main app
        // This allows the app to handle session join prompts
        if (processRoomState) {
            processRoomState(state);
        } else {
            // Fallback if processRoomState is not available
            console.warn('processRoomState not available, falling back to direct processing');

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

            // Update displays
            if (state.queue && state.queue.length > 0) {
                queueManager.updateQueueDisplay(state.queue);
                console.log('Queue updated with', state.queue.length, 'tracks');
            } else {
                const queueList = document.getElementById('queue-list');
                if (queueList) {
                    queueList.innerHTML = '<p class="empty-queue">Queue is empty. Add a track to get started!</p>';
                }
                console.log('Queue is empty');
            }

            if (state.history && state.history.length > 0) {
                historyManager.updateHistoryDisplay(state.history);
                console.log('History updated with', state.history.length, 'tracks');
            } else {
                const historyList = document.getElementById('history-list');
                if (historyList) {
                    historyList.innerHTML = '<p class="empty-history">No tracks played yet</p>';
                }
                console.log('History is empty');
            }

            updateCurrentTrackDisplay('No track playing', '');
        }
    });

    // Try to restore state from localStorage on page load (as backup)
    window.addEventListener('DOMContentLoaded', () => {
        try {
            const savedState = localStorage.getItem('soundcloud-jukebox-state');
            if (savedState) {
                const state = JSON.parse(savedState);
                const age = Date.now() - (state.timestamp || 0);
                // Only use saved state if it's less than 1 hour old
                if (age < 3600000 && state.queue && state.queue.length > 0) {
                    console.log('Restoring state from localStorage (backup)');
                    queueManager.updateQueueDisplay(state.queue);
                }
            }
        } catch (e) {
            console.warn('Could not restore state from localStorage:', e);
        }
    });

    // Track added to queue
    socket.on('track-added', (track) => {
        queueManager.addQueueItem(track);
    });

    // Track removed from queue
    socket.on('track-removed', (trackId) => {
        const item = document.querySelector(`[data-track-id="${trackId}"]`);
        if (item) {
            item.remove();
        }
        const queueList = document.getElementById('queue-list');
        if (queueList.children.length === 0) {
            queueList.innerHTML = '<p class="empty-queue">Queue is empty. Add a track to get started!</p>';
        }
    });

    // History updated
    socket.on('history-updated', (history) => {
        if (history && history.length > 0) {
            historyManager.updateHistoryDisplay(history);
            console.log('History updated with', history.length, 'tracks');
        } else {
            const historyList = document.getElementById('history-list');
            if (historyList) {
                historyList.innerHTML = '<p class="empty-history">No tracks played yet</p>';
            }
        }
    });

    // Play command
    socket.on('play-track', () => {
        if (currentPlatform === 'spotify') {
            spotifyManager.expectingPlayCommand = false; // We received the play command we were expecting

            if (spotifyManager.player && spotifyManager.widgetReady()) {
                try {
                    spotifyManager.playTrack();
                    console.log('Spotify play command executed');
                } catch (error) {
                    console.warn('Spotify play failed:', error);
                    // For Spotify, just try once more after a delay
                    setTimeout(() => {
                        if (spotifyManager.player && spotifyManager.widgetReady()) {
                            try {
                                spotifyManager.playTrack();
                                console.log('Spotify play succeeded after retry');
                            } catch (err) {
                                console.error('Spotify play failed after retry:', err);
                            }
                        }
                    }, 500);
                }
            } else {
                console.warn('Spotify player not ready when play command received');
                spotifyManager.pendingPlayCommand = true;
                // Try to initialize player if not ready
                spotifyManager.initializePlayer().catch(error => {
                    console.error('Failed to initialize Spotify player:', error);
                });
            }
        } else {
            // SoundCloud play logic (existing)
            soundCloudManager.expectingPlayCommand = false; // We received the play command we were expecting

            if (soundCloudManager.widget) {
                if (soundCloudManager.widgetReady) {
                    // Widget is ready, play immediately
                    try {
                        soundCloudManager.widget.play();
                        soundCloudManager.isCurrentlyPlaying = true;
                        soundCloudManager.currentRoomIsPlaying = true; // Update room state
                        soundCloudManager.updatePlayPauseButton(true);
                        soundCloudManager.pendingPlayCommand = false;
                        console.log('Play command executed immediately (widget ready)');
                    } catch (error) {
                        console.warn('Play failed:', error);
                        // Retry with exponential backoff
                        let retryCount = 0;
                        const maxRetries = 3;
                        const retryPlay = () => {
                            retryCount++;
                            setTimeout(() => {
                                if (soundCloudManager.widget && soundCloudManager.widgetReady && retryCount <= maxRetries) {
                                    try {
                                        soundCloudManager.widget.play();
                                        soundCloudManager.isCurrentlyPlaying = true;
                                        soundCloudManager.currentRoomIsPlaying = true; // Update room state
                                        soundCloudManager.updatePlayPauseButton(true);
                                        soundCloudManager.pendingPlayCommand = false;
                                        console.log(`Play succeeded after retry ${retryCount}`);
                                    } catch (err) {
                                        if (retryCount < maxRetries) {
                                            retryPlay();
                                        } else {
                                            console.error('Play failed after all retries:', err);
                                            soundCloudManager.pendingPlayCommand = true; // Keep it pending for widget ready handler
                                        }
                                    }
                                }
                            }, 300 * retryCount); // Exponential backoff: 300ms, 600ms, 900ms
                        };
                        retryPlay();
                    }
                } else {
                    // Widget not ready yet, queue the play command
                    console.log('Widget not ready, queuing play command...');
                    soundCloudManager.pendingPlayCommand = true;

                    // Try multiple times with increasing delays in case widget becomes ready
                    const retryDelays = [500, 1000, 2000, 3000];
                    retryDelays.forEach((delay, index) => {
                        setTimeout(() => {
                            if (soundCloudManager.widget && soundCloudManager.widgetReady && soundCloudManager.pendingPlayCommand) {
                                try {
                                    soundCloudManager.widget.play();
                                    soundCloudManager.isCurrentlyPlaying = true;
                                    soundCloudManager.currentRoomIsPlaying = true; // Update room state
                                    soundCloudManager.updatePlayPauseButton(true);
                                    soundCloudManager.pendingPlayCommand = false;
                                    console.log(`Play command executed after delay ${delay}ms (attempt ${index + 1})`);
                                } catch (err) {
                                    if (index === retryDelays.length - 1) {
                                        console.warn('Queued play failed after all retries:', err);
                                    }
                                }
                            }
                        }, delay);
                    });
                }
            } else {
                console.warn('Widget not available when play command received');
                soundCloudManager.pendingPlayCommand = true;
            }
        }
    });

    // Pause command
    socket.on('pause-track', () => {
        if (currentPlatform === 'spotify') {
            if (spotifyManager.player && spotifyManager.widgetReady()) {
                spotifyManager.player.pause();
                spotifyManager.isCurrentlyPlaying = false;
                spotifyManager.currentRoomIsPlaying = false;
                spotifyManager.updatePlayPauseButton(false);
            }
        } else {
            if (soundCloudManager.widget) {
                soundCloudManager.widget.pause();
                soundCloudManager.isCurrentlyPlaying = false;
                soundCloudManager.currentRoomIsPlaying = false; // Update room state
                soundCloudManager.updatePlayPauseButton(false);
            }
        }
    });

    // Restart track command (from server broadcast)
    socket.on('restart-track', (data) => {
        const position = data?.position || 0;
        const keepPlaying = data?.keepPlaying !== false; // Default to true if not specified

        if (currentPlatform === 'spotify') {
            if (spotifyManager.player && !spotifyManager.isSyncing) {
                console.log('Restarting Spotify track to position 0, keepPlaying:', keepPlaying);
                spotifyManager.isSyncing = true;

                const deviceId = spotifyManager.deviceId();
                const accessToken = spotifyManager.accessToken();
                if (!deviceId || !accessToken) {
                    console.error('Spotify device ID or access token not available');
                    spotifyManager.isSyncing = false;
                    return;
                }

                // For Spotify, we need to use the Web API to seek
                fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${position}&device_id=${deviceId}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                }).then(() => {
                    if (keepPlaying && !spotifyManager.isCurrentlyPlaying) {
                        setTimeout(() => {
                            if (spotifyManager.player) {
                                spotifyManager.playTrack();
                            }
                            spotifyManager.isSyncing = false;
                        }, 500);
                    } else {
                        setTimeout(() => {
                            spotifyManager.isSyncing = false;
                        }, 500);
                    }
                }).catch(error => {
                    console.error('Spotify seek failed:', error);
                    spotifyManager.isSyncing = false;
                });
            }
        } else {
            if (soundCloudManager.widget && !soundCloudManager.isSyncing) {
                console.log('Restarting SoundCloud track to position 0, keepPlaying:', keepPlaying);
                soundCloudManager.isSyncing = true;
                soundCloudManager.widget.seekTo(position);

                // If we should keep playing, resume playback after seeking
                if (keepPlaying && !soundCloudManager.isCurrentlyPlaying) {
                    setTimeout(() => {
                        if (soundCloudManager.widget) {
                            soundCloudManager.widget.play();
                            soundCloudManager.isCurrentlyPlaying = true;
                            soundCloudManager.updatePlayPauseButton(true);
                        }
                        soundCloudManager.isSyncing = false;
                    }, 500);
                } else {
                    setTimeout(() => {
                        soundCloudManager.isSyncing = false;
                    }, 500);
                }
            }
        }
    });

    // Seek command (sync position from other users or Supabase)
    socket.on('seek-track', (position) => {
        if (currentPlatform === 'spotify') {
            if (spotifyManager.player && !spotifyManager.isSyncing) {
                // For Spotify, we use the Web API to seek
                // Spotify doesn't have the same position checking complexity as SoundCloud
                spotifyManager.isSyncing = true;
                console.log('Syncing Spotify position to:', position, 'ms');

                const deviceId = spotifyManager.deviceId();
                const accessToken = spotifyManager.accessToken();
                if (!deviceId || !accessToken) {
                    console.error('Spotify device ID or access token not available');
                    spotifyManager.isSyncing = false;
                    return;
                }

                fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${position}&device_id=${deviceId}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                }).then(() => {
                    setTimeout(() => {
                        spotifyManager.isSyncing = false;
                    }, 1000);
                }).catch(error => {
                    console.error('Spotify seek failed:', error);
                    spotifyManager.isSyncing = false;
                });
            }
        } else {
            if (soundCloudManager.widget && !soundCloudManager.isSyncing) {
                soundCloudManager.widget.getPosition((currentPos) => {
                    // Only treat position exactly 0 as a restart (not small positions like 50ms)
                    const isRestart = position === 0;

                    // Don't seek to position 0 or very small positions if we're already playing
                    // This prevents unwanted restarts from stale data or sync issues
                    // UNLESS it's explicitly position 0 AND we're not far into the track
                    if (position < 1000 && currentPos > 5000 && soundCloudManager.isCurrentlyPlaying) {
                        // Only allow if it's exactly 0 AND we're not too far in (might be intentional restart)
                        // But if we're past 10 seconds, ignore position 0 to prevent unwanted restarts
                        if (position === 0 && currentPos > 10000) {
                            console.log('Ignoring seek to position 0 - track is playing at', currentPos, 'ms (likely stale data)');
                            return;
                        }
                        // For positions between 0-1000ms when we're past 5 seconds, ignore unless exactly 0
                        if (position > 0 && position < 1000) {
                            console.log('Ignoring seek to', position, 'ms - track is playing at', currentPos, 'ms');
                            return;
                        }
                    }

                    // For restart (position exactly 0), only allow if we're not too far in
                    // For other positions, only seek if position difference is significant (> 5 seconds)
                    const diff = Math.abs(currentPos - position);
                    if (isRestart) {
                        // Only restart if we're not too far into the track (prevent accidental restarts)
                        if (currentPos < 10000) {
                            soundCloudManager.isSyncing = true;
                            console.log('Restarting track from', currentPos, 'to 0ms');
                            soundCloudManager.widget.seekTo(position);
                            setTimeout(() => {
                                soundCloudManager.isSyncing = false;
                            }, 1000);
                        } else {
                            console.log('Ignoring restart - track is too far in (', currentPos, 'ms)');
                        }
                    } else if (diff > 5000) {
                        // Only seek if position difference is significant (> 5 seconds)
                        soundCloudManager.isSyncing = true;
                        console.log('Syncing position from', currentPos, 'to:', position, 'ms');
                        soundCloudManager.widget.seekTo(position);
                        setTimeout(() => {
                            soundCloudManager.isSyncing = false;
                        }, 1000);
                    } else {
                        // If difference is small, we're already in sync - no need to seek
                        // This prevents micro-adjustments that cause lag and stuttering
                    }
                });
            }
        }
    });

    // Track changed
    socket.on('track-changed', (track) => {
        console.log('Track changed to:', track.url);

        // Detect platform from track URL
        const platform = detectPlatform(track.url);
        currentPlatform = platform;

        if (platform === 'spotify') {
            // Handle Spotify track change
            spotifyManager.isSyncing = false;
            spotifyManager.isCurrentlyPlaying = false;
            spotifyManager.isInitialLoad = false;
            spotifyManager.initialLoadComplete = true;
            spotifyManager.widgetReady = false;
            spotifyManager.pendingPlayCommand = false;
            spotifyManager.expectingPlayCommand = true;

            // Clear position sync interval to prevent interference during track change
            if (spotifyManager.positionSyncInterval) {
                clearInterval(spotifyManager.positionSyncInterval);
                spotifyManager.positionSyncInterval = null;
            }

            // Ensure player is initialized before loading track
            spotifyManager.initializePlayer().then(() => {
                // Load new Spotify track
                spotifyManager.loadTrack(track.url, track.info, () => {
                    // Don't play locally - wait for server to broadcast 'play-track' event
                    console.log('Spotify track loaded, waiting for server play command...');
                });
            }).catch(error => {
                console.error('Failed to initialize Spotify player for track change:', error);
                showError('Failed to initialize Spotify player. Please refresh the page.');
            });
        } else {
            // Handle SoundCloud track change (existing logic)
            soundCloudManager.isSyncing = false;
            soundCloudManager.isCurrentlyPlaying = false;
            soundCloudManager.isInitialLoad = false; // Not an initial load, this is a track change
            soundCloudManager.initialLoadComplete = true; // Mark as complete since we're changing tracks
            soundCloudManager.widgetReady = false; // Reset widget ready flag when loading new track
            soundCloudManager.pendingPlayCommand = false; // Clear any pending play commands
            soundCloudManager.expectingPlayCommand = true; // We're expecting a play command after track change

            // Clear position sync interval to prevent interference during track change
            if (soundCloudManager.positionSyncInterval) {
                clearInterval(soundCloudManager.positionSyncInterval);
                soundCloudManager.positionSyncInterval = null;
            }

            // Load new SoundCloud track
            soundCloudManager.loadTrack(track.url, track.info, () => {
                // Track loaded, reset position to 0
                // Don't sync position for new tracks - they should start at 0
                if (soundCloudManager.widget) {
                    soundCloudManager.widget.seekTo(0);
                }

                // Don't play locally - wait for server to broadcast 'play-track' event
                // This ensures all users in the room start playing together
                console.log('SoundCloud track loaded, waiting for server play command...');
            });
        }
    });

    // User count update
    socket.on('user-count', (count) => {
        const userCountSpan = document.getElementById('user-count');
        userCountSpan.textContent = count;
    });

    // User volumes update (initial load)
    socket.on('user-volumes', (volumes) => {
        updateOtherUsersVolumes(volumes);
    });

    // User joined
    socket.on('user-joined', (data) => {
        addOtherUserVolume(data.userId, data.volume);
    });

    // User left
    socket.on('user-left', (data) => {
        removeOtherUserVolume(data.userId);
    });

    // User volume changed
    socket.on('user-volume-changed', (data) => {
        updateOtherUserVolume(data.userId, data.volume);
    });

    // Receive sync command from server
    socket.on('sync-all-users', (data) => {
        const { position } = data;
        if (currentPlatform === 'spotify') {
            if (spotifyManager.player && !spotifyManager.isSyncing) {
                spotifyManager.isSyncing = true;
                console.log('Syncing Spotify to position:', position);

                const deviceId = spotifyManager.deviceId();
                const accessToken = spotifyManager.accessToken();
                if (!deviceId || !accessToken) {
                    console.error('Spotify device ID or access token not available');
                    spotifyManager.isSyncing = false;
                    return;
                }
                fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${position}&device_id=${deviceId}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                }).then(() => {
                    setTimeout(() => {
                        spotifyManager.isSyncing = false;
                    }, 1500);
                }).catch(error => {
                    console.error('Spotify sync failed:', error);
                    spotifyManager.isSyncing = false;
                });
            }
        } else {
            if (soundCloudManager.widget && !soundCloudManager.isSyncing) {
                soundCloudManager.isSyncing = true;
                console.log('Syncing SoundCloud to position:', position);
                soundCloudManager.widget.seekTo(position);
                setTimeout(() => {
                    soundCloudManager.isSyncing = false;
                }, 1500);
            }
        }
    });

    return {
        socket,
        myUserId
    };
}

// Export initialization function
export { initSocketManager };
