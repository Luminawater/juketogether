import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Share,
  Linking,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Card,
  Title,
  Paragraph,
  Avatar,
  useTheme,
  Divider,
  ActivityIndicator,
  Button,
  IconButton,
} from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';
import { UserBadge } from '../components/UserBadge';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../config/constants';

type PublicProfileScreenRouteProp = RouteProp<RootStackParamList, 'PublicProfile'>;
type PublicProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'PublicProfile'>;

interface UserAnalytics {
  total_rooms_created: number;
  total_listeners_all_rooms: number;
  peak_listeners_all_rooms: number;
  total_tracks_played_all_rooms: number;
  total_play_time_all_rooms_seconds: number;
  total_rooms_joined: number;
  total_sessions_hosted: number;
}

const PublicProfileScreen: React.FC = () => {
  const route = useRoute<PublicProfileScreenRouteProp>();
  const navigation = useNavigation<PublicProfileScreenNavigationProp>();
  const { user, profile: currentUserProfile, supabase } = useAuth();
  const theme = useTheme();

  const { id } = route.params;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending' | 'accepted' | 'pending_incoming'>('none');
  const [loadingFriendship, setLoadingFriendship] = useState(false);
  const [collabStatus, setCollabStatus] = useState<'none' | 'pending' | 'accepted' | 'pending_incoming'>('none');
  const [loadingCollab, setLoadingCollab] = useState(false);
  const [canCollaborate, setCanCollaborate] = useState(false);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [hasSpotify, setHasSpotify] = useState(false);
  const friendSocketRef = useRef<Socket | null>(null);

  useEffect(() => {
    loadProfile();
    if (user?.id && id && user.id !== id) {
      checkFriendshipStatus();
      checkCollaborationStatus();
      checkCollaborationEligibility();
      setupFriendSocket();
    }
    return () => {
      if (friendSocketRef.current) {
        friendSocketRef.current.disconnect();
        friendSocketRef.current = null;
      }
    };
  }, [id, user?.id]);

  const loadProfile = async () => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (profileError || !profileData) {
        console.error('Error loading profile:', profileError);
        setNotFound(true);
        setLoading(false);
        return;
      }

      const profile = profileData as UserProfile;
      setProfile(profile);

      // Check if profile is private
      if (profile.is_private_account === true) {
        // If it's private and not the current user's profile, show private message
        if (user?.id !== id) {
          setIsPrivate(true);
          setLoading(false);
          return;
        }
      }

      // Load analytics if profile is public or it's the current user
      await loadUserAnalytics(id);
      await loadUserPlaylists(id);
      await checkSpotifyConnection(id);
      setLoading(false);
    } catch (error) {
      console.error('Error loading profile:', error);
      setNotFound(true);
      setLoading(false);
    }
  };

  const setupFriendSocket = async () => {
    if (!user?.id || !id || user.id === id) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      // Create a socket connection for friend requests (no room needed)
      const socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: false,
        auth: {
          token: session.access_token,
        },
      });

      socket.on('connect', () => {
        console.log('Friend socket connected');
        // Request friends list to check status
        socket.emit('get-friends');
      });

      socket.on('friends-list', (friends: any[]) => {
        checkFriendshipFromList(friends);
      });

      socket.on('friend-request-sent', () => {
        setFriendshipStatus('pending');
        setLoadingFriendship(false);
        Alert.alert('Success', 'Friend request sent!');
      });

      socket.on('collaboration-request-sent', () => {
        setCollabStatus('pending');
        setLoadingCollab(false);
        Alert.alert('Success', 'Collaboration request sent!');
      });

      socket.on('collaboration-request-accepted', (data: { roomId: string }) => {
        setCollabStatus('accepted');
        setLoadingCollab(false);
        Alert.alert('Success', 'Collaboration request accepted! Creating room...', [
          {
            text: 'Join Room',
            onPress: () => {
              navigation.navigate('Room', { roomId: data.roomId });
            },
          },
          { text: 'OK' },
        ]);
      });

      socket.on('error', (error: any) => {
        console.error('Friend socket error:', error);
        if (error.message) {
          Alert.alert('Error', error.message);
        }
      });

      friendSocketRef.current = socket;
    } catch (error) {
      console.error('Error setting up friend socket:', error);
    }
  };

  const checkFriendshipStatus = async () => {
    if (!user?.id || !id || user.id === id) return;
    
    try {
      // Check friendship status from Supabase - check both directions
      const { data: friendships, error } = await supabase
        .from('friends')
        .select('*')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      if (error) {
        console.error('Error checking friendship:', error);
        return;
      }

      // Find the friendship relationship with this user
      const friendship = friendships?.find(
        (f: any) => 
          (f.user_id === user.id && f.friend_id === id) ||
          (f.user_id === id && f.friend_id === user.id)
      );

      if (friendship) {
        if (friendship.status === 'accepted') {
          setFriendshipStatus('accepted');
        } else if (friendship.status === 'pending') {
          // Check if request is incoming (friend_id is current user) or outgoing (user_id is current user)
          if (friendship.friend_id === user.id) {
            setFriendshipStatus('pending_incoming');
          } else {
            setFriendshipStatus('pending');
          }
        }
      } else {
        setFriendshipStatus('none');
      }
    } catch (error) {
      console.error('Error checking friendship status:', error);
    }
  };

  const checkFriendshipFromList = (friends: any[]) => {
    if (!user?.id || !id) return;
    
    const friendship = friends.find(
      (f: any) => 
        (f.user_id === user.id && f.friend_id === id) ||
        (f.user_id === id && f.friend_id === user.id)
    );

    if (friendship) {
      if (friendship.status === 'accepted') {
        setFriendshipStatus('accepted');
      } else if (friendship.status === 'pending') {
        if (friendship.friend_id === user.id) {
          setFriendshipStatus('pending_incoming');
        } else {
          setFriendshipStatus('pending');
        }
      }
    } else {
      setFriendshipStatus('none');
    }
  };

  const handleSendFriendRequest = () => {
    if (!friendSocketRef.current || !id || loadingFriendship) return;
    
    setLoadingFriendship(true);
    friendSocketRef.current.emit('add-friend', { friendId: id });
    
    // Reset loading after a delay
    setTimeout(() => setLoadingFriendship(false), 2000);
  };

  const handleAcceptFriendRequest = () => {
    if (!friendSocketRef.current || !id || loadingFriendship) return;
    
    setLoadingFriendship(true);
    friendSocketRef.current.emit('accept-friend-request', { friendId: id });
    
    // Listen for friends-list update after acceptance
    const updateHandler = (friends: any[]) => {
      checkFriendshipFromList(friends);
      setLoadingFriendship(false);
      Alert.alert('Success', 'Friend request accepted!');
      friendSocketRef.current?.off('friends-list', updateHandler);
    };
    friendSocketRef.current.on('friends-list', updateHandler);
    
    // Fallback timeout
    setTimeout(() => {
      setLoadingFriendship(false);
      friendSocketRef.current?.off('friends-list', updateHandler);
    }, 5000);
  };

  const checkCollaborationEligibility = async () => {
    if (!user?.id || !id || user.id === id || !currentUserProfile?.subscription_tier || !profile?.subscription_tier) {
      setCanCollaborate(false);
      return;
    }
    
    try {
      // Check if both users' tiers have collaboration enabled
      const { data: currentUserTier } = await supabase
        .from('subscription_tier_settings')
        .select('collaboration')
        .eq('tier', currentUserProfile.subscription_tier)
        .single();
      
      const { data: profileUserTier } = await supabase
        .from('subscription_tier_settings')
        .select('collaboration')
        .eq('tier', profile.subscription_tier)
        .single();

      setCanCollaborate(
        (currentUserTier?.collaboration || false) && 
        (profileUserTier?.collaboration || false)
      );
    } catch (error) {
      console.error('Error checking collaboration eligibility:', error);
      setCanCollaborate(false);
    }
  };

  const checkCollaborationStatus = async () => {
    if (!user?.id || !id || user.id === id) return;
    
    try {
      // Check collaboration request status from Supabase
      const { data: collabRequests, error } = await supabase
        .from('collaboration_requests')
        .select('*')
        .or(`requester_id.eq.${user.id},collaborator_id.eq.${user.id}`);

      if (error) {
        console.error('Error checking collaboration status:', error);
        return;
      }

      // Find the collaboration request with this user
      const collab = collabRequests?.find(
        (c: any) => 
          (c.requester_id === user.id && c.collaborator_id === id) ||
          (c.requester_id === id && c.collaborator_id === user.id)
      );

      if (collab) {
        if (collab.status === 'accepted') {
          setCollabStatus('accepted');
        } else if (collab.status === 'pending') {
          // Check if request is incoming (collaborator_id is current user) or outgoing (requester_id is current user)
          if (collab.collaborator_id === user.id) {
            setCollabStatus('pending_incoming');
          } else {
            setCollabStatus('pending');
          }
        } else {
          setCollabStatus('none');
        }
      } else {
        setCollabStatus('none');
      }
    } catch (error) {
      console.error('Error checking collaboration status:', error);
    }
  };

  const handleSendCollaborationRequest = () => {
    if (!friendSocketRef.current || !id || loadingCollab) return;
    
    setLoadingCollab(true);
    friendSocketRef.current.emit('request-collaboration', { collaboratorId: id });
    
    // Reset loading after a delay
    setTimeout(() => setLoadingCollab(false), 2000);
  };

  const handleAcceptCollaborationRequest = () => {
    if (!friendSocketRef.current || !id || loadingCollab) return;
    
    setLoadingCollab(true);
    friendSocketRef.current.emit('accept-collaboration-request', { requesterId: id });
    
    // Listen for collaboration-accepted event
    const updateHandler = (data: { roomId: string }) => {
      setCollabStatus('accepted');
      setLoadingCollab(false);
      Alert.alert('Success', 'Collaboration request accepted! Creating room...', [
        {
          text: 'Join Room',
          onPress: () => {
            navigation.navigate('Room', { roomId: data.roomId });
          },
        },
        { text: 'OK' },
      ]);
      friendSocketRef.current?.off('collaboration-request-accepted', updateHandler);
    };
    friendSocketRef.current.on('collaboration-request-accepted', updateHandler);
    
    // Fallback timeout
    setTimeout(() => {
      setLoadingCollab(false);
      friendSocketRef.current?.off('collaboration-request-accepted', updateHandler);
    }, 10000);
  };

  const loadUserAnalytics = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_analytics')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        setAnalytics(data as UserAnalytics);
      }
    } catch (error) {
      console.error('Error loading user analytics:', error);
    }
  };

  const loadUserPlaylists = async (userId: string) => {
    try {
      setLoadingPlaylists(true);
      const { data, error } = await supabase
        .from('playlists')
        .select(`
          *,
          playlist_tracks(count)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(6); // Limit to 6 playlists for display

      if (!error && data) {
        const playlistsWithCount = data.map((p: any) => ({
          ...p,
          track_count: p.playlist_tracks?.[0]?.count || 0,
        }));
        setPlaylists(playlistsWithCount);
      }
    } catch (error) {
      console.error('Error loading user playlists:', error);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const checkSpotifyConnection = async (userId: string) => {
    try {
      // Check if user has Spotify connected via auth provider
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (!error && user) {
        // Check if this is the current user viewing their own profile
        if (user.id === userId) {
          const isSpotifyUser = user.app_metadata?.provider === 'spotify' || 
                               user.identities?.some((identity: any) => identity.provider === 'spotify');
          setHasSpotify(isSpotifyUser || false);
        } else {
          // For other users, we can't check their auth provider directly
          // We'll show the link anyway, but it might not work if they haven't connected
          setHasSpotify(false);
        }
      }
    } catch (error) {
      console.error('Error checking Spotify connection:', error);
      setHasSpotify(false);
    }
  };

  const handleOpenLink = (url: string) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.open(url, '_blank');
      }
    } else {
      Linking.openURL(url).catch((err: any) => {
        console.error('Error opening link:', err);
        Alert.alert('Error', 'Could not open link');
      });
    }
  };

  const getInitials = () => {
    if (profile?.display_name) {
      return profile.display_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }
    if (profile?.username) {
      return profile.username.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const formatPlayTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getProfileUrl = () => {
    if (Platform.OS === 'web') {
      // Always use the production domain for shared profile links
      // This ensures links work for anyone who receives them, regardless of environment
      const baseUrl = 'https://www.juketogether.com';
      return `${baseUrl}/profile/${id}`;
    } else {
      // For mobile, construct a deep link URL
      return `juketogether://profile/${id}`;
    }
  };

  const handleShare = async () => {
    if (!profile) return;

    const profileUrl = getProfileUrl();
    const shareMessage = `Check out ${profile.display_name || profile.username || 'this profile'} on JukeTogether!\n${profileUrl}`;

    try {
      if (Platform.OS === 'web') {
        // Use Web Share API if available
        if (typeof navigator !== 'undefined' && 'share' in navigator) {
          await (navigator as any).share({
            title: `${profile.display_name || profile.username || 'Profile'} - JukeTogether`,
            text: shareMessage,
            url: profileUrl,
          });
        } else {
          // Fallback: copy to clipboard
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            await navigator.clipboard.writeText(profileUrl);
            Alert.alert('Copied!', 'Profile link copied to clipboard');
          } else {
            Alert.alert('Share', `Profile URL: ${profileUrl}`);
          }
        }
      } else {
        // Mobile: use React Native Share
        const result = await Share.share({
          message: shareMessage,
          url: profileUrl,
          title: `${profile.display_name || profile.username || 'Profile'} - JukeTogether`,
        });

        if (result.action === Share.sharedAction) {
          if (result.activityType) {
            // Shared with activity type of result.activityType
            console.log('Shared via', result.activityType);
          } else {
            // Shared
            console.log('Profile shared successfully');
          }
        } else if (result.action === Share.dismissedAction) {
          // Dismissed
          console.log('Share dismissed');
        }
      }
    } catch (error: any) {
      console.error('Error sharing profile:', error);
      // Fallback: show alert with URL
      Alert.alert('Share Profile', `Profile URL: ${profileUrl}`);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (notFound) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Card style={[styles.card, { marginHorizontal: 20 }]}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface, textAlign: 'center' }}>
              Profile Not Found
            </Title>
            <Paragraph style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 16 }}>
              The profile you're looking for doesn't exist or has been removed.
            </Paragraph>
            <Button
              mode="contained"
              onPress={() => navigation.goBack()}
              style={{ marginTop: 20 }}
            >
              Go Back
            </Button>
          </Card.Content>
        </Card>
      </View>
    );
  }

  if (isPrivate && user?.id !== id) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Card style={[styles.card, { marginHorizontal: 20 }]}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface, textAlign: 'center' }}>
              Private Profile
            </Title>
            <Paragraph style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 16 }}>
              This profile is private. Only the profile owner can view it.
            </Paragraph>
            <Button
              mode="contained"
              onPress={() => navigation.goBack()}
              style={{ marginTop: 20 }}
            >
              Go Back
            </Button>
          </Card.Content>
        </Card>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* Profile Header Section */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Avatar.Text
            size={80}
            label={getInitials()}
            style={{ backgroundColor: theme.colors.primary }}
          />
          {profile.avatar_url ? (
            <Avatar.Image
              size={80}
              source={{ uri: profile.avatar_url }}
              style={styles.avatar}
            />
          ) : null}
        </View>
        <View style={styles.headerTitleContainer}>
          <Title style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
            {profile.username || 'user_unknown'}
          </Title>
          <IconButton
            icon="share-variant"
            size={24}
            onPress={handleShare}
            iconColor={theme.colors.primary}
            style={styles.shareButton}
          />
        </View>
        {profile.display_name && (
          <Paragraph style={[styles.displayName, { color: theme.colors.onSurfaceVariant }]}>
            {profile.display_name}
          </Paragraph>
        )}
        {profile.dj_name ? (
          <Paragraph style={[styles.djName, { color: theme.colors.primary }]}>
            🎧 {profile.dj_name}
          </Paragraph>
        ) : null}
        {profile.country && (
          <Paragraph style={[styles.country, { color: theme.colors.onSurfaceVariant }]}>
            📍 {profile.country}
          </Paragraph>
        )}
        <View style={styles.badgeContainer}>
          <UserBadge
            role={profile.role}
            tier={profile.subscription_tier}
            showLabel={true}
            size="small"
          />
        </View>
        
        {/* Friend Request Button - Only show if viewing someone else's profile */}
        {user?.id && id && user.id !== id && (
          <View style={styles.friendRequestContainer}>
            {friendshipStatus === 'none' && (
              <Button
                mode="contained"
                onPress={handleSendFriendRequest}
                loading={loadingFriendship}
                disabled={loadingFriendship}
                icon="account-plus"
                style={styles.friendButton}
              >
                Send Friend Request
              </Button>
            )}
            {friendshipStatus === 'pending' && (
              <Button
                mode="outlined"
                disabled={true}
                icon="clock-outline"
                style={styles.friendButton}
              >
                Friend Request Sent
              </Button>
            )}
            {friendshipStatus === 'pending_incoming' && (
              <Button
                mode="contained"
                onPress={handleAcceptFriendRequest}
                loading={loadingFriendship}
                disabled={loadingFriendship}
                icon="account-check"
                style={styles.friendButton}
              >
                Accept Friend Request
              </Button>
            )}
            {friendshipStatus === 'accepted' && (
              <Button
                mode="outlined"
                disabled={true}
                icon="account-check"
                style={styles.friendButton}
              >
                Friends
              </Button>
            )}
          </View>
        )}
        
        {/* Collaboration Request Button - Only show for users with collaboration-enabled tiers */}
        {user?.id && id && user.id !== id && canCollaborate && (
          <View style={styles.friendRequestContainer}>
            {collabStatus === 'none' && (
              <Button
                mode="contained"
                onPress={handleSendCollaborationRequest}
                loading={loadingCollab}
                disabled={loadingCollab}
                icon="music-note"
                style={[styles.friendButton, { backgroundColor: theme.colors.secondary }]}
              >
                Request a Collab
              </Button>
            )}
            {collabStatus === 'pending' && (
              <Button
                mode="outlined"
                disabled={true}
                icon="clock-outline"
                style={styles.friendButton}
              >
                Collab Request Sent
              </Button>
            )}
            {collabStatus === 'pending_incoming' && (
              <Button
                mode="contained"
                onPress={handleAcceptCollaborationRequest}
                loading={loadingCollab}
                disabled={loadingCollab}
                icon="music-note-multiple"
                style={[styles.friendButton, { backgroundColor: theme.colors.secondary }]}
              >
                Accept Collab Request
              </Button>
            )}
            {collabStatus === 'accepted' && (
              <Button
                mode="outlined"
                disabled={true}
                icon="music-note-multiple"
                style={styles.friendButton}
              >
                Collaborating
              </Button>
            )}
          </View>
        )}
      </View>

      {/* Statistics Card */}
      {analytics && (
        <Card style={[styles.card, styles.enhancedCard, { marginHorizontal: 20, marginBottom: 20 }]}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <IconButton
                icon="chart-line"
                size={24}
                iconColor={theme.colors.primary}
                style={styles.sectionIcon}
              />
              <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Statistics
              </Title>
            </View>
            <Divider style={styles.divider} />
            
            <View style={styles.statsGrid}>
              <View style={[styles.statItem, styles.enhancedStatItem, { backgroundColor: theme.colors.surfaceVariant }]}>
                <IconButton
                  icon="door-open"
                  size={20}
                  iconColor={theme.colors.primary}
                  style={styles.statIcon}
                />
                <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                  {analytics.total_rooms_created || 0}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Rooms Created
                </Text>
              </View>

              <View style={[styles.statItem, styles.enhancedStatItem, { backgroundColor: theme.colors.surfaceVariant }]}>
                <IconButton
                  icon="account-group"
                  size={20}
                  iconColor={theme.colors.primary}
                  style={styles.statIcon}
                />
                <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                  {analytics.total_listeners_all_rooms || 0}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Total Listeners
                </Text>
              </View>

              {analytics.total_play_time_all_rooms_seconds > 0 && (
                <View style={[styles.statItem, styles.enhancedStatItem, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <IconButton
                    icon="clock-outline"
                    size={20}
                    iconColor={theme.colors.primary}
                    style={styles.statIcon}
                  />
                  <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                    {formatPlayTime(analytics.total_play_time_all_rooms_seconds)}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                    Total Play Time
                  </Text>
                </View>
              )}

              <View style={[styles.statItem, styles.enhancedStatItem, { backgroundColor: theme.colors.surfaceVariant }]}>
                <IconButton
                  icon="login"
                  size={20}
                  iconColor={theme.colors.primary}
                  style={styles.statIcon}
                />
                <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                  {analytics.total_rooms_joined || 0}
                </Text>
                <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Rooms Joined
                </Text>
              </View>

              {analytics.total_tracks_played_all_rooms > 0 && (
                <View style={[styles.statItem, styles.enhancedStatItem, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <IconButton
                    icon="music-note"
                    size={20}
                    iconColor={theme.colors.primary}
                    style={styles.statIcon}
                  />
                  <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                    {analytics.total_tracks_played_all_rooms || 0}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                    Tracks Played
                  </Text>
                </View>
              )}

              {analytics.total_sessions_hosted > 0 && (
                <View style={[styles.statItem, styles.enhancedStatItem, { backgroundColor: theme.colors.surfaceVariant }]}>
                  <IconButton
                    icon="microphone"
                    size={20}
                    iconColor={theme.colors.primary}
                    style={styles.statIcon}
                  />
                  <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                    {analytics.total_sessions_hosted || 0}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                    Sessions Hosted
                  </Text>
                </View>
              )}
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Quick Links Card */}
      <Card style={[styles.card, styles.enhancedCard, { marginHorizontal: 20, marginBottom: 20 }]}>
        <Card.Content>
          <View style={styles.sectionHeader}>
            <IconButton
              icon="link-variant"
              size={24}
              iconColor={theme.colors.primary}
              style={styles.sectionIcon}
            />
            <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Quick Links
            </Title>
          </View>
          <Divider style={styles.divider} />
          
          <View style={styles.quickLinksContainer}>
            <TouchableOpacity
              style={[styles.quickLinkButton, { backgroundColor: theme.colors.surfaceVariant }]}
              onPress={() => handleOpenLink('https://open.spotify.com')}
            >
              <IconButton
                icon="spotify"
                size={28}
                iconColor="#1DB954"
                style={styles.quickLinkIcon}
              />
              <Text style={[styles.quickLinkText, { color: theme.colors.onSurface }]}>
                Spotify
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickLinkButton, { backgroundColor: theme.colors.surfaceVariant }]}
              onPress={() => handleOpenLink('https://soundcloud.com')}
            >
              <IconButton
                icon="soundcloud"
                size={28}
                iconColor="#FF5500"
                style={styles.quickLinkIcon}
              />
              <Text style={[styles.quickLinkText, { color: theme.colors.onSurface }]}>
                SoundCloud
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickLinkButton, { backgroundColor: theme.colors.surfaceVariant }]}
              onPress={() => handleOpenLink('https://youtube.com')}
            >
              <IconButton
                icon="youtube"
                size={28}
                iconColor="#FF0000"
                style={styles.quickLinkIcon}
              />
              <Text style={[styles.quickLinkText, { color: theme.colors.onSurface }]}>
                YouTube
              </Text>
            </TouchableOpacity>
          </View>
        </Card.Content>
      </Card>

      {/* Playlists Card */}
      {playlists.length > 0 && (
        <Card style={[styles.card, styles.enhancedCard, { marginHorizontal: 20, marginBottom: 20 }]}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <IconButton
                icon="playlist-music"
                size={24}
                iconColor={theme.colors.primary}
                style={styles.sectionIcon}
              />
              <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Playlists
              </Title>
            </View>
            <Divider style={styles.divider} />
            
            {loadingPlaylists ? (
              <ActivityIndicator size="small" style={{ marginVertical: 20 }} />
            ) : (
              <View style={styles.playlistsContainer}>
                {playlists.map((playlist) => (
                  <TouchableOpacity
                    key={playlist.id}
                    style={[styles.playlistItem, { backgroundColor: theme.colors.surfaceVariant }]}
                    onPress={() => navigation.navigate('Playlist', { playlistId: playlist.id })}
                  >
                    <View style={styles.playlistContent}>
                      <IconButton
                        icon="playlist-music"
                        size={24}
                        iconColor={theme.colors.primary}
                        style={styles.playlistIcon}
                      />
                      <View style={styles.playlistInfo}>
                        <Text style={[styles.playlistName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                          {playlist.name}
                        </Text>
                        <Text style={[styles.playlistTrackCount, { color: theme.colors.onSurfaceVariant }]}>
                          {playlist.track_count || 0} tracks
                        </Text>
                      </View>
                    </View>
                    <IconButton
                      icon="chevron-right"
                      size={20}
                      iconColor={theme.colors.onSurfaceVariant}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Account Information Card */}
      <Card style={[styles.card, styles.enhancedCard, { marginHorizontal: 20 }]}>
        <Card.Content>
          <View style={styles.sectionHeader}>
            <IconButton
              icon="account-circle"
              size={24}
              iconColor={theme.colors.primary}
              style={styles.sectionIcon}
            />
            <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Account Information
            </Title>
          </View>
          <Divider style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoRowContent}>
              <IconButton
                icon="calendar"
                size={20}
                iconColor={theme.colors.onSurfaceVariant}
                style={styles.infoIcon}
              />
              <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>
                Member since:
              </Text>
            </View>
            <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>
              {profile.created_at
                ? new Date(profile.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })
                : 'Unknown'}
            </Text>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    width: '100%',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  shareButton: {
    margin: 0,
  },
  displayName: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  djName: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  country: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  badgeContainer: {
    marginTop: 16,
  },
  card: {
    marginBottom: 20,
    elevation: 4,
    borderRadius: 16,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.15)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
    }),
  },
  enhancedCard: {
    borderRadius: 20,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.2)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionIcon: {
    margin: 0,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  divider: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 8,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  enhancedStatItem: {
    borderRadius: 16,
    padding: 16,
    minHeight: 100,
    justifyContent: 'center',
  },
  statIcon: {
    margin: 0,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 2,
  },
  friendRequestContainer: {
    marginTop: 20,
    width: '100%',
    paddingHorizontal: 20,
  },
  friendButton: {
    width: '100%',
  },
  quickLinksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  quickLinkButton: {
    flex: 1,
    minWidth: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
  },
  quickLinkIcon: {
    margin: 0,
    marginRight: 8,
  },
  quickLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  playlistsContainer: {
    marginTop: 8,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  playlistContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  playlistIcon: {
    margin: 0,
    marginRight: 12,
  },
  playlistInfo: {
    flex: 1,
  },
  playlistName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  playlistTrackCount: {
    fontSize: 12,
  },
  infoRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    margin: 0,
    marginRight: 8,
  },
});

export default PublicProfileScreen;

