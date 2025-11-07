import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Share,
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
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { Track } from '../types';
import { socketService, RoomState } from '../services/socketService';
import { FloatingPlayer } from '../components/FloatingPlayer';
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

const RoomScreen: React.FC = () => {
  const route = useRoute<RoomScreenRouteProp>();
  const navigation = useNavigation<RoomScreenNavigationProp>();
  const { user, session, supabase } = useAuth();
  const theme = useTheme();

  const { roomId, roomName } = route.params;

  // Main state
  const [activeTab, setActiveTab] = useState<'main' | 'users' | 'settings' | 'spotify'>('main');
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

  // Connect to Socket.io when component mounts
  useEffect(() => {
    const userId = user?.id || `anonymous_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    socketService.connect(roomId, userId);

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
      Alert.alert('Error', 'Please enter a track URL');
      return;
    }

    if (!connected) {
      Alert.alert('Error', 'Not connected to room. Please wait...');
      return;
    }

    const isSoundCloud = trackUrl.includes('soundcloud.com');
    const isSpotify = trackUrl.includes('spotify.com') || trackUrl.includes('spotify:');
    const isYouTube = trackUrl.includes('youtube.com') || trackUrl.includes('youtu.be');

    if (!isSoundCloud && !isSpotify && !isYouTube) {
      Alert.alert('Error', 'Please enter a valid SoundCloud, Spotify, or YouTube URL');
      return;
    }

    setLoading(true);
    try {
      if (socketService.socket) {
        socketService.socket.emit('add-track', {
          roomId,
          trackUrl: trackUrl.trim(),
        });
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
      // Generate shareable link - using roomId that can be pasted into the app
      // For web/mobile apps, we can use a simple format or full URL
      const shareMessage = `Join my music room "${roomName}"!\n\nRoom ID: ${roomId}\n\nPaste this Room ID in the app to join, or use this link: https://juketogether.vercel.app/room/${roomId}`;
      
      const result = await Share.share({
        message: shareMessage,
        title: `Join ${roomName}`,
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // Shared with activity type of result.activityType
          console.log('Shared via:', result.activityType);
        } else {
          // Shared
          console.log('Room shared successfully');
        }
      } else if (result.action === Share.dismissedAction) {
        // Dismissed
        console.log('Share dismissed');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to share room link');
      console.error('Error sharing room:', error);
    }
  };

  const renderMainTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* Current Track */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>Now Playing</Title>
          {currentTrack ? (
            <>
              <View style={styles.trackInfo}>
                <Avatar.Image
                  size={60}
                  source={{ uri: currentTrack.info?.thumbnail || 'https://via.placeholder.com/60' }}
                />
                <View style={styles.trackDetails}>
                  <Text style={styles.trackTitle}>{currentTrack.info?.fullTitle || 'Unknown Track'}</Text>
                  <Text style={styles.trackPlatform}>
                    {currentTrack.url?.includes('spotify') ? '🎵 Spotify' : 
                     currentTrack.url?.includes('youtube') ? '🎥 YouTube' : 
                     '🎵 SoundCloud'}
                  </Text>
                </View>
              </View>

              {/* Track Reactions */}
              {user && (
                <View style={styles.reactionsContainer}>
                  <View style={styles.reactionButtonGroup}>
                    <IconButton
                      icon="thumb-up"
                      iconColor={trackReactions.userReaction === 'like' ? '#4caf50' : '#666'}
                      size={28}
                      onPress={() => handleReaction('like')}
                      disabled={loadingReaction}
                      style={[
                        styles.reactionButton,
                        trackReactions.userReaction === 'like' && styles.reactionButtonActive
                      ]}
                    />
                    <Text style={styles.reactionCount}>{trackReactions.likes}</Text>
                  </View>

                  <View style={styles.reactionButtonGroup}>
                    <IconButton
                      icon="thumb-down"
                      iconColor={trackReactions.userReaction === 'dislike' ? '#f44336' : '#666'}
                      size={28}
                      onPress={() => handleReaction('dislike')}
                      disabled={loadingReaction}
                      style={[
                        styles.reactionButton,
                        trackReactions.userReaction === 'dislike' && styles.reactionButtonActive
                      ]}
                    />
                    <Text style={styles.reactionCount}>{trackReactions.dislikes}</Text>
                  </View>

                  <View style={styles.reactionButtonGroup}>
                    <IconButton
                      icon="star"
                      iconColor={trackReactions.userReaction === 'fantastic' ? '#ff9800' : '#666'}
                      size={28}
                      onPress={() => handleReaction('fantastic')}
                      disabled={loadingReaction}
                      style={[
                        styles.reactionButton,
                        trackReactions.userReaction === 'fantastic' && styles.reactionButtonActive
                      ]}
                    />
                    <Text style={styles.reactionCount}>{trackReactions.fantastic}</Text>
                  </View>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.noTrack}>No track playing</Text>
          )}

          {/* Playback Controls */}
          <View style={styles.controls}>
            <Button
              mode="contained"
              onPress={playPause}
              style={styles.controlButton}
              disabled={!currentTrack || !canControl}
              icon={isPlaying ? 'pause' : 'play'}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button
              mode="outlined"
              onPress={nextTrack}
              style={styles.controlButton}
              disabled={queue.length === 0 || !canControl}
              icon="skip-next"
            >
              Next
            </Button>
            <Button
              mode="outlined"
              onPress={syncToSession}
              style={styles.controlButton}
              icon="sync"
            >
              Sync
            </Button>
          </View>
          {!canControl && (
            <Text style={styles.permissionNotice}>
              ⚠️ Only room owner and admins can control playback
            </Text>
          )}
        </Card.Content>
      </Card>

      {/* Add Track */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>Add Track</Title>
          {!user && (
            <Text style={styles.anonymousNotice}>
              💡 Sign up to add tracks to the queue
            </Text>
          )}
          {user && !isOwner && !isAdmin && !roomSettings.allowQueue && (
            <Text style={styles.permissionNotice}>
              ⚠️ Only room owner and admins can add tracks to the queue
            </Text>
          )}
          <TextInput
            label="SoundCloud, Spotify, or YouTube URL"
            value={trackUrl}
            onChangeText={setTrackUrl}
            mode="outlined"
            placeholder="Paste a URL..."
            style={styles.urlInput}
            editable={!!user && (isOwner || isAdmin || roomSettings.allowQueue)}
            onSubmitEditing={addTrack}
          />
          <Button
            mode="contained"
            onPress={addTrack}
            loading={loading}
            disabled={loading || !user || (!isOwner && !isAdmin && !roomSettings.allowQueue)}
            style={styles.addButton}
          >
            {user ? 'Add to Queue' : 'Sign Up to Add Tracks'}
          </Button>
        </Card.Content>
      </Card>

      {/* Queue */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>Queue ({queue.length})</Title>
          {queue.length === 0 ? (
            <Text style={styles.emptyQueue}>Queue is empty. Add a track to get started!</Text>
          ) : (
            <ScrollView style={styles.queueList}>
              {queue.map((track, index) => (
                <List.Item
                  key={track.id}
                  title={track.info?.fullTitle || 'Unknown Track'}
                  description={`Added by ${track.addedBy === user?.id ? 'You' : 'Someone'}`}
                  left={() => (
                    <Avatar.Image
                      size={40}
                      source={{ uri: track.info?.thumbnail || 'https://via.placeholder.com/40' }}
                    />
                  )}
                  right={() => <Text>{index + 1}</Text>}
                />
              ))}
            </ScrollView>
          )}
        </Card.Content>
      </Card>

      {/* History */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>History ({history.length})</Title>
          {history.length === 0 ? (
            <Text style={styles.emptyQueue}>No tracks played yet</Text>
          ) : (
            <ScrollView style={styles.queueList}>
              {history.slice(0, 10).map((track) => (
                <List.Item
                  key={track.id}
                  title={track.info?.fullTitle || 'Unknown Track'}
                  description="Previously played"
                  left={() => (
                    <Avatar.Image
                      size={40}
                      source={{ uri: track.info?.thumbnail || 'https://via.placeholder.com/40' }}
                    />
                  )}
                  onPress={() => {
                    // Replay track
                    if (socketService.socket) {
                      socketService.socket.emit('replay-track', { roomId, trackId: track.id });
                    }
                  }}
                />
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
        <ScrollView style={styles.tabContent}>
          <Card style={styles.card}>
            <Card.Content>
              <Title>Spotify Playlists</Title>
              <Text style={styles.emptyQueue}>
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
        <ScrollView style={styles.tabContent}>
          <Card style={styles.card}>
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
                <Title>{selectedPlaylist.name}</Title>
                {selectedPlaylist.description && (
                  <Text style={styles.playlistDescription}>{selectedPlaylist.description}</Text>
                )}
                {selectedPlaylist.tracks && (
                  <Text style={styles.trackCount}>
                    {selectedPlaylist.tracks.total} tracks
                  </Text>
                )}
              </View>
            </Card.Content>
          </Card>

          {spotifyError && (
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.errorText}>{spotifyError}</Text>
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
            <Card style={styles.card}>
              <Card.Content>
                <ActivityIndicator size="large" />
                <Text style={styles.loadingText}>Loading tracks...</Text>
              </Card.Content>
            </Card>
          ) : playlistTracks.length > 0 ? (
            <>
              <Card style={styles.card}>
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
              <Card style={styles.card}>
                <Card.Content>
                  <Title>Tracks</Title>
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
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.emptyQueue}>No tracks found in this playlist</Text>
              </Card.Content>
            </Card>
          )}
        </ScrollView>
      );
    }

    return (
      <ScrollView style={styles.tabContent}>
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.playlistHeader}>
              <Title>Your Spotify Playlists</Title>
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
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.errorText}>{spotifyError}</Text>
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
          <Card style={styles.card}>
            <Card.Content>
              <ActivityIndicator size="large" />
              <Text style={styles.loadingText}>Loading playlists...</Text>
            </Card.Content>
          </Card>
        ) : spotifyPlaylists.length > 0 ? (
          <Card style={styles.card}>
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
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.emptyQueue}>No playlists found</Text>
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
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.noAccess}>You don't have access to room settings.</Text>
              <Text style={styles.noAccessSubtext}>Only room owners and admins can access settings.</Text>
            </Card.Content>
          </Card>
        </View>
      );
    }

    return (
      <ScrollView style={styles.tabContent}>
        <Card style={styles.card}>
          <Card.Content>
            <Title>Room Settings</Title>
            
            <View style={styles.settingItem}>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Private Room</Text>
                <Switch
                  value={roomSettings.isPrivate}
                  onValueChange={(value) => setRoomSettings(prev => ({ ...prev, isPrivate: value }))}
                  disabled={!isOwner}
                />
              </View>
              <Text style={styles.settingDescription}>
                Only users with the room link can join
              </Text>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.settingItem}>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Allow Users to Control Playback</Text>
                <Switch
                  value={roomSettings.allowControls}
                  onValueChange={(value) => setRoomSettings(prev => ({ ...prev, allowControls: value }))}
                  disabled={!isOwner && !isAdmin}
                />
              </View>
              <Text style={styles.settingDescription}>
                If disabled, only room owner and admins can control playback
              </Text>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.settingItem}>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Allow Users to Queue Songs</Text>
                <Switch
                  value={roomSettings.allowQueue}
                  onValueChange={(value) => setRoomSettings(prev => ({ ...prev, allowQueue: value }))}
                  disabled={!isOwner && !isAdmin}
                />
              </View>
              <Text style={styles.settingDescription}>
                If disabled, only room owner and admins can add tracks to the queue
              </Text>
            </View>

            <Divider style={styles.divider} />

            <View style={styles.settingItem}>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>DJ Mode (Standard Tier)</Text>
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
              <Text style={styles.settingDescription}>
                Enable DJ mode to add up to 3 additional players for mixing tracks
              </Text>
              
              {roomSettings.djMode && (
                <View style={styles.djModeControls}>
                  <Text style={styles.djModeLabel}>Active Players: {roomSettings.djPlayers} / 3</Text>
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
                  <Text style={styles.settingLabel}>Room Admins</Text>
                  <Text style={styles.settingDescription}>
                    Admins can access settings and control playback
                  </Text>
                  
                  <ScrollView style={styles.adminsList}>
                    {roomSettings.admins.length === 0 ? (
                      <Text style={styles.emptyQueue}>No admins added yet</Text>
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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.headerTop}>
          <Text style={styles.roomTitle}>{roomName}</Text>
          <View style={styles.headerRight}>
            <IconButton
              icon="share-variant"
              iconColor="#fff"
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
        <Text style={styles.roomId}>Room ID: {roomId} • {userCount} users</Text>
        {!connected && <ActivityIndicator size="small" color={theme.colors.onSurface} style={styles.connectingIndicator} />}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Button
          mode={activeTab === 'main' ? 'contained' : 'text'}
          onPress={() => setActiveTab('main')}
          icon="music-note"
          style={styles.tabButton}
        >
          Main
        </Button>
        <Button
          mode={activeTab === 'users' ? 'contained' : 'text'}
          onPress={() => setActiveTab('users')}
          icon="account-group"
          style={styles.tabButton}
        >
          Users
        </Button>
        {user && isSpotifyUser(user) && (
          <Button
            mode={activeTab === 'spotify' ? 'contained' : 'text'}
            onPress={() => setActiveTab('spotify')}
            icon="spotify"
            style={styles.tabButton}
          >
            Spotify
          </Button>
        )}
        {(isOwner || isAdmin) && (
          <Button
            mode={activeTab === 'settings' ? 'contained' : 'text'}
            onPress={() => setActiveTab('settings')}
            icon="cog"
            style={styles.tabButton}
          >
            Settings
          </Button>
        )}
      </View>

      {/* Tab Content */}
      {activeTab === 'main' && renderMainTab()}
      {activeTab === 'users' && renderUsersTab()}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingTop: Platform.OS === 'web' ? 16 : 50,
    elevation: 2,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roomTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareButton: {
    margin: 0,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  connectingIndicator: {
    marginTop: 8,
  },
  roomId: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 8,
  },
  tabButton: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  card: {
    margin: 16,
    marginTop: 16,
  },
  trackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  trackDetails: {
    marginLeft: 16,
    flex: 1,
  },
  trackTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  trackPlatform: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  noTrack: {
    textAlign: 'center',
    fontStyle: 'italic',
    color: '#666',
    paddingVertical: 20,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  controlButton: {
    flex: 1,
    minWidth: 100,
    maxWidth: 150,
  },
  permissionNotice: {
    fontSize: 12,
    color: '#ff9800',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  anonymousNotice: {
    fontSize: 14,
    color: '#ff9800',
    marginBottom: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  urlInput: {
    marginBottom: 16,
  },
  addButton: {
    marginTop: 8,
  },
  emptyQueue: {
    textAlign: 'center',
    fontStyle: 'italic',
    color: '#666',
    paddingVertical: 40,
  },
  queueList: {
    maxHeight: 400,
  },
  usersList: {
    maxHeight: 300,
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestSent: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 4,
  },
  friendsTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  friendsTabButton: {
    flex: 1,
  },
  friendsList: {
    maxHeight: 400,
  },
  settingItem: {
    marginVertical: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  divider: {
    marginVertical: 8,
  },
  adminsList: {
    maxHeight: 200,
    marginVertical: 16,
  },
  addAdminForm: {
    marginTop: 16,
  },
  adminInput: {
    marginBottom: 8,
  },
  addAdminButton: {
    marginTop: 8,
  },
  saveButton: {
    marginTop: 16,
  },
  noAccess: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginVertical: 20,
  },
  noAccessSubtext: {
    textAlign: 'center',
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  playlistHeader: {
    marginBottom: 16,
  },
  playlistDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
  },
  trackCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  errorText: {
    color: '#f44336',
    marginBottom: 16,
    textAlign: 'center',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 16,
    color: '#666',
  },
  djModeControls: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  djModeLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
    color: '#333',
  },
  djPlayerButtons: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-start',
  },
  reactionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginVertical: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
  },
  reactionButtonGroup: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  reactionButton: {
    margin: 0,
  },
  reactionButtonActive: {
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
  },
  reactionCount: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
});

export default RoomScreen;
