// SoundCloud integration functionality
import { showError, showSuccess } from './ui-utils.js';

// SoundCloud Widget API variables
let widget = null;
let currentTrackId = null;
let isSyncing = false;
let positionSyncInterval = null;
let isCurrentlyPlaying = false;
let isInitialLoad = false; // Track if we're in initial load phase
let initialLoadComplete = false; // Track when initial load is done
let widgetReady = false; // Track if widget is ready to receive commands
let pendingPlayCommand = false; // Track if there's a pending play command
let expectingPlayCommand = false; // Track if we're expecting a play command after track change
let currentRoomIsPlaying = false; // Track the room's playing state from Supabase
let lastPauseTime = 0; // Track when widget last paused to prevent immediate retries

// DOM elements
const currentTrackDiv = document.getElementById('current-track');

// Store updateCurrentTrackDisplay callback in module scope
let updateCurrentTrackDisplayCallback = null;

// Initialize SoundCloud manager
function initSoundCloudManager(deps) {
    // Dependencies will be passed from main app
    const socket = deps.socket;
    const roomId = deps.roomId;
    updateCurrentTrackDisplayCallback = deps.updateCurrentTrackDisplay;

    return {
        widget,
        currentTrackId,
        isCurrentlyPlaying,
        currentRoomIsPlaying,
        loadTrack,
        playTrack,
        updateCurrentTrackDisplay: updateCurrentTrackDisplayCallback,
        fetchTrackMetadata,
        addTrack,
        extractSoundCloudUrls,
        normalizeSoundCloudUrl,
        isValidSoundCloudUrl,
        isPlaylistUrl,
        isProfileUrl,
        addPlaylist,
        addProfile,
        convertToEmbedUrl,
        initializeWidget,
        updatePlayPauseButton: updatePlayPauseButton
    };
}

// Update current track display (fallback if callback not set)
function updateCurrentTrackDisplay(title, url) {
    if (updateCurrentTrackDisplayCallback) {
        updateCurrentTrackDisplayCallback(title, url);
    } else {
        currentTrackDiv.innerHTML = `
            <p><strong>Now Playing:</strong> ${title}</p>
            <p style="font-size: 0.9em; margin-top: 5px;"><a href="${url}" target="_blank">View on SoundCloud</a></p>
        `;
    }
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

// Fetch track metadata from SoundCloud oEmbed API
async function fetchTrackMetadata(url) {
    try {
        // Try server proxy first (avoids CORS issues)
        try {
            const proxyResponse = await fetch('/api/soundcloud-oembed', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url })
            });

            if (proxyResponse.ok) {
                const data = await proxyResponse.json();
                console.log('oEmbed response data:', data);
                if (data && data.title) {
                    return parseOEmbedResponse(data, url);
                } else {
                    console.warn('oEmbed response missing title:', data);
                    // Try resolve endpoint as fallback
                    return await fetchTrackMetadataViaResolve(url);
                }
            } else {
                const errorData = await proxyResponse.json().catch(() => ({}));
                console.error('oEmbed proxy error:', proxyResponse.status, errorData);
                // Try resolve endpoint as fallback
                return await fetchTrackMetadataViaResolve(url);
            }
        } catch (proxyError) {
            console.log('Server proxy failed, trying direct oEmbed:', proxyError);
        }

        // Try direct oEmbed API (POST method as shown in SoundCloud documentation)
        const oembedUrl = 'https://soundcloud.com/oembed';
        const formData = new URLSearchParams();
        formData.append('format', 'json');
        formData.append('url', url);

        let response;
        try {
            // Try POST with form data (recommended by SoundCloud docs)
            response = await fetch(oembedUrl, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Accept': 'application/json'
                },
                body: formData
            });
        } catch (postError) {
            // Fallback to GET if POST fails
            console.log('POST method failed, trying GET:', postError);
            const getUrl = `${oembedUrl}?url=${encodeURIComponent(url)}&format=json`;
            response = await fetch(getUrl, {
                method: 'GET',
                mode: 'cors',
                headers: {
                    'Accept': 'application/json'
                }
            });
        }

        if (!response.ok) {
            throw new Error(`oEmbed API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('Direct oEmbed response data:', data);
        if (data && data.title) {
            return parseOEmbedResponse(data, url);
        } else {
            console.warn('Direct oEmbed response missing title:', data);
            // Try resolve endpoint as fallback
            return await fetchTrackMetadataViaResolve(url);
        }
    } catch (error) {
        console.error('Error fetching track metadata:', error);
        // Try resolve endpoint as fallback
        try {
            return await fetchTrackMetadataViaResolve(url);
        } catch (resolveError) {
            console.error('Resolve endpoint also failed:', resolveError);
            // Try JSONP fallback if CORS fails
            return await fetchTrackMetadataJSONP(url).catch(() => {
                // Return fallback info if all methods fail
                return {
                    title: 'Unknown Track',
                    artist: null,
                    fullTitle: 'Unknown Track',
                    url: url,
                    thumbnail: null
                };
            });
        }
    }
}

// Parse oEmbed response into track info format
function parseOEmbedResponse(data, url) {
    // Extract title from oEmbed response
    // The title is usually in the format "Artist - Track Title" or just "Track Title"
    let title = data.title || 'Unknown Track';

    // If still no title, try extracting from HTML if available
    if (title === 'Unknown Track' && data.html) {
        // Try to extract title from embed HTML
        const titleMatch = data.html.match(/title="([^"]+)"/);
        if (titleMatch) {
            title = titleMatch[1];
        }
    }

    // Try to extract artist and track separately if possible
    // oEmbed title format is usually "Artist - Track Title"
    const titleParts = title.split(' - ');
    const artist = titleParts.length > 1 ? titleParts[0] : null;
    const trackTitle = titleParts.length > 1 ? titleParts.slice(1).join(' - ') : title;

    return {
        title: trackTitle,
        artist: artist,
        fullTitle: title,
        url: url,
        thumbnail: data.thumbnail_url || null
    };
}

// Fetch track metadata using SoundCloud /resolve endpoint
async function fetchTrackMetadataViaResolve(url) {
    try {
        // Try server-side resolve endpoint (if client_id is configured)
        const resolveResponse = await fetch('/api/soundcloud-resolve', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        if (resolveResponse.ok) {
            const data = await resolveResponse.json();
            if (data && data.title) {
                return {
                    title: data.title,
                    artist: data.user ? data.user.username : null,
                    fullTitle: data.user ? `${data.user.username} - ${data.title}` : data.title,
                    url: url,
                    thumbnail: data.artwork_url || data.user?.avatar_url || null
                };
            }
        }
    } catch (error) {
        console.log('Resolve endpoint not available or failed:', error);
    }

    // If resolve fails, return null to trigger fallback
    throw new Error('Resolve endpoint failed');
}

// Fallback: Fetch track metadata using JSONP
function fetchTrackMetadataJSONP(url) {
    return new Promise((resolve, reject) => {
        const callbackName = `soundcloud_oembed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const script = document.createElement('script');

        window[callbackName] = (data) => {
            delete window[callbackName];
            document.body.removeChild(script);

            resolve(parseOEmbedResponse(data, url));
        };

        script.onerror = () => {
            delete window[callbackName];
            document.body.removeChild(script);
            reject(new Error('JSONP request failed'));
        };

        const oembedUrl = `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=js&callback=${callbackName}`;
        script.src = oembedUrl;
        document.body.appendChild(script);

        // Timeout after 10 seconds
        setTimeout(() => {
            if (window[callbackName]) {
                delete window[callbackName];
                document.body.removeChild(script);
                reject(new Error('JSONP request timeout'));
            }
        }, 10000);
    });
}

// Extract all SoundCloud URLs from text
function extractSoundCloudUrls(text) {
    if (!text || typeof text !== 'string') {
        return [];
    }

    const urls = [];

    // Pattern 1: Full URLs (https://soundcloud.com/... or https://on.soundcloud.com/...)
    const fullUrlPattern = /https?:\/\/(www\.)?(soundcloud\.com|on\.soundcloud\.com|snd\.sc)\/[^\s\n\t]+/gi;
    const fullUrls = text.match(fullUrlPattern) || [];
    fullUrls.forEach(url => {
        const cleanUrl = url.trim();
        if (!urls.includes(cleanUrl)) {
            urls.push(cleanUrl);
        }
    });

    // Pattern 2: on.soundcloud.com/XXXXX format (most common in pasted text)
    const onSoundCloudPattern = /on\.soundcloud\.com\/[a-zA-Z0-9]+/gi;
    let match;
    while ((match = onSoundCloudPattern.exec(text)) !== null) {
        const url = match[0].trim();
        const fullUrl = `https://${url}`;
        if (!urls.includes(fullUrl)) {
            urls.push(fullUrl);
        }
    }

    // Pattern 3: soundcloud.com/... without protocol (but not on.soundcloud.com which is handled above)
    const soundcloudPattern = /(?:^|\s|>)(soundcloud\.com\/[a-zA-Z0-9\/\-_\.]+)/gi;
    while ((match = soundcloudPattern.exec(text)) !== null) {
        const url = match[1].trim();
        // Skip if it's on.soundcloud.com (already handled)
        if (!url.startsWith('on.')) {
            const fullUrl = `https://${url}`;
            if (!urls.includes(fullUrl)) {
                urls.push(fullUrl);
            }
        }
    }

    // Pattern 4: snd.sc short links
    const sndScPattern = /snd\.sc\/[a-zA-Z0-9]+/gi;
    while ((match = sndScPattern.exec(text)) !== null) {
        const url = match[0].trim();
        const fullUrl = `https://${url}`;
        if (!urls.includes(fullUrl)) {
            urls.push(fullUrl);
        }
    }

    // Remove duplicates and return
    return [...new Set(urls)];
}

// Normalize URL (convert short links to full URLs, clean up)
function normalizeSoundCloudUrl(url) {
    if (!url || typeof url !== 'string') {
        return null;
    }

    url = url.trim();

    // If it's a short link without protocol, add https://
    if (url.match(/^(on\.)?soundcloud\.com\//i) && !url.match(/^https?:\/\//i)) {
        url = `https://${url}`;
    }

    return url;
}

// Validate SoundCloud URL
function isValidSoundCloudUrl(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }

    // Normalize first
    url = normalizeSoundCloudUrl(url);
    if (!url) {
        return false;
    }

    // Match standard SoundCloud URLs and private/shared links
    const soundcloudPattern = /^https?:\/\/(www\.)?(soundcloud\.com|on\.soundcloud\.com|snd\.sc)\/.+/i;

    if (!soundcloudPattern.test(url)) {
        return false;
    }

    // Additional check: make sure it's not just the domain
    const pathMatch = url.match(/(?:soundcloud\.com|on\.soundcloud\.com|snd\.sc)\/(.+)/i);
    if (!pathMatch || pathMatch[1].length < 1) {
        return false;
    }

    return true;
}

// Check if URL is a SoundCloud playlist
function isPlaylistUrl(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }

    // Normalize first
    url = normalizeSoundCloudUrl(url);
    if (!url) {
        return false;
    }

    // SoundCloud playlists have paths like:
    // - soundcloud.com/user/sets/playlist-name
    // - soundcloud.com/user/playlists/playlist-name
    const playlistPattern = /soundcloud\.com\/[^\/]+\/(sets|playlists)\//i;
    return playlistPattern.test(url);
}

// Check if URL is a SoundCloud profile
function isProfileUrl(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }

    // Normalize first
    url = normalizeSoundCloudUrl(url);
    if (!url) {
        return false;
    }

    // Exclude playlists (they have /sets/ or /playlists/ in the path)
    if (url.includes('/sets/') || url.includes('/playlists/')) {
        return false;
    }

    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(p => p); // Remove empty parts

        // Profile URLs can be:
        // 1. Single segment: soundcloud.com/vera-molland
        // 2. Two segments ending in /tracks: soundcloud.com/vera-molland/tracks
        // 3. Two segments ending in /popular-tracks: soundcloud.com/vera-molland/popular-tracks
        // Tracks typically have 2 segments where the second is NOT a known profile page: soundcloud.com/user/track-name

        if (pathParts.length === 1) {
            // Single segment - definitely a profile
            return true;
        }

        if (pathParts.length === 2) {
            // Two segments - check if second part is a profile page indicator
            const secondPart = pathParts[1].toLowerCase();
            const profilePages = ['tracks', 'popular-tracks', 'albums', 'sets', 'playlists', 'reposts', 'followers', 'following'];

            if (profilePages.includes(secondPart)) {
                // This is a profile page (e.g., /tracks, /popular-tracks)
                return true;
            }

            // If second part doesn't match profile pages, it's likely a track
            return false;
        }

        // More than 2 segments is likely a track or something else
        return false;
    } catch (e) {
        // If URL parsing fails, fall back to regex pattern
        const profilePattern = /^https?:\/\/(www\.)?(soundcloud\.com|on\.soundcloud\.com)\/[^\/]+(\/(tracks|popular-tracks|albums|sets|playlists|reposts|followers|following))?$/i;
        return profilePattern.test(url);
    }
}

// Convert SoundCloud URL to embed format
function convertToEmbedUrl(url) {
    try {
        const urlObj = new URL(url);

        // Check if this is a private/shared track (has /s- segment)
        const pathParts = urlObj.pathname.split('/').filter(p => p); // Remove empty parts
        const sIndex = pathParts.findIndex(part => part.startsWith('s-'));

        if (sIndex !== -1) {
            // This is a private/shared track
            // For private tracks, try the full URL with share token
            const fullPath = pathParts.join('/');
            const fullUrl = `${urlObj.protocol}//${urlObj.host}/${fullPath}`;

            console.log('Private/shared track - using full URL with share token:', fullUrl);
            return fullUrl;
        }

        // For regular public tracks, preserve query parameters (they may be needed)
        // Remove trailing .mp3 or other file extensions from pathname if present
        let cleanPath = urlObj.pathname;
        // Remove file extensions like .mp3, .wav, etc. from the end
        cleanPath = cleanPath.replace(/\.(mp3|wav|flac|m4a|ogg)$/i, '');

        // Preserve query parameters (e.g., ?si=... for share tokens)
        const cleanUrl = `${urlObj.protocol}//${urlObj.host}${cleanPath}${urlObj.search}`;
        console.log('Cleaned URL for embedding (preserving query params):', cleanUrl);
        return cleanUrl;
    } catch (e) {
        // If URL parsing fails, return as-is
        console.error('Error parsing URL:', e);
        return url;
    }
}

// Load track in SoundCloud widget
function loadTrack(url, trackInfo, onLoaded) {
    // Check if SoundCloud API is loaded
    if (typeof SC === 'undefined' || !SC.Widget) {
        console.error('SoundCloud Widget API not loaded');
        showError('SoundCloud API failed to load. Please refresh the page.');
        return;
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

    // Remove existing widget
    const widgetContainer = document.getElementById('soundcloud-widget');
    widgetContainer.innerHTML = '';

    // Check if this is a private/shared track (has /s- segment)
    const isPrivateTrack = url.includes('/s-');

    if (isPrivateTrack) {
        // Use oEmbed API for private tracks (recommended by SoundCloud)
        console.log('Private track detected, using oEmbed API');
        loadTrackViaOEmbed(url, widgetContainer, onLoaded);
    } else {
        // Use direct embed for public tracks
        loadTrackDirect(url, widgetContainer, onLoaded);
    }
}

// Load track using oEmbed API (for private/shared tracks)
function loadTrackViaOEmbed(url, widgetContainer, onLoaded) {
    console.log('Private track detected, trying oEmbed API via server proxy...');

    // Use server proxy to avoid CORS issues
    const proxyUrl = '/api/soundcloud-oembed';

    // Try POST method first (recommended)
    fetch(proxyUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            url: url,
            maxheight: '400',
            auto_play: 'false',
            show_comments: 'true'
        })
    })
        .then(response => {
            if (!response.ok) {
                // If POST fails, try GET
                console.log('POST method failed, trying GET:', response.status);
                const getUrl = `${proxyUrl}?url=${encodeURIComponent(url)}&format=json&maxheight=400&auto_play=false&show_comments=true`;
                return fetch(getUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });
            }
            return response;
        })
        .then(response => {
            console.log('oEmbed response status:', response.status);
            if (!response.ok) {
                throw new Error(`oEmbed API error: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('oEmbed response received:', data);

            if (!data || !data.html) {
                throw new Error('No HTML in oEmbed response');
            }

            // Extract the embed HTML from oEmbed response
            const embedHtml = data.html;

            // Create a temporary container to parse the embed HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = embedHtml;
            const iframe = tempDiv.querySelector('iframe');

            if (!iframe) {
                throw new Error('No iframe found in oEmbed response');
            }

            // Clone and configure the iframe
            const newIframe = iframe.cloneNode(true);
            newIframe.width = '100%';
            newIframe.height = '400';
            newIframe.allow = 'autoplay';
            // Add mobile-friendly attributes
            newIframe.setAttribute('allowfullscreen', '');

            // Force browser playback by modifying the iframe src
            // Add parameters to prevent SoundCloud app redirect
            if (newIframe.src) {
                const url = new URL(newIframe.src);
                url.searchParams.set('buying', 'false');
                url.searchParams.set('sharing', 'false');
                url.searchParams.set('download', 'false');
                url.searchParams.set('single_active', 'false');
                url.searchParams.set('show_teaser', 'false'); // Hide "Listen in browser" overlay on mobile
                // Ensure it plays in browser, not app
                newIframe.src = url.toString();
            }

            // Handle iframe load errors (especially on mobile)
            newIframe.onerror = () => {
                console.error('oEmbed iframe failed to load');
                widgetContainer.innerHTML = '<p style="padding: 20px; text-align: center;">Failed to load SoundCloud player. Please try refreshing the page.</p>';
            };

            widgetContainer.appendChild(newIframe);

            // Initialize widget API after iframe loads
            newIframe.onload = () => {
                console.log('oEmbed iframe loaded, initializing widget...');
                initializeWidget(newIframe, url, onLoaded);
            };
        })
        .catch(error => {
            console.error('oEmbed API failed:', error);
            console.log('Falling back to direct embed with full URL...');
            // Fallback: try direct embed with the full private URL
            loadTrackDirect(url, widgetContainer, onLoaded);
        });
}

// Load track using direct embed (for public tracks or fallback)
function loadTrackDirect(url, widgetContainer, onLoaded) {
    // Create new iframe
    const iframe = document.createElement('iframe');
    iframe.width = '100%';
    iframe.height = '400';
    iframe.scrolling = 'no';
    iframe.frameBorder = 'no';
    iframe.allow = 'autoplay';
    // Add mobile-friendly attributes
    iframe.setAttribute('allowfullscreen', '');

    // Convert SoundCloud URL to embed format
    const embedUrl = convertToEmbedUrl(url);
    // Force browser playback (not SoundCloud app) and configure player
    // Added mobile-friendly parameters - show_teaser=false hides "Listen in browser" overlay on mobile
    iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(embedUrl)}&color=%23667eea&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=false&visual=true&buying=false&sharing=false&download=false&show_artwork=true&single_active=false`;

    widgetContainer.appendChild(iframe);

    // Initialize widget API after iframe loads
    iframe.onload = () => {
        initializeWidget(iframe, url, onLoaded);
    };

    // Handle iframe load errors (especially on mobile)
    iframe.onerror = () => {
        console.error('Iframe failed to load');
        widgetContainer.innerHTML = '<p style="padding: 20px; text-align: center;">Failed to load SoundCloud player. Please try refreshing the page.</p>';
    };
}

// Initialize SoundCloud widget and set up event listeners
function initializeWidget(iframe, url, onLoaded) {
    try {
        // Initialize widget API
        widget = SC.Widget(iframe);

        // Set up widget event listeners - this will be completed in the next part
        // due to the large size of this function

        // Call onLoaded callback if provided
        if (onLoaded) {
            widget.bind(SC.Widget.Events.READY, () => {
                setTimeout(() => {
                    onLoaded();
                }, 500);
            });
        }

        currentTrackId = url;
    } catch (error) {
        console.error('Error initializing SoundCloud widget:', error);
        showError('Failed to load track. Please try again.');
    }
}

// Play track
function playTrack() {
    if (widget) {
        widget.play();
        isCurrentlyPlaying = true;
        updatePlayPauseButton(true);
    }
}

// Add track function
async function addTrack(url) {
    // Trim and validate SoundCloud URL
    if (!url) {
        showError('Please enter a SoundCloud URL');
        return;
    }

    // Normalize the URL first
    url = normalizeSoundCloudUrl(url);

    if (!url || !isValidSoundCloudUrl(url)) {
        showError('Please enter a valid SoundCloud URL (including private/shared links)');
        console.log('Invalid URL:', url);
        return;
    }

    // Check if it's a playlist
    if (isPlaylistUrl(url)) {
        await addPlaylist(url);
        return;
    }

    // Check if it's a profile
    if (isProfileUrl(url)) {
        await addProfile(url);
        return;
    }

    // Fetch track metadata first
    const trackInfo = await fetchTrackMetadata(url);

    // Emit add-track event - this will be handled by socket manager
    if (window.socket && window.roomId) {
        window.socket.emit('add-track', {
            roomId: window.roomId,
            trackUrl: url,
            trackInfo
        });
    }
}

// Add playlist tracks
async function addPlaylist(url) {
    try {
        showSuccess('Fetching playlist tracks...');

        const response = await fetch('/api/soundcloud-playlist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to fetch playlist: ${response.status}`);
        }

        const data = await response.json();
        const { tracks, playlistTitle } = data;

        if (!tracks || tracks.length === 0) {
            showError('Playlist is empty or could not be loaded');
            return;
        }

        // Add all tracks to queue with full metadata
        let addedCount = 0;
        let failedCount = 0;

        // Process tracks sequentially to avoid overwhelming the server
        for (const track of tracks) {
            try {
                // Fetch full track metadata
                let trackInfo = await fetchTrackMetadata(track.url);

                // Use scraped info as fallback if metadata fetch fails or is incomplete
                if (!trackInfo || !trackInfo.title || trackInfo.title === 'Unknown Track') {
                    trackInfo = {
                        title: track.title || 'Unknown Track',
                        artist: track.artist || null,
                        fullTitle: track.fullTitle || track.title || 'Unknown Track',
                        url: track.url,
                        thumbnail: track.thumbnail || null
                    };
                } else {
                    // Ensure URL is set even if metadata was fetched
                    trackInfo.url = track.url;
                }

                if (window.socket && window.roomId) {
                    window.socket.emit('add-track', {
                        roomId: window.roomId,
                        trackUrl: track.url,
                        trackInfo
                    });
                }

                addedCount++;

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error('Error adding track from playlist:', error);
                // Try to add with basic info if metadata fetch fails
                try {
                    const trackInfo = {
                        title: track.title || 'Unknown Track',
                        artist: track.artist || null,
                        fullTitle: track.fullTitle || track.title || 'Unknown Track',
                        url: track.url,
                        thumbnail: track.thumbnail || null
                    };

                    if (window.socket && window.roomId) {
                        window.socket.emit('add-track', {
                            roomId: window.roomId,
                            trackUrl: track.url,
                            trackInfo
                        });
                    }
                    addedCount++;
                } catch (fallbackError) {
                    console.error('Failed to add track even with fallback:', fallbackError);
                    failedCount++;
                }
            }
        }

        // Show success message
        if (addedCount > 0) {
            showSuccess(`Added ${addedCount} track${addedCount === 1 ? '' : 's'} from playlist "${playlistTitle}"`);
        }

        if (failedCount > 0) {
            console.warn(`Failed to add ${failedCount} track(s) from playlist`);
        }
    } catch (error) {
        console.error('Error fetching playlist:', error);
        showError(error.message || 'Failed to load playlist. Make sure Python is installed and scrape_soundcloud.py is available.');
    }
}

// Add profile tracks
async function addProfile(url) {
    try {
        showSuccess('Fetching profile tracks...');

        const response = await fetch('/api/soundcloud-profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to fetch profile: ${response.status}`);
        }

        const data = await response.json();
        const { tracks, profileName } = data;

        if (!tracks || tracks.length === 0) {
            showError('Profile has no tracks or could not be loaded');
            return;
        }

        // Add all tracks to queue with full metadata
        let addedCount = 0;
        let failedCount = 0;

        // Process tracks sequentially to avoid overwhelming the server
        for (const track of tracks) {
            try {
                // Fetch full track metadata
                let trackInfo = await fetchTrackMetadata(track.url);

                // Use scraped info as fallback if metadata fetch fails or is incomplete
                if (!trackInfo || !trackInfo.title || trackInfo.title === 'Unknown Track') {
                    trackInfo = {
                        title: track.title || 'Unknown Track',
                        artist: track.artist || null,
                        fullTitle: track.fullTitle || track.title || 'Unknown Track',
                        url: track.url,
                        thumbnail: track.thumbnail || null
                    };
                } else {
                    // Ensure URL is set even if metadata was fetched
                    trackInfo.url = track.url;
                }

                if (window.socket && window.roomId) {
                    window.socket.emit('add-track', {
                        roomId: window.roomId,
                        trackUrl: track.url,
                        trackInfo
                    });
                }

                addedCount++;

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error('Error adding track from profile:', error);
                // Try to add with basic info if metadata fetch fails
                try {
                    const trackInfo = {
                        title: track.title || 'Unknown Track',
                        artist: track.artist || null,
                        fullTitle: track.fullTitle || track.title || 'Unknown Track',
                        url: track.url,
                        thumbnail: track.thumbnail || null
                    };

                    if (window.socket && window.roomId) {
                        window.socket.emit('add-track', {
                            roomId: window.roomId,
                            trackUrl: track.url,
                            trackInfo
                        });
                    }
                    addedCount++;
                } catch (fallbackError) {
                    console.error('Failed to add track even with fallback:', fallbackError);
                    failedCount++;
                }
            }
        }

        // Show success message
        if (addedCount > 0) {
            showSuccess(`Added ${addedCount} track${addedCount === 1 ? '' : 's'} from profile "${profileName}"`);
        }

        if (failedCount > 0) {
            console.warn(`Failed to add ${failedCount} track(s) from profile`);
        }
    } catch (error) {
        console.error('Error fetching profile:', error);
        showError(error.message || 'Failed to load profile. Make sure Python is installed and scrape_soundcloud.py is available.');
    }
}

// Export functions
export { initSoundCloudManager };



