// Users and friends management functionality
import { showError, showSuccess } from './ui-utils.js';

let currentUserId = null;
let currentRoomId = null;
let socket = null;
let friends = [];
let friendRequests = [];
let roomUsers = [];

// Initialize users manager
function initUsersManager(deps) {
    currentUserId = deps.userId;
    currentRoomId = deps.roomId;
    socket = deps.socket;

    return {
        updateUsersList,
        addFriend,
        acceptFriendRequest,
        rejectFriendRequest,
        removeFriend,
        loadFriends,
        loadFriendRequests
    };
}

// Update users list display
function updateUsersList(users) {
    roomUsers = users;
    const usersList = document.getElementById('users-list');
    if (!usersList) return;

    if (!users || users.length === 0) {
        usersList.innerHTML = '<p class="empty-users">No users in room</p>';
        return;
    }

    usersList.innerHTML = '';
    users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.setAttribute('data-user-id', user.userId);
        
        const isMe = user.userId === currentUserId;
        const isFriend = friends.some(f => 
            (f.user_id === user.userId && f.friend_id === currentUserId) ||
            (f.friend_id === user.userId && f.user_id === currentUserId)
        );
        const hasPendingRequest = friendRequests.some(r => 
            (r.user_id === user.userId && r.friend_id === currentUserId) ||
            (r.friend_id === user.userId && r.user_id === currentUserId)
        );

        userItem.innerHTML = `
            <div class="user-info">
                <div class="user-avatar">
                    ${user.userProfile?.avatar_url ? 
                        `<img src="${user.userProfile.avatar_url}" alt="${user.userProfile.username || 'User'}">` :
                        `<span class="material-icons">account_circle</span>`
                    }
                </div>
                <div class="user-details">
                    <div class="user-name">${user.userProfile?.username || user.userProfile?.display_name || 'Anonymous User'}</div>
                    ${isMe ? '<span class="user-badge me">You</span>' : ''}
                    ${user.isOwner ? '<span class="user-badge owner">Owner</span>' : ''}
                    ${user.isAdmin ? '<span class="user-badge admin">Admin</span>' : ''}
                </div>
            </div>
            <div class="user-actions">
                ${!isMe && !isFriend && !hasPendingRequest ? `
                    <button class="add-friend-btn" data-user-id="${user.userId}" title="Add friend">
                        <span class="material-icons">person_add</span>
                    </button>
                ` : ''}
                ${!isMe && hasPendingRequest && friendRequests.find(r => r.user_id === currentUserId && r.friend_id === user.userId) ? `
                    <span class="request-sent">Request sent</span>
                ` : ''}
                ${!isMe && hasPendingRequest && friendRequests.find(r => r.user_id === user.userId && r.friend_id === currentUserId) ? `
                    <button class="accept-friend-btn" data-user-id="${user.userId}" title="Accept">
                        <span class="material-icons">check</span>
                    </button>
                    <button class="reject-friend-btn" data-user-id="${user.userId}" title="Reject">
                        <span class="material-icons">close</span>
                    </button>
                ` : ''}
            </div>
        `;

        usersList.appendChild(userItem);
    });

    // Attach event listeners
    usersList.querySelectorAll('.add-friend-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const userId = btn.getAttribute('data-user-id');
            addFriend(userId);
        });
    });

    usersList.querySelectorAll('.accept-friend-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const userId = btn.getAttribute('data-user-id');
            acceptFriendRequest(userId);
        });
    });

    usersList.querySelectorAll('.reject-friend-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const userId = btn.getAttribute('data-user-id');
            rejectFriendRequest(userId);
        });
    });
}

// Add friend
function addFriend(friendId) {
    if (!socket || !currentRoomId) {
        showError('Not connected to room');
        return;
    }

    socket.emit('add-friend', {
        friendId: friendId
    });
}

// Accept friend request
function acceptFriendRequest(friendId) {
    if (!socket || !currentRoomId) {
        showError('Not connected to room');
        return;
    }

    socket.emit('accept-friend-request', {
        friendId: friendId
    });
}

// Reject friend request
function rejectFriendRequest(friendId) {
    if (!socket || !currentRoomId) {
        showError('Not connected to room');
        return;
    }

    socket.emit('reject-friend-request', {
        friendId: friendId
    });
}

// Remove friend
function removeFriend(friendId) {
    if (!socket || !currentRoomId) {
        showError('Not connected to room');
        return;
    }

    socket.emit('remove-friend', {
        friendId: friendId
    });
}

// Load friends list
function loadFriends(friendsList) {
    friends = friendsList || [];
    const friendsListEl = document.getElementById('friends-list');
    if (!friendsListEl) return;

    if (friends.length === 0) {
        friendsListEl.innerHTML = '<p class="empty-friends">No friends yet</p>';
        return;
    }

    friendsListEl.innerHTML = '';
    friends.forEach(friend => {
        const friendItem = document.createElement('div');
        friendItem.className = 'friend-item';
        friendItem.innerHTML = `
            <div class="friend-info">
                <span class="material-icons">account_circle</span>
                <span class="friend-name">${friend.username || 'Friend'}</span>
            </div>
            <button class="remove-friend-btn" data-friend-id="${friend.friend_id || friend.user_id}">
                <span class="material-icons">person_remove</span>
            </button>
        `;
        friendsListEl.appendChild(friendItem);
    });

    friendsListEl.querySelectorAll('.remove-friend-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const friendId = btn.getAttribute('data-friend-id');
            removeFriend(friendId);
        });
    });
}

// Load friend requests
function loadFriendRequests(requests) {
    friendRequests = requests || [];
    const requestsListEl = document.getElementById('friend-requests-list');
    if (!requestsListEl) return;

    const pendingRequests = requests.filter(r => r.status === 'pending' && r.friend_id === currentUserId);
    
    if (pendingRequests.length === 0) {
        requestsListEl.innerHTML = '<p class="empty-requests">No pending requests</p>';
        return;
    }

    requestsListEl.innerHTML = '';
    pendingRequests.forEach(request => {
        const requestItem = document.createElement('div');
        requestItem.className = 'friend-request-item';
        requestItem.innerHTML = `
            <div class="request-info">
                <span class="material-icons">account_circle</span>
                <span class="request-name">${request.username || 'User'}</span>
            </div>
            <div class="request-actions">
                <button class="accept-request-btn" data-user-id="${request.user_id}">
                    <span class="material-icons">check</span>
                </button>
                <button class="reject-request-btn" data-user-id="${request.user_id}">
                    <span class="material-icons">close</span>
                </button>
            </div>
        `;
        requestsListEl.appendChild(requestItem);
    });

    requestsListEl.querySelectorAll('.accept-request-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const userId = btn.getAttribute('data-user-id');
            acceptFriendRequest(userId);
        });
    });

    requestsListEl.querySelectorAll('.reject-request-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const userId = btn.getAttribute('data-user-id');
            rejectFriendRequest(userId);
        });
    });
}

// Export functions
export { initUsersManager };

