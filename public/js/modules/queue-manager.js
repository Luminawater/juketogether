// Queue management functionality
let queueList;

// Initialize queue manager
function initQueueManager() {
    queueList = document.getElementById('queue-list');
    return {
        updateQueueDisplay,
        addQueueItem,
        removeTrack
    };
}

// Update queue display
function updateQueueDisplay(queue) {
    if (!queueList) return;

    queueList.innerHTML = '';

    if (queue.length === 0) {
        queueList.innerHTML = '<p class="empty-queue">Queue is empty. Add a track to get started!</p>';
        return;
    }

    queue.forEach(track => {
        addQueueItem(track);
    });
}

// Add queue item to display
function addQueueItem(track) {
    // Remove empty message if exists
    const emptyMsg = queueList.querySelector('.empty-queue');
    if (emptyMsg) {
        emptyMsg.remove();
    }

    // Check if item already exists and update it instead of creating duplicate
    const existingItem = queueList.querySelector(`[data-track-id="${track.id}"]`);
    if (existingItem) {
        // Update existing item
        const titleDiv = existingItem.querySelector('.queue-item-title');
        if (titleDiv && track.info) {
            // Format: "Artist - Title" or just "Title"
            const displayTitle = track.info.artist
                ? `${track.info.artist} - ${track.info.title}`
                : (track.info.fullTitle || track.info.title || 'Track');
            titleDiv.textContent = displayTitle;
        }
        return;
    }

    const item = document.createElement('div');
    item.className = 'queue-item';
    item.setAttribute('data-track-id', track.id);

    // Format: "Artist - Title" or just "Title"
    const displayTitle = track.info?.artist
        ? `${track.info.artist} - ${track.info.title}`
        : (track.info?.fullTitle || track.info?.title || 'Loading...');

    item.innerHTML = `
        <div class="queue-item-info">
            <div class="queue-item-title">${displayTitle}</div>
            <div class="queue-item-url">${track.url}</div>
        </div>
        <div class="queue-item-actions">
            <button class="remove-btn" onclick="removeTrack('${track.id}')">
                <span class="material-icons">delete</span>
                Remove
            </button>
        </div>
    `;

    queueList.appendChild(item);
}

// Remove track
function removeTrack(trackId) {
    // This function will be called from global scope via onclick
    // We'll need to make it available globally or use event delegation
    const item = document.querySelector(`[data-track-id="${trackId}"]`);
    if (item) {
        item.remove();
        if (queueList.children.length === 0) {
            queueList.innerHTML = '<p class="empty-queue">Queue is empty. Add a track to get started!</p>';
        }
    }
    // Emit remove event - this will be handled by the main app
    if (window.socket && window.roomId) {
        window.socket.emit('remove-track', { roomId: window.roomId, trackId });
    }
}

// Export functions
export { initQueueManager };
