// Spotify integration functionality using Spotify Web Playback SDK
import { showError, showSuccess } from './ui-utils.js';

// Spotify Web Playback SDK variables
let player = null;
let deviceId = null;
let currentTrackId = null;
let isSyncing = false;
let positionSyncInterval = null;
let isCurrentlyPlaying = false;
let isInitialLoad = false;
let initialLoadComplete = false;
let widgetReady = false;
let pendingPlayCommand = false;
let expectingPlayCommand = false;
let currentRoomIsPlaying = false;
let currentTrack = null;
let accessToken = null;
let sdkReady = false;
let initializationPromise = null;

// DOM elements
const currentTrackDiv = document.getElementById('current-track');

// Initialize Spotify manager
function initSpotifyManager(deps) {
    // Dependencies will be passed from main app
    const socket = deps.socket;
    const roomId = deps.roomId;
    const updateCurrentTrackDisplay = deps.updateCurrentTrackDisplay;

    return {
        player,
        deviceId: () => deviceId,
        accessToken: () => accessToken,
        currentTrackId,
        isCurrentlyPlaying,
        currentRoomIsPlaying,
        widgetReady: () => widgetReady,
        loadTrack,
        playTrack,
        updateCurrentTrackDisplay: updateCurrentTrackDisplay,
        fetchTrackMetadata,
        addTrack,
        extractSpotifyUrls,
        normalizeSpotifyUrl,
        isValidSpotifyUrl,
        isPlaylistUrl: isSpotifyPlaylistUrl,
        isAlbumUrl: isSpotifyAlbumUrl,
        convertToSpotifyUri,
        initializePlayer,
        updatePlayPauseButton: updatePlayPauseButton
    };
}

// Update current track display for Spotify
function updateCurrentTrackDisplay(title, url) {
    currentTrackDiv.innerHTML = `
        <p><strong>Now Playing:</strong> ${title}</p>
        <p style="font-size: 0.9em; margin-top: 5px;"><a href="${url}" target="_blank">View on Spotify</a></p>
    `;
}

// Helper function to update play/pause button
function updatePlayPauseButton(isPlaying) {
    const playPauseBtn = document.getElementById('play-pause-btn');
    const icon = playPauseBtn.querySelector('.material-icons');
    if (isPlaying) {
        if (icon) icon.textContent = 'pause';
        // Update text node (find text node after icon)
        const textNodes = Array.from(playPauseBtn.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
        if (textNodes.length > 0) {
            textNodes[0].textContent = ' Pause';
        } else {
            // If no text node exists, create one
            playPauseBtn.appendChild(document.createTextNode(' Pause'));
        }
    } else {
        if (icon) icon.textContent = 'play_arrow';
        // Update text node
        const textNodes = Array.from(playPauseBtn.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
        if (textNodes.length > 0) {
            textNodes[0].textContent = ' Play';
        } else {
            playPauseBtn.appendChild(document.createTextNode(' Play'));
        }
    }
}

// Fetch track metadata from Spotify Web API
async function fetchTrackMetadata(url) {
    try {
        // Extract Spotify ID from URL
        const spotifyId = extractSpotifyId(url);
        if (!spotifyId) {
            throw new Error('Invalid Spotify URL');
        }

        // Determine content type from URL
        let endpoint;
        if (url.includes('/track/')) {
            endpoint = `v1/tracks/${spotifyId}`;
        } else if (url.includes('/album/')) {
            endpoint = `v1/albums/${spotifyId}`;
        } else if (url.includes('/playlist/')) {
            endpoint = `v1/playlists/${spotifyId}`;
        } else {
            throw new Error('Unsupported Spotify content type');
        }

        // Use server proxy to avoid CORS issues
        const response = await fetch('/api/spotify-metadata', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ endpoint })
        });

        if (!response.ok) {
            throw new Error(`Spotify API error: ${response.status}`);
        }

        const data = await response.json();

        if (url.includes('/track/')) {
            return {
                title: data.name,
                artist: data.artists.map(artist => artist.name).join(', '),
                fullTitle: `${data.artists.map(artist => artist.name).join(', ')} - ${data.name}`,
                url: url,
                thumbnail: data.album?.images?.[0]?.url || null,
                duration: data.duration_ms
            };
        } else if (url.includes('/album/')) {
            return {
                title: data.name,
                artist: data.artists.map(artist => artist.name).join(', '),
                fullTitle: `${data.name} by ${data.artists.map(artist => artist.name).join(', ')}`,
                url: url,
                thumbnail: data.images?.[0]?.url || null,
                tracks: data.tracks?.items || []
            };
        } else if (url.includes('/playlist/')) {
            return {
                title: data.name,
                artist: data.owner?.display_name || 'Spotify',
                fullTitle: data.name,
                url: url,
                thumbnail: data.images?.[0]?.url || null,
                tracks: data.tracks?.items || []
            };
        }
    } catch (error) {
        console.error('Error fetching Spotify metadata:', error);
        return {
            title: 'Unknown Track',
            artist: null,
            fullTitle: 'Unknown Track',
            url: url,
            thumbnail: null
        };
    }
}

// Extract Spotify ID from various URL formats
function extractSpotifyId(url) {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(p => p);

        // Handle different Spotify URL formats
        if (pathParts.length >= 2) {
            const contentType = pathParts[pathParts.length - 2];
            const id = pathParts[pathParts.length - 1];

            // Remove query parameters if present
            return id.split('?')[0];
        }
    } catch (e) {
        // Try regex fallback for malformed URLs
        const match = url.match(/spotify\.com\/(?:.*\/)?([a-zA-Z0-9]{22})/);
        if (match) {
            return match[1];
        }
    }
    return null;
}

// Extract all Spotify URLs from text
function extractSpotifyUrls(text) {
    if (!text || typeof text !== 'string') {
        return [];
    }

    const urls = [];

    // Pattern for Spotify URLs
    const spotifyPattern = /https?:\/\/(?:open\.|play\.)?spotify\.com\/(?:intl-[a-z]{2}\/)?(?:track|album|playlist|artist)\/[a-zA-Z0-9]{22}/gi;

    let match;
    while ((match = spotifyPattern.exec(text)) !== null) {
        const url = match[0].trim();
        if (!urls.includes(url)) {
            urls.push(url);
        }
    }

    // Pattern for Spotify URI format
    const uriPattern = /spotify:(track|album|playlist|artist):[a-zA-Z0-9]{22}/gi;
    while ((match = uriPattern.exec(text)) !== null) {
        const uri = match[0].trim();
        // Convert URI to URL format
        const url = uri.replace('spotify:', 'https://open.spotify.com/').replace(':', '/');
        if (!urls.includes(url)) {
            urls.push(url);
        }
    }

    return [...new Set(urls)];
}

// Normalize Spotify URL
function normalizeSpotifyUrl(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }

    url = url.trim();

    // Convert Spotify URI to URL
    if (url.startsWith('spotify:')) {
        return url.replace('spotify:', 'https://open.spotify.com/').replace(/:/g, '/');
    }

    // Ensure https protocol
    if (url.match(/^spotify\.com\//i) && !url.match(/^https?:\/\//i)) {
        url = `https://${url}`;
    }

    return url;
}

// Validate Spotify URL
function isValidSpotifyUrl(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }

    // Normalize first
    url = normalizeSpotifyUrl(url);
    if (!url) {
        return false;
    }

    // Match Spotify URL patterns
    const spotifyPattern = /^https?:\/\/(?:open\.|play\.)?spotify\.com\/(?:intl-[a-z]{2}\/)?(?:track|album|playlist|artist)\/[a-zA-Z0-9]{22}/i;

    if (!spotifyPattern.test(url)) {
        return false;
    }

    // Additional check: extract ID to ensure it's valid length
    const id = extractSpotifyId(url);
    return id && id.length === 22;
}

// Check if URL is a Spotify playlist
function isSpotifyPlaylistUrl(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }

    url = normalizeSpotifyUrl(url);
    if (!url) {
        return false;
    }

    return url.includes('/playlist/');
}

// Check if URL is a Spotify album
function isSpotifyAlbumUrl(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }

    url = normalizeSpotifyUrl(url);
    if (!url) {
        return false;
    }

    return url.includes('/album/');
}

// Convert Spotify URL to Spotify URI
function convertToSpotifyUri(url) {
    const id = extractSpotifyId(url);
    if (!id) return null;

    if (url.includes('/track/')) {
        return `spotify:track:${id}`;
    } else if (url.includes('/album/')) {
        return `spotify:album:${id}`;
    } else if (url.includes('/playlist/')) {
        return `spotify:playlist:${id}`;
    }

    return null;
}

// Initialize Spotify Web Playback SDK
function initializePlayer() {
    // Return existing promise if initialization is already in progress
    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = new Promise((resolve, reject) => {
        // Check if SDK is already ready
        if (sdkReady && window.Spotify && window.Spotify.Player) {
            createPlayer(resolve, reject);
            return;
        }

        // Wait for SDK to be ready
        if (window.Spotify && window.Spotify.Player) {
            sdkReady = true;
            createPlayer(resolve, reject);
        } else {
            // Set up callback for when SDK loads
            window.onSpotifyWebPlaybackSDKReady = () => {
                sdkReady = true;
                createPlayer(resolve, reject);
            };

            // If SDK is already loaded but callback wasn't called, try again after a short delay
            setTimeout(() => {
                if (window.Spotify && window.Spotify.Player && !sdkReady) {
                    sdkReady = true;
                    createPlayer(resolve, reject);
                } else if (!window.Spotify || !window.Spotify.Player) {
                    reject(new Error('Spotify Web Playback SDK not loaded'));
                }
            }, 1000);
        }
    });

    return initializationPromise;
}

// Create and configure the Spotify player
function createPlayer(resolve, reject) {
    // Get access token from server
    fetch('/api/spotify-token')
        .then(response => response.json())
        .then(data => {
            accessToken = data.access_token;
            if (!accessToken) {
                reject(new Error('No Spotify access token available'));
                return;
            }

            // Create player using the correct API
            player = new window.Spotify.Player({
                name: 'SoundCloud Jukebox',
                getOAuthToken: cb => { cb(accessToken); },
                volume: 0.5
            });

            // Set up event listeners
            player.addListener('ready', ({ device_id }) => {
                deviceId = device_id;
                widgetReady = true;
                console.log('Spotify player ready with device ID:', device_id);
                initializationPromise = null; // Clear promise after success
                resolve();
            });

            player.addListener('not_ready', ({ device_id }) => {
                console.log('Spotify player not ready:', device_id);
                deviceId = null;
                widgetReady = false;
            });

            player.addListener('player_state_changed', state => {
                if (state) {
                    isCurrentlyPlaying = !state.paused;
                    updatePlayPauseButton(isCurrentlyPlaying);

                    if (state.track_window?.current_track) {
                        currentTrack = state.track_window.current_track;
                        updateCurrentTrackDisplay(
                            `${currentTrack.artists.map(a => a.name).join(', ')} - ${currentTrack.name}`,
                            `https://open.spotify.com/track/${currentTrack.id}`
                        );
                    }
                }
            });

            player.addListener('initialization_error', ({ message }) => {
                console.error('Spotify initialization error:', message);
                initializationPromise = null;
                reject(new Error(message));
            });

            player.addListener('authentication_error', ({ message }) => {
                console.error('Spotify authentication error:', message);
                initializationPromise = null;
                reject(new Error(message));
            });

            player.addListener('account_error', ({ message }) => {
                console.error('Spotify account error:', message);
                initializationPromise = null;
                reject(new Error(message));
            });

            player.addListener('playback_error', ({ message }) => {
                console.error('Spotify playback error:', message);
                showError(`Playback error: ${message}`);
            });

            // Connect to player
            player.connect().then(success => {
                if (success) {
                    console.log('Spotify player connected successfully');
                } else {
                    initializationPromise = null;
                    reject(new Error('Failed to connect to Spotify player'));
                }
            });
        })
        .catch(error => {
            console.error('Error getting Spotify token:', error);
            initializationPromise = null;
            reject(error);
        });
}

// Load track in Spotify player
async function loadTrack(url, trackInfo, onLoaded) {
    // Ensure player is initialized before loading track
    if (!player || !widgetReady) {
        console.log('Spotify player not ready, initializing...');
        try {
            await initializePlayer();
        } catch (error) {
            console.error('Failed to initialize Spotify player:', error);
            showError('Failed to initialize Spotify player. Please refresh the page.');
            return;
        }
    }

    if (!player || !widgetReady) {
        console.error('Spotify player not ready after initialization');
        showError('Spotify player is not ready. Please refresh the page.');
        return;
    }

    // Clear previous position sync interval
    if (positionSyncInterval) {
        clearInterval(positionSyncInterval);
        positionSyncInterval = null;
    }

    const spotifyUri = convertToSpotifyUri(url);
    if (!spotifyUri) {
        showError('Invalid Spotify URL format');
        return;
    }

    // Load and play the track
    fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({
            uris: [spotifyUri]
        }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        }
    })
    .then(response => {
        if (response.ok) {
            currentTrackId = url;
            isCurrentlyPlaying = true;
            updatePlayPauseButton(true);

            if (onLoaded) {
                setTimeout(() => {
                    onLoaded();
                }, 500);
            }
        } else {
            throw new Error(`Failed to load track: ${response.status}`);
        }
    })
    .catch(error => {
        console.error('Error loading Spotify track:', error);
        showError('Failed to load Spotify track');
    });
}

// Play track
function playTrack() {
    if (player && widgetReady) {
        player.resume();
        isCurrentlyPlaying = true;
        updatePlayPauseButton(true);
    }
}

// Add track function
async function addTrack(url) {
    // Trim and validate Spotify URL
    if (!url) {
        showError('Please enter a Spotify URL');
        return;
    }

    // Normalize the URL first
    url = normalizeSpotifyUrl(url);

    if (!url || !isValidSpotifyUrl(url)) {
        showError('Please enter a valid Spotify URL');
        console.log('Invalid URL:', url);
        return;
    }

    // Check if it's an album
    if (isSpotifyAlbumUrl(url)) {
        await addAlbum(url);
        return;
    }

    // Check if it's a playlist
    if (isSpotifyPlaylistUrl(url)) {
        await addPlaylist(url);
        return;
    }

    // Fetch track metadata first
    const trackInfo = await fetchTrackMetadata(url);

    // Emit add-track event - this will be handled by socket manager
    if (window.socket && window.roomId) {
        window.socket.emit('add-track', {
            roomId: window.roomId,
            trackUrl: url,
            trackInfo,
            platform: 'spotify'
        });
    }
}

// Add album tracks
async function addAlbum(url) {
    try {
        showSuccess('Fetching album tracks...');

        const trackInfo = await fetchTrackMetadata(url);
        const { tracks, title } = trackInfo;

        if (!tracks || tracks.length === 0) {
            showError('Album is empty or could not be loaded');
            return;
        }

        // Add all tracks to queue
        let addedCount = 0;

        for (const track of tracks) {
            try {
                const trackUrl = `https://open.spotify.com/track/${track.id}`;
                const trackMetadata = {
                    title: track.name,
                    artist: track.artists.map(artist => artist.name).join(', '),
                    fullTitle: `${track.artists.map(artist => artist.name).join(', ')} - ${track.name}`,
                    url: trackUrl,
                    thumbnail: trackInfo.thumbnail,
                    platform: 'spotify'
                };

                if (window.socket && window.roomId) {
                    window.socket.emit('add-track', {
                        roomId: window.roomId,
                        trackUrl: trackUrl,
                        trackInfo: trackMetadata,
                        platform: 'spotify'
                    });
                }

                addedCount++;

                // Small delay to avoid overwhelming
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error('Error adding track from album:', error);
            }
        }

        showSuccess(`Added ${addedCount} track${addedCount === 1 ? '' : 's'} from album "${title}"`);
    } catch (error) {
        console.error('Error fetching album:', error);
        showError('Failed to load album');
    }
}

// Add playlist tracks
async function addPlaylist(url) {
    try {
        showSuccess('Fetching playlist tracks...');

        const trackInfo = await fetchTrackMetadata(url);
        const { tracks, title } = trackInfo;

        if (!tracks || tracks.length === 0) {
            showError('Playlist is empty or could not be loaded');
            return;
        }

        // Add all tracks to queue
        let addedCount = 0;

        for (const item of tracks) {
            try {
                const track = item.track || item; // Handle different response formats
                const trackUrl = `https://open.spotify.com/track/${track.id}`;
                const trackMetadata = {
                    title: track.name,
                    artist: track.artists.map(artist => artist.name).join(', '),
                    fullTitle: `${track.artists.map(artist => artist.name).join(', ')} - ${track.name}`,
                    url: trackUrl,
                    thumbnail: track.album?.images?.[0]?.url || trackInfo.thumbnail,
                    platform: 'spotify'
                };

                if (window.socket && window.roomId) {
                    window.socket.emit('add-track', {
                        roomId: window.roomId,
                        trackUrl: trackUrl,
                        trackInfo: trackMetadata,
                        platform: 'spotify'
                    });
                }

                addedCount++;

                // Small delay to avoid overwhelming
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error('Error adding track from playlist:', error);
            }
        }

        showSuccess(`Added ${addedCount} track${addedCount === 1 ? '' : 's'} from playlist "${title}"`);
    } catch (error) {
        console.error('Error fetching playlist:', error);
        showError('Failed to load playlist');
    }
}

// Export functions
export { initSpotifyManager };
