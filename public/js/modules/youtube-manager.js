// YouTube integration functionality using YouTube IFrame API
import { showError, showSuccess } from './ui-utils.js';

// YouTube IFrame API variables
let player = null;
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
let apiReady = false;

// DOM elements
const currentTrackDiv = document.getElementById('current-track');

// Store updateCurrentTrackDisplay callback in module scope
let updateCurrentTrackDisplayCallback = null;

// Initialize YouTube manager
function initYouTubeManager(deps) {
    // Dependencies will be passed from main app
    const socket = deps.socket;
    const roomId = deps.roomId;
    updateCurrentTrackDisplayCallback = deps.updateCurrentTrackDisplay;

    // Load YouTube IFrame API if not already loaded
    if (!window.YT || !window.YT.Player) {
        loadYouTubeAPI();
    } else {
        apiReady = true;
    }

    return {
        player,
        currentTrackId,
        isCurrentlyPlaying,
        currentRoomIsPlaying,
        widgetReady: () => widgetReady,
        loadTrack,
        playTrack,
        updateCurrentTrackDisplay: updateCurrentTrackDisplayCallback,
        fetchTrackMetadata,
        addTrack,
        extractYouTubeUrls,
        normalizeYouTubeUrl,
        isValidYouTubeUrl,
        isPlaylistUrl: isYouTubePlaylistUrl,
        convertToVideoId,
        initializePlayer,
        updatePlayPauseButton: updatePlayPauseButton
    };
}

// Load YouTube IFrame API
function loadYouTubeAPI() {
    if (window.YT && window.YT.Player) {
        apiReady = true;
        return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    // Set up callback for when API is ready
    window.onYouTubeIframeAPIReady = () => {
        apiReady = true;
        console.log('YouTube IFrame API ready');
    };
}

// Update current track display (fallback if callback not set)
function updateCurrentTrackDisplay(title, url) {
    if (updateCurrentTrackDisplayCallback) {
        updateCurrentTrackDisplayCallback(title, url);
    } else {
        currentTrackDiv.innerHTML = `
            <p><strong>Now Playing:</strong> ${title}</p>
            <p style="font-size: 0.9em; margin-top: 5px;"><a href="${url}" target="_blank">View on YouTube</a></p>
        `;
    }
}

// Helper function to update play/pause button
function updatePlayPauseButton(isPlaying) {
    const playPauseBtn = document.getElementById('play-pause-btn');
    const icon = playPauseBtn.querySelector('.material-icons');
    if (isPlaying) {
        if (icon) icon.textContent = 'pause';
        const textNodes = Array.from(playPauseBtn.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
        if (textNodes.length > 0) {
            textNodes[0].textContent = ' Pause';
        } else {
            playPauseBtn.appendChild(document.createTextNode(' Pause'));
        }
    } else {
        if (icon) icon.textContent = 'play_arrow';
        const textNodes = Array.from(playPauseBtn.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
        if (textNodes.length > 0) {
            textNodes[0].textContent = ' Play';
        } else {
            playPauseBtn.appendChild(document.createTextNode(' Play'));
        }
    }
}

// Extract YouTube video ID from URL
function extractVideoId(url) {
    if (!url) return null;

    // Handle various YouTube URL formats
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

// Convert YouTube URL to video ID
function convertToVideoId(url) {
    return extractVideoId(url);
}

// Extract all YouTube URLs from text
function extractYouTubeUrls(text) {
    if (!text || typeof text !== 'string') {
        return [];
    }

    const urls = [];
    const patterns = [
        /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/gi,
        /https?:\/\/(?:www\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/gi,
        /https?:\/\/(?:www\.)?youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)/gi
    ];

    patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const url = match[0].trim();
            if (!urls.includes(url)) {
                urls.push(url);
            }
        }
    });

    return [...new Set(urls)];
}

// Normalize YouTube URL
function normalizeYouTubeUrl(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }

    url = url.trim();

    // If it's just a video ID, convert to full URL
    const videoId = extractVideoId(url);
    if (videoId && url.length === 11 && !url.includes('://')) {
        return `https://www.youtube.com/watch?v=${videoId}`;
    }

    // Ensure https protocol
    if (url.match(/^(www\.)?youtube\.com\//i) && !url.match(/^https?:\/\//i)) {
        url = `https://${url}`;
    }

    if (url.match(/^youtu\.be\//i) && !url.match(/^https?:\/\//i)) {
        url = `https://${url}`;
    }

    return url;
}

// Validate YouTube URL
function isValidYouTubeUrl(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }

    url = normalizeYouTubeUrl(url);
    if (!url) {
        return false;
    }

    const videoId = extractVideoId(url);
    return videoId !== null && videoId.length === 11;
}

// Check if URL is a YouTube playlist
function isYouTubePlaylistUrl(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }

    url = normalizeYouTubeUrl(url);
    if (!url) {
        return false;
    }

    return url.includes('/playlist?list=') || url.includes('&list=');
}

// Fetch track metadata from YouTube
async function fetchTrackMetadata(url) {
    try {
        const videoId = extractVideoId(url);
        if (!videoId) {
            throw new Error('Invalid YouTube URL');
        }

        // Use YouTube oEmbed API for metadata
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        
        const response = await fetch(oembedUrl);
        if (!response.ok) {
            throw new Error(`YouTube API error: ${response.status}`);
        }

        const data = await response.json();
        
        return {
            title: data.title || 'Unknown Track',
            artist: data.author_name || null,
            fullTitle: data.title || 'Unknown Track',
            url: url,
            thumbnail: data.thumbnail_url || null,
            videoId: videoId
        };
    } catch (error) {
        console.error('Error fetching YouTube metadata:', error);
        // Fallback: try to extract from URL
        const videoId = extractVideoId(url);
        return {
            title: 'Unknown Track',
            artist: null,
            fullTitle: 'Unknown Track',
            url: url,
            thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null,
            videoId: videoId
        };
    }
}

// Initialize YouTube player
function initializePlayer() {
    return new Promise((resolve, reject) => {
        // Wait for API to be ready
        const checkAPI = () => {
            if (window.YT && window.YT.Player) {
                apiReady = true;
                resolve();
            } else {
                setTimeout(checkAPI, 100);
            }
        };

        if (apiReady && window.YT && window.YT.Player) {
            resolve();
        } else {
            // Set up callback if not already set
            if (!window.onYouTubeIframeAPIReady) {
                window.onYouTubeIframeAPIReady = () => {
                    apiReady = true;
                    resolve();
                };
            }
            checkAPI();
        }
    });
}

// Load track in YouTube player
async function loadTrack(url, trackInfo, onLoaded) {
    // Ensure API is ready
    if (!apiReady || !window.YT || !window.YT.Player) {
        console.log('YouTube API not ready, initializing...');
        try {
            await initializePlayer();
        } catch (error) {
            console.error('Failed to initialize YouTube API:', error);
            showError('Failed to initialize YouTube player. Please refresh the page.');
            return;
        }
    }

    // Update track display if trackInfo is available
    if (trackInfo) {
        const displayTitle = trackInfo.fullTitle || (trackInfo.artist ? `${trackInfo.artist} - ${trackInfo.title}` : trackInfo.title) || 'Unknown Track';
        updateCurrentTrackDisplay(displayTitle, url);
    }

    // Clear previous position sync interval
    if (positionSyncInterval) {
        clearInterval(positionSyncInterval);
        positionSyncInterval = null;
    }

    // Get video ID
    const videoId = extractVideoId(url);
    if (!videoId) {
        showError('Invalid YouTube URL');
        return;
    }

    // Remove existing player
    const playerContainer = document.getElementById('soundcloud-widget'); // Reuse same container
    playerContainer.innerHTML = '';

    // Create new player div
    const playerDiv = document.createElement('div');
    playerDiv.id = 'youtube-player';
    playerContainer.appendChild(playerDiv);

    // Create YouTube player
    try {
        player = new window.YT.Player('youtube-player', {
            height: '400',
            width: '100%',
            videoId: videoId,
            playerVars: {
                autoplay: 0,
                controls: 1,
                rel: 0,
                modestbranding: 1,
                enablejsapi: 1,
                origin: window.location.origin
            },
            events: {
                onReady: (event) => {
                    widgetReady = true;
                    currentTrackId = url;
                    console.log('YouTube player ready');
                    if (onLoaded) {
                        setTimeout(() => {
                            onLoaded();
                        }, 500);
                    }
                },
                onStateChange: (event) => {
                    // YouTube player states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
                    if (event.data === window.YT.PlayerState.PLAYING) {
                        isCurrentlyPlaying = true;
                        updatePlayPauseButton(true);
                    } else if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
                        isCurrentlyPlaying = false;
                        updatePlayPauseButton(false);
                    }
                },
                onError: (event) => {
                    console.error('YouTube player error:', event.data);
                    showError('Failed to load YouTube video');
                }
            }
        });
    } catch (error) {
        console.error('Error creating YouTube player:', error);
        showError('Failed to create YouTube player');
    }
}

// Play track
function playTrack() {
    if (player && widgetReady) {
        try {
            player.playVideo();
            isCurrentlyPlaying = true;
            updatePlayPauseButton(true);
        } catch (error) {
            console.error('Error playing YouTube video:', error);
        }
    }
}

// Add track function
async function addTrack(url) {
    // Trim and validate YouTube URL
    if (!url) {
        showError('Please enter a YouTube URL');
        return;
    }

    // Normalize the URL first
    url = normalizeYouTubeUrl(url);

    if (!url || !isValidYouTubeUrl(url)) {
        showError('Please enter a valid YouTube URL');
        console.log('Invalid URL:', url);
        return;
    }

    // Check if it's a playlist
    if (isYouTubePlaylistUrl(url)) {
        showError('YouTube playlists are not yet supported. Please add individual video URLs.');
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
            platform: 'youtube'
        });
    }
}

// Export functions
export { initYouTubeManager };

