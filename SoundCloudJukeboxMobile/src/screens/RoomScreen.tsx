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
import { LinearGradient } from 'expo-linear-gradient';
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
import { roomScreenStyles } from './RoomScreen.styles';
import { RoomUser, Friend, RoomSettings, BlockedInfo, ActiveBoost, TierSettings } from './RoomScreen.types';

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
  const [activeFriendsTab, setActiveFriendsTab] = useState<'list' | 'requests'>('list');

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
    
    const handleSyncAllUsers = (data: { position: number }) => {
      // Sync all users to this position (from Supabase)
      setPosition(data.position);
    };
    
    // Listen for seek and sync events from socket
    if (socketService.socket) {
      socketService.socket.on('seek-track', handleSeekTrack);
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
        reactionType
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
    if (!playerState || !playerState.sound) {
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
    
    if (!state1 || !state1.sound || !state2 || !state2.sound) {
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
            platform = 'youtube';
            // YouTube tracks should be added via the YouTube search interface
            // For direct URLs, we'll let the server handle it
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
    if (!canControl) {
      Alert.alert('Permission Denied', 'Only room owner and admins can control playback.');
      return;
    }

    if (!connected) {
      Alert.alert('Error', 'Not connected to room');
      return;
    }

    if (!currentTrack) {
      Alert.alert('No Track', 'No track is currently playing.');
      return;
    }

    const now = Date.now();
    const timeSinceLastClick = now - lastPreviousClickTime.current;

    if (timeSinceLastClick < PREVIOUS_DOUBLE_CLICK_WINDOW && history.length > 0) {
      // Second click within window - go to previous track
      const previousTrack = history[0]; // Most recent track in history
      if (previousTrack && socketService.socket) {
        socketService.socket.emit('replay-track', { roomId, trackId: previousTrack.id });
      }
      lastPreviousClickTime.current = 0; // Reset
    } else {
      // First click - restart current track
      if (socketService.socket) {
        socketService.socket.emit('restart-track', { roomId });
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

  const renderMainTab = useCallback(() => {
    // Show DJ Mode interface if active and user has PRO tier
    if (isDJModeActive && roomSettings.djMode && profile && hasTier(profile.subscription_tier, 'pro')) {
      return (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
          <DJModeInterface
            djMode={roomSettings.djMode}
            djPlayers={roomSettings.djPlayers}
            playerTracks={djPlayerTracks}
            playerPlayingStates={djPlayerPlayingStates}
            playerVolumes={djPlayerVolumes}
            playerBPMs={djPlayerBPMs}
            playerPositions={djPlayerPositions}
            playerDurations={djPlayerDurations}
            onPlayerPlayPause={handleDJPlayerPlayPause}
            onPlayerLoadTrack={handleDJPlayerLoadTrack}
            onPlayerVolumeChange={handleDJPlayerVolumeChange}
            onPlayerSeek={handleDJPlayerSeek}
            onSyncTracks={handleDJPlayerSync}
          />
          
          {/* Queue for loading tracks into DJ players */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="playlist-music" size={22} color={theme.colors.primary} />
                <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                  Queue (Load to Players)
                </Title>
              </View>
              {queue.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="music-off" size={48} color={theme.colors.onSurfaceVariant} />
                  <Text style={[styles.emptyQueue, { color: theme.colors.onSurfaceVariant }]}>
                    Queue is empty. Add tracks to load into DJ players.
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.queueList} showsVerticalScrollIndicator={false}>
                  {queue.map((track, index) => (
                    <List.Item
                      key={track.id}
                      title={track.info?.fullTitle || 'Unknown Track'}
                      description={`${track.platform} • Click to load into a player`}
                      left={() => (
                        <Avatar.Image
                          size={40}
                          source={{ uri: getThumbnailUrl(track.info?.thumbnail, 40) }}
                        />
                      )}
                      onPress={() => {
                        // Show player selection dialog
                        Alert.alert(
                          'Load Track',
                          'Select a player to load this track into:',
                          [
                            ...Array.from({ length: roomSettings.djPlayers }, (_, i) => ({
                              text: `Player ${i + 1}`,
                              onPress: () => {
                                handleDJPlayerLoadTrack(i);
                              },
                            })),
                            { text: 'Cancel', style: 'cancel' },
                          ]
                        );
                      }}
                    />
                  ))}
                </ScrollView>
              )}
            </Card.Content>
          </Card>
        </ScrollView>
      );
    }

    // Standard mode interface
    return (
      <ScrollView 
        ref={scrollViewRef}
        style={styles.tabContent} 
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Show UpgradePrompt if playback is blocked, otherwise show NowPlayingCard */}
        {playbackBlocked && blockedInfo ? (
        <UpgradePrompt
          isOwner={blockedInfo.isOwner}
          blockedAt={blockedInfo.blockedAt}
          songsPlayed={blockedInfo.songsPlayed}
          roomId={roomId}
          onBoosterPurchased={() => {
            // Refresh room state after booster purchase
            setPlaybackBlocked(false);
            setBlockedInfo(null);
            if (socketService.socket) {
              socketService.socket.emit('join-room', roomId);
            }
          }}
        />
      ) : (
        <NowPlayingCard
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          trackReactions={trackReactions}
          canControl={canControl}
          onReaction={handleReaction}
          loadingReaction={loadingReaction}
          hasUser={!!user}
          queueLength={queue.length}
          autoplay={roomSettings.autoplay}
          onToggleAutoplay={toggleAutoplay}
          canToggleAutoplay={isOwner || isAdmin}
          position={position}
          duration={duration}
          onAddToPlaylist={() => setShowQueueDialog(true)}
          onPlayPause={playPause}
          onPrevious={handlePrevious}
          onNext={nextTrack}
          hasQueue={queue.length > 0}
          onCreatePlaylist={() => setCreatePlaylistDialogVisible(true)}
          canCreatePlaylist={!!(profile && hasTier(profile.subscription_tier, 'pro'))}
        />
      )}

      {/* DJ Mode Interface */}
      {roomSettings.djMode && (
        <DJModeInterface
          djMode={roomSettings.djMode}
          djPlayers={roomSettings.djPlayers}
          playerTracks={djPlayerTracks}
          playerPlayingStates={djPlayerPlayingStates}
          onPlayerPlayPause={(playerIndex) => {
            setDjPlayerPlayingStates(prev => {
              const newStates = [...prev];
              newStates[playerIndex] = !newStates[playerIndex];
              return newStates;
            });
          }}
          onPlayerLoadTrack={(playerIndex) => {
            if (queue.length > 0) {
              const trackToLoad = queue[0];
              setDjPlayerTracks(prev => {
                const newTracks = [...prev];
                newTracks[playerIndex] = trackToLoad;
                return newTracks;
              });
              setQueue(prev => prev.slice(1));
            } else {
              Alert.alert('No Tracks', 'Queue is empty. Add tracks to load into DJ players.');
            }
          }}
        />
      )}

      {/* YouTube Player - Show for YouTube tracks (separate from NowPlayingCard) */}
      {currentTrack && (currentTrack.url?.includes('youtube') || currentTrack.url?.includes('youtu.be')) && (
        <View style={styles.youtubePlayerContainer}>
          <YouTubePlayer
            track={currentTrack}
            isPlaying={isPlaying}
            position={position}
            onPositionUpdate={(newPosition) => {
              // Send position update to server (which saves to Supabase)
              if (socketService.socket && !playbackBlocked) {
                socketService.socket.emit('sync-position', {
                  roomId,
                  position: newPosition,
                });
              }
            }}
            onReady={() => {
              console.log('YouTube player ready');
            }}
            onError={(error) => {
              console.error('YouTube player error:', error);
              Alert.alert('YouTube Error', error);
            }}
            onStateChange={(state) => {
              // Update local state based on YouTube player state
              // But Supabase is source of truth, so we sync to it
              if (state === 'playing' && !isPlaying) {
                // YouTube started playing, but wait for Supabase confirmation
              } else if (state === 'paused' && isPlaying) {
                // YouTube paused, but wait for Supabase confirmation
              } else if (state === 'ended') {
                // Track ended - trigger next track if autoplay is enabled
                // Server will handle permission checks, so we don't need canControl here
                if (roomSettings.autoplay && queue.length > 0 && socketService.socket) {
                  console.log('Track ended, autoplay enabled, triggering next track');
                  socketService.socket.emit('next-track', { roomId });
                }
              }
            }}
          />
        </View>
      )}

      {/* SoundCloud Player - Show for SoundCloud tracks (separate from NowPlayingCard) */}
      {currentTrack && currentTrack.url?.includes('soundcloud.com') && (
        <View style={styles.youtubePlayerContainer}>
          <SoundCloudPlayer
            track={currentTrack}
            isPlaying={isPlaying}
            position={position}
            onPositionUpdate={(newPosition) => {
              // Send position update to server (which saves to Supabase)
              console.log('[RoomScreen] SoundCloud position update', { newPosition });
              if (socketService.socket && !playbackBlocked) {
                socketService.socket.emit('sync-position', {
                  roomId,
                  position: newPosition,
                });
              }
            }}
            onDurationUpdate={(newDuration) => {
              console.log('[RoomScreen] SoundCloud duration update', { duration: newDuration });
              setDuration(newDuration);
            }}
            onReady={() => {
              console.log('[RoomScreen] SoundCloud player ready');
            }}
            onError={(error) => {
              console.error('[RoomScreen] SoundCloud player error:', error);
              Alert.alert('SoundCloud Error', error);
            }}
            onStateChange={(state) => {
              console.log('[RoomScreen] SoundCloud state changed', { state, isPlaying });
              // Update local state based on SoundCloud player state
              // But Supabase is source of truth, so we sync to it
              if (state === 'playing' && !isPlaying) {
                // SoundCloud started playing, but wait for Supabase confirmation
              } else if (state === 'paused' && isPlaying) {
                // SoundCloud paused, but wait for Supabase confirmation
              } else if (state === 'ended') {
                // Track ended - trigger next track if autoplay is enabled
                // Server will handle permission checks, so we don't need canControl here
                if (roomSettings.autoplay && queue.length > 0 && socketService.socket) {
                  console.log('[RoomScreen] SoundCloud track ended, autoplay enabled, triggering next track');
                  socketService.socket.emit('next-track', { roomId });
                }
              }
            }}
          />
        </View>
      )}
      {/* Boost Banner - Show if owner is free tier and no active boost */}
      {creatorTier === 'free' && !activeBoost && (
        <Card style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Card.Content>
            <View style={styles.boostContainer}>
              <View style={styles.boostHeader}>
                <MaterialCommunityIcons name="rocket-launch" size={24} color={theme.colors.primary} />
                <Title style={[styles.boostTitle, { color: theme.colors.onSurface }]}>
                  Boost This Room
                </Title>
              </View>
              <Text style={[styles.boostDescription, { color: theme.colors.onSurfaceVariant }]}>
                This room is on Free tier. Purchase a 1-hour boost for $1 USD to unlock Pro tier benefits:
                {'\n'}• Unlimited queue
                {'\n'}• DJ Mode
                {'\n'}• No ads
              </Text>
              <Button
                mode="contained"
                onPress={purchaseBoost}
                loading={purchasingBoost}
                disabled={purchasingBoost}
                style={styles.boostButton}
                buttonColor={theme.colors.primary}
                textColor={theme.colors.onPrimary}
                icon="rocket-launch"
              >
                {purchasingBoost ? 'Processing...' : 'Boost for $1 USD'}
              </Button>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Active Boost Banner */}
      {activeBoost && (
        <Card style={[styles.card, { backgroundColor: `${theme.colors.primary}15`, borderColor: theme.colors.primary, borderWidth: 2 }]}>
          <Card.Content>
            <View style={styles.boostContainer}>
              <View style={styles.boostHeader}>
                <MaterialCommunityIcons name="rocket-launch" size={24} color={theme.colors.primary} />
                <Title style={[styles.boostTitle, { color: theme.colors.primary }]}>
                  Boost Active! 🚀
                </Title>
              </View>
              <Text style={[styles.boostDescription, { color: theme.colors.onSurface }]}>
                Room has Pro tier benefits for {activeBoost.minutesRemaining} more minute{activeBoost.minutesRemaining !== 1 ? 's' : ''}
              </Text>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Ads Banner - Show based on room creator's tier, not current user's tier */}
      {tierSettings.ads && (
        <AdsBanner
          onUpgradePress={() => {
            if (!user) {
              // If not logged in, navigate to auth screen
              navigation.navigate('Auth');
            } else {
              // Navigate to subscription screen
              navigation.navigate('Subscription');
            }
          }}
        />
      )}

      {/* Add Track */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="plus-circle" size={22} color={theme.colors.primary} />
            <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Add Track
            </Title>
          </View>
          {!user && (
            <View style={[styles.infoNotice, { backgroundColor: `${theme.colors.primary}15` }]}>
              <MaterialCommunityIcons name="information" size={18} color={theme.colors.primary} />
              <Text style={[styles.infoNoticeText, { color: theme.colors.primary }]}>
                Sign up to add tracks to the queue
              </Text>
            </View>
          )}
          {user && !isOwner && !isAdmin && !roomSettings.allowQueue && (
            <View style={[styles.permissionNoticeContainer, { backgroundColor: `${theme.colors.error}15` }]}>
              <MaterialCommunityIcons name="alert-circle" size={16} color={theme.colors.error} />
              <Text style={[styles.permissionNotice, { color: theme.colors.error }]}>
                Only room owner and admins can add tracks to the queue
              </Text>
            </View>
          )}
          <TextInput
            label="SoundCloud, Spotify, or YouTube URL"
            value={trackUrl}
            onChangeText={setTrackUrl}
            mode="outlined"
            placeholder="Paste URL(s) or text with URLs..."
            multiline
            numberOfLines={3}
            style={styles.urlInput}
            editable={!!user && (isOwner || isAdmin || roomSettings.allowQueue)}
            onSubmitEditing={addTrack}
            outlineColor={theme.colors.primary}
            activeOutlineColor={theme.colors.primary}
          />
          <Button
            mode="contained"
            onPress={addTrack}
            loading={loading}
            disabled={loading || !user || (!isOwner && !isAdmin && !roomSettings.allowQueue)}
            style={styles.addButton}
            buttonColor={theme.colors.primary}
            textColor={theme.colors.onPrimary}
            icon="plus"
          >
            {user ? 'Add to Queue' : 'Sign Up to Add Tracks'}
          </Button>
        </Card.Content>
      </Card>

      {/* Queue */}
      <Card style={[styles.card, styles.queueCard]}>
        <Card.Content style={styles.queueCardContent}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionIconContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
                <MaterialCommunityIcons name="playlist-music" size={22} color={theme.colors.primary} />
              </View>
              <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Queue
              </Title>
            </View>
            <View style={[styles.countBadge, { backgroundColor: `${theme.colors.primary}20` }]}>
              <Text style={[styles.countBadgeText, { color: theme.colors.primary }]}>
                {queue.length}
                {tierSettings.queueLimit !== null && ` / ${tierSettings.queueLimit}`}
              </Text>
            </View>
          </View>
          {tierSettings.queueLimit !== null && queue.length >= tierSettings.queueLimit && (
            <View style={[styles.permissionNoticeContainer, { backgroundColor: `${theme.colors.error}15` }]}>
              <MaterialCommunityIcons name="alert-circle" size={16} color={theme.colors.error} />
              <Text style={[styles.permissionNotice, { color: theme.colors.error }]}>
                Queue limit reached ({tierSettings.queueLimit} songs). Room creator needs to upgrade to increase limit.
              </Text>
            </View>
          )}
          {tierSettings.queueLimit !== null && queue.length >= tierSettings.queueLimit * 0.8 && queue.length < tierSettings.queueLimit && (
            <View style={[styles.infoNotice, { backgroundColor: `${theme.colors.primary}15` }]}>
              <MaterialCommunityIcons name="information" size={18} color={theme.colors.primary} />
              <Text style={[styles.infoNoticeText, { color: theme.colors.primary }]}>
                Queue limit: {queue.length} / {tierSettings.queueLimit} songs
              </Text>
            </View>
          )}
          {queue.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="music-off" size={48} color={theme.colors.onSurfaceVariant} />
              <Text style={[styles.emptyQueue, { color: theme.colors.onSurfaceVariant }]}>
                Queue is empty. Add a track to get started!
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.queueList} showsVerticalScrollIndicator={false}>
              {queue.map((track, index) => {
                const canRemove = isOwner || isAdmin || roomSettings.allowQueueRemoval || 
                  (track.addedBy === user?.id);
                const isRemoving = removingTrackIds.has(track.id);
                
                return (
                  <AnimatedQueueItem
                    key={track.id}
                    track={track}
                    index={index}
                    canRemove={canRemove}
                    isRemoving={isRemoving}
                    theme={theme}
                    user={user}
                    onRemove={handleRemoveTrack}
                  />
                );
              })}
            </ScrollView>
          )}
        </Card.Content>
      </Card>

      {/* History */}
      <Card style={[styles.card, styles.historyCard]}>
        <Card.Content style={styles.historyCardContent}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionIconContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
                <MaterialCommunityIcons name="history" size={22} color={theme.colors.primary} />
              </View>
              <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                History
              </Title>
            </View>
            <View style={[styles.countBadge, { backgroundColor: `${theme.colors.primary}20` }]}>
              <Text style={[styles.countBadgeText, { color: theme.colors.primary }]}>
                {history.length}
              </Text>
            </View>
          </View>
          {history.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="clock-outline" size={48} color={theme.colors.onSurfaceVariant} />
              <Text style={[styles.emptyQueue, { color: theme.colors.onSurfaceVariant }]}>
                No tracks played yet
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.queueList} showsVerticalScrollIndicator={false}>
              {history.slice(0, 10).map((track) => (
                <TouchableOpacity
                  key={track.id}
                  activeOpacity={0.8}
                  style={[
                    styles.queueItem, 
                    styles.historyItem, 
                    { 
                      backgroundColor: `${theme.colors.surfaceVariant}60`,
                    }
                  ]}
                  onPress={() => {
                    // Replay track
                    if (socketService.socket) {
                      socketService.socket.emit('replay-track', { roomId, trackId: track.id });
                    }
                  }}
                >
                  <View style={styles.queueItemContent}>
                    <View style={[styles.historyIconContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
                      <MaterialCommunityIcons 
                        name="history" 
                        size={18} 
                        color={theme.colors.primary}
                      />
                    </View>
                    <Avatar.Image
                      size={IS_MOBILE ? 60 : 64}
                      source={{ uri: getThumbnailUrl(track.info?.thumbnail, IS_MOBILE ? 60 : 64) }}
                      style={[styles.queueItemThumbnail, styles.historyThumbnail]}
                    />
                    <View style={styles.queueItemDetails}>
                      <Text 
                        style={[styles.queueItemTitle, { color: theme.colors.onSurface }]}
                        numberOfLines={1}
                      >
                        {track.info?.fullTitle || 'Unknown Track'}
                      </Text>
                      <View style={styles.queueItemMeta}>
                        <MaterialCommunityIcons 
                          name="clock-outline" 
                          size={14} 
                          color={theme.colors.onSurfaceVariant} 
                        />
                        <Text 
                          style={[styles.queueItemDescription, { color: theme.colors.onSurfaceVariant }]}
                          numberOfLines={1}
                        >
                          Previously played
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[styles.replayButton, { backgroundColor: `${theme.colors.primary}20` }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        if (socketService.socket) {
                          socketService.socket.emit('replay-track', { roomId, trackId: track.id });
                        }
                      }}
                    >
                      <MaterialCommunityIcons 
                        name="replay" 
                        size={20} 
                        color={theme.colors.primary}
                      />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </Card.Content>
      </Card>

      {/* Create Playlist Button - Only show for PRO tier users */}
      {profile && profile.subscription_tier === 'pro' && (
        <Card style={styles.card}>
          <Card.Content>
            <Button
              mode="contained"
              onPress={() => setCreatePlaylistDialogVisible(true)}
              icon="playlist-plus"
              style={styles.addButton}
              buttonColor={theme.colors.primary}
              textColor={theme.colors.onPrimary}
            >
              Create Playlist from Room
            </Button>
            <Text style={[styles.settingDescription, { color: theme.colors.onSurfaceVariant, marginTop: 8 }]}>
              Create a playlist with all tracks from history and queue
            </Text>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
  }, [
    isDJModeActive,
    roomSettings,
    profile,
    scrollViewRef,
    handleScroll,
    playbackBlocked,
    blockedInfo,
    currentTrack,
    isPlaying,
    trackReactions,
    canControl,
    user,
    queue,
    position,
    roomId,
    theme,
    playPause,
    nextTrack,
    syncToSession,
    handleReaction,
    loadingReaction,
    handleDJPlayerPlayPause,
    handleDJPlayerLoadTrack,
    handleDJPlayerVolumeChange,
    handleDJPlayerSeek,
    handleDJPlayerSync,
    purchaseBoost,
    purchasingBoost,
    activeBoost,
    tierSettings,
    navigation,
    djPlayerTracks,
    djPlayerPlayingStates,
    djPlayerVolumes,
    djPlayerBPMs,
    djPlayerPositions,
    djPlayerDurations,
    setDjPlayerTracks,
    setQueue,
  ]);

  const renderUsersTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* Users in Room */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>Users in Room ({userCount})</Title>
          <ScrollView style={styles.usersList}>
            {users.map((roomUser) => {
              const isMe = roomUser.userId === user?.id;
              const isFriend = friends.some(f => 
                (f.user_id === roomUser.userId && f.friend_id === user?.id) ||
                (f.friend_id === roomUser.userId && f.user_id === user?.id)
              );
              const hasPendingRequest = friendRequests.some(r => 
                (r.user_id === roomUser.userId && r.friend_id === user?.id) ||
                (r.friend_id === roomUser.userId && r.user_id === user?.id)
              );

              return (
                <List.Item
                  key={roomUser.userId}
                  title={roomUser.userProfile?.username || roomUser.userProfile?.display_name || 'Anonymous User'}
                  description={
                    isMe ? 'You' :
                    roomUser.isOwner ? 'Room Owner' :
                    roomUser.isAdmin ? 'Admin' : 'User'
                  }
                  left={() => (
                    <Avatar.Image
                      size={40}
                      source={{
                        uri: roomUser.userProfile?.avatar_url ||
                             `https://ui-avatars.com/api/?name=${encodeURIComponent(roomUser.userProfile?.username || '')}&background=667eea&color=fff`
                      }}
                    />
                  )}
                  right={() => (
                    <View style={styles.userActions}>
                      {isMe && <Chip>You</Chip>}
                      {roomUser.isOwner && <Chip icon="crown">Owner</Chip>}
                      {roomUser.isAdmin && <Chip icon="shield">Admin</Chip>}
                      {!isMe && !isFriend && !hasPendingRequest && (
                        <Button
                          icon="account-plus"
                          mode="text"
                          compact
                          onPress={() => addFriend(roomUser.userId)}
                        >
                          Add Friend
                        </Button>
                      )}
                      {!isMe && hasPendingRequest && friendRequests.find(r => r.user_id === user?.id && r.friend_id === roomUser.userId) && (
                        <Text style={styles.requestSent}>Request sent</Text>
                      )}
                      {!isMe && hasPendingRequest && friendRequests.find(r => r.user_id === roomUser.userId && r.friend_id === user?.id) && (
                        <View style={styles.requestActions}>
                          <Button
                            icon="check"
                            mode="text"
                            compact
                            onPress={() => acceptFriendRequest(roomUser.userId)}
                          >
                            Accept
                          </Button>
                          <Button
                            icon="close"
                            mode="text"
                            compact
                            onPress={() => rejectFriendRequest(roomUser.userId)}
                          >
                            Reject
                          </Button>
                        </View>
                      )}
                    </View>
                  )}
                />
              );
            })}
          </ScrollView>
        </Card.Content>
      </Card>

      {/* Friends Section */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>Friends</Title>
          <View style={styles.friendsTabs}>
            <Button
              mode={activeFriendsTab === 'list' ? 'contained' : 'outlined'}
              onPress={() => setActiveFriendsTab('list')}
              style={styles.friendsTabButton}
            >
              My Friends
            </Button>
            <Button
              mode={activeFriendsTab === 'requests' ? 'contained' : 'outlined'}
              onPress={() => setActiveFriendsTab('requests')}
              style={styles.friendsTabButton}
            >
              Requests ({friendRequests.filter(r => r.friend_id === user?.id).length})
            </Button>
          </View>

          {activeFriendsTab === 'list' ? (
            <ScrollView style={styles.friendsList}>
              {friends.length === 0 ? (
                <Text style={styles.emptyQueue}>No friends yet</Text>
              ) : (
                friends.map((friend) => (
                  <List.Item
                    key={friend.id}
                    title={friend.username || 'Friend'}
                    left={() => (
                      <Avatar.Image
                        size={40}
                        source={{
                          uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.username || '')}&background=667eea&color=fff`
                        }}
                      />
                    )}
                    right={() => (
                      <Button
                        icon="account-remove"
                        mode="text"
                        compact
                        onPress={() => removeFriend(friend.friend_id === user?.id ? friend.user_id : friend.friend_id)}
                      >
                        Remove
                      </Button>
                    )}
                  />
                ))
              )}
            </ScrollView>
          ) : (
            <ScrollView style={styles.friendsList}>
              {friendRequests.filter(r => r.friend_id === user?.id).length === 0 ? (
                <Text style={styles.emptyQueue}>No pending requests</Text>
              ) : (
                friendRequests
                  .filter(r => r.friend_id === user?.id)
                  .map((request) => (
                    <List.Item
                      key={request.id}
                      title={request.username || 'User'}
                      description="Wants to be your friend"
                      left={() => (
                        <Avatar.Image
                          size={40}
                          source={{
                            uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(request.username || '')}&background=667eea&color=fff`
                          }}
                        />
                      )}
                      right={() => (
                        <View style={styles.requestActions}>
                          <Button
                            icon="check"
                            mode="contained"
                            compact
                            onPress={() => acceptFriendRequest(request.user_id)}
                          >
                            Accept
                          </Button>
                          <Button
                            icon="close"
                            mode="outlined"
                            compact
                            onPress={() => rejectFriendRequest(request.user_id)}
                          >
                            Reject
                          </Button>
                        </View>
                      )}
                    />
                  ))
              )}
            </ScrollView>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );

  const renderSpotifyTab = () => {
    const isSpotifyLoggedIn = user && isSpotifyUser(user);

    if (!isSpotifyLoggedIn) {
      return (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
          <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <Title style={{ color: theme.colors.onSurface }}>Spotify Playlists</Title>
              <Text style={[styles.emptyQueue, { color: theme.colors.onSurfaceVariant }]}>
                Sign in with Spotify to browse and queue songs from your playlists.
              </Text>
              <Button
                mode="contained"
                onPress={() => navigation.navigate('Auth')}
                icon="spotify"
                style={styles.addButton}
              >
                Sign In with Spotify
              </Button>
            </Card.Content>
          </Card>
        </ScrollView>
      );
    }

    if (selectedPlaylist) {
      return (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
          <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <View style={styles.playlistHeader}>
                <Button
                  icon="arrow-left"
                  mode="text"
                  onPress={() => {
                    setSelectedPlaylist(null);
                    setPlaylistTracks([]);
                  }}
                >
                  Back to Playlists
                </Button>
                <Title style={{ color: theme.colors.onSurface }}>{selectedPlaylist.name}</Title>
                {selectedPlaylist.description && (
                  <Text style={[styles.playlistDescription, { color: theme.colors.onSurfaceVariant }]}>{selectedPlaylist.description}</Text>
                )}
                {selectedPlaylist.tracks && (
                  <Text style={[styles.trackCount, { color: theme.colors.onSurfaceVariant }]}>
                    {selectedPlaylist.tracks.total} tracks
                  </Text>
                )}
              </View>
            </Card.Content>
          </Card>

          {spotifyError && (
            <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <Card.Content>
                <Text style={[styles.errorText, { color: theme.colors.error }]}>{spotifyError}</Text>
                <Button
                  mode="outlined"
                  onPress={() => loadPlaylistTracks(selectedPlaylist)}
                  style={styles.addButton}
                >
                  Retry
                </Button>
              </Card.Content>
            </Card>
          )}

          {loadingTracks ? (
            <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <Card.Content>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>Loading tracks...</Text>
              </Card.Content>
            </Card>
          ) : playlistTracks.length > 0 ? (
            <>
              <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                <Card.Content>
                  <Button
                    mode="contained"
                    onPress={queueAllTracks}
                    icon="playlist-plus"
                    style={styles.addButton}
                  >
                    Queue All Tracks
                  </Button>
                </Card.Content>
              </Card>
              <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                <Card.Content>
                  <Title style={{ color: theme.colors.onSurface }}>Tracks</Title>
                  <ScrollView style={styles.queueList}>
                    {playlistTracks.map((track) => (
                      <List.Item
                        key={track.id}
                        title={track.name}
                        description={track.artists.map(a => a.name).join(', ')}
                        left={() => (
                          <Avatar.Image
                            size={40}
                            source={{
                              uri: getThumbnailUrl(track.album?.images?.[0]?.url, 40)
                            }}
                          />
                        )}
                        right={() => (
                          <Button
                            icon="plus"
                            mode="text"
                            compact
                            onPress={() => queueSpotifyTrack(track)}
                          >
                            Queue
                          </Button>
                        )}
                      />
                    ))}
                  </ScrollView>
                </Card.Content>
              </Card>
            </>
          ) : (
            <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
              <Card.Content>
                <Text style={[styles.emptyQueue, { color: theme.colors.onSurfaceVariant }]}>No tracks found in this playlist</Text>
              </Card.Content>
            </Card>
          )}
        </ScrollView>
      );
    }

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <View style={styles.playlistHeader}>
              <Title style={{ color: theme.colors.onSurface }}>Your Spotify Playlists</Title>
              <Button
                icon="refresh"
                mode="text"
                onPress={loadSpotifyPlaylists}
                disabled={loadingPlaylists}
              >
                Refresh
              </Button>
            </View>
          </Card.Content>
        </Card>

        {spotifyError && (
          <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <Text style={[styles.errorText, { color: theme.colors.error }]}>{spotifyError}</Text>
              <Button
                mode="outlined"
                onPress={loadSpotifyPlaylists}
                style={styles.addButton}
              >
                Retry
              </Button>
            </Card.Content>
          </Card>
        )}

        {loadingPlaylists ? (
          <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>Loading playlists...</Text>
            </Card.Content>
          </Card>
        ) : spotifyPlaylists.length > 0 ? (
          <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <ScrollView style={styles.queueList}>
                {spotifyPlaylists.map((playlist) => (
                  <List.Item
                    key={playlist.id}
                    title={playlist.name}
                    description={
                      playlist.owner?.display_name
                        ? `By ${playlist.owner.display_name} • ${playlist.tracks?.total || 0} tracks`
                        : `${playlist.tracks?.total || 0} tracks`
                    }
                    left={() => (
                      <Avatar.Image
                        size={50}
                        source={{
                          uri: getThumbnailUrl(playlist.images?.[0]?.url, 50)
                        }}
                      />
                    )}
                    onPress={() => loadPlaylistTracks(playlist)}
                  />
                ))}
              </ScrollView>
            </Card.Content>
          </Card>
        ) : (
          <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <Text style={[styles.emptyQueue, { color: theme.colors.onSurfaceVariant }]}>No playlists found</Text>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    );
  };

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

  const renderDJModeTab = () => {
    const isPro = profile && hasTier(profile.subscription_tier, 'pro');

    if (!isPro) {
      return (
        <ScrollView
          style={styles.tabContent}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <DJModeUpgradeAd
            onUpgrade={() => {
              navigation.navigate('Subscription');
            }}
          />
        </ScrollView>
      );
    }

    // Check if DJ mode is available (room creator has Pro tier)
    if (!tierSettings.djMode) {
      return (
        <ScrollView
          style={styles.tabContent}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Card.Content style={styles.centerContent}>
              <MaterialCommunityIcons
                name="equalizer"
                size={64}
                color={theme.colors.primary}
                style={styles.centerIcon}
              />
              <Text style={[styles.noAccess, { color: theme.colors.onSurface, fontSize: 18, marginBottom: 8 }]}>
                DJ Mode Not Available
              </Text>
              <Text style={[styles.noAccessSubtext, { color: theme.colors.onSurfaceVariant }]}>
                The room creator needs to have a Pro tier subscription to enable DJ Mode.
              </Text>
            </Card.Content>
          </Card>
        </ScrollView>
      );
    }

    // If user is pro and DJ mode is available, show the DJ interface
    if (roomSettings.djMode || (isOwner || isAdmin)) {
      return (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
          <DJModeInterface
            djMode={roomSettings.djMode}
            djPlayers={roomSettings.djPlayers}
            playerTracks={djPlayerTracks}
            playerPlayingStates={djPlayerPlayingStates}
            playerVolumes={djPlayerVolumes}
            playerBPMs={djPlayerBPMs}
            playerPositions={djPlayerPositions}
            playerDurations={djPlayerDurations}
            onPlayerPlayPause={handleDJPlayerPlayPause}
            onPlayerLoadTrack={handleDJPlayerLoadTrack}
            onPlayerVolumeChange={handleDJPlayerVolumeChange}
            onPlayerSeek={handleDJPlayerSeek}
            onSyncTracks={handleDJPlayerSync}
          />
          
          {/* Queue for loading tracks into DJ players */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="playlist-music" size={22} color={theme.colors.primary} />
                <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                  Queue (Load to Players)
                </Title>
              </View>
              {queue.length === 0 ? (
                <Text style={[styles.emptyQueue, { color: theme.colors.onSurfaceVariant }]}>
                  No tracks in queue
                </Text>
              ) : (
                <ScrollView style={styles.queueList}>
                  {queue.map((track, index) => (
                    <Card
                      key={index}
                      style={[styles.queueItem, { backgroundColor: theme.colors.surfaceVariant }]}
                      onPress={() => {
                        // Track can be loaded to a player from here
                        Alert.alert('Load Track', `Select a player to load "${track.info?.fullTitle || 'Unknown Track'}"`, [
                          { text: 'Cancel', style: 'cancel' },
                          ...Array.from({ length: roomSettings.djPlayers }, (_, i) => ({
                            text: `Player ${i + 1}`,
                            onPress: async () => {
                              // Load the selected track to the player
                              const success = await djAudioService.loadTrack(i, track);
                              if (success) {
                                const newTracks = [...djPlayerTracks];
                                newTracks[i] = track;
                                setDjPlayerTracks(newTracks);
                                
                                // Detect BPM
                                const bpmResult = await bpmDetectionService.detectBPM(track);
                                const newBPMs = [...djPlayerBPMs];
                                newBPMs[i] = bpmResult.bpm;
                                setDjPlayerBPMs(newBPMs);
                              } else {
                                Alert.alert('Error', 'Failed to load track to player');
                              }
                            },
                          })),
                        ]);
                      }}
                    >
                      <Card.Content style={styles.queueItemContent}>
                        <MaterialCommunityIcons name="music" size={20} color={theme.colors.primary} />
                        <View style={styles.queueItemDetails}>
                          <Text style={[styles.queueItemTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
                            {track.info?.fullTitle || 'Unknown Track'}
                          </Text>
                          <View style={styles.queueItemMeta}>
                            <MaterialCommunityIcons 
                              name="account" 
                              size={12} 
                              color={theme.colors.onSurfaceVariant} 
                            />
                            <Text style={[styles.queueItemDescription, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                              {track.info?.artist || 'Unknown Artist'}
                            </Text>
                          </View>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
                      </Card.Content>
                    </Card>
                  ))}
                </ScrollView>
              )}
            </Card.Content>
          </Card>
        </ScrollView>
      );
    }

    // Loading state while DJ mode is being enabled
    return (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.centerContent}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.noAccess, { color: theme.colors.onSurface, fontSize: 18, marginTop: 16 }]}>
              Enabling DJ Mode...
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
    );
  };

  const renderSettingsTab = () => {
    if (!isOwner && !isAdmin) {
      return (
        <View style={styles.tabContent}>
          <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <Text style={[styles.noAccess, { color: theme.colors.onSurfaceVariant }]}>You don't have access to room settings.</Text>
              <Text style={[styles.noAccessSubtext, { color: theme.colors.onSurfaceVariant }]}>Only room owners and admins can access settings.</Text>
            </Card.Content>
          </Card>
        </View>
      );
    }

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Room Settings</Title>
            
            <View style={styles.settingItem}>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: theme.colors.onSurface }]}>Private Room</Text>
                <Switch
                  value={roomSettings.isPrivate}
                  onValueChange={(value) => setRoomSettings(prev => ({ ...prev, isPrivate: value }))}
                  disabled={!isOwner}
                />
              </View>
              <Text style={[styles.settingDescription, { color: theme.colors.onSurfaceVariant }]}>
                Only users with the reference code can join
              </Text>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.settingItem}>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: theme.colors.onSurface }]}>Allow Users to Control Playback</Text>
                <Switch
                  value={roomSettings.allowControls}
                  onValueChange={(value) => setRoomSettings(prev => ({ ...prev, allowControls: value }))}
                  disabled={!isOwner && !isAdmin}
                />
              </View>
              <Text style={[styles.settingDescription, { color: theme.colors.onSurfaceVariant }]}>
                If disabled, only room owner and admins can control playback
              </Text>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.settingItem}>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: theme.colors.onSurface }]}>Allow Users to Queue Songs</Text>
                <Switch
                  value={roomSettings.allowQueue}
                  onValueChange={(value) => setRoomSettings(prev => ({ ...prev, allowQueue: value }))}
                  disabled={!isOwner && !isAdmin}
                />
              </View>
              <Text style={[styles.settingDescription, { color: theme.colors.onSurfaceVariant }]}>
                If disabled, only room owner and admins can add tracks to the queue
              </Text>
              
              <Divider style={[styles.divider, { marginVertical: 12 }]} />
              
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: theme.colors.onSurface }]}>Allow Users to Remove from Queue</Text>
                <Switch
                  value={roomSettings.allowQueueRemoval}
                  onValueChange={(value) => setRoomSettings(prev => ({ ...prev, allowQueueRemoval: value }))}
                  disabled={!isOwner && !isAdmin}
                />
              </View>
              <Text style={[styles.settingDescription, { color: theme.colors.onSurfaceVariant }]}>
                If disabled, only room owner and admins can remove tracks. Users can always remove their own tracks.
              </Text>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.settingItem}>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: theme.colors.onSurface }]}>Can other people add to playlist?</Text>
                <Switch
                  value={roomSettings.allowPlaylistAdditions}
                  onValueChange={(value) => setRoomSettings(prev => ({ ...prev, allowPlaylistAdditions: value }))}
                  disabled={!isOwner && !isAdmin}
                />
              </View>
              <Text style={[styles.settingDescription, { color: theme.colors.onSurfaceVariant }]}>
                If enabled, other users can add tracks to playlists created from this room
              </Text>
            </View>

            <Divider style={styles.divider} />

            {isOwner && (
              <View style={styles.settingItem}>
                <View style={styles.settingRow}>
                  <Text style={[styles.settingLabel, { color: theme.colors.onSurface }]}>Session Mode</Text>
                  <Switch
                    value={roomSettings.sessionEnabled}
                    onValueChange={(value) => {
                      setRoomSettings(prev => ({ ...prev, sessionEnabled: value }));
                    }}
                    disabled={!isOwner}
                  />
                </View>
                <Text style={[styles.settingDescription, { color: theme.colors.onSurfaceVariant }]}>
                  When enabled, users will be prompted to open a mini player when trying to leave the room during an active session
                </Text>
              </View>
            )}

            {isOwner && (
              <>
                <Divider style={styles.divider} />
                <View style={styles.settingItem}>
                  <Text style={[styles.settingLabel, { color: theme.colors.onSurface }]}>Room Admins</Text>
                  <Text style={[styles.settingDescription, { color: theme.colors.onSurfaceVariant }]}>
                    Admins can access settings and control playback
                  </Text>
                  
                  <ScrollView style={styles.adminsList}>
                    {roomSettings.admins.length === 0 ? (
                      <Text style={[styles.emptyQueue, { color: theme.colors.onSurfaceVariant }]}>No admins added yet</Text>
                    ) : (
                      roomSettings.admins.map((adminId) => {
                        const adminUser = users.find(u => u.userId === adminId);
                        return (
                          <List.Item
                            key={adminId}
                            title={adminUser?.userProfile?.username || 'Admin'}
                            left={() => (
                              <Avatar.Image
                                size={40}
                                source={{
                                  uri: adminUser?.userProfile?.avatar_url ||
                                       `https://ui-avatars.com/api/?name=${encodeURIComponent(adminUser?.userProfile?.username || '')}&background=667eea&color=fff`
                                }}
                              />
                            )}
                            right={() => (
                              <Button
                                icon="delete"
                                mode="text"
                                compact
                                onPress={() => removeAdmin(adminId)}
                              >
                                Remove
                              </Button>
                            )}
                          />
                        );
                      })
                    )}
                  </ScrollView>

                  <View style={styles.addAdminForm}>
                    <TextInput
                      label="Username"
                      value={addAdminInput}
                      onChangeText={setAddAdminInput}
                      mode="outlined"
                      placeholder="Enter username to add as admin"
                      style={styles.adminInput}
                      onSubmitEditing={addAdmin}
                    />
                    <Button
                      mode="contained"
                      onPress={addAdmin}
                      icon="account-plus"
                      style={styles.addAdminButton}
                    >
                      Add Admin
                    </Button>
                  </View>
                </View>
              </>
            )}

            <Divider style={styles.divider} />

            <Button
              mode="contained"
              onPress={saveSettings}
              icon="content-save"
              style={styles.saveButton}
            >
              Save Settings
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    );
  };

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
      {/* Header */}
      <View style={[styles.header, { backgroundColor: headerColor }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={[styles.roomTitle, { color: theme.colors.onSurface }]}>{roomName}</Text>
            {/* Play/Pause button - Only visible on web/desktop, positioned AFTER room name */}
            {Platform.OS === 'web' && !IS_MOBILE && activeTab === 'main' && (
              <View style={styles.iconButtonWrapper}>
                <IconButton
                  icon={isPlaying ? 'pause' : 'play'}
                  iconColor={theme.colors.onSurface}
                  size={20}
                  onPress={playPause}
                  disabled={!currentTrack || !canControl}
                  style={styles.iconButton}
                />
              </View>
            )}
            <View style={styles.connectionStatus}>
              <View style={[styles.statusDot, { backgroundColor: connected ? '#4CAF50' : '#FF9800' }]} />
            </View>
            <View style={{ flex: 1 }} />
          </View>
          <View style={styles.headerRight}>
            {/* DJ Mode Toggle - Only for PRO users */}
            {profile && hasTier(profile.subscription_tier, 'pro') && roomSettings.djMode && (
              <DJModeToggle
                isDJMode={isDJModeActive}
                onToggle={() => setIsDJModeActive(!isDJModeActive)}
                disabled={!roomSettings.djMode}
              />
            )}
            {/* Playback Controls - Only visible on web/desktop, hidden on mobile (shown via FAB) */}
            {activeTab === 'main' && Platform.OS === 'web' && !IS_MOBILE && (
              <>
                <View style={styles.iconButtonWrapper}>
                  <IconButton
                    icon="skip-previous"
                    iconColor={theme.colors.onSurface}
                    size={20}
                    onPress={handlePrevious}
                    disabled={!currentTrack || !canControl}
                    style={styles.iconButton}
                  />
                </View>
                <View style={styles.iconButtonWrapper}>
                  <IconButton
                    icon="skip-next"
                    iconColor={theme.colors.onSurface}
                    size={20}
                    onPress={nextTrack}
                    disabled={queue.length === 0 || !canControl}
                    style={styles.iconButton}
                  />
                </View>
              </>
            )}
            <Chip
              icon={({ size, color }) => (
                <MaterialCommunityIcons name="account-group" size={size} color="#FFFFFF" />
              )}
              style={[styles.userCountChip, { backgroundColor: theme.colors.primaryContainer }]}
              textStyle={[styles.userCountChipText, { color: '#FFFFFF' }]}
              onPress={() => setActiveTab('users')}
            >
              {userCount}
            </Chip>
            <Chip
              icon={({ size, color }) => (
                <MaterialCommunityIcons name="format-list-bulleted" size={size} color="#FFFFFF" />
              )}
              style={[styles.userCountChip, { backgroundColor: theme.colors.secondaryContainer }]}
              textStyle={[styles.userCountChipText, { color: '#FFFFFF' }]}
            >
              {queue.length}
            </Chip>
            <View style={styles.iconButtonWrapper}>
              <IconButton
                icon="share-variant"
                iconColor={theme.colors.onSurface}
                size={20}
                onPress={shareRoom}
                style={styles.iconButton}
              />
            </View>
          </View>
        </View>
        {shortCode && (
          <Text style={[styles.roomId, { color: theme.colors.onSurfaceVariant }]}>
            Reference: {shortCode}
          </Text>
        )}
        {!connected && <ActivityIndicator size="small" color={theme.colors.onSurface} style={styles.connectingIndicator} />}
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { backgroundColor: headerColor, borderBottomColor: theme.colors.outline }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
          style={styles.tabsScrollView}
        >
          <TouchableOpacity
            onPress={() => setActiveTab('main')}
            style={[
              styles.tabButton,
              activeTab === 'main' && {
                backgroundColor: theme.colors.primary,
              },
            ]}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="music-note"
              size={20}
              color={activeTab === 'main' ? theme.colors.onPrimary : theme.colors.onSurface}
              style={styles.tabIcon}
            />
            <Text
              style={[
                styles.tabButtonText,
                {
                  color: activeTab === 'main' ? theme.colors.onPrimary : theme.colors.onSurface,
                },
              ]}
            >
              Main
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('users')}
            style={[
              styles.tabButton,
              activeTab === 'users' && {
                backgroundColor: theme.colors.primary,
              },
            ]}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="account-group"
              size={20}
              color={activeTab === 'users' ? theme.colors.onPrimary : theme.colors.onSurface}
              style={styles.tabIcon}
            />
            <Text
              style={[
                styles.tabButtonText,
                {
                  color: activeTab === 'users' ? theme.colors.onPrimary : theme.colors.onSurface,
                },
              ]}
            >
              Users
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('chat')}
            style={[
              styles.tabButton,
              activeTab === 'chat' && {
                backgroundColor: theme.colors.primary,
              },
            ]}
            activeOpacity={0.7}
          >
            <View style={styles.tabIconContainer}>
              <MaterialCommunityIcons
                name="chat"
                size={20}
                color={activeTab === 'chat' ? theme.colors.onPrimary : theme.colors.onSurface}
                style={styles.tabIcon}
              />
              {unreadChatCount > 0 && (
                <Badge
                  visible={unreadChatCount > 0}
                  size={18}
                  style={[
                    styles.chatBadge,
                    { backgroundColor: theme.colors.error }
                  ]}
                >
                  {unreadChatCount > 99 ? '99+' : unreadChatCount}
                </Badge>
              )}
            </View>
            <Text
              style={[
                styles.tabButtonText,
                {
                  color: activeTab === 'chat' ? theme.colors.onPrimary : theme.colors.onSurface,
                },
              ]}
            >
              Chat
            </Text>
          </TouchableOpacity>
          {user && isSpotifyUser(user) && (
            <TouchableOpacity
              onPress={() => setActiveTab('spotify')}
              style={[
                styles.tabButton,
                activeTab === 'spotify' && {
                  backgroundColor: theme.colors.primary,
                },
              ]}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="spotify"
                size={20}
                color={activeTab === 'spotify' ? theme.colors.onPrimary : theme.colors.onSurface}
                style={styles.tabIcon}
              />
              <Text
                style={[
                  styles.tabButtonText,
                  {
                    color: activeTab === 'spotify' ? theme.colors.onPrimary : theme.colors.onSurface,
                  },
                ]}
              >
                Spotify
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              if (profile && hasTier(profile.subscription_tier, 'pro') && !isDJModeActive) {
                setShowDJModeConfirmDialog(true);
              } else {
                setActiveTab('djmode');
              }
            }}
            style={[
              styles.tabButton,
              (activeTab === 'djmode' || isDJModeActive) && {
                backgroundColor: theme.colors.primary,
              },
            ]}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="equalizer"
              size={20}
              color={(activeTab === 'djmode' || isDJModeActive) ? theme.colors.onPrimary : theme.colors.onSurface}
              style={styles.tabIcon}
            />
            <Text
              style={[
                styles.tabButtonText,
                {
                  color: (activeTab === 'djmode' || isDJModeActive) ? theme.colors.onPrimary : theme.colors.onSurface,
                },
              ]}
            >
              DJ Mode
            </Text>
          </TouchableOpacity>
          {(isOwner || isAdmin) && (
            <TouchableOpacity
              onPress={() => setActiveTab('settings')}
              style={[
                styles.tabButton,
                activeTab === 'settings' && {
                  backgroundColor: theme.colors.primary,
                },
              ]}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="cog"
                size={20}
                color={activeTab === 'settings' ? theme.colors.onPrimary : theme.colors.onSurface}
                style={styles.tabIcon}
              />
              <Text
                style={[
                  styles.tabButtonText,
                  {
                    color: activeTab === 'settings' ? theme.colors.onPrimary : theme.colors.onSurface,
                  },
                ]}
              >
                Settings
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Tab Content */}
      {activeTab === 'main' && renderMainTab()}
      {activeTab === 'users' && renderUsersTab()}
      {activeTab === 'chat' && renderChatTab()}
      {activeTab === 'spotify' && renderSpotifyTab()}
      {activeTab === 'djmode' && renderDJModeTab()}
      {activeTab === 'settings' && renderSettingsTab()}

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