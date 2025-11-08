import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Share,
  Dimensions,
  TouchableOpacity,
  Animated,
} from 'react-native';
import {
  Text,
  Card,
  Title,
  Button,
  TextInput,
  List,
  Avatar,
  FAB,
  ActivityIndicator,
  Switch,
  Divider,
  Chip,
  Portal,
  Dialog,
  Paragraph,
  IconButton,
  Badge,
  useTheme,
} from 'react-native-paper';
import { RouteProp, useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { Track, SubscriptionTier } from '../types';
import { socketService, RoomState } from '../services/socketService';
import { FloatingPlayer } from '../components/FloatingPlayer';
import { NowPlayingCard } from '../components/NowPlayingCard';
import { UpgradePrompt } from '../components/UpgradePrompt';
import { AdDialog } from '../components/AdDialog';
import { DJModeInterface } from '../components/DJModeInterface';
import { DJModeToggle } from '../components/DJModeToggle';
import { DJModeUpgradeAd } from '../components/DJModeUpgradeAd';
import { DJModeConfirmDialog } from '../components/DJModeConfirmDialog';
import { YouTubePlayer } from '../components/YouTubePlayer';
import { SoundCloudPlayer } from '../components/SoundCloudPlayer';
import { SessionExitDialog } from '../components/SessionExitDialog';
import { MiniPlayer } from '../components/MiniPlayer';
import { djAudioService } from '../services/djAudioService';
import { bpmDetectionService } from '../services/bpmDetectionService';
import {
  isSpotifyUser,
  fetchUserPlaylists,
  fetchPlaylistTracks,
  spotifyTrackToQueueTrack,
  SpotifyPlaylist,
  SpotifyTrack,
} from '../services/spotifyService';
import { fetchSoundCloudTrackMetadata } from '../services/soundcloudService';
import { fetchYouTubeTrackMetadata } from '../services/youtubeService';
import {
  getTrackReactions,
  setTrackReaction,
  TrackReactionCounts,
  ReactionType,
} from '../services/trackReactionsService';
import { getRoomUrl, getRoomShareMessage, extractMusicUrls, isValidMusicUrl } from '../utils/roomUtils';
import RoomChat from '../components/RoomChat';
import AdsBanner from '../components/AdsBanner';
import { hasTier, getTierHeaderColor } from '../utils/permissions';
import {
  getUnreadMessageCount,
  updateLastReadTimestamp,
  subscribeToChatMessages,
  unsubscribeFromChatMessages,
  RealtimeChannel,
} from '../services/chatService';
import { ShareRoomDialog } from '../components/ShareRoomDialog';
import { QueueDialog } from '../components/QueueDialog';
import { CreatePlaylistDialog } from '../components/CreatePlaylistDialog';
import { API_URL } from '../config/constants';
import { getThumbnailUrl } from '../utils/imageUtils';
import { AnimatedFAB } from '../components/RoomAnimatedFAB';
import { AnimatedQueueItem } from '../components/RoomAnimatedQueueItem';
import { RoomUsersTab } from '../components/RoomUsersTab';
import { RoomSpotifyTab } from '../components/RoomSpotifyTab';
import { RoomSettingsTab } from '../components/RoomSettingsTab';
import { RoomDJModeTab } from '../components/RoomDJModeTab';
import { RoomMainTab } from '../components/RoomMainTab';
import { RoomHeader } from '../components/RoomHeader';
import { roomScreenStyles } from './RoomScreen.styles';
import { RoomUser, Friend, RoomSettings, BlockedInfo, ActiveBoost, TierSettings } from './RoomScreen.types';
import { localStorageHelpers } from '../utils/localStorageHelpers';

type RoomScreenRouteProp = RouteProp<RootStackParamList, 'Room'>;
type RoomScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Room'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_MOBILE = SCREEN_WIDTH < 768;

const RoomScreen: React.FC = () => {
  const route = useRoute<RoomScreenRouteProp>();
  const navigation = useNavigation<RoomScreenNavigationProp>();
  const { user, session, supabase, profile } = useAuth();
  const theme = useTheme();

  const { roomId, roomName } = route.params;

  // Main state
  const [activeTab, setActiveTab] = useState<'main' | 'users' | 'settings' | 'spotify' | 'chat' | 'djmode'>('main');
  const [queue, setQueue] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);
  const [removingTrackIds, setRemovingTrackIds] = useState<Set<string>>(new Set());
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0); // Track duration in milliseconds
  const [trackUrl, setTrackUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState<RoomUser[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [playerMinimized, setPlayerMinimized] = useState(false);
  const [isUserSyncedToSession, setIsUserSyncedToSession] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const chatUnreadChannelRef = useRef<RealtimeChannel | null>(null);

  // Users & Friends state
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<Friend[]>([]);

  // Settings state
  const [roomSettings, setRoomSettings] = useState<RoomSettings>({
    isPrivate: false,
    allowControls: true,
    allowQueue: true,
    allowQueueRemoval: true,
    djMode: false,
    djPlayers: 0,
    admins: [],
    allowPlaylistAdditions: false,
    sessionEnabled: false,
    autoplay: true,
  });
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canControl, setCanControl] = useState(true);
  const [addAdminInput, setAddAdminInput] = useState('');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showQueueDialog, setShowQueueDialog] = useState(false);
  const [showDJModeConfirmDialog, setShowDJModeConfirmDialog] = useState(false);
  const [showSessionExitDialog, setShowSessionExitDialog] = useState(false);
  const [miniPlayerVisible, setMiniPlayerVisible] = useState(false);
  const [floatingPlayerVisible, setFloatingPlayerVisible] = useState(false);
  const [showMediaPlayer, setShowMediaPlayer] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const [shortCode, setShortCode] = useState<string | undefined>(undefined);
  const [creatorTier, setCreatorTier] = useState<'free' | 'standard' | 'pro'>('free');
  const [tierSettings, setTierSettings] = useState<TierSettings>({
    queueLimit: 1,
    djMode: false,
    ads: true,
  });

  // Spotify state
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<SpotifyTrack[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);

  // Track reactions state
  const [trackReactions, setTrackReactions] = useState<TrackReactionCounts>({
    likes: 0,
    dislikes: 0,
    fantastic: 0,
    userReaction: null,
  });
  const [loadingReaction, setLoadingReaction] = useState(false);

  // DJ Mode state
  const [isDJModeActive, setIsDJModeActive] = useState(false);
  const [djPlayerTracks, setDjPlayerTracks] = useState<(Track | null)[]>([null, null, null, null]);
  const [djPlayerPlayingStates, setDjPlayerPlayingStates] = useState<boolean[]>([false, false, false, false]);
  const [djPlayerVolumes, setDjPlayerVolumes] = useState<number[]>([0.5, 0.5, 0.5, 0.5]);
  const [djPlayerBPMs, setDjPlayerBPMs] = useState<(number | null)[]>([null, null, null, null]);
  const [djPlayerPositions, setDjPlayerPositions] = useState<number[]>([0, 0, 0, 0]);
  const [djPlayerDurations, setDjPlayerDurations] = useState<number[]>([0, 0, 0, 0]);

  // Scroll detection state
  const [showHeaderControls, setShowHeaderControls] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // FAB animation
  const fabTranslateX = useRef(new Animated.Value(0)).current;
  const fabPulseAnim = useRef(new Animated.Value(1)).current;
  const fabColorAnim = useRef(new Animated.Value(0)).current;

  // Previous button double-click tracking
  const lastPreviousClickTime = useRef<number>(0);
  const PREVIOUS_DOUBLE_CLICK_WINDOW = 2000; // 2 seconds

  // Playback blocking state
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [blockedInfo, setBlockedInfo] = useState<BlockedInfo | null>(null);
  const [activeBoost, setActiveBoost] = useState<ActiveBoost | null>(null);

  // Ad state
  const [adVisible, setAdVisible] = useState(false);
  const [currentAd, setCurrentAd] = useState<any>(null);
  const [adCountdown, setAdCountdown] = useState(5);
  const [songsSinceLastAd, setSongsSinceLastAd] = useState(0);
  const [purchasingBoost, setPurchasingBoost] = useState(false);

  // Load showMediaPlayer preference from storage
  useEffect(() => {
    const loadMediaPlayerPreference = async () => {
      try {
        const saved = await localStorageHelpers.get('showMediaPlayer');
        if (saved === 'true') {
          setShowMediaPlayer(true);
        }
      } catch (error) {
        console.error('Error loading media player preference:', error);
      }
    };
    loadMediaPlayerPreference();
  }, []);

  // Connect to Socket.io when component mounts
  useEffect(() => {
    // Only connect if we have a valid roomId
    if (!roomId) return;

    const userId = user?.id || `anonymous_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const authToken = session?.access_token;

    // Only connect if not already connected to this room
    if (!socketService.isConnected() || socketService.socket === null) {
      socketService.connect(roomId, userId, authToken);
    }

    const handleConnect = () => {
      setConnected(true);
      console.log('Connected to room:', roomId);
      // Join room
      if (socketService.socket) {
        socketService.socket.emit('join-room', roomId);
      }
    };

    const handleDisconnect = () => {
      setConnected(false);
      console.log('Disconnected from room');
    };

    const handleRoomState = (state: RoomState & { 
      history?: Track[];
      users?: RoomUser[];
      roomSettings?: RoomSettings;
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
    }) => {
      console.log('[handleRoomState] Received room state', { 
        queueLength: state.queue?.length || 0,
        hasCurrentTrack: !!state.currentTrack,
        currentTrackUrl: state.currentTrack?.url,
        currentTrackPlatform: state.currentTrack?.url?.includes('soundcloud') ? 'soundcloud' : 
                              state.currentTrack?.url?.includes('youtube') ? 'youtube' : 
                              state.currentTrack?.url?.includes('spotify') ? 'spotify' : 'unknown',
        isPlaying: state.isPlaying,
        position: state.position
      });
      
      setQueue(state.queue || []);
      setHistory(state.history || []);
      setCurrentTrack(state.currentTrack || null);
      setIsPlaying(state.isPlaying || false);
      setPosition(state.position || 0);
      setUsers(state.users || []);
      setUserCount(state.users?.length || 0);
      
      if (state.roomSettings) {
        setRoomSettings(state.roomSettings);
        setCanControl(state.roomSettings.allowControls || !!state.isOwner || !!state.isAdmin);
      }
      setIsOwner(!!state.isOwner);
      setIsAdmin(!!state.isAdmin);
      
      // Update creator tier and tier settings
      if (state.creatorTier) {
        setCreatorTier(state.creatorTier);
      }
      if (state.tierSettings) {
        setTierSettings(state.tierSettings);
      }
      
      // Update active boost
      if (state.activeBoost) {
        setActiveBoost(state.activeBoost);
        // Clear blocking if boost is active
        if (playbackBlocked) {
          setPlaybackBlocked(false);
          setBlockedInfo(null);
        }
      } else {
        setActiveBoost(null);
      }
    };
    
    const handleBoostActivated = (data: { boost: any }) => {
      if (data.boost) {
        setActiveBoost(data.boost);
        Alert.alert('Boost Activated!', 'Room now has Pro tier benefits for 1 hour!');
      } else {
        setActiveBoost(null);
      }
    };
    
    const handleBoostExpired = (data: { roomId: string }) => {
      if (data.roomId === roomId) {
        setActiveBoost(null);
        Alert.alert('Boost Expired', 'The room boost has expired. Music playback has been paused. Purchase another boost to continue.');
        // Refresh room state
        if (socketService.socket) {
          socketService.socket.emit('join-room', roomId);
        }
      }
    };

    const handleTrackAdded = (track: Track) => {
      setQueue(prev => [...prev, track]);
    };

    const handleTrackRemoved = (trackId: string) => {
      // Mark track as being removed to trigger animation
      setRemovingTrackIds(prev => new Set(prev).add(trackId));
      
      // After animation completes, remove from queue
      setTimeout(() => {
        setQueue(prev => prev.filter(t => t.id !== trackId));
        setRemovingTrackIds(prev => {
          const next = new Set(prev);
          next.delete(trackId);
          return next;
        });
      }, 300); // Match animation duration
    };

    const handlePlay = () => {
      console.log('[handlePlay] Received play event, setting isPlaying to true', { 
        currentTrack: currentTrack?.url, 
        wasPlaying: isPlaying 
      });
      setIsPlaying(true);
    };

    const handlePause = () => {
      console.log('[handlePause] Received pause event, setting isPlaying to false', { 
        currentTrack: currentTrack?.url, 
        wasPlaying: isPlaying 
      });
      setIsPlaying(false);
    };

    // Load interstitial ad
    const loadInterstitialAd = async () => {
      try {
        const { data, error } = await supabase
          .from('ads')
          .select('*')
          .eq('display_location', 'room_interstitial')
          .eq('enabled', true)
          .order('priority', { ascending: false })
          .limit(1)
          .single();

        if (!error && data) {
          return data;
        }
      } catch (error) {
        console.error('Error loading ad:', error);
      }
      return null;
    };

    // Check if ad should be shown based on tier
    const shouldShowAd = (userTier: string, songsSinceLastAd: number) => {
      if (activeBoost) return false; // No ads if boost is active
      
      if (userTier === 'free') {
        return songsSinceLastAd >= 1; // Every 1 song for free tier
      } else if (userTier === 'standard' || userTier === 'rookie') {
        return songsSinceLastAd >= 2; // Every 2 songs for standard/rookie tier
      }
      return false; // No ads for pro tier
    };

    // Show ad and pause playback
    const showAd = async () => {
      const ad = await loadInterstitialAd();
      if (ad) {
        setCurrentAd(ad);
        setAdVisible(true);
        setAdCountdown(5);
        
        // Pause playback
        if (isPlaying && socketService.socket) {
          socketService.socket.emit('pause', { roomId });
        }
      }
    };

    const handleNextTrack = async (track: Track) => {
      setCurrentTrack(track);
      setQueue(prev => prev.filter(t => t.id !== track.id));
      
      // Check if ad should be shown before playing
      const userTier = profile?.subscription_tier || 'free';
      const newSongsSinceLastAd = songsSinceLastAd + 1;
      
      if (shouldShowAd(userTier, newSongsSinceLastAd)) {
        await showAd();
        setSongsSinceLastAd(0); // Reset counter after showing ad
        // Don't start playing yet - wait for ad to finish
      } else {
        setIsPlaying(true);
        setSongsSinceLastAd(newSongsSinceLastAd);
      }
    };

    const handleUserJoined = (data: { userId: string; userProfile?: any }) => {
      setUsers(prev => [...prev, {
        userId: data.userId,
        userProfile: data.userProfile,
      }]);
      setUserCount(prev => prev + 1);
    };

    const handleUserLeft = (data: { userId: string }) => {
      setUsers(prev => prev.filter(u => u.userId !== data.userId));
      setUserCount(prev => Math.max(0, prev - 1));
    };

    const handleUserCount = (count: number) => {
      setUserCount(count);
    };

    const handleFriendsList = (friendsList: Friend[]) => {
      setFriends(friendsList.filter(f => f.status === 'accepted'));
      setFriendRequests(friendsList.filter(f => f.status === 'pending'));
    };

    const handleFriendRequestSent = (data: { friendId: string }) => {
      Alert.alert('Success', 'Friend request sent!');
      // Refresh friends list
      if (socketService.socket && user) {
        socketService.socket.emit('get-friends');
      }
    };

    const handleHistoryUpdated = (updatedHistory: Track[]) => {
      setHistory(updatedHistory);
    };

    const handleRoomSettingsUpdated = (updatedSettings: any) => {
      setRoomSettings({
        isPrivate: updatedSettings.isPrivate || false,
        allowControls: updatedSettings.allowControls !== false,
        allowQueue: updatedSettings.allowQueue !== false,
        allowQueueRemoval: updatedSettings.allowQueueRemoval !== false,
        djMode: updatedSettings.djMode || false,
        djPlayers: updatedSettings.djPlayers || 0,
        admins: updatedSettings.admins || roomSettings.admins || [],
        allowPlaylistAdditions: updatedSettings.allowPlaylistAdditions || false,
        sessionEnabled: updatedSettings.sessionEnabled || false,
        autoplay: updatedSettings.autoplay !== false, // Default to true if not specified
      });
      setCanControl(updatedSettings.allowControls !== false || isOwner || isAdmin);
    };

    const handleRoomAdminsUpdated = (admins: string[]) => {
      setRoomSettings(prev => ({ ...prev, admins }));
    };

    const handleError = (error: any) => {
      console.error('Socket error:', error);
      // Show specific error message if available, otherwise show generic message
      const errorMessage = error?.message || 'An error occurred';
      // Only show generic connection error for actual connection issues
      if (errorMessage.includes('connect') || errorMessage.includes('Connection')) {
        Alert.alert('Connection Error', 'Failed to connect to room. Please try again.');
      } else {
        // Show the specific error message for other errors (like friend requests)
        Alert.alert('Error', errorMessage);
      }
    };

    const handleConnectionError = (error: any) => {
      console.error('Socket connection error:', error);
      // Check if it's a connection refused error (server not running)
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('failed')) {
        Alert.alert(
          'Server Not Available',
          'Unable to connect to the server. Please make sure the server is running on port 8080.',
          [
            { text: 'OK', style: 'default' },
            { 
              text: 'Retry', 
              onPress: () => {
                // Retry connection
                const userId = user?.id || `anonymous_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                socketService.connect(roomId, userId);
              }
            }
          ]
        );
      } else {
        Alert.alert('Connection Error', `Failed to connect: ${errorMessage}`);
      }
    };

    // Register event listeners
    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('roomState', handleRoomState);
    
    // Check if socket is already connected (handles fast connections)
    if (socketService.isConnected()) {
      handleConnect();
    }
    socketService.on('trackAdded', handleTrackAdded);
    socketService.on('trackRemoved', handleTrackRemoved);
    // Listen for both 'play'/'pause' and 'play-track'/'pause-track' events
    socketService.on('play', handlePlay);
    socketService.on('pause', handlePause);
    
    // Also listen for server events (play-track/pause-track)
    if (socketService.socket) {
      socketService.socket.on('play-track', handlePlay);
      socketService.socket.on('pause-track', handlePause);
    }
    socketService.on('nextTrack', handleNextTrack);
    socketService.on('userJoined', handleUserJoined);
    socketService.on('userLeft', handleUserLeft);
    socketService.on('userCount', handleUserCount);
    socketService.on('friendsList', handleFriendsList);
    socketService.on('friendRequestSent', handleFriendRequestSent);
    socketService.on('historyUpdated', handleHistoryUpdated);
    socketService.on('roomSettingsUpdated', handleRoomSettingsUpdated);
    socketService.on('roomAdminsUpdated', handleRoomAdminsUpdated);
    socketService.on('boost-activated', handleBoostActivated);
    socketService.on('boost-expired', handleBoostExpired);
    
    // Handle YouTube position sync from Supabase (source of truth)
    const handleSeekTrack = (data: { position: number }) => {
      // This is handled by YouTubePlayer component internally
      // Position updates come from Supabase via room-state
      setPosition(data.position);
    };

  const handleRestartTrack = (data: { position: number; keepPlaying: boolean }) => {
    // Restart track to beginning
    setPosition(data.position);
    // Keep the current playing state as sent by server
    setIsPlaying(data.keepPlaying);
  };

  const handleSyncPlaybackState = (data: { isPlaying: boolean; position: number; currentTrack: Track | null }) => {
    console.log('[handleSyncPlaybackState] Syncing to playback state:', data);
    setIsPlaying(data.isPlaying);
    setPosition(data.position);
    if (data.currentTrack) {
      setCurrentTrack(data.currentTrack);
      setTrackUrl(data.currentTrack.url || '');
    }
  };

    const handleSyncAllUsers = (data: { position: number }) => {
      // Sync all users to this position (from Supabase)
      setPosition(data.position);
    };
    
    // Listen for seek and sync events from socket
    if (socketService.socket) {
      socketService.socket.on('seek-track', handleSeekTrack);
      socketService.socket.on('restart-track', handleRestartTrack);
      socketService.socket.on('sync-playback-state', handleSyncPlaybackState);
      socketService.socket.on('sync-all-users', handleSyncAllUsers);
    }
    
    // Handle playback blocking
    const handlePlaybackBlocked = (data: {
      reason: string;
      blockedAt: number;
      songsPlayed: number;
      userId: string;
      isOwner: boolean;
    }) => {
      setPlaybackBlocked(true);
      setBlockedInfo(data);
      setIsPlaying(false); // Stop playback
      Alert.alert(
        'Playback Blocked',
        data.isOwner 
          ? 'You\'ve reached your tier limit. Upgrade your subscription to continue.'
          : 'The room owner has reached their tier limit. Purchase a booster pack to continue.',
        [{ text: 'OK' }]
      );
    };
    
    // Listen for playback-blocked events from socket
    if (socketService.socket) {
      socketService.socket.on('playback-blocked', handlePlaybackBlocked);
    }
    
    socketService.on('error', (error: any) => {
      if (error.blocked) {
        // Handle blocked error
        handlePlaybackBlocked({
          reason: error.reason || 'tier_limit',
          blockedAt: error.blockedAt || 2,
          songsPlayed: error.songsPlayed || 0,
          userId: error.userId || user?.id || '',
          isOwner: error.isOwner || false,
        });
      } else {
        handleError(error);
      }
    });
    socketService.on('connectionError', handleConnectionError);

    // Request friends list
    if (socketService.socket && user) {
      socketService.socket.emit('get-friends');
    }

    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      socketService.off('roomState', handleRoomState);
      socketService.off('trackAdded', handleTrackAdded);
      socketService.off('trackRemoved', handleTrackRemoved);
      socketService.off('play', handlePlay);
      socketService.off('pause', handlePause);
      if (socketService.socket) {
        socketService.socket.off('play-track', handlePlay);
        socketService.socket.off('pause-track', handlePause);
      }
      socketService.off('nextTrack', handleNextTrack);
      socketService.off('userJoined', handleUserJoined);
      socketService.off('userLeft', handleUserLeft);
      socketService.off('userCount', handleUserCount);
      socketService.off('friendsList', handleFriendsList);
      socketService.off('friendRequestSent', handleFriendRequestSent);
      socketService.off('historyUpdated', handleHistoryUpdated);
      socketService.off('roomSettingsUpdated', handleRoomSettingsUpdated);
      socketService.off('roomAdminsUpdated', handleRoomAdminsUpdated);
      socketService.off('boost-activated', handleBoostActivated);
      socketService.off('boost-expired', handleBoostExpired);
      socketService.off('error', handleError);
      socketService.off('connectionError', handleConnectionError);
      if (socketService.socket) {
        socketService.socket.off('seek-track', handleSeekTrack);
        socketService.socket.off('restart-track', handleRestartTrack);
        socketService.socket.off('sync-playback-state', handleSyncPlaybackState);
        socketService.socket.off('sync-all-users', handleSyncAllUsers);
      }
      // Only disconnect if we're leaving the room
      // Don't disconnect if just navigating away temporarily
      if (socketService.isConnected()) {
        socketService.disconnect();
      }
    };
  }, [roomId, user?.id, session?.access_token]);

  // Track unread chat messages
  useEffect(() => {
    if (!user || !supabase || !roomId) return;

    // Fetch initial unread count
    const fetchUnreadCount = async () => {
      try {
        const count = await getUnreadMessageCount(supabase, roomId, user.id);
        setUnreadChatCount(count);
      } catch (error) {
        console.error('Error fetching unread chat count:', error);
      }
    };

    fetchUnreadCount();

    // Subscribe to new chat messages to update unread count
    chatUnreadChannelRef.current = subscribeToChatMessages(
      supabase,
      roomId,
      async (message) => {
        // Only increment if chat tab is not active and message is not from current user
        if (activeTab !== 'chat' && message.user_id !== user.id) {
          setUnreadChatCount((prev) => prev + 1);
        }
      },
      (error) => {
        console.error('Error in chat unread subscription:', error);
      }
    );

    return () => {
      if (chatUnreadChannelRef.current) {
        unsubscribeFromChatMessages(supabase, chatUnreadChannelRef.current);
        chatUnreadChannelRef.current = null;
      }
    };
  }, [roomId, user, supabase, activeTab]);

  // Update last read timestamp when chat tab is opened
  useEffect(() => {
    if (activeTab === 'chat' && user && supabase && roomId) {
      const updateReadStatus = async () => {
        try {
          await updateLastReadTimestamp(supabase, roomId, user.id);
          // Reset unread count
          setUnreadChatCount(0);
        } catch (error) {
          console.error('Error updating last read timestamp:', error);
        }
      };

      updateReadStatus();
    }
  }, [activeTab, user, supabase, roomId]);

  // Handle removing tracks from queue
  const handleRemoveTrack = useCallback((trackId: string) => {
    if (!socketService.socket) return;
    
    // Check if user can remove tracks
    const canRemove = isOwner || isAdmin || roomSettings.allowQueueRemoval || 
      (queue.find(t => t.id === trackId)?.addedBy === user?.id);
    
    if (!canRemove) {
      Alert.alert('Permission Denied', 'You do not have permission to remove tracks from the queue.');
      return;
    }
    
    socketService.removeTrack(trackId, roomId);
  }, [isOwner, isAdmin, roomSettings.allowQueueRemoval, queue, user?.id, roomId]);

  // Boost countdown timer
  useEffect(() => {
    if (!activeBoost) return;
    
    const interval = setInterval(() => {
      if (activeBoost) {
        const expiresAt = new Date(activeBoost.expiresAt);
        const now = new Date();
        const minutesRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 60000));
        
        if (minutesRemaining <= 0) {
          // Boost expired, refresh room state
          if (socketService.socket) {
            socketService.socket.emit('join-room', roomId);
          }
          setActiveBoost(null);
        } else {
          setActiveBoost(prev => prev ? { ...prev, minutesRemaining } : null);
        }
      }
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [activeBoost, roomId]);

  // Load Spotify playlists when user is logged in with Spotify
  useEffect(() => {
    if (user && session && isSpotifyUser(user)) {
      loadSpotifyPlaylists();
    }
  }, [user, session]);

  // Load track reactions when current track changes
  useEffect(() => {
    if (currentTrack && user) {
      loadTrackReactions();
    } else {
      setTrackReactions({ likes: 0, dislikes: 0, fantastic: 0, userReaction: null });
    }
  }, [currentTrack?.id, roomId, user?.id]);

  // Navigation blocking when session is enabled
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Only block if session is enabled, there's a current track, and user is not the owner
      if (
        roomSettings.sessionEnabled &&
        currentTrack &&
        !isOwner &&
        !miniPlayerVisible
      ) {
        // Prevent default behavior of leaving the screen
        e.preventDefault();

        // Show the exit dialog
        setPendingNavigation(() => () => {
          navigation.dispatch(e.data.action);
        });
        setShowSessionExitDialog(true);
      }
    });

    return unsubscribe;
  }, [navigation, roomSettings.sessionEnabled, currentTrack, isOwner, miniPlayerVisible]);

  // Handle session exit dialog actions
  const handleOpenMiniPlayer = () => {
    setShowSessionExitDialog(false);
    setMiniPlayerVisible(true);
    setPendingNavigation(null);
  };

  const handleExitRoom = () => {
    setShowSessionExitDialog(false);
    setMiniPlayerVisible(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    } else {
      navigation.goBack();
    }
  };

  const handleCloseMiniPlayer = () => {
    setMiniPlayerVisible(false);
    // If we're not in the room screen, navigate back to it
    const state = navigation.getState();
    const currentRoute = state.routes[state.index];
    if (currentRoute.name !== 'Room') {
      navigation.navigate('Room', { roomId, roomName });
    }
  };

  const handleExpandMiniPlayer = () => {
    setMiniPlayerVisible(false);
    // Navigate to room if not already there
    const state = navigation.getState();
    const currentRoute = state.routes[state.index];
    if (currentRoute.name !== 'Room') {
      navigation.navigate('Room', { roomId, roomName });
    }
    // Ensure we're on the main tab
    setActiveTab('main');
  };

  const handleToggleMiniPlayer = () => {
    setMiniPlayerVisible(prev => !prev);
  };

  const loadTrackReactions = async () => {
    if (!currentTrack || !user || !supabase) return;

    try {
      const reactions = await getTrackReactions(
        supabase,
        roomId,
        currentTrack.id,
        user.id
      );
      setTrackReactions(reactions);
    } catch (error) {
      console.error('Error loading track reactions:', error);
    }
  };

  const handleReaction = async (reactionType: ReactionType) => {
    if (!user || !currentTrack || !supabase || loadingReaction) return;

    setLoadingReaction(true);
    try {
      const result = await setTrackReaction(
        supabase,
        roomId,
        currentTrack.id,
        user.id,
        reactionType,
        currentTrack // Pass the full track object to save to user preferences
      );

      if (result.success) {
        // Reload reactions to get updated counts
        await loadTrackReactions();
      } else {
        Alert.alert('Error', result.error || 'Failed to update reaction');
      }
    } catch (error: any) {
      console.error('Error handling reaction:', error);
      Alert.alert('Error', 'Failed to update reaction');
    } finally {
      setLoadingReaction(false);
    }
  };

  // Scroll handler to detect when scrolled past "Now Playing" section
  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    // Show header controls when scrolled past the "Now Playing" section
    // The "Now Playing" section typically ends around 500-600px from top
    // We add a small buffer to ensure smooth transition
    const threshold = 500;
    setShowHeaderControls(scrollY > threshold);
  };

  // Initialize DJ Audio Service
  useEffect(() => {
    if (isDJModeActive && roomSettings.djMode) {
      djAudioService.initialize();
    }
    
    return () => {
      if (isDJModeActive) {
        djAudioService.cleanup();
      }
    };
  }, [isDJModeActive, roomSettings.djMode]);

  // Update DJ player positions periodically
  useEffect(() => {
    if (!isDJModeActive || !roomSettings.djMode) return;

    const interval = setInterval(() => {
      const states = djAudioService.getAllPlayerStates();
      const newPositions: number[] = [];
      const newDurations: number[] = [];
      
      states.forEach((state) => {
        newPositions.push(state.position);
        newDurations.push(state.duration);
      });
      
      setDjPlayerPositions(newPositions);
      setDjPlayerDurations(newDurations);
    }, 100); // Update every 100ms

    return () => clearInterval(interval);
  }, [isDJModeActive, roomSettings.djMode]);

  // DJ Mode Handlers
  const handleDJPlayerLoadTrack = async (playerIndex: number) => {
    if (!queue || queue.length === 0) {
      Alert.alert('No Tracks', 'Add tracks to the queue first');
      return;
    }

    // Use the first track in queue for now (could be enhanced to show a track picker)
    const track = queue[0];
    const success = await djAudioService.loadTrack(playerIndex, track);
    
    if (success) {
      const newTracks = [...djPlayerTracks];
      newTracks[playerIndex] = track;
      setDjPlayerTracks(newTracks);

      // Detect BPM
      const bpmResult = await bpmDetectionService.detectBPM(track);
      const newBPMs = [...djPlayerBPMs];
      newBPMs[playerIndex] = bpmResult.bpm;
      setDjPlayerBPMs(newBPMs);

      // Update duration
      const playerState = djAudioService.getPlayerState(playerIndex);
      if (playerState) {
        const newDurations = [...djPlayerDurations];
        newDurations[playerIndex] = playerState.duration;
        setDjPlayerDurations(newDurations);
      }
    } else {
      Alert.alert('Error', 'Failed to load track');
    }
  };

  const handleDJPlayerPlayPause = async (playerIndex: number) => {
    const playerState = djAudioService.getPlayerState(playerIndex);
    if (!playerState || !playerState.player) {
      Alert.alert('No Track', 'Load a track first');
      return;
    }

    if (playerState.isPlaying) {
      await djAudioService.pause(playerIndex);
    } else {
      await djAudioService.play(playerIndex);
    }

    const newStates = [...djPlayerPlayingStates];
    newStates[playerIndex] = !playerState.isPlaying;
    setDjPlayerPlayingStates(newStates);
  };

  const handleDJPlayerVolumeChange = async (playerIndex: number, volume: number) => {
    await djAudioService.setVolume(playerIndex, volume);
    const newVolumes = [...djPlayerVolumes];
    newVolumes[playerIndex] = volume;
    setDjPlayerVolumes(newVolumes);
  };

  const handleDJPlayerSeek = async (playerIndex: number, position: number) => {
    await djAudioService.seekTo(playerIndex, position);
    const newPositions = [...djPlayerPositions];
    newPositions[playerIndex] = position;
    setDjPlayerPositions(newPositions);
  };

  const handleDJPlayerSync = async (playerIndex1: number, playerIndex2: number) => {
    const state1 = djAudioService.getPlayerState(playerIndex1);
    const state2 = djAudioService.getPlayerState(playerIndex2);
    
    if (!state1 || !state1.player || !state2 || !state2.player) {
      Alert.alert('Error', 'Both players need tracks loaded');
      return;
    }

    const bpm1 = djPlayerBPMs[playerIndex1];
    const bpm2 = djPlayerBPMs[playerIndex2];

    if (bpm1 && bpm2) {
      // Calculate beat offset and sync
      const offset = bpmDetectionService.calculateBeatOffset(
        bpm1,
        bpm2,
        djPlayerPositions[playerIndex1]
      );
      
      // Seek player 2 to match player 1's beat
      const newPosition = Math.max(0, djPlayerPositions[playerIndex2] + offset);
      await handleDJPlayerSeek(playerIndex2, newPosition);
      
      Alert.alert('Synced', `Players synced at ${Math.round(bpm1)} BPM`);
    } else {
      // Simple position sync if no BPM data
      await handleDJPlayerSeek(playerIndex2, djPlayerPositions[playerIndex1]);
      Alert.alert('Synced', 'Players synced by position');
    }
  };

  const loadSpotifyPlaylists = async () => {
    if (!user || !session) return;

    setLoadingPlaylists(true);
    setSpotifyError(null);
    try {
      const playlists = await fetchUserPlaylists(session);
      setSpotifyPlaylists(playlists);
    } catch (error: any) {
      console.error('Error loading Spotify playlists:', error);
      setSpotifyError(error.message || 'Failed to load playlists');
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const loadPlaylistTracks = async (playlist: SpotifyPlaylist) => {
    if (!session) return;

    setSelectedPlaylist(playlist);
    setLoadingTracks(true);
    setSpotifyError(null);
    try {
      const tracks = await fetchPlaylistTracks(playlist.id, session);
      setPlaylistTracks(tracks);
    } catch (error: any) {
      console.error('Error loading playlist tracks:', error);
      setSpotifyError(error.message || 'Failed to load tracks');
      setPlaylistTracks([]);
    } finally {
      setLoadingTracks(false);
    }
  };

  const queueSpotifyTrack = (track: SpotifyTrack) => {
    if (!user || !connected || !socketService.socket) {
      Alert.alert('Error', 'Not connected to room');
      return;
    }

    const queueTrack = spotifyTrackToQueueTrack(track, user.id);
    
    socketService.socket.emit('add-track', {
      roomId,
      trackUrl: queueTrack.url,
      trackInfo: queueTrack.info,
      platform: 'spotify',
    });
  };

  const queueAllTracks = () => {
    if (!user || !connected || !socketService.socket || playlistTracks.length === 0) {
      Alert.alert('Error', 'No tracks to queue');
      return;
    }

    let queuedCount = 0;
    playlistTracks.forEach((track) => {
      const queueTrack = spotifyTrackToQueueTrack(track, user.id);
      socketService.socket?.emit('add-track', {
        roomId,
        trackUrl: queueTrack.url,
        trackInfo: queueTrack.info,
        platform: 'spotify',
      });
      queuedCount++;
    });

    Alert.alert('Success', `Queued ${queuedCount} track${queuedCount === 1 ? '' : 's'}`);
  };

  const [createPlaylistDialogVisible, setCreatePlaylistDialogVisible] = useState(false);

  const handleCreatePlaylist = async (playlistData: {
    name: string;
    description: string;
    tracks: Track[];
    invitedFriendIds: string[];
  }) => {
    if (!user || !profile || !hasTier(profile.subscription_tier, 'pro')) {
      Alert.alert('Error', 'Only PRO tier users can create playlists');
      return;
    }

    try {
      // Create playlist
      const { data: playlist, error: playlistError } = await supabase
        .from('playlists')
        .insert({
          user_id: user.id,
          name: playlistData.name,
          description: playlistData.description || `Created from room ${roomName || roomId}`,
          created_from_room_id: roomId,
        })
        .select()
        .single();

      if (playlistError) throw playlistError;

      // Add tracks to playlist
      const tracksToInsert = playlistData.tracks.map((track, index) => ({
        playlist_id: playlist.id,
        track_id: track.id || `track_${index}`,
        track_url: track.url || '',
        track_title: track.info?.fullTitle || track.info?.title || 'Unknown Track',
        track_artist: track.info?.artist || '',
        track_thumbnail: track.info?.thumbnail || '',
        platform: track.platform || (track.url?.includes('spotify') ? 'spotify' : track.url?.includes('youtube') ? 'youtube' : 'soundcloud'),
        position: index,
        added_by: user.id,
      }));

      const { error: tracksError } = await supabase
        .from('playlist_tracks')
        .insert(tracksToInsert);

      if (tracksError) throw tracksError;

      // Create invites for friends
      if (playlistData.invitedFriendIds.length > 0) {
        const invitesToInsert = playlistData.invitedFriendIds.map((friendId) => ({
          playlist_id: playlist.id,
          invited_user_id: friendId,
          invited_by: user.id,
          status: 'pending',
        }));

        const { error: invitesError } = await supabase
          .from('playlist_invites')
          .insert(invitesToInsert);

        if (invitesError) {
          console.error('Error creating playlist invites:', invitesError);
          // Don't fail the whole operation if invites fail
        }
      }

      setCreatePlaylistDialogVisible(false);

      Alert.alert(
        'Success',
        `Playlist "${playlistData.name}" created with ${playlistData.tracks.length} tracks!${playlistData.invitedFriendIds.length > 0 ? ` ${playlistData.invitedFriendIds.length} friend(s) invited.` : ''}`,
        [
          {
            text: 'View Playlist',
            onPress: () => navigation.navigate('Playlist', { playlistId: playlist.id }),
          },
          { text: 'OK' },
        ]
      );
    } catch (error: any) {
      console.error('Error creating playlist:', error);
      throw error; // Re-throw to let the dialog handle it
    }
  };

  const handleQueueTracks = async (urls: string[]) => {
    if (!user) {
      Alert.alert(
        'Sign Up Required',
        'You need to create an account to add tracks to the queue. Would you like to sign up?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Up', onPress: () => navigation.navigate('Auth') },
        ]
      );
      return;
    }

    if (!connected) {
      Alert.alert('Error', 'Not connected to room. Please wait...');
      return;
    }

    if (!socketService.socket) {
      Alert.alert('Error', 'Not connected to room socket');
      return;
    }

    setLoading(true);
    try {
      // Add all extracted URLs
      let successCount = 0;
      let errorCount = 0;
      
      for (const url of urls) {
        try {
          // Detect platform and fetch metadata if needed
          const normalizedUrl = url.toLowerCase();
          const isSoundCloud = normalizedUrl.includes('soundcloud.com');
          const isSpotify = normalizedUrl.includes('spotify.com') || normalizedUrl.includes('open.spotify.com') || normalizedUrl.startsWith('spotify:');
          const isYouTube = normalizedUrl.includes('youtube.com') || normalizedUrl.includes('youtu.be');

          let trackInfo = null;
          let platform: 'soundcloud' | 'spotify' | 'youtube' | undefined = undefined;

          // Fetch metadata for SoundCloud URLs
          if (isSoundCloud) {
            try {
              trackInfo = await fetchSoundCloudTrackMetadata(url);
              platform = 'soundcloud';
            } catch (error) {
              console.error('Error fetching SoundCloud metadata:', error);
              // Continue with null trackInfo - server will use fallback
            }
          } else if (isSpotify) {
            platform = 'spotify';
            // Spotify tracks should be added via the Spotify search/playlist interface
            // For direct URLs, we'll let the server handle it
          } else if (isYouTube) {
            try {
              trackInfo = await fetchYouTubeTrackMetadata(url);
              platform = 'youtube';
            } catch (error) {
              console.error('Error fetching YouTube metadata:', error);
              platform = 'youtube';
              // Continue with null trackInfo - server will use fallback
            }
          }

          // Emit add-track event with metadata if available
          socketService.socket.emit('add-track', {
            roomId,
            trackUrl: url,
            trackInfo: trackInfo || undefined,
            platform: platform || undefined,
          });
          successCount++;
        } catch (error) {
          console.error('Error adding track:', error);
          errorCount++;
        }
      }
      
      // Show success message
      if (successCount > 0) {
        if (urls.length === 1) {
          Alert.alert('Success', 'Track added to queue!');
        } else {
          Alert.alert(
            'Success',
            `Added ${successCount} track${successCount === 1 ? '' : 's'} to queue${errorCount > 0 ? ` (${errorCount} failed)` : ''}`
          );
        }
      } else {
        Alert.alert('Error', 'Failed to add tracks');
      }
    } catch (error) {
      console.error('Error adding tracks:', error);
      Alert.alert('Error', 'Failed to add tracks');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const addTrack = async () => {
    if (!user) {
      Alert.alert(
        'Sign Up Required',
        'You need to create an account to add tracks to the queue. Would you like to sign up?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Up', onPress: () => navigation.navigate('Auth') },
        ]
      );
      return;
    }

    // Check if user can queue tracks
    const canQueue = isOwner || isAdmin || roomSettings.allowQueue;
    if (!canQueue) {
      Alert.alert('Permission Denied', 'Only room owner and admins can add tracks to the queue.');
      return;
    }

    if (!trackUrl.trim()) {
      Alert.alert('Error', 'Please enter a track URL or paste text containing URLs');
      return;
    }

    if (!connected) {
      Alert.alert('Error', 'Not connected to room. Please wait...');
      return;
    }

    // Extract URLs from the input text
    const extractedUrls = extractMusicUrls(trackUrl);
    
    if (extractedUrls.length === 0) {
      Alert.alert(
        'No URLs Found',
        'Could not find any SoundCloud, Spotify, or YouTube URLs in the text. Please paste a valid URL or text containing URLs.'
      );
      return;
    }

    await handleQueueTracks(extractedUrls);
    setTrackUrl('');
  };

  const playPause = () => {
    console.log('[playPause] Called', { canControl, connected, currentTrack: !!currentTrack, isPlaying, roomId });
    
    if (!canControl) {
      console.log('[playPause] Blocked: No control permission');
      Alert.alert('Permission Denied', 'Only room owner and admins can control playback.');
      return;
    }

    if (!connected) {
      console.log('[playPause] Blocked: Not connected');
      Alert.alert('Error', 'Not connected to room');
      return;
    }

    if (!currentTrack) {
      console.log('[playPause] Blocked: No current track');
      Alert.alert('No Track', 'No track is currently playing. Add a track to the queue first.');
      return;
    }

    if (isPlaying) {
      console.log('[playPause] Emitting pause event', { roomId, currentTrack: currentTrack.url });
      if (socketService.socket) {
        socketService.socket.emit('pause', { roomId });
      } else {
        console.error('[playPause] No socket available');
      }
    } else {
      console.log('[playPause] Emitting play event', { roomId, currentTrack: currentTrack.url });
      if (socketService.socket) {
        socketService.socket.emit('play', { roomId });
      } else {
        console.error('[playPause] No socket available');
      }
    }
  };

  const nextTrack = () => {
    if (!canControl) {
      Alert.alert('Permission Denied', 'Only room owner and admins can control playback.');
      return;
    }

    if (!connected) {
      Alert.alert('Error', 'Not connected to room');
      return;
    }

    if (queue.length > 0 && socketService.socket) {
      socketService.socket.emit('next-track', { roomId });
    } else if (queue.length === 0) {
      Alert.alert('No Tracks', 'Queue is empty. Add tracks to continue.');
    }
  };

  const syncToSession = () => {
    if (!connected || !socketService.socket) return;

    // For YouTube tracks, we use the current position from state
    // The YouTube player reports position updates via onPositionUpdate
    // which updates the position state, so we can use that
    const syncPosition = position;

    socketService.socket.emit('sync-all-users', {
      roomId,
      position: syncPosition,
    });

    setIsUserSyncedToSession(true);
    Alert.alert('Success', 'Synced to music session!');
  };

  const handlePrevious = () => {
    console.log('[handlePrevious] Back button pressed');

    if (!canControl) {
      console.log('[handlePrevious] No control permissions');
      Alert.alert('Permission Denied', 'Only room owner and admins can control playback.');
      return;
    }

    if (!connected) {
      console.log('[handlePrevious] Not connected');
      Alert.alert('Error', 'Not connected to room');
      return;
    }

    if (!currentTrack) {
      console.log('[handlePrevious] No current track');
      Alert.alert('No Track', 'No track is currently playing.');
      return;
    }

    const now = Date.now();
    const timeSinceLastClick = now - lastPreviousClickTime.current;
    console.log('[handlePrevious] Time since last click:', timeSinceLastClick, 'ms, history length:', history.length);

    if (timeSinceLastClick < PREVIOUS_DOUBLE_CLICK_WINDOW && history.length > 0) {
      // Second click within window - go to previous track
      console.log('[handlePrevious] Double-click detected - replaying previous track');
      const previousTrack = history[0]; // Most recent track in history
      if (previousTrack && socketService.socket) {
        socketService.socket.emit('replay-track', { roomId, trackId: previousTrack.id });
        Alert.alert('Previous Track', `Playing: ${previousTrack.info?.fullTitle || 'Previous track'}`);
      }
      lastPreviousClickTime.current = 0; // Reset
    } else {
      // First click - restart current track
      console.log('[handlePrevious] Single click - restarting current track');
      if (socketService.socket) {
        socketService.socket.emit('restart-track', { roomId });
        Alert.alert('Restart', 'Track restarted from beginning');
      }
      lastPreviousClickTime.current = now;
    }
  };

  const addFriend = (friendId: string) => {
    if (!socketService.socket || !user) return;
    socketService.socket.emit('add-friend', { friendId });
  };

  const acceptFriendRequest = (friendId: string) => {
    if (!socketService.socket || !user) return;
    socketService.socket.emit('accept-friend-request', { friendId });
  };

  const rejectFriendRequest = (friendId: string) => {
    if (!socketService.socket || !user) return;
    socketService.socket.emit('reject-friend-request', { friendId });
  };

  const removeFriend = (friendId: string) => {
    if (!socketService.socket || !user) return;
    socketService.socket.emit('remove-friend', { friendId });
  };

  const addAdmin = () => {
    if (!isOwner || !socketService.socket) return;
    if (!addAdminInput.trim()) {
      Alert.alert('Error', 'Please enter a username');
      return;
    }
    socketService.socket.emit('add-room-admin', {
      roomId,
      username: addAdminInput.trim(),
    });
    setAddAdminInput('');
  };

  const removeAdmin = (adminId: string) => {
    if (!isOwner || !socketService.socket) return;
    socketService.socket.emit('remove-room-admin', {
      roomId,
      adminId,
    });
  };

  const saveSettings = () => {
    if (!isOwner && !isAdmin || !socketService.socket) return;
    socketService.socket.emit('update-room-settings', {
      roomId,
      settings: {
        isPrivate: roomSettings.isPrivate,
        allowControls: roomSettings.allowControls,
        allowQueue: roomSettings.allowQueue,
        allowQueueRemoval: roomSettings.allowQueueRemoval,
        djMode: roomSettings.djMode,
        djPlayers: roomSettings.djPlayers,
        allowPlaylistAdditions: roomSettings.allowPlaylistAdditions,
        sessionEnabled: roomSettings.sessionEnabled,
        autoplay: roomSettings.autoplay,
      },
    });
    Alert.alert('Success', 'Settings saved!');
  };

  const toggleAutoplay = () => {
    if (!isOwner && !isAdmin || !socketService.socket) return;
    const newAutoplay = !roomSettings.autoplay;
    setRoomSettings(prev => ({ ...prev, autoplay: newAutoplay }));
    socketService.socket.emit('update-room-settings', {
      roomId,
      settings: {
        ...roomSettings,
        autoplay: newAutoplay,
      },
    });
  };

  const toggleShowMediaPlayer = async () => {
    const newValue = !showMediaPlayer;
    setShowMediaPlayer(newValue);
    try {
      await localStorageHelpers.set('showMediaPlayer', newValue.toString());
    } catch (error) {
      console.error('Error saving media player preference:', error);
    }
  };

  const shareRoom = async () => {
    try {
      // Fetch room data including short_code if not already loaded
      if (!shortCode && supabase) {
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('short_code')
          .eq('id', roomId)
          .single();

        if (!roomError && roomData?.short_code) {
          setShortCode(roomData.short_code);
        }
      }
      
      // Show share dialog
      setShowShareDialog(true);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load room information');
      console.error('Error loading room data:', error);
    }
  };

  const purchaseBoost = useCallback(async () => {
    if (!user || !session) {
      Alert.alert('Sign In Required', 'You need to sign in to purchase a boost.');
      navigation.navigate('Auth');
      return;
    }
    
    // Confirm purchase
    Alert.alert(
      'Purchase Boost',
      'Purchase a 1-hour boost for $1 USD? This will give the room Pro tier benefits (unlimited queue, DJ mode, no ads).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purchase',
          onPress: async () => {
            setPurchasingBoost(true);
            try {
              const response = await fetch(`${API_URL}/api/rooms/${roomId}/boost`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
                },
              });
              
              const data = await response.json();
              
              if (!response.ok) {
                throw new Error(data.error || 'Failed to purchase boost');
              }
              
              Alert.alert('Success!', data.message || 'Boost activated successfully!');
              
              // Refresh room state
              if (socketService.socket) {
                socketService.socket.emit('join-room', roomId);
              }
            } catch (error: any) {
              console.error('Error purchasing boost:', error);
              Alert.alert('Error', error.message || 'Failed to purchase boost. Please try again.');
            } finally {
              setPurchasingBoost(false);
            }
          },
        },
      ]
    );
  }, [user, session, roomId, navigation]);




  // Automatically enable DJ mode when DJ Mode tab is accessed by Pro user
  useEffect(() => {
    const isPro = profile && hasTier(profile.subscription_tier, 'pro');
    if (activeTab === 'djmode' && isPro && tierSettings.djMode && !roomSettings.djMode && (isOwner || isAdmin) && socketService.socket) {
      socketService.socket.emit('update-room-settings', {
        roomId,
        settings: {
          ...roomSettings,
          djMode: true,
          djPlayers: roomSettings.djPlayers || 1, // Default to 1 player if not set
        },
      });
    }
  }, [activeTab, profile, tierSettings.djMode, roomSettings.djMode, isOwner, isAdmin, roomId]);



  const renderChatTab = () => {
    if (!supabase) {
      return (
        <View style={styles.tabContent}>
          <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <Text style={[styles.emptyQueue, { color: theme.colors.onSurfaceVariant }]}>
                Chat unavailable. Please check your connection.
              </Text>
            </Card.Content>
          </Card>
        </View>
      );
    }

    // RoomChat has its own container with flex: 1, so we don't need tabContent wrapper
    return <RoomChat roomId={roomId} supabase={supabase} />;
  };

  // Determine tier for header color - use creator tier if available, otherwise current user's tier
  const headerTier = creatorTier || (profile?.subscription_tier as SubscriptionTier) || 'free';
  const headerColor = getTierHeaderColor(headerTier);

  // Update navigation header color based on tier
  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: {
        backgroundColor: headerColor,
      },
      headerTintColor: theme.colors.onSurface, // Ensure icons are visible
    });
  }, [navigation, headerColor, theme.colors.onSurface]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <RoomHeader
        headerColor={headerColor}
        roomName={roomName || ''}
        shortCode={shortCode || null}
        connected={connected}
        activeTab={activeTab}
        isPlaying={isPlaying}
        currentTrack={currentTrack}
        canControl={canControl}
        queue={queue}
        userCount={userCount}
        profile={profile}
        roomSettings={roomSettings}
        isDJModeActive={isDJModeActive}
        setIsDJModeActive={setIsDJModeActive}
        playPause={playPause}
        handlePrevious={handlePrevious}
        nextTrack={nextTrack}
        shareRoom={shareRoom}
        setActiveTab={setActiveTab}
        unreadChatCount={unreadChatCount}
        user={user}
        tierSettings={tierSettings}
        isOwner={isOwner}
        isAdmin={isAdmin}
        setShowDJModeConfirmDialog={setShowDJModeConfirmDialog}
      />

      {/* Tab Content */}
      {activeTab === 'main' && (
        <RoomMainTab
          isDJModeActive={isDJModeActive}
          roomSettings={roomSettings}
          profile={profile}
          scrollViewRef={scrollViewRef}
          handleScroll={handleScroll}
          playbackBlocked={playbackBlocked}
          blockedInfo={blockedInfo}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          trackReactions={trackReactions}
          canControl={canControl}
          user={user}
          queue={queue}
          history={history}
          position={position}
          duration={duration}
          roomId={roomId}
          playPause={playPause}
          handlePrevious={handlePrevious}
          nextTrack={nextTrack}
          handleReaction={handleReaction}
          loadingReaction={loadingReaction}
          toggleAutoplay={toggleAutoplay}
          showMediaPlayer={showMediaPlayer}
          toggleShowMediaPlayer={toggleShowMediaPlayer}
          isOwner={isOwner}
          isAdmin={isAdmin}
          trackUrl={trackUrl}
          setTrackUrl={setTrackUrl}
          addTrack={addTrack}
          loading={loading}
          removingTrackIds={removingTrackIds}
          handleRemoveTrack={handleRemoveTrack}
          setDuration={setDuration}
          purchaseBoost={purchaseBoost}
          purchasingBoost={purchasingBoost}
          creatorTier={creatorTier}
          activeBoost={activeBoost}
          tierSettings={tierSettings}
          navigation={navigation}
          djPlayerTracks={djPlayerTracks}
          djPlayerPlayingStates={djPlayerPlayingStates}
          djPlayerVolumes={djPlayerVolumes}
          djPlayerBPMs={djPlayerBPMs}
          djPlayerPositions={djPlayerPositions}
          djPlayerDurations={djPlayerDurations}
          handleDJPlayerPlayPause={handleDJPlayerPlayPause}
          handleDJPlayerLoadTrack={handleDJPlayerLoadTrack}
          handleDJPlayerVolumeChange={handleDJPlayerVolumeChange}
          handleDJPlayerSeek={handleDJPlayerSeek}
          handleDJPlayerSync={handleDJPlayerSync}
          setDjPlayerTracks={setDjPlayerTracks}
          setQueue={setQueue}
          setShowQueueDialog={setShowQueueDialog}
          setCreatePlaylistDialogVisible={setCreatePlaylistDialogVisible}
          setPlaybackBlocked={setPlaybackBlocked}
          setBlockedInfo={setBlockedInfo}
        />
      )}
      {activeTab === 'users' && (
        <RoomUsersTab
          users={users}
          userCount={userCount}
          user={user}
          friends={friends}
          friendRequests={friendRequests}
          onAddFriend={addFriend}
          onAcceptFriendRequest={acceptFriendRequest}
          onRejectFriendRequest={rejectFriendRequest}
          onRemoveFriend={removeFriend}
        />
      )}
      {activeTab === 'chat' && renderChatTab()}
      {activeTab === 'spotify' && (
        <RoomSpotifyTab
          user={user}
          navigation={navigation}
          spotifyPlaylists={spotifyPlaylists}
          selectedPlaylist={selectedPlaylist}
          playlistTracks={playlistTracks}
          loadingPlaylists={loadingPlaylists}
          loadingTracks={loadingTracks}
          spotifyError={spotifyError}
          onLoadPlaylists={loadSpotifyPlaylists}
          onSelectPlaylist={(playlist) => {
            if (playlist) {
              loadPlaylistTracks(playlist);
            } else {
              setSelectedPlaylist(null);
              setPlaylistTracks([]);
            }
          }}
          onQueueTrack={queueSpotifyTrack}
          onQueueAllTracks={queueAllTracks}
        />
      )}
      {activeTab === 'djmode' && (
        <RoomDJModeTab
          profile={profile}
          navigation={navigation}
          isOwner={isOwner}
          isAdmin={isAdmin}
          roomSettings={roomSettings}
          tierSettings={tierSettings}
          queue={queue}
          djPlayerTracks={djPlayerTracks}
          djPlayerPlayingStates={djPlayerPlayingStates}
          djPlayerVolumes={djPlayerVolumes}
          djPlayerBPMs={djPlayerBPMs}
          djPlayerPositions={djPlayerPositions}
          djPlayerDurations={djPlayerDurations}
          onPlayerPlayPause={handleDJPlayerPlayPause}
          onPlayerLoadTrack={handleDJPlayerLoadTrack}
          onPlayerVolumeChange={handleDJPlayerVolumeChange}
          onPlayerSeek={handleDJPlayerSeek}
          onSyncTracks={handleDJPlayerSync}
          onSetDjPlayerTracks={setDjPlayerTracks}
          onSetDjPlayerBPMs={setDjPlayerBPMs}
        />
      )}
      {activeTab === 'settings' && (
        <RoomSettingsTab
          isOwner={isOwner}
          isAdmin={isAdmin}
          roomSettings={roomSettings}
          users={users}
          addAdminInput={addAdminInput}
          onSettingsChange={setRoomSettings}
          onAddAdminInputChange={setAddAdminInput}
          onAddAdmin={addAdmin}
          onRemoveAdmin={removeAdmin}
          onSaveSettings={saveSettings}
        />
      )}

      {/* Floating Player - Hidden by default, only show when explicitly requested */}
      {currentTrack && floatingPlayerVisible && !miniPlayerVisible && (
        <FloatingPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onPlayPause={playPause}
          onNext={nextTrack}
          minimized={playerMinimized}
          onToggleMinimize={() => setPlayerMinimized(!playerMinimized)}
        />
      )}

      <ShareRoomDialog
        visible={showShareDialog}
        onDismiss={() => setShowShareDialog(false)}
        roomName={roomName || ''}
        roomId={roomId || ''}
        shortCode={shortCode}
        onCopyUrl={() => {
          Alert.alert('Success', 'Room URL copied to clipboard!');
        }}
        onCopyCode={() => {
          Alert.alert('Success', 'Join code copied to clipboard!');
        }}
      />
      <QueueDialog
        visible={showQueueDialog}
        onDismiss={() => setShowQueueDialog(false)}
        onQueue={handleQueueTracks}
        canQueue={isOwner || isAdmin || roomSettings.allowQueue}
      />

      <DJModeConfirmDialog
        visible={showDJModeConfirmDialog}
        onConfirm={() => {
          setShowDJModeConfirmDialog(false);
          // Navigate to DJ Mode screen with the same room ID
          navigation.navigate('DJMode', { roomId, roomName });
        }}
        onDismiss={() => {
          setShowDJModeConfirmDialog(false);
        }}
      />

      <SessionExitDialog
        visible={showSessionExitDialog}
        onOpenMiniPlayer={handleOpenMiniPlayer}
        onExitRoom={handleExitRoom}
        onDismiss={() => {
          setShowSessionExitDialog(false);
          setPendingNavigation(null);
        }}
      />

      {/* MiniPlayer FAB Button - Hide when MiniPlayer is visible */}
      {currentTrack && !miniPlayerVisible && (
        <Animated.View
          style={[
            styles.fabContainer,
            {
              transform: [{ translateX: fabTranslateX }],
            },
          ]}
        >
          <AnimatedFAB
            isPlaying={isPlaying}
            sessionEnabled={roomSettings.sessionEnabled}
            hasQueue={queue.length > 0}
            pulseAnim={fabPulseAnim}
            colorAnim={fabColorAnim}
            onPress={handleToggleMiniPlayer}
            miniPlayerVisible={miniPlayerVisible}
            theme={theme}
          />
        </Animated.View>
      )}

      {miniPlayerVisible && currentTrack && (
        <MiniPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          roomName={roomName || ''}
          onPlayPause={playPause}
          onExpand={handleExpandMiniPlayer}
          onClose={handleCloseMiniPlayer}
          position="left"
          onPrevious={handlePrevious}
          onNext={nextTrack}
          hasQueue={queue.length > 0}
          canControl={canControl}
        />
      )}

      {/* Create Playlist Dialog */}
      <CreatePlaylistDialog
        visible={createPlaylistDialogVisible}
        onDismiss={() => setCreatePlaylistDialogVisible(false)}
        onCreate={handleCreatePlaylist}
        queue={queue}
        history={history}
        userId={user?.id}
        supabase={supabase}
      />

      {/* Ad Dialog */}
      <AdDialog
        visible={adVisible}
        ad={currentAd}
        countdown={adCountdown}
        onDismiss={() => {
          setAdVisible(false);
          setCurrentAd(null);
          // Resume playback if there's a current track
          if (currentTrack && socketService.socket) {
            socketService.socket.emit('play', { roomId });
          }
        }}
        onUpgrade={() => {
          navigation.navigate('Subscription');
        }}
        onBooster={() => {
          // Show booster pack options - this will be handled by UpgradePrompt if needed
          // For now, just navigate to subscription screen
          navigation.navigate('Subscription');
        }}
      />

    </View>
  );
};

const styles = roomScreenStyles;

export default RoomScreen;