// Room management functionality
let roomId;
let socket;
let queueList;
let widget;
let showError;
let updateCurrentTrackDisplay;

// Initialize room manager with dependencies
function initRoomManager(deps) {
    // Get URL params
    const urlParams = new URLSearchParams(window.location.search);

    // Get room ID from URL or create one
    roomId = urlParams.get('room') || localStorage.getItem('soundcloud-jukebox-room') || 'default-room';

    // Save room ID to localStorage for persistence
    localStorage.setItem('soundcloud-jukebox-room', roomId);

    // Set dependencies
    socket = deps.socket;
    queueList = deps.queueList;
    widget = deps.widget;
    showError = deps.showError;
    updateCurrentTrackDisplay = deps.updateCurrentTrackDisplay;

    // Room selector elements
    const roomInput = document.getElementById('room-input');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const createRoomBtn = document.getElementById('create-room-btn');
    const currentRoomNameSpan = document.getElementById('current-room-name');

    // Initialize room input with current room
    if (roomInput) {
        roomInput.value = roomId;
    }

    // Update current room display
    function updateCurrentRoomDisplay(roomName) {
        if (currentRoomNameSpan) {
            currentRoomNameSpan.textContent = roomName;
        }
        if (roomInput) {
            roomInput.value = roomName;
        }
    }

    // Join existing room
    function joinRoom(newRoomId) {
        if (!newRoomId || newRoomId.trim() === '') {
            showError('Please enter a room name');
            return;
        }

        newRoomId = newRoomId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

        if (newRoomId === roomId) {
            return; // Already in this room
        }

        // Leave current room
        if (socket.connected) {
            socket.emit('leave-room', { roomId });
        }

        // Update room ID
        roomId = newRoomId;
        localStorage.setItem('soundcloud-jukebox-room', roomId);
        updateCurrentRoomDisplay(roomId);

        // Update URL without reload
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('room', roomId);
        window.history.pushState({}, '', newUrl);

        // Clear current state
        if (queueList) {
            queueList.innerHTML = '<p class="empty-queue">Queue is empty. Add a track to get started!</p>';
        }
        updateCurrentTrackDisplay('No track playing', '');
        if (widget) {
            const widgetContainer = document.getElementById('soundcloud-widget');
            if (widgetContainer) {
                widgetContainer.innerHTML = '';
            }
            widget = null;
        }

        // Reset session sync status when joining a new room
        if (window.isUserSyncedToSession !== undefined) {
            window.isUserSyncedToSession = false;
        }

        // Join new room
        if (socket.connected) {
            socket.emit('join-room', roomId);
        } else {
            // If not connected yet, it will join on connect
            socket.connect();
        }

        console.log('Joined room:', roomId);
    }

    // Create new room (generates random name)
    function createNewRoom() {
        const randomId = 'room-' + Math.random().toString(36).substring(2, 9);
        joinRoom(randomId);
    }

    // Event listeners for room selector
    if (joinRoomBtn) {
        joinRoomBtn.addEventListener('click', () => {
            const newRoomId = roomInput?.value.trim();
            if (newRoomId) {
                joinRoom(newRoomId);
            }
        });
    }

    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', createNewRoom);
    }

    if (roomInput) {
        roomInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                joinRoomBtn?.click();
            }
        });
    }

    // Update display on initial load
    updateCurrentRoomDisplay(roomId);

    // Return public API
    return {
        get roomId() { return roomId; },
        updateCurrentRoomDisplay,
        joinRoom,
        createNewRoom
    };
}

// Export initialization function
export { initRoomManager };
