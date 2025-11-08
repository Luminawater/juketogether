import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config/constants';
import { Track } from '../types';

export interface RoomState {
  queue: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  position: number;
  history?: Track[];
  users?: any[];
  roomSettings?: any;
  isOwner?: boolean;
  isAdmin?: boolean;
  creatorTier?: 'free' | 'standard' | 'pro';
  tierSettings?: {
    queueLimit: number | null;
    djMode: boolean;
    ads: boolean;
  };
  activeBoost?: {
    id: string;
    expiresAt: string;
    minutesRemaining: number;
    purchasedBy: string;
  } | null;
}

class SocketService {
  private _socket: Socket | null = null;
  private roomId: string | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private shouldReconnect: boolean = true;

  get socket(): Socket | null {
    return this._socket;
  }

  connect(roomId: string, userId: string, authToken?: string, providerToken?: string) {
    if (this._socket?.connected && this.roomId === roomId) {
      return; // Already connected to this room
    }

    this.disconnect();
    this.roomId = roomId;
    this.reconnectAttempts = 0;
    this.shouldReconnect = true;

    console.log(`[SocketService] Connecting to ${SOCKET_URL} for room ${roomId}`);

    this._socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5, // Add jitter to prevent thundering herd
      timeout: 20000, // 20 second timeout
      query: {
        room: roomId,
        userId: userId,
      },
      auth: {
        token: authToken,
        providerToken: providerToken,
      },
      autoConnect: true,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this._socket) return;

    // If socket is already connected, emit connect event immediately
    if (this._socket.connected) {
      this.emit('connect');
    }

    this._socket.on('connect', () => {
      console.log('[SocketService] Socket connected successfully');
      this.reconnectAttempts = 0; // Reset on successful connection
      this.shouldReconnect = true;
      this.emit('connect');
    });

    this._socket.on('disconnect', (reason) => {
      console.log('[SocketService] Socket disconnected:', reason);
      this.emit('disconnect', reason);
      
      // If disconnected due to server shutdown or transport close, don't reconnect
      if (reason === 'io server disconnect' || reason === 'transport close') {
        this.shouldReconnect = false;
        console.log('[SocketService] Disabling reconnection due to:', reason);
      }
    });

    this._socket.on('reconnect_attempt', (attemptNumber) => {
      this.reconnectAttempts = attemptNumber;
      console.log(`[SocketService] Reconnection attempt ${attemptNumber}/${this.maxReconnectAttempts}`);
      
      if (attemptNumber >= this.maxReconnectAttempts) {
        console.error('[SocketService] Max reconnection attempts reached. Stopping reconnection.');
        this.shouldReconnect = false;
        if (this._socket) {
          this._socket.io.reconnect(false); // Disable reconnection
        }
        this.emit('connectionError', new Error('Max reconnection attempts reached'));
      }
    });

    this._socket.on('reconnect_failed', () => {
      console.error('[SocketService] Reconnection failed after all attempts');
      this.shouldReconnect = false;
      this.emit('connectionError', new Error('Reconnection failed after all attempts'));
    });

    this._socket.on('connect_error', (error) => {
      const errorMessage = error?.message || String(error);
      console.error('[SocketService] Socket connection error:', errorMessage);
      
      // Check if it's a timeout error
      if (errorMessage.includes('timeout') || errorMessage.includes('xhr poll error')) {
        console.warn('[SocketService] Connection timeout - server may not be available');
      }
      
      // Emit a more specific error for connection failures
      this.emit('connectionError', error);
    });

    this._socket.on('error', (error) => {
      console.error('[SocketService] Socket error:', error);
      this.emit('error', error);
    });

    // Room state updates
    this._socket.on('room-state', (state: RoomState & any) => {
      this.emit('roomState', state);
    });

    // Track added to queue
    this._socket.on('track-added', (track: Track) => {
      this.emit('trackAdded', track);
    });

    // Track removed from queue
    this._socket.on('track-removed', (trackId: string) => {
      this.emit('trackRemoved', trackId);
    });

    // Playback control events
    this._socket.on('play-track', () => {
      this.emit('play');
    });

    this._socket.on('pause-track', () => {
      this.emit('pause');
    });

    this._socket.on('track-changed', (track: Track) => {
      this.emit('nextTrack', track);
    });

    // User events
    this._socket.on('user-joined', (data: any) => {
      this.emit('userJoined', data);
    });

    this._socket.on('user-left', (data: any) => {
      this.emit('userLeft', data);
    });

    this._socket.on('user-count', (count: number) => {
      this.emit('userCount', count);
    });

    // Friends events
    this._socket.on('friends-list', (friends: any[]) => {
      this.emit('friendsList', friends);
    });

    this._socket.on('friend-request-sent', (data: any) => {
      this.emit('friendRequestSent', data);
    });

    // Position sync
    this._socket.on('seek-track', (position: number) => {
      this.emit('positionUpdate', position);
    });

    // History updates
    this._socket.on('history-updated', (history: Track[]) => {
      this.emit('historyUpdated', history);
    });

    // Room settings updates
    this._socket.on('room-settings-updated', (settings: any) => {
      this.emit('roomSettingsUpdated', settings);
    });

    // Room admins updates
    this._socket.on('room-admins-updated', (admins: string[]) => {
      this.emit('roomAdminsUpdated', admins);
    });

    // Boost activation
    this._socket.on('boost-activated', (data: any) => {
      this.emit('boost-activated', data);
    });

    // Boost expiration
    this._socket.on('boost-expired', (data: any) => {
      this.emit('boost-expired', data);
    });
  }

  private emit(event: string, ...args: any[]) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(...args));
    }
  }

  // Public API methods
  on(event: string, handler: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  off(event: string, handler: Function) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // Emit events to server
  addTrack(trackUrl: string) {
    this._socket?.emit('add-track', { trackUrl });
  }

  removeTrack(trackId: string, roomId: string) {
    this._socket?.emit('remove-track', { roomId, trackId });
  }

  play(roomId: string) {
    this._socket?.emit('play', { roomId });
  }

  pause(roomId: string) {
    this._socket?.emit('pause', { roomId });
  }

  nextTrack(roomId: string) {
    this._socket?.emit('next-track', { roomId });
  }

  updatePosition(position: number, roomId: string) {
    this._socket?.emit('seek', { roomId, position });
  }

  setVolume(volume: number, roomId: string) {
    this._socket?.emit('volume-change', { roomId, volume });
  }

  syncAllUsers(roomId: string, position: number) {
    this._socket?.emit('sync-all-users', { roomId, position });
  }

  disconnect() {
    if (this._socket) {
      this._socket.disconnect();
      this._socket = null;
    }
    this.roomId = null;
    this.listeners.clear();
  }

  isConnected(): boolean {
    return this._socket?.connected || false;
  }
}

export const socketService = new SocketService();

