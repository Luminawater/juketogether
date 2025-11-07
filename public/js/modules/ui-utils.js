// UI utility functions

// Format time ago
function formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
        return 'Just now';
    } else if (diffMins < 60) {
        return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else {
        return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    }
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;

    const form = document.querySelector('.add-track-form');
    form.parentNode.insertBefore(errorDiv, form);

    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Show success message
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.textContent = message;

    const form = document.querySelector('.add-track-form');
    form.parentNode.insertBefore(successDiv, form);

    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

// Export functions
export {
    formatTimeAgo,
    showError,
    showSuccess
};


