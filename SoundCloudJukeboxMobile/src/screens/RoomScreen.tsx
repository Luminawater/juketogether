import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Share,
  Dimensions,
  TouchableOpacity,
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
  useTheme,
} from 'react-native-paper';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { Track } from '../types';
import { socketService, RoomState } from '../services/socketService';
import { FloatingPlayer } from '../components/FloatingPlayer';
import { NowPlayingCard } from '../components/NowPlayingCard';
import { DJModeInterface } from '../components/DJModeInterface';
import {
  isSpotifyUser,
  fetchUserPlaylists,
  fetchPlaylistTracks,
  spotifyTrackToQueueTrack,
  SpotifyPlaylist,
  SpotifyTrack,
} from '../services/spotifyService';
import {
  getTrackReactions,
  setTrackReaction,
  TrackReactionCounts,
  ReactionType,
} from '../services/trackReactionsService';
import { getRoomUrl, getRoomShareMessage, extractMusicUrls, isValidMusicUrl } from '../utils/roomUtils';
import RoomChat from '../components/RoomChat';
import AdsBanner from '../components/AdsBanner';
import { hasTier } from '../utils/permissions';
import { ShareRoomDialog } from '../components/ShareRoomDialog';

type RoomScreenRouteProp = RouteProp<RootStackParamList, 'Room'>;
type RoomScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Room'>;

interface RoomUser {
  userId: string;
  userProfile?: {
    username?: string;
    display_name?: string;
    avatar_url?: string;
  };
  isOwner?: boolean;
  isAdmin?: boolean;
  volume?: number;
}

interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  username?: string;
  status: 'pending' | 'accepted' | 'blocked';
}

interface RoomSettings {
  isPrivate: boolean;
  allowControls: boolean;
  allowQueue: boolean;
  djMode: boolean;
  djPlayers: number;
  admins: string[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_MOBILE = SCREEN_WIDTH < 768;

const RoomScreen: React.FC = () => {
  const route = useRoute<RoomScreenRouteProp>();
  const navigation = useNavigation<RoomScreenNavigationProp>();
  const { user, session, supabase, profile } = useAuth();
  const theme = useTheme();

  const { roomId, roomName } = route.params;

  // Main state
  const [activeTab, setActiveTab] = useState<'main' | 'users' | 'settings' | 'spotify' | 'chat'>('main');
  const [queue, setQueue] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [trackUrl, setTrackUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [users, setUsers] = useState<RoomUser[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [playerMinimized, setPlayerMinimized] = useState(false);
  const [isUserSyncedToSession, setIsUserSyncedToSession] = useState(false);

  // Users & Friends state
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<Friend[]>([]);
  const [activeFriendsTab, setActiveFriendsTab] = useState<'list' | 'requests'>('list');

  // Settings state
  const [roomSettings, setRoomSettings] = useState<RoomSettings>({
    isPrivate: false,
    allowControls: true,
    allowQueue: true,
    djMode: false,
    djPlayers: 0,
    admins: [],
  });
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canControl, setCanControl] = useState(true);
  const [addAdminInput, setAddAdminInput] = useState('');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shortCode, setShortCode] = useState<string | undefined>(undefined);

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
  const [djPlayerTracks, setDjPlayerTracks] = useState<(Track | null)[]>([null, null, null]);
  const [djPlayerPlayingStates, setDjPlayerPlayingStates] = useState<boolean[]>([false, false, false]);

  // Connect to Socket.io when component mounts
  useEffect(() => {
    const userId = user?.id || `anonymous_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const authToken = session?.access_token;

    socketService.connect(roomId, userId, authToken);

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
    }) => {
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
    };

    const handleTrackAdded = (track: Track) => {
      setQueue(prev => [...prev, track]);
    };

    const handleTrackRemoved = (trackId: string) => {
      setQueue(prev => prev.filter(t => t.id !== trackId));
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleNextTrack = (track: Track) => {
      setCurrentTrack(track);
      setQueue(prev => prev.filter(t => t.id !== track.id));
      setIsPlaying(true);
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

    const handleHistoryUpdated = (updatedHistory: Track[]) => {
      setHistory(updatedHistory);
    };

    const handleRoomSettingsUpdated = (updatedSettings: any) => {
      setRoomSettings({
        isPrivate: updatedSettings.isPrivate || false,
        allowControls: updatedSettings.allowControls !== false,
        allowQueue: updatedSettings.allowQueue !== false,
        djMode: updatedSettings.djMode || false,
        djPlayers: updatedSettings.djPlayers || 0,
        admins: updatedSettings.admins || roomSettings.admins || [],
      });
      setCanControl(updatedSettings.allowControls !== false || isOwner || isAdmin);
    };

    const handleRoomAdminsUpdated = (admins: string[]) => {
      setRoomSettings(prev => ({ ...prev, admins }));
    };

    const handleError = (error: any) => {
      console.error('Socket error:', error);
      Alert.alert('Connection Error', 'Failed to connect to room. Please try again.');
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
    socketService.on('trackAdded', handleTrackAdded);
    socketService.on('trackRemoved', handleTrackRemoved);
    socketService.on('play', handlePlay);
    socketService.on('pause', handlePause);
    socketService.on('nextTrack', handleNextTrack);
    socketService.on('userJoined', handleUserJoined);
    socketService.on('userLeft', handleUserLeft);
    socketService.on('userCount', handleUserCount);
    socketService.on('friendsList', handleFriendsList);
    socketService.on('historyUpdated', handleHistoryUpdated);
    socketService.on('roomSettingsUpdated', handleRoomSettingsUpdated);
    socketService.on('roomAdminsUpdated', handleRoomAdminsUpdated);
    socketService.on('error', handleError);
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
      socketService.off('nextTrack', handleNextTrack);
      socketService.off('userJoined', handleUserJoined);
      socketService.off('userLeft', handleUserLeft);
      socketService.off('userCount', handleUserCount);
      socketService.off('friendsList', handleFriendsList);
      socketService.off('historyUpdated', handleHistoryUpdated);
      socketService.off('roomSettingsUpdated', handleRoomSettingsUpdated);
      socketService.off('roomAdminsUpdated', handleRoomAdminsUpdated);
      socketService.off('error', handleError);
      socketService.off('connectionError', handleConnectionError);
      socketService.disconnect();
    };
  }, [roomId, user?.id, navigation]);

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

    setLoading(true);
    try {
      if (socketService.socket) {
        // Add all extracted URLs
        let successCount = 0;
        let errorCount = 0;
        
        for (const url of extractedUrls) {
          try {
            socketService.socket.emit('add-track', {
              roomId,
              trackUrl: url,
            });
            successCount++;
          } catch (error) {
            console.error('Error adding track:', error);
            errorCount++;
          }
        }
        
        // Show success message
        if (successCount > 0) {
          if (extractedUrls.length === 1) {
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
      }
      setTrackUrl('');
    } catch (error) {
      console.error('Error adding track:', error);
      Alert.alert('Error', 'Failed to add track');
    } finally {
      setLoading(false);
    }
  };

  const playPause = () => {
    if (!canControl) {
      Alert.alert('Permission Denied', 'Only room owner and admins can control playback.');
      return;
    }

    if (!isUserSyncedToSession) {
      Alert.alert('Sync Required', 'You must sync to the session first. Click the Sync button.');
      return;
    }

    if (!connected) {
      Alert.alert('Error', 'Not connected to room');
      return;
    }

    if (isPlaying) {
      if (socketService.socket) {
        socketService.socket.emit('pause', { roomId });
      }
    } else {
      if (socketService.socket) {
        socketService.socket.emit('play', { roomId });
      }
    }
  };

  const nextTrack = () => {
    if (!canControl) {
      Alert.alert('Permission Denied', 'Only room owner and admins can control playback.');
      return;
    }

    if (!isUserSyncedToSession) {
      Alert.alert('Sync Required', 'You must sync to the session first.');
      return;
    }

    if (!connected) {
      Alert.alert('Error', 'Not connected to room');
      return;
    }

    if (queue.length > 0 && socketService.socket) {
      socketService.socket.emit('next-track', { roomId });
    }
  };

  const syncToSession = () => {
    if (!connected || !socketService.socket) return;

    socketService.socket.emit('sync-all-users', {
      roomId,
      position: position,
    });

    setIsUserSyncedToSession(true);
    Alert.alert('Success', 'Synced to music session!');
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
        djMode: roomSettings.djMode,
        djPlayers: roomSettings.djPlayers,
      },
    });
    Alert.alert('Success', 'Settings saved!');
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

  const renderMainTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Current Track - Using NowPlayingCard component */}
      <NowPlayingCard
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        trackReactions={trackReactions}
        canControl={canControl}
        onPlayPause={playPause}
        onNext={nextTrack}
        onSync={syncToSession}
        onReaction={handleReaction}
        loadingReaction={loadingReaction}
        hasUser={!!user}
        queueLength={queue.length}
      />

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

          <View style={styles.nowPlayingHeader}>
            <View style={styles.nowPlayingHeaderLeft}>
              <View style={[styles.iconContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
                <MaterialCommunityIcons 
                  name="music-note" 
                  size={24} 
                  color={theme.colors.primary} 
                />
              </View>
              <Title style={styles.nowPlayingTitle}>Now Playing</Title>
            </View>
            {isPlaying && (
              <View style={[styles.liveIndicator, { backgroundColor: `${theme.colors.primary}20` }]}>
                <View style={[styles.liveDot, { backgroundColor: theme.colors.primary }]} />
                <Text style={[styles.liveText, { color: theme.colors.primary }]}>LIVE</Text>
              </View>
            )}
          </View>
          {currentTrack ? (
            <>
              <View style={styles.trackInfo}>
                <View style={styles.thumbnailContainer}>
                  <View style={[styles.thumbnailWrapper, isPlaying && styles.thumbnailWrapperPlaying]}>
                    <Avatar.Image
                      size={IS_MOBILE ? 100 : 120}
                      source={{ uri: currentTrack.info?.thumbnail || 'https://via.placeholder.com/100' }}
                      style={styles.trackThumbnail}
                    />
                    {isPlaying && (
                      <View style={styles.playingIndicator}>
                        <View style={[styles.pulseRing, { borderColor: theme.colors.primary }]} />
                        <View style={[styles.pulseRing, styles.pulseRing2, { borderColor: theme.colors.primary }]} />
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.trackDetails}>
                  <Text style={[styles.trackTitle, { color: theme.colors.onSurface }]} numberOfLines={2}>
                    {currentTrack.info?.fullTitle || 'Unknown Track'}
                  </Text>
                  <View style={[styles.platformBadge, { backgroundColor: `${theme.colors.primary}15` }]}>
                    <MaterialCommunityIcons 
                      name={
                        currentTrack.url?.includes('spotify') ? 'spotify' : 
                        currentTrack.url?.includes('youtube') ? 'youtube' : 
                        'music-note'
                      }
                      size={16}
                      color={theme.colors.primary}
                    />
                    <Text style={[styles.trackPlatform, { color: theme.colors.primary }]}>
                      {currentTrack.url?.includes('spotify') ? 'Spotify' : 
                       currentTrack.url?.includes('youtube') ? 'YouTube' : 
                       'SoundCloud'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Track Reactions */}
              {user && (
                <View style={[styles.reactionsContainer, { 
                  borderTopColor: theme.colors.outline,
                  borderBottomColor: theme.colors.outline,
                  backgroundColor: `${theme.colors.surfaceVariant}40`
                }]}>
                  <View style={styles.reactionButtonGroup}>
                    <TouchableOpacity
                      onPress={() => handleReaction('like')}
                      disabled={loadingReaction}
                      style={[
                        styles.reactionButtonTouchable,
                        { backgroundColor: trackReactions.userReaction === 'like' ? 'rgba(76, 175, 80, 0.2)' : `${theme.colors.surfaceVariant}80` }
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="thumb-up"
                        size={26}
                        color={trackReactions.userReaction === 'like' ? '#4caf50' : theme.colors.onSurfaceVariant}
                      />
                    </TouchableOpacity>
                    <Text style={[styles.reactionCount, { color: theme.colors.onSurface }]}>
                      {trackReactions.likes}
                    </Text>
                  </View>

                  <View style={styles.reactionButtonGroup}>
                    <TouchableOpacity
                      onPress={() => handleReaction('dislike')}
                      disabled={loadingReaction}
                      style={[
                        styles.reactionButtonTouchable,
                        { backgroundColor: trackReactions.userReaction === 'dislike' ? 'rgba(244, 67, 54, 0.2)' : `${theme.colors.surfaceVariant}80` }
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="thumb-down"
                        size={26}
                        color={trackReactions.userReaction === 'dislike' ? '#f44336' : theme.colors.onSurfaceVariant}
                      />
                    </TouchableOpacity>
                    <Text style={[styles.reactionCount, { color: theme.colors.onSurface }]}>
                      {trackReactions.dislikes}
                    </Text>
                  </View>

                  <View style={styles.reactionButtonGroup}>
                    <TouchableOpacity
                      onPress={() => handleReaction('fantastic')}
                      disabled={loadingReaction}
                      style={[
                        styles.reactionButtonTouchable,
                        { backgroundColor: trackReactions.userReaction === 'fantastic' ? 'rgba(255, 152, 0, 0.2)' : `${theme.colors.surfaceVariant}80` }
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="star"
                        size={26}
                        color={trackReactions.userReaction === 'fantastic' ? '#ff9800' : theme.colors.onSurfaceVariant}
                      />
                    </TouchableOpacity>
                    <Text style={[styles.reactionCount, { color: theme.colors.onSurface }]}>
                      {trackReactions.fantastic}
                    </Text>
                  </View>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.noTrack}>No track playing</Text>
          )}

          {/* Playback Controls */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.controls}>
                <Button
                  mode="contained"
                  onPress={playPause}
                  style={[styles.controlButton, styles.primaryControlButton]}
                  contentStyle={styles.controlButtonContent}
                  disabled={!currentTrack || !canControl}
                  icon={isPlaying ? 'pause' : 'play'}
                  buttonColor={theme.colors.primary}
                  textColor={theme.colors.onPrimary}
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </Button>
                <Button
                  mode="outlined"
                  onPress={nextTrack}
                  style={[styles.controlButton, { borderColor: theme.colors.primary }]}
                  contentStyle={styles.controlButtonContent}
                  disabled={queue.length === 0 || !canControl}
                  icon="skip-next"
                  textColor={theme.colors.primary}
                >
                  Next
                </Button>
                <Button
                  mode="outlined"
                  onPress={syncToSession}
                  style={[styles.controlButton, { borderColor: theme.colors.primary }]}
                  contentStyle={styles.controlButtonContent}
                  icon="sync"
                  textColor={theme.colors.primary}
                >
                  Sync
                </Button>
              </View>
              {!canControl && (
                <View style={[styles.permissionNoticeContainer, { backgroundColor: `${theme.colors.error}15` }]}>
                  <MaterialCommunityIcons name="alert-circle" size={16} color={theme.colors.error} />
                  <Text style={[styles.permissionNotice, { color: theme.colors.error }]}>
                    Only room owner and admins can control playback
                  </Text>
                </View>
              )}
            </Card.Content>
          </Card>
      {/* Ads Banner - Only show for non-PRO users */}
      {(!profile || !hasTier(profile.subscription_tier, 'pro')) && (
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
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <MaterialCommunityIcons name="playlist-music" size={22} color={theme.colors.primary} />
              <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Queue
              </Title>
            </View>
            <View style={[styles.countBadge, { backgroundColor: `${theme.colors.primary}20` }]}>
              <Text style={[styles.countBadgeText, { color: theme.colors.primary }]}>
                {queue.length}
              </Text>
            </View>
          </View>
          {queue.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="music-off" size={48} color={theme.colors.onSurfaceVariant} />
              <Text style={[styles.emptyQueue, { color: theme.colors.onSurfaceVariant }]}>
                Queue is empty. Add a track to get started!
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.queueList} showsVerticalScrollIndicator={false}>
              {queue.map((track, index) => (
                <TouchableOpacity
                  key={track.id}
                  activeOpacity={0.7}
                  style={[
                    styles.queueItem, 
                    { 
                      backgroundColor: theme.colors.surfaceVariant,
                      borderLeftColor: theme.colors.primary,
                      borderLeftWidth: index === 0 ? 3 : 0,
                    }
                  ]}
                >
                  <View style={styles.queueItemContent}>
                    <View style={[styles.queueItemNumber, { backgroundColor: `${theme.colors.primary}20` }]}>
                      <Text style={[styles.queueNumber, { color: theme.colors.primary }]}>
                        {index + 1}
                      </Text>
                    </View>
                    <Avatar.Image
                      size={56}
                      source={{ uri: track.info?.thumbnail || 'https://via.placeholder.com/50' }}
                      style={styles.queueItemThumbnail}
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
                          name="account" 
                          size={12} 
                          color={theme.colors.onSurfaceVariant} 
                        />
                        <Text 
                          style={[styles.queueItemDescription, { color: theme.colors.onSurfaceVariant }]}
                          numberOfLines={1}
                        >
                          {track.addedBy === user?.id ? 'You' : 'Someone'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </Card.Content>
      </Card>

      {/* History */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <MaterialCommunityIcons name="history" size={22} color={theme.colors.primary} />
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
                  activeOpacity={0.7}
                  style={[
                    styles.queueItem, 
                    styles.historyItem, 
                    { 
                      backgroundColor: `${theme.colors.surfaceVariant}80`,
                      opacity: 0.85,
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
                      size={56}
                      source={{ uri: track.info?.thumbnail || 'https://via.placeholder.com/50' }}
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
                          size={12} 
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
                    <View style={[styles.replayButton, { backgroundColor: `${theme.colors.primary}20` }]}>
                      <MaterialCommunityIcons 
                        name="replay" 
                        size={20} 
                        color={theme.colors.primary}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );

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
                              uri: track.album?.images?.[0]?.url || 'https://via.placeholder.com/40'
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
                          uri: playlist.images?.[0]?.url || 'https://via.placeholder.com/50'
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
                Only users with the room link can join
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
            </View>

            <Divider style={styles.divider} />

            <View style={styles.settingItem}>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: theme.colors.onSurface }]}>DJ Mode (Standard Tier)</Text>
                <Switch
                  value={roomSettings.djMode}
                  onValueChange={(value) => {
                    setRoomSettings(prev => ({ 
                      ...prev, 
                      djMode: value,
                      djPlayers: value ? prev.djPlayers : 0 // Reset players when disabling
                    }));
                  }}
                  disabled={!isOwner}
                />
              </View>
              <Text style={[styles.settingDescription, { color: theme.colors.onSurfaceVariant }]}>
                Enable DJ mode to add up to 3 additional players for mixing tracks
              </Text>
              
              {roomSettings.djMode && (
                <View style={[styles.djModeControls, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <Text style={[styles.djModeLabel, { color: theme.colors.onSurface }]}>Active Players: {roomSettings.djPlayers} / 3</Text>
                  <View style={styles.djPlayerButtons}>
                    <Button
                      mode="outlined"
                      onPress={() => {
                        if (roomSettings.djPlayers < 3) {
                          setRoomSettings(prev => ({ ...prev, djPlayers: prev.djPlayers + 1 }));
                        }
                      }}
                      disabled={roomSettings.djPlayers >= 3 || !isOwner}
                      icon="plus"
                      compact
                    >
                      Add Player
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={() => {
                        if (roomSettings.djPlayers > 0) {
                          setRoomSettings(prev => ({ ...prev, djPlayers: prev.djPlayers - 1 }));
                        }
                      }}
                      disabled={roomSettings.djPlayers <= 0 || !isOwner}
                      icon="minus"
                      compact
                    >
                      Remove Player
                    </Button>
                  </View>
                </View>
              )}
            </View>

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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <IconButton
              icon="arrow-left"
              iconColor={theme.colors.onSurface}
              size={24}
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            />
            <Text style={[styles.roomTitle, { color: theme.colors.onSurface }]}>{roomName}</Text>
          </View>
          <View style={styles.headerRight}>
            {(isOwner || isAdmin) && (
              <IconButton
                icon="cog"
                iconColor={theme.colors.onSurface}
                size={24}
                onPress={() => setActiveTab('settings')}
                style={styles.settingsButton}
              />
            )}
            <IconButton
              icon="share-variant"
              iconColor={theme.colors.onSurface}
              size={24}
              onPress={shareRoom}
              style={styles.shareButton}
            />
            <View style={styles.connectionStatus}>
              <View style={[styles.statusDot, { backgroundColor: connected ? theme.colors.primary : theme.colors.error }]} />
              <Text style={[styles.statusText, { color: theme.colors.onSurface }]}>{connected ? 'Connected' : 'Connecting...'}</Text>
            </View>
          </View>
        </View>
        <Text style={[styles.roomId, { color: theme.colors.onSurfaceVariant }]}>Room ID: {roomId} • {userCount} users</Text>
        {!connected && <ActivityIndicator size="small" color={theme.colors.onSurface} style={styles.connectingIndicator} />}
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.outline }]}>
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
          <MaterialCommunityIcons
            name="chat"
            size={20}
            color={activeTab === 'chat' ? theme.colors.onPrimary : theme.colors.onSurface}
            style={styles.tabIcon}
          />
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
      </View>

      {/* Tab Content */}
      {activeTab === 'main' && renderMainTab()}
      {activeTab === 'users' && renderUsersTab()}
      {activeTab === 'chat' && renderChatTab()}
      {activeTab === 'spotify' && renderSpotifyTab()}
      {activeTab === 'settings' && renderSettingsTab()}

      {/* Floating Player */}
      {currentTrack && (
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
        roomName={roomName}
        roomId={roomId}
        shortCode={shortCode}
        onCopyUrl={() => {
          Alert.alert('Success', 'Room URL copied to clipboard!');
        }}
        onCopyCode={() => {
          Alert.alert('Success', 'Join code copied to clipboard!');
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: IS_MOBILE ? 16 : 20,
    paddingTop: Platform.OS === 'web' ? 20 : (IS_MOBILE ? 50 : 60),
    elevation: 8,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 6px 20px rgba(0, 0, 0, 0.25)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
    }),
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: IS_MOBILE ? 'wrap' : 'nowrap',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: IS_MOBILE ? 8 : 12,
    minWidth: 0,
  },
  backButton: {
    margin: 0,
  },
  roomTitle: {
    fontSize: IS_MOBILE ? 22 : 26,
    fontWeight: '700',
    flex: 1,
    minWidth: 0,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IS_MOBILE ? 4 : 8,
    flexWrap: 'wrap',
  },
  settingsButton: {
    margin: 0,
  },
  shareButton: {
    margin: 0,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 0px 8px currentColor',
    } : {}),
  },
  statusText: {
    fontSize: IS_MOBILE ? 11 : 12,
  },
  connectingIndicator: {
    marginTop: 8,
  },
  roomId: {
    fontSize: IS_MOBILE ? 12 : 14,
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: IS_MOBILE ? 4 : 8,
    paddingTop: 4,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    } : {}),
  },
  tabButton: {
    flex: 1,
    minWidth: IS_MOBILE ? 80 : 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: IS_MOBILE ? 12 : 14,
    paddingHorizontal: IS_MOBILE ? 8 : 12,
    borderRadius: 12,
    marginHorizontal: 4,
    marginBottom: 4,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      userSelect: 'none',
      transition: 'all 0.2s ease',
    } : {}),
  },
  tabIcon: {
    marginRight: 6,
  },
  tabButtonText: {
    fontSize: IS_MOBILE ? 13 : 14,
    fontWeight: '500',
  },
  tabContent: {
    flex: 1,
    paddingBottom: IS_MOBILE ? 20 : 40,
  },
  card: {
    margin: IS_MOBILE ? 12 : 16,
    marginTop: IS_MOBILE ? 12 : 16,
    borderRadius: 24,
    elevation: 8,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.25)',
      transition: 'transform 0.2s, box-shadow 0.2s',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
    }),
  },
  nowPlayingCard: {
    borderWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: Platform.OS === 'web' ? 'rgba(102, 126, 234, 0.4)' : 'transparent',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 8px 32px rgba(102, 126, 234, 0.3)',
    } : {
      shadowColor: '#667eea',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
    }),
  },
  nowPlayingContent: {
    padding: IS_MOBILE ? 16 : 20,
  },
  nowPlayingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: IS_MOBILE ? 16 : 20,
    gap: 8,
  },
  nowPlayingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  nowPlayingTitle: {
    fontSize: IS_MOBILE ? 20 : 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  trackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: IS_MOBILE ? 16 : 20,
  },
  thumbnailContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailWrapper: {
    position: 'relative',
    ...(Platform.OS === 'web' ? {
      transition: 'transform 0.3s ease',
    } : {}),
  },
  thumbnailWrapperPlaying: {
    ...(Platform.OS === 'web' ? {
      // Use CSS keyframes animation for web
      // Note: animation property is not directly supported by react-native-web
      // This will be handled via CSS or we can use Animated API
    } : {}),
  },
  trackThumbnail: {
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 8px 24px rgba(102, 126, 234, 0.4)',
    } : {
      shadowColor: '#667eea',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
    }),
  },
  playingIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    opacity: 0.6,
  },
  pulseRing2: {
    width: 50,
    height: 50,
    borderRadius: 25,
    opacity: 0.3,
  },
  trackDetails: {
    marginLeft: IS_MOBILE ? 16 : 20,
    flex: 1,
  },
  trackTitle: {
    fontSize: IS_MOBILE ? 18 : 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
  },
  trackPlatform: {
    fontSize: IS_MOBILE ? 11 : 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noTrack: {
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: IS_MOBILE ? 20 : 20,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: IS_MOBILE ? 8 : 12,
    marginTop: IS_MOBILE ? 16 : 20,
    flexWrap: 'wrap',
  },
  controlButton: {
    flex: IS_MOBILE ? 0 : 1,
    minWidth: IS_MOBILE ? 100 : 120,
    maxWidth: IS_MOBILE ? 130 : 160,
    borderRadius: 12,
    ...(Platform.OS === 'web' ? {
      transition: 'transform 0.2s, box-shadow 0.2s',
    } : {}),
  },
  primaryControlButton: {
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 12px rgba(102, 126, 234, 0.4)',
    } : {}),
  },
  controlButtonContent: {
    paddingVertical: IS_MOBILE ? 6 : 8,
  },
  permissionNoticeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  permissionNotice: {
    fontSize: IS_MOBILE ? 11 : 12,
    flex: 1,
    fontWeight: '500',
  },
  infoNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoNoticeText: {
    fontSize: IS_MOBILE ? 12 : 14,
    flex: 1,
    fontWeight: '500',
  },
  urlInput: {
    marginBottom: IS_MOBILE ? 12 : 16,
  },
  addButton: {
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: IS_MOBILE ? 40 : 50,
    gap: 12,
  },
  emptyQueue: {
    textAlign: 'center',
    fontSize: IS_MOBILE ? 13 : 14,
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: IS_MOBILE ? 16 : 20,
    gap: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sectionTitle: {
    fontSize: IS_MOBILE ? 18 : 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  countBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 40,
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: IS_MOBILE ? 13 : 14,
    fontWeight: '700',
  },
  queueList: {
    maxHeight: IS_MOBILE ? 300 : 400,
  },
  usersList: {
    maxHeight: IS_MOBILE ? 250 : 300,
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestSent: {
    fontSize: IS_MOBILE ? 11 : 12,
    fontStyle: 'italic',
  },
  requestActions: {
    flexDirection: 'row',
    gap: IS_MOBILE ? 2 : 4,
    flexWrap: 'wrap',
  },
  friendsTabs: {
    flexDirection: 'row',
    gap: IS_MOBILE ? 6 : 8,
    marginBottom: IS_MOBILE ? 12 : 16,
  },
  friendsTabButton: {
    flex: 1,
    minWidth: IS_MOBILE ? 100 : 120,
  },
  friendsList: {
    maxHeight: IS_MOBILE ? 300 : 400,
  },
  settingItem: {
    marginVertical: IS_MOBILE ? 12 : 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: IS_MOBILE ? 'wrap' : 'nowrap',
  },
  settingLabel: {
    fontSize: IS_MOBILE ? 14 : 16,
    fontWeight: '500',
    flex: 1,
    marginRight: IS_MOBILE ? 8 : 0,
  },
  settingDescription: {
    fontSize: IS_MOBILE ? 12 : 14,
    marginTop: 4,
  },
  divider: {
    marginVertical: IS_MOBILE ? 6 : 8,
  },
  adminsList: {
    maxHeight: IS_MOBILE ? 150 : 200,
    marginVertical: IS_MOBILE ? 12 : 16,
  },
  addAdminForm: {
    marginTop: IS_MOBILE ? 12 : 16,
  },
  adminInput: {
    marginBottom: IS_MOBILE ? 6 : 8,
  },
  addAdminButton: {
    marginTop: 8,
  },
  saveButton: {
    marginTop: IS_MOBILE ? 12 : 16,
  },
  noAccess: {
    textAlign: 'center',
    fontSize: IS_MOBILE ? 14 : 16,
    marginVertical: IS_MOBILE ? 16 : 20,
  },
  noAccessSubtext: {
    textAlign: 'center',
    fontSize: IS_MOBILE ? 12 : 14,
    marginTop: 8,
  },
  playlistHeader: {
    marginBottom: IS_MOBILE ? 12 : 16,
  },
  playlistDescription: {
    fontSize: IS_MOBILE ? 12 : 14,
    marginTop: 8,
    marginBottom: 4,
  },
  trackCount: {
    fontSize: IS_MOBILE ? 11 : 12,
    marginTop: 4,
  },
  errorText: {
    marginBottom: IS_MOBILE ? 12 : 16,
    textAlign: 'center',
    fontSize: IS_MOBILE ? 13 : 14,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: IS_MOBILE ? 12 : 16,
    fontSize: IS_MOBILE ? 13 : 14,
  },
  djModeControls: {
    marginTop: IS_MOBILE ? 12 : 16,
    padding: IS_MOBILE ? 10 : 12,
    borderRadius: 12,
  },
  djModeLabel: {
    fontSize: IS_MOBILE ? 13 : 14,
    fontWeight: '500',
    marginBottom: IS_MOBILE ? 10 : 12,
  },
  djPlayerButtons: {
    flexDirection: 'row',
    gap: IS_MOBILE ? 6 : 8,
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
  },
  reactionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: IS_MOBILE ? 20 : 28,
    marginVertical: IS_MOBILE ? 20 : 24,
    paddingVertical: IS_MOBILE ? 16 : 20,
    paddingHorizontal: IS_MOBILE ? 12 : 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderRadius: 16,
  },
  reactionButtonGroup: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: IS_MOBILE ? 6 : 8,
  },
  reactionButtonTouchable: {
    padding: IS_MOBILE ? 12 : 14,
    borderRadius: 16,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'background-color 0.2s, transform 0.2s',
    } : {}),
  },
  reactionCount: {
    fontSize: IS_MOBILE ? 12 : 13,
    fontWeight: '600',
  },
  queueItem: {
    marginVertical: IS_MOBILE ? 6 : 8,
    marginHorizontal: IS_MOBILE ? 4 : 8,
    borderRadius: 16,
    padding: IS_MOBILE ? 12 : 14,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'transform 0.2s, box-shadow 0.2s',
    } : {}),
  },
  queueItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IS_MOBILE ? 12 : 16,
  },
  queueItemNumber: {
    width: IS_MOBILE ? 32 : 36,
    height: IS_MOBILE ? 32 : 36,
    borderRadius: IS_MOBILE ? 16 : 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  queueNumber: {
    fontSize: IS_MOBILE ? 13 : 15,
    fontWeight: '700',
  },
  queueItemThumbnail: {
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.25)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
    }),
  },
  historyThumbnail: {
    opacity: 0.7,
  },
  queueItemDetails: {
    flex: 1,
    marginLeft: 4,
  },
  queueItemTitle: {
    fontSize: IS_MOBILE ? 14 : 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  queueItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  queueItemDescription: {
    fontSize: IS_MOBILE ? 12 : 13,
  },
  historyItem: {
    opacity: 0.85,
  },
  historyIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'transform 0.2s',
    } : {}),
  },
});

export default RoomScreen;
