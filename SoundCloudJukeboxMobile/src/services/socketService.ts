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

  get socket(): Socket | null {
    return this._socket;
  }

  connect(roomId: string, userId: string, authToken?: string) {
    if (this._socket?.connected && this.roomId === roomId) {
      return; // Already connected to this room
    }

    this.disconnect();
    this.roomId = roomId;

    this._socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000, // 20 second timeout
      query: {
        room: roomId,
        userId: userId,
      },
      auth: {
        token: authToken,
      },
      // Add error handling for connection failures
      autoConnect: true,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    if (!this._socket) return;

    this._socket.on('connect', () => {
      console.log('Socket connected');
      this.emit('listeners', 'connect');
    });

    this._socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.emit('listeners', 'disconnect', reason);
    });

    this._socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      // Emit a more specific error for connection failures
      this.emit('listeners', 'connectionError', error);
    });

    this._socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.emit('listeners', 'error', error);
    });

    // Room state updates
    this._socket.on('room-state', (state: RoomState & any) => {
      this.emit('listeners', 'roomState', state);
    });

    // Track added to queue
    this._socket.on('track-added', (track: Track) => {
      this.emit('listeners', 'trackAdded', track);
    });

    // Track removed from queue
    this._socket.on('track-removed', (trackId: string) => {
      this.emit('listeners', 'trackRemoved', trackId);
    });

    // Playback control events
    this._socket.on('play-track', () => {
      this.emit('listeners', 'play');
    });

    this._socket.on('pause-track', () => {
      this.emit('listeners', 'pause');
    });

    this._socket.on('track-changed', (track: Track) => {
      this.emit('listeners', 'nextTrack', track);
    });

    // User events
    this._socket.on('user-joined', (data: any) => {
      this.emit('listeners', 'userJoined', data);
    });

    this._socket.on('user-left', (data: any) => {
      this.emit('listeners', 'userLeft', data);
    });

    this._socket.on('user-count', (count: number) => {
      this.emit('listeners', 'userCount', count);
    });

    // Friends events
    this._socket.on('friends-list', (friends: any[]) => {
      this.emit('listeners', 'friendsList', friends);
    });

    // Position sync
    this._socket.on('seek-track', (position: number) => {
      this.emit('listeners', 'positionUpdate', position);
    });

    // History updates
    this._socket.on('history-updated', (history: Track[]) => {
      this.emit('listeners', 'historyUpdated', history);
    });

    // Room settings updates
    this._socket.on('room-settings-updated', (settings: any) => {
      this.emit('listeners', 'roomSettingsUpdated', settings);
    });

    // Room admins updates
    this._socket.on('room-admins-updated', (admins: string[]) => {
      this.emit('listeners', 'roomAdminsUpdated', admins);
    });

    // Boost activation
    this._socket.on('boost-activated', (data: any) => {
      this.emit('listeners', 'boost-activated', data);
    });

    // Boost expiration
    this._socket.on('boost-expired', (data: any) => {
      this.emit('listeners', 'boost-expired', data);
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

