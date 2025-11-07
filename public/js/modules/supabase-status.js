// Supabase connection status checking
function initSupabaseStatus() {
    // Check Supabase connection status
    async function checkSupabaseStatus() {
        const statusIndicator = document.getElementById('status-indicator');
        const statusText = document.getElementById('status-text');

        try {
            const response = await fetch('/api/status');
            const data = await response.json();

            if (data.supabase && data.supabase.connected) {
                if (statusIndicator) {
                    statusIndicator.className = 'status-indicator connected';
                    statusIndicator.title = 'Supabase connected';
                }
                if (statusText) {
                    statusText.textContent = 'Storage: Connected';
                    statusText.style.color = '#4caf50';
                }
            } else {
                if (statusIndicator) {
                    statusIndicator.className = 'status-indicator disconnected';
                    statusIndicator.title = 'Supabase disconnected - using in-memory storage';
                }
                if (statusText) {
                    statusText.textContent = 'Storage: Offline';
                    statusText.style.color = '#ff9800';
                }
            }
        } catch (error) {
            console.error('Error checking Supabase status:', error);
            if (statusIndicator) {
                statusIndicator.className = 'status-indicator error';
                statusIndicator.title = 'Error checking connection';
            }
            if (statusText) {
                statusText.textContent = 'Storage: Error';
                statusText.style.color = '#f44336';
            }
        }
    }

    // Check status on page load and periodically
    checkSupabaseStatus();
    setInterval(checkSupabaseStatus, 30000); // Check every 30 seconds

    return {
        checkSupabaseStatus
    };
}

// Export initialization function
export { initSupabaseStatus };

