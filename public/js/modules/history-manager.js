// History management functionality
import { formatTimeAgo } from './ui-utils.js';

let historyList;
let clearHistoryBtn;

// Initialize history manager
function initHistoryManager() {
    historyList = document.getElementById('history-list');
    clearHistoryBtn = document.getElementById('clear-history-btn');

    // Set up clear history button
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', clearHistory);
    }

    return {
        updateHistoryDisplay,
        addHistoryItem,
        replayTrack,
        clearHistory
    };
}

// Update history display
function updateHistoryDisplay(history) {
    if (!historyList) return;

    historyList.innerHTML = '';

    if (history.length === 0) {
        historyList.innerHTML = '<p class="empty-history">No tracks played yet</p>';
        return;
    }

    history.forEach(track => {
        addHistoryItem(track);
    });
}

// Add history item to display
function addHistoryItem(track) {
    if (!historyList) return;

    // Remove empty message if exists
    const emptyMsg = historyList.querySelector('.empty-history');
    if (emptyMsg) {
        emptyMsg.remove();
    }

    // Check if item already exists and update it instead of creating duplicate
    const existingItem = historyList.querySelector(`[data-history-track-id="${track.id}"]`);
    if (existingItem) {
        // Update existing item
        const titleDiv = existingItem.querySelector('.history-item-title');
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
    item.className = 'history-item';
    item.setAttribute('data-history-track-id', track.id);

    // Format: "Artist - Title" or just "Title"
    const displayTitle = track.info?.artist
        ? `${track.info.artist} - ${track.info.title}`
        : (track.info?.fullTitle || track.info?.title || 'Unknown Track');

    // Format played time
    const playedAt = track.playedAt ? new Date(track.playedAt) : new Date();
    const timeAgo = formatTimeAgo(playedAt);

    item.innerHTML = `
        <div class="history-item-info">
            <div class="history-item-title">${displayTitle}</div>
            <div class="history-item-meta">
                <span class="history-item-url">${track.url}</span>
                <span class="history-item-time">${timeAgo}</span>
            </div>
        </div>
        <div class="history-item-actions">
            <button class="replay-btn" onclick="replayTrack('${track.id}')">
                <span class="material-icons">replay</span>
                Replay
            </button>
        </div>
    `;

    historyList.appendChild(item);
}

// Replay track from history
function replayTrack(trackId) {
    // This function will be called from global scope via onclick
    // We'll need to make it available globally or use event delegation
    if (window.socket && window.roomId) {
        window.socket.emit('replay-track', { roomId: window.roomId, trackId });
        console.log('Replaying track from history:', trackId);
    }
}

// Clear history
function clearHistory() {
    if (confirm('Are you sure you want to clear the history? This cannot be undone.')) {
        if (window.socket && window.roomId) {
            window.socket.emit('clear-history', { roomId: window.roomId });
            console.log('Clearing history for room:', window.roomId);
        }
    }
}

// Export functions
export { initHistoryManager };












