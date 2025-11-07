// Volume control functionality with Web Audio API
let currentVolume = 50; // Default volume
let audioContext = null;
let gainNode = null;
let mediaElementSource = null;
let volumeController = null;

// Initialize Web Audio API volume controller
function initVolumeController() {
    try {
        // Check if Web Audio API is supported
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
            console.log('Web Audio API not supported, using fallback volume control');
            return null;
        }

        audioContext = new AudioContext();

        // Create gain node for volume control
        gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
        gainNode.gain.value = currentVolume / 100;

        console.log('Volume controller initialized with Web Audio API');
        return {
            setVolume: (volume) => {
                if (gainNode) {
                    const volumeValue = Math.max(0, Math.min(1, volume / 100));
                    gainNode.gain.value = volumeValue;
                    console.log('Volume set to:', volumeValue);
                }
            },
            getVolume: () => {
                if (gainNode) {
                    return Math.round(gainNode.gain.value * 100);
                }
                return currentVolume;
            }
        };
    } catch (error) {
        console.warn('Failed to initialize Web Audio API volume controller:', error);
        return null;
    }
}

// Try to connect SoundCloud iframe audio to Web Audio API
function connectIframeAudio(widget) {
    if (!audioContext || !gainNode || !widget) return;

    try {
        const widgetContainer = document.getElementById('soundcloud-widget');
        const iframe = widgetContainer?.querySelector('iframe');

        if (!iframe) return;

        // Try to access iframe's audio element (may fail due to CORS)
        // This is a best-effort approach
        try {
            const iframeWindow = iframe.contentWindow;
            if (iframeWindow) {
                // Try to find audio elements in iframe (will fail on cross-origin)
                // This is just a fallback attempt
            }
        } catch (e) {
            // Expected: CORS prevents access to iframe content
            console.log('Cannot access iframe audio directly (CORS restriction)');
        }

        // Alternative: Use CSS to visually indicate volume (doesn't change actual audio)
        // But we'll still try Web Audio API methods when possible
        applyVolumeVisualFeedback(currentVolume);
    } catch (error) {
        console.warn('Failed to connect iframe audio:', error);
    }
}

// Apply visual feedback for volume (CSS-based, works as fallback)
// Note: This is just visual feedback - actual volume is controlled by SoundCloud Widget API
function applyVolumeVisualFeedback(volume) {
    const widgetContainer = document.getElementById('soundcloud-widget');
    if (!widgetContainer) return;

    // Use CSS opacity as visual indicator (0.5 to 1.0 range for better visibility)
    // Reduced opacity range so widget doesn't become too dim
    const opacity = 0.5 + (volume / 100) * 0.5;
    widgetContainer.style.opacity = opacity;

    // Subtle brightness adjustment for visual feedback
    const brightness = 0.7 + (volume / 100) * 0.3;
    widgetContainer.style.filter = `brightness(${brightness})`;
}

// Load volume from localStorage
function loadVolumePreference() {
    try {
        const savedVolume = localStorage.getItem('soundcloud-jukebox-volume');
        if (savedVolume !== null) {
            const volume = parseInt(savedVolume, 10);
            if (!isNaN(volume) && volume >= 0 && volume <= 100) {
                currentVolume = volume;
            }
        }
    } catch (e) {
        console.warn('Failed to load volume preference:', e);
    }
}

// Save volume preference to localStorage
function saveVolumePreference(volume) {
    try {
        localStorage.setItem('soundcloud-jukebox-volume', volume.toString());
    } catch (e) {
        console.warn('Failed to save volume preference:', e);
    }
}

// Initialize volume controller on page load
loadVolumePreference();
volumeController = initVolumeController();

// Initialize volume on widget ready
function initializeVolume(widget) {
    // Apply saved volume preference
    if (currentVolume !== undefined) {
        // Set volume using Web Audio API controller
        if (volumeController) {
            volumeController.setVolume(currentVolume);
        }

        // Apply visual feedback
        applyVolumeVisualFeedback(currentVolume);

        // Use SoundCloud Widget API for actual volume control
        if (widget) {
            try {
                const volumeDecimal = Math.max(0, Math.min(1, currentVolume / 100));
                widget.setVolume(volumeDecimal);
                console.log('SoundCloud widget volume initialized to:', volumeDecimal);
            } catch (error) {
                console.warn('SoundCloud widget volume initialization failed:', error);
            }
        }

        // Try to connect iframe audio
        setTimeout(() => {
            connectIframeAudio(widget);
        }, 1000);
    }
}

// Set up volume slider event listeners
function setupVolumeControls(socket, roomId) {
    const volumeSlider = document.getElementById('volume-slider');
    const volumeValue = document.getElementById('volume-value');

    if (volumeSlider) {
        // Handle both input and change events for better mobile support
        const handleVolumeChange = (e) => {
            const volume = parseInt(e.target.value);
            currentVolume = volume;
            if (volumeValue) volumeValue.textContent = volume + '%';

            // Save volume preference
            saveVolumePreference(volume);

            // Try to set volume using Web Audio API
            if (volumeController) {
                volumeController.setVolume(volume);
            }

            // Apply visual feedback
            applyVolumeVisualFeedback(volume);

            // Use SoundCloud Widget API for actual volume control
            // This is the only way to control volume of cross-origin iframe audio
            const widget = window.widget; // Access from global scope
            if (widget) {
                try {
                    // SoundCloud Widget API expects volume as a decimal (0.0 to 1.0)
                    const volumeDecimal = Math.max(0, Math.min(1, volume / 100));
                    widget.setVolume(volumeDecimal);
                    console.log('SoundCloud widget volume set to:', volumeDecimal);
                } catch (error) {
                    console.warn('SoundCloud widget volume control failed:', error);
                    // Fallback: visual feedback only
                }
            }

            // Try to connect iframe audio if not already connected
            if (widget && !mediaElementSource) {
                connectIframeAudio(widget);
            }

            // Broadcast volume change to server
            socket.emit('volume-change', {
                roomId: roomId,
                volume: volume
            });
        };

        volumeSlider.addEventListener('input', handleVolumeChange);
        volumeSlider.addEventListener('change', handleVolumeChange);

        // Support touch events for mobile
        volumeSlider.addEventListener('touchstart', (e) => {
            e.stopPropagation();
        });
        volumeSlider.addEventListener('touchend', (e) => {
            e.stopPropagation();
        });

        // Set initial volume
        volumeSlider.value = currentVolume;
        if (volumeValue) volumeValue.textContent = currentVolume + '%';
    }
}

// Export functions
export {
    currentVolume,
    volumeController,
    initVolumeController,
    connectIframeAudio,
    applyVolumeVisualFeedback,
    loadVolumePreference,
    saveVolumePreference,
    initializeVolume,
    setupVolumeControls
};


