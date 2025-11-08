import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Text,
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  RadioButton,
  Avatar,
  FAB,
  Portal,
  Dialog,
  useTheme,
} from 'react-native-paper';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { Room } from '../types';
import { SUPABASE_URL } from '../config/constants';
import { UserBadge } from '../components/UserBadge';
import { DashboardSkeleton } from '../components/LoadingSkeleton';
import {
  getRemainingSongs,
  canPlaySong,
  getTierDisplayName,
  hasRole,
} from '../utils/permissions';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getRoomUrl, getRoomShareMessage } from '../utils/roomUtils';
import { ShareRoomDialog } from '../components/ShareRoomDialog';

type DashboardScreenNavigationProp = NavigationProp<RootStackParamList, 'Dashboard'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_MOBILE = SCREEN_WIDTH < 768;
const IS_SMALL_MOBILE = SCREEN_WIDTH < 400;

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const { user, session, profile, permissions, signOut, supabase } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogVisible, setCreateDialogVisible] = useState(false);
  const [joinDialogVisible, setJoinDialogVisible] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [sharingRoom, setSharingRoom] = useState<Room | null>(null);

  // Create room form state
  const [roomName, setRoomName] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [roomType, setRoomType] = useState<'public' | 'private'>('public');

  // Join room form state
  const [joinRoomId, setJoinRoomId] = useState('');

  // Refs to prevent infinite loops
  const isLoadingRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const renderCountRef = useRef(0);

  // Debug: Track renders
  renderCountRef.current += 1;
  console.log(`[DashboardScreen] Render #${renderCountRef.current}`, {
    userId: user?.id,
    hasUser: !!user,
    loading,
    roomsCount: rooms.length,
    isLoadingRef: isLoadingRef.current,
    lastUserId: lastUserIdRef.current,
  });

  const loadUserRooms = useCallback(async () => {
    const userId = user?.id;
    
    console.log('[DashboardScreen] loadUserRooms called', {
      userId,
      isLoading: isLoadingRef.current,
      lastUserId: lastUserIdRef.current,
    });

    // Prevent multiple simultaneous calls
    if (isLoadingRef.current) {
      console.log('[DashboardScreen] Already loading, skipping...');
      return;
    }

    if (!userId) {
      console.log('[DashboardScreen] No user ID, stopping loading');
      setLoading(false);
      return;
    }

    // Prevent loading same user multiple times
    if (lastUserIdRef.current === userId) {
      console.log('[DashboardScreen] Same user ID as last load, skipping...');
      return;
    }

    isLoadingRef.current = true;
    lastUserIdRef.current = userId;

    // Add timeout to prevent infinite hanging (backup timeout)
    const timeoutId = setTimeout(() => {
      console.error('[DashboardScreen] Overall timeout after 12 seconds');
      isLoadingRef.current = false;
      setLoading(false);
      Alert.alert('Timeout', 'Loading rooms took too long. Please try again.');
    }, 12000);

    try {
      console.log('[DashboardScreen] Starting room fetch for user:', userId);
      console.log('[DashboardScreen] Supabase client:', !!supabase);
      console.log('[DashboardScreen] Context session:', {
        hasSession: !!session,
        sessionUser: session?.user?.id,
        accessToken: session?.access_token ? 'present' : 'missing',
      });
      
      // Check localStorage for Supabase session (web only)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Check all Supabase-related keys
        const allKeys = Object.keys(localStorage).filter(k => 
          k.includes('supabase') || 
          k.includes('sb-') || 
          k.toLowerCase().includes('auth')
        );
        console.log('[DashboardScreen] All auth-related localStorage keys:', allKeys);
        
        // Try to find the Supabase session key
        const supabaseKeys = allKeys.filter(k => k.includes('sb-'));
        if (supabaseKeys.length > 0) {
          supabaseKeys.forEach(key => {
            const value = localStorage.getItem(key);
            console.log(`[DashboardScreen] localStorage[${key}]:`, {
              exists: !!value,
              length: value?.length || 0,
              preview: value?.substring(0, 50) || 'empty',
            });
          });
        }
      }
      
      // Check if we have a session before querying
      const { data: sessionData } = await supabase.auth.getSession();
      console.log('[DashboardScreen] Supabase getSession() result:', {
        hasSession: !!sessionData?.session,
        sessionUser: sessionData?.session?.user?.id,
        accessToken: sessionData?.session?.access_token ? 'present' : 'missing',
        matchesContext: sessionData?.session?.user?.id === session?.user?.id,
      });
      
      if (!sessionData?.session) {
        console.error('[DashboardScreen] No session found in Supabase client!');
        console.error('[DashboardScreen] Context session exists:', !!session);
        if (session) {
          console.error('[DashboardScreen] Session mismatch - context has session but Supabase client does not!');
          console.error('[DashboardScreen] This might indicate a storage issue. Trying to set session...');
          // Try to set the session manually
          const { error: setError } = await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
          if (setError) {
            console.error('[DashboardScreen] Failed to set session:', setError);
            // Don't throw - let the query fail gracefully instead of redirecting
            console.warn('[DashboardScreen] Session restoration failed, but continuing anyway');
            // The query will likely fail, but we'll handle it gracefully
          } else {
            console.log('[DashboardScreen] Session manually restored, retrying query...');
          }
        } else {
          // No session at all - this is a real auth issue
          console.error('[DashboardScreen] No session in context either - user needs to sign in');
          // Don't throw here - let the query fail and handle it in error handling
          // The App.tsx will handle redirect if user is actually null
        }
      }
      
      console.log('[DashboardScreen] Querying rooms for user:', userId);
      console.log('[DashboardScreen] Session check:', {
        hasSession: !!session,
        sessionUser: session?.user?.id,
        accessToken: session?.access_token ? 'present' : 'missing'
      });

      // Note: We don't throw here if session is missing - let the query fail gracefully
      // The App.tsx will handle redirect if user is actually null

      // Query rooms with timeout protection
      console.log('[DashboardScreen] Executing rooms query with 8s timeout...');
      
      const startTime = Date.now();
      const queryPromise = supabase
        .from('rooms')
        .select('id, host_user_id, updated_at')
        .eq('host_user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(50);
      
      // Add timeout wrapper
      const timeoutPromise = new Promise<{ data: null; error: any }>((resolve) =>
        setTimeout(() => resolve({
          data: null,
          error: { message: 'Query timeout after 8 seconds', code: 'TIMEOUT' }
        }), 8000)
      );
      
      const { data: roomsData, error: roomsError } = await Promise.race([
        queryPromise,
        timeoutPromise
      ]);
      
      const queryTime = Date.now() - startTime;
      console.log('[DashboardScreen] Query completed in', queryTime, 'ms. Data:', roomsData?.length || 0, 'Error:', roomsError);

      if (roomsError) {
        console.error('[DashboardScreen] Rooms query error:', roomsError);
        console.error('[DashboardScreen] Error details:', JSON.stringify(roomsError, null, 2));
        
        // Handle timeout errors gracefully - don't throw, just show empty state
        if (roomsError.code === 'TIMEOUT') {
          console.warn('[DashboardScreen] Query timed out, showing empty state');
          setRooms([]);
          Alert.alert(
            'Connection Timeout',
            'Unable to load rooms. Please check your connection and try again.',
            [{ text: 'OK' }]
          );
          return;
        }
        
        // For other errors, check if it's an auth error
        if (roomsError.message?.includes('JWT') || roomsError.message?.includes('session') || roomsError.message?.includes('unauthorized')) {
          console.error('[DashboardScreen] Auth error detected, will redirect to login');
          throw roomsError;
        }
        
        // For other errors, show empty state instead of crashing
        console.warn('[DashboardScreen] Non-critical error, showing empty state');
        setRooms([]);
        Alert.alert('Error', 'Failed to load rooms. Please try again later.');
        return;
      }

      console.log('[DashboardScreen] Basic rooms query successful, found:', roomsData?.length || 0, 'rooms');
      console.log('[DashboardScreen] Rooms data:', roomsData);

      if (!roomsData || roomsData.length === 0) {
        console.log('[DashboardScreen] No rooms found for user:', userId);
        console.log('[DashboardScreen] This might be normal if the user hasn\'t created any rooms yet');
        setRooms([]);
        return;
      }

      console.log('[DashboardScreen] Found', roomsData.length, 'rooms, fetching settings...');

      // Get room settings separately
      const roomIds = roomsData.map((r: any) => r.id);
      console.log('[DashboardScreen] Fetching settings for rooms:', roomIds);

      const settingsResult = await Promise.race([
        supabase
          .from('room_settings')
          .select('*')
          .in('room_id', roomIds),
        new Promise<{ data: null; error: any }>((resolve) =>
          setTimeout(() => resolve({
            data: null,
            error: { message: 'Settings query timeout after 5 seconds', code: 'TIMEOUT' }
          }), 5000)
        )
      ]);

      const settingsData = settingsResult.data;
      const settingsError = settingsResult.error;

      if (settingsError && settingsError.code !== 'TIMEOUT') {
        console.warn('[DashboardScreen] Error fetching room settings:', settingsError);
        // Continue without settings - we'll use defaults
      }

      // Create a map of room_id -> settings
      const settingsMap = new Map();
      if (settingsData) {
        settingsData.forEach((setting: any) => {
          settingsMap.set(setting.room_id, setting);
        });
      }

      clearTimeout(timeoutId);

      console.log('[DashboardScreen] Query response received', {
        roomsCount: roomsData.length,
        settingsCount: settingsData?.length || 0,
      });
      
      // Transform the data to match the Room interface
      const transformedRooms = roomsData.map((room: any) => {
        const settings = settingsMap.get(room.id);
        return {
          id: room.id,
          name: settings?.name || 'Unnamed Room',
          description: settings?.description || null,
          type: (settings?.is_private ? 'private' : 'public') as 'public' | 'private',
          created_by: userId,
          created_at: settings?.created_at || room.updated_at || new Date().toISOString(),
          short_code: room.short_code || null,
        };
      });
      
      console.log('[DashboardScreen] Setting rooms:', transformedRooms.length);
      setRooms(transformedRooms);
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('[DashboardScreen] Error loading rooms:', error);
      console.error('[DashboardScreen] Error stack:', error?.stack);
      console.error('[DashboardScreen] Error message:', error?.message);
      Alert.alert('Error', `Failed to load rooms: ${error?.message || 'Unknown error'}`);
    } finally {
      clearTimeout(timeoutId);
      console.log('[DashboardScreen] Loading complete, setting loading to false');
      isLoadingRef.current = false;
      setLoading(false);
    }
  }, [user?.id, supabase]);

  useEffect(() => {
    const userId = user?.id;
    console.log('[DashboardScreen] useEffect triggered', {
      userId,
      hasUser: !!user,
      isLoading: isLoadingRef.current,
      lastUserId: lastUserIdRef.current,
    });

    // Only load rooms if user is available and different from last load
    if (userId && userId !== lastUserIdRef.current) {
      loadUserRooms();
    } else if (!userId) {
      // If no user, stop loading immediately
      console.log('[DashboardScreen] No user, stopping loading');
      setLoading(false);
    } else {
      console.log('[DashboardScreen] User ID unchanged, skipping load');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Only depend on user?.id, not loadUserRooms to prevent loops

  const createRoom = async () => {
    if (!roomName.trim()) {
      Alert.alert('Error', 'Please enter a room name');
      return;
    }

    try {
      const roomId = generateRoomId();
      const shortCode = await generateShortCode();
      
      // First, create the room entry
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert({
          id: roomId,
          host_user_id: user?.id || '',
          short_code: shortCode,
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Then, create the room_settings entry
      const { data: settingsData, error: settingsError } = await supabase
        .from('room_settings')
        .insert({
          room_id: roomId,
          name: roomName.trim(),
          description: roomDescription.trim() || null,
          is_private: roomType === 'private',
        })
        .select()
        .single();

      if (settingsError) {
        // If settings creation fails, try to clean up the room
        await supabase.from('rooms').delete().eq('id', roomId);
        throw settingsError;
      }

      setCreateDialogVisible(false);
      setRoomName('');
      setRoomDescription('');
      setRoomType('public');

      // Show share dialog with the newly created room
      const newRoom: Room = {
        id: roomId,
        name: roomName.trim(),
        description: roomDescription.trim() || undefined,
        type: roomType,
        created_by: user?.id || '',
        created_at: new Date().toISOString(),
        short_code: shortCode,
      };
      setSharingRoom(newRoom);
      setShowShareDialog(true);

      loadUserRooms();
    } catch (error) {
      console.error('Error creating room:', error);
      Alert.alert('Error', 'Failed to create room');
    }
  };

  const joinRoom = async (roomId: string, roomName?: string) => {
    // For now, just navigate to room screen
    // In a real app, you'd check if room exists and handle permissions
    navigation.navigate('Room', { roomId, roomName: roomName || 'Music Room' });
  };

  const joinRoomById = async () => {
    if (!joinRoomId.trim()) {
      Alert.alert('Error', 'Please enter a room code, ID or URL');
      return;
    }

    let searchValue = joinRoomId.trim().toUpperCase();

    // Extract room ID from URL if it's a full URL
    if (searchValue.includes('/ROOM/')) {
      searchValue = searchValue.split('/ROOM/')[1];
    }

    try {
      // First try to find by short_code (if it's 5 characters and uppercase)
      let data = null;
      let error = null;

      if (searchValue.length === 5 && /^[A-Z0-9]+$/.test(searchValue)) {
        // Likely a short code - join with room_settings to get name
        const result = await supabase
          .from('rooms')
          .select(`
            *,
            room_settings (
              name,
              description,
              is_private
            )
          `)
          .eq('short_code', searchValue)
          .single();
        data = result.data;
        error = result.error;
      }

      // If not found by short_code, try by room ID
      if (error || !data) {
        const result = await supabase
          .from('rooms')
          .select(`
            *,
            room_settings (
              name,
              description,
              is_private
            )
          `)
          .eq('id', searchValue)
          .single();
        data = result.data;
        error = result.error;
      }

      if (error || !data) {
        Alert.alert('Error', 'Room not found. Please check the code and try again.');
        return;
      }

      setJoinDialogVisible(false);
      setJoinRoomId('');
      const roomName = (data as any).room_settings?.name || 'Music Room';
      joinRoom(data.id, roomName);
    } catch (error) {
      console.error('Error joining room:', error);
      Alert.alert('Error', 'Failed to join room');
    }
  };

  const generateRoomId = () => {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  };

  // Generate unique short code (5 characters, uppercase alphanumeric)
  // Excludes confusing characters: 0, O, 1, I
  const generateShortCode = async (): Promise<string> => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      let code = '';
      for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      // Check if code already exists
      const { data, error } = await supabase
        .from('rooms')
        .select('short_code')
        .eq('short_code', code)
        .single();
      
      if (error && error.code === 'PGRST116') {
        // No rows found, code is unique
        return code;
      }
      
      attempts++;
    }
    
    // Fallback: add timestamp to ensure uniqueness
    const timestamp = Date.now().toString(36).substr(-2).toUpperCase();
    return chars.charAt(Math.floor(Math.random() * chars.length)) + 
           chars.charAt(Math.floor(Math.random() * chars.length)) + 
           chars.charAt(Math.floor(Math.random() * chars.length)) + 
           timestamp;
  };


  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const handleSignOut = async () => {
    await signOut();
  };

  // Show skeleton only on initial load when we don't have user yet
  if (loading && !user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <DashboardSkeleton />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header with user info */}
      <View style={[
        styles.header, 
        { 
          backgroundColor: theme.colors.surface,
          paddingTop: Platform.OS === 'web' ? 20 : Math.max(insets.top + 10, 20),
        }
      ]}>
        <View style={styles.userInfo}>
          <View style={[styles.avatarContainer, { backgroundColor: '#667eea' }]}>
            {profile?.avatar_url || user?.user_metadata?.avatar_url ? (
              <Avatar.Image
                size={56}
                source={{
                  uri: profile?.avatar_url || user?.user_metadata?.avatar_url || ''
                }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarInitials}>
                <Text style={styles.avatarInitialsText}>
                  {profile?.display_name
                    ? profile.display_name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .substring(0, 2)
                    : profile?.username
                    ? profile.username.substring(0, 2).toUpperCase()
                    : user?.email
                    ? user.email.substring(0, 2).toUpperCase()
                    : 'U'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.userDetails}>
            <Text style={[styles.userEmail, { color: theme.colors.onSurface }]}>
              {user?.email}
            </Text>
            <Text style={[styles.userGreeting, { color: theme.colors.onSurfaceVariant }]}>
              Welcome back!
            </Text>
            {profile && permissions && (
              <View style={styles.userBadgesContainer}>
                <View style={styles.userBadges}>
                  <View
                    style={[
                      styles.badgePill,
                      {
                        backgroundColor: profile.role === 'admin' 
                          ? '#f44336' 
                          : profile.role === 'moderator'
                          ? '#ff9800'
                          : '#2196f3',
                      },
                    ]}
                  >
                    <Text style={styles.badgeText}>
                      {profile.role === 'admin'
                        ? 'Admin'
                        : profile.role === 'moderator'
                        ? 'Moderator'
                        : 'User'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.badgePill,
                      {
                        backgroundColor:
                          profile.subscription_tier === 'pro'
                            ? '#667eea'
                            : profile.subscription_tier === 'standard'
                            ? '#4caf50'
                            : '#9e9e9e',
                      },
                    ]}
                  >
                    <Text style={styles.badgeText}>
                      {profile.subscription_tier === 'pro'
                        ? 'Pro'
                        : profile.subscription_tier === 'standard'
                        ? 'Standard'
                        : 'Free'}
                    </Text>
                  </View>
                </View>
                {permissions.max_songs !== Infinity && (
                  <Text style={[styles.songCount, { color: theme.colors.onSurfaceVariant }]}>
                    {permissions.songs_played}/{permissions.max_songs} songs played
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: IS_MOBILE ? Math.max(insets.bottom, 20) : 40 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[
          styles.actionsSection,
          IS_SMALL_MOBILE && styles.actionsSectionMobile
        ]}>
          <Button
            mode="contained"
            onPress={() => setCreateDialogVisible(true)}
            style={[
              styles.primaryActionButton,
              IS_SMALL_MOBILE && styles.fullWidthButton
            ]}
            contentStyle={styles.primaryActionContent}
            icon="plus"
          >
            Create Room
          </Button>
          <Button
            mode="outlined"
            onPress={() => setJoinDialogVisible(true)}
            style={[
              styles.secondaryActionButton,
              IS_SMALL_MOBILE && styles.fullWidthButton
            ]}
            contentStyle={styles.secondaryActionContent}
            icon="account-plus"
          >
            Join Room
          </Button>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>My Rooms</Text>
          {!loading && rooms.length > 0 && (
            <Text style={[styles.roomCount, { color: theme.colors.onSurfaceVariant }]}>
              {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}
            </Text>
          )}
        </View>
        
        {loading ? (
          <Card style={[styles.emptyCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content style={styles.emptyCardContent}>
              <ActivityIndicator 
                size="large" 
                color={theme.colors.primary} 
                style={styles.emptyIcon}
              />
              <Text style={[styles.emptyText, { color: theme.colors.onSurface }]}>
                Loading rooms...
              </Text>
            </Card.Content>
          </Card>
        ) : rooms.length === 0 ? (
          <Card style={[styles.emptyCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content style={styles.emptyCardContent}>
              <MaterialCommunityIcons 
                name="music-note-off" 
                size={64} 
                color={theme.colors.onSurfaceVariant} 
                style={styles.emptyIcon}
              />
              <Text style={[styles.emptyText, { color: theme.colors.onSurface }]}>
                No rooms yet
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.colors.onSurfaceVariant }]}>
                Create your first room to start sharing music with friends!
              </Text>
            </Card.Content>
          </Card>
        ) : (
          rooms.map((room) => (
            <TouchableOpacity
              key={room.id}
              activeOpacity={0.7}
              onPress={() => joinRoom(room.id, room.name)}
            >
              <Card 
                style={[styles.roomCard, { backgroundColor: theme.colors.surface }]}
                elevation={3}
              >
                <Card.Content style={styles.roomCardContent}>
                  <View style={styles.roomHeader}>
                    <View style={[styles.roomIconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
                      <MaterialCommunityIcons 
                        name={room.type === 'private' ? 'lock' : 'earth'} 
                        size={24} 
                        color={theme.colors.onPrimaryContainer} 
                      />
                    </View>
                    <View style={styles.roomInfo}>
                      <View style={styles.roomTitleRow}>
                        <Title style={[styles.roomTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
                          {room.name}
                        </Title>
                        <View style={[
                          styles.roomTypeBadge, 
                          { 
                            backgroundColor: room.type === 'private' 
                              ? theme.colors.errorContainer 
                              : theme.colors.primaryContainer 
                          }
                        ]}>
                          <Text style={[
                            styles.roomType, 
                            { 
                              color: room.type === 'private' 
                                ? theme.colors.onErrorContainer 
                                : theme.colors.onPrimaryContainer 
                            }
                          ]}>
                            {room.type === 'private' ? 'Private' : 'Public'}
                          </Text>
                        </View>
                      </View>
                      {room.description && (
                        <Paragraph 
                          style={[styles.roomDescription, { color: theme.colors.onSurfaceVariant }]} 
                          numberOfLines={2}
                        >
                          {room.description}
                        </Paragraph>
                      )}
                      <View style={styles.roomMeta}>
                        <View style={styles.roomMetaItem}>
                          <MaterialCommunityIcons 
                            name="calendar" 
                            size={14} 
                            color={theme.colors.onSurfaceVariant} 
                          />
                          <Text style={[styles.roomDate, { color: theme.colors.onSurfaceVariant }]}>
                            {formatDate(room.created_at)}
                          </Text>
                        </View>
                        {room.short_code && (
                          <View style={styles.roomMetaItem}>
                            <MaterialCommunityIcons 
                              name="tag" 
                              size={14} 
                              color={theme.colors.onSurfaceVariant} 
                            />
                            <Text style={[styles.roomCode, { color: theme.colors.primary }]}>
                              {room.short_code}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  <View style={styles.roomActions}>
                    <Button
                      mode="contained"
                      onPress={() => joinRoom(room.id, room.name)}
                      style={styles.joinButton}
                      contentStyle={styles.joinButtonContent}
                      icon="play"
                      buttonColor="#10B981"
                      textColor="#FFFFFF"
                    >
                      Join Room
                    </Button>
                    <Button
                      mode="text"
                      onPress={(e) => {
                        e.stopPropagation();
                        setSharingRoom(room);
                        setShowShareDialog(true);
                      }}
                      style={styles.shareButton}
                      contentStyle={styles.shareButtonContent}
                      icon="share-variant"
                      textColor={theme.colors.secondary}
                    >
                      Share
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>


      {/* Create Room Dialog */}
      <Portal>
        <Dialog 
          visible={createDialogVisible} 
          onDismiss={() => setCreateDialogVisible(false)}
          style={{ borderRadius: 20 }}
        >
          <Dialog.Title>Create New Room</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Room Name"
              value={roomName}
              onChangeText={setRoomName}
              mode="outlined"
              style={styles.dialogInput}
              autoFocus
            />
            <TextInput
              label="Description (optional)"
              value={roomDescription}
              onChangeText={setRoomDescription}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.dialogInput}
            />
            <Text style={[styles.radioLabel, { color: theme.colors.onSurface }]}>Room Type:</Text>
            <RadioButton.Group 
              onValueChange={value => setRoomType(value as 'public' | 'private')} 
              value={roomType}
            >
              <View style={styles.radioOption}>
                <RadioButton value="public" />
                <Text style={{ color: theme.colors.onSurface }}>Public - Anyone with the link can join</Text>
              </View>
              <View style={styles.radioOption}>
                <RadioButton value="private" />
                <Text style={{ color: theme.colors.onSurface }}>Private - Only invited users can join</Text>
              </View>
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => {
              setCreateDialogVisible(false);
              setRoomName('');
              setRoomDescription('');
              setRoomType('public');
            }}>
              Cancel
            </Button>
            <Button onPress={createRoom} mode="contained">Create</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Join Room Dialog */}
      <Portal>
        <Dialog 
          visible={joinDialogVisible} 
          onDismiss={() => {
            setJoinDialogVisible(false);
            setJoinRoomId('');
          }}
          style={{ borderRadius: 20 }}
        >
          <Dialog.Title>Join Room</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Room Code, ID or URL"
              value={joinRoomId}
              onChangeText={setJoinRoomId}
              mode="outlined"
              placeholder="Enter 5-character code or room ID/URL"
              autoCapitalize="characters"
              style={styles.dialogInput}
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => {
              setJoinDialogVisible(false);
              setJoinRoomId('');
            }}>
              Cancel
            </Button>
            <Button onPress={joinRoomById} mode="contained">Join</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {sharingRoom && (
        <ShareRoomDialog
          visible={showShareDialog}
          onDismiss={() => {
            setShowShareDialog(false);
            setSharingRoom(null);
          }}
          roomName={sharingRoom.name}
          roomId={sharingRoom.id}
          shortCode={sharingRoom.short_code}
          onCopyUrl={() => {
            Alert.alert('Success', 'Room URL copied to clipboard!');
          }}
          onCopyCode={() => {
            Alert.alert('Success', 'Join code copied to clipboard!');
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: IS_MOBILE ? 16 : 20,
    paddingBottom: IS_MOBILE ? 16 : 20,
    elevation: 6,
    // Web-compatible shadow
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.2)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    }),
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatar: {
    backgroundColor: 'transparent',
  },
  avatarInitials: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialsText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  userDetails: {
    marginLeft: IS_MOBILE ? 12 : 16,
    flex: 1,
  },
  userEmail: {
    fontSize: IS_MOBILE ? 15 : 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userGreeting: {
    fontSize: IS_MOBILE ? 13 : 14,
    marginBottom: 8,
  },
  userBadgesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  userBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  songCount: {
    fontSize: 12,
    marginLeft: 4,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: IS_MOBILE ? 16 : 20,
  },
  actionsSection: {
    flexDirection: 'row',
    gap: IS_MOBILE ? 10 : 12,
    marginBottom: IS_MOBILE ? 24 : 32,
  },
  actionsSectionMobile: {
    flexDirection: 'column',
  },
  fullWidthButton: {
    width: '100%',
  },
  primaryActionButton: {
    flex: 1,
    borderRadius: 12,
    elevation: 2,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    } : {}),
  },
  primaryActionContent: {
    paddingVertical: IS_MOBILE ? 10 : 8,
    minHeight: 44, // iOS/Android minimum touch target
  },
  secondaryActionButton: {
    flex: IS_SMALL_MOBILE ? 0 : 1,
    borderRadius: 12,
  },
  secondaryActionContent: {
    paddingVertical: IS_MOBILE ? 10 : 8,
    minHeight: 44, // iOS/Android minimum touch target
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: IS_MOBILE ? 20 : 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  roomCount: {
    fontSize: IS_MOBILE ? 13 : 14,
    fontWeight: '500',
  },
  emptyCard: {
    borderRadius: 16,
    elevation: 2,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.15)',
    } : {}),
  },
  emptyCardContent: {
    padding: IS_MOBILE ? 32 : 48,
    alignItems: 'center',
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: IS_MOBILE ? 18 : 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: IS_MOBILE ? 13 : 14,
    textAlign: 'center',
    lineHeight: IS_MOBILE ? 18 : 20,
  },
  roomCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
      transition: 'transform 0.2s, box-shadow 0.2s',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
    }),
  },
  roomCardContent: {
    padding: IS_MOBILE ? 16 : 20,
  },
  roomHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  roomIconContainer: {
    width: IS_MOBILE ? 44 : 48,
    height: IS_MOBILE ? 44 : 48,
    borderRadius: IS_MOBILE ? 10 : 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: IS_MOBILE ? 10 : 12,
  },
  roomTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  roomInfo: {
    flex: 1,
  },
  roomMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 16,
  },
  roomMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  roomCode: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  roomTitle: {
    fontSize: IS_MOBILE ? 16 : 18,
    fontWeight: '600',
    flex: 1,
  },
  roomDescription: {
    fontSize: IS_MOBILE ? 13 : 14,
    lineHeight: IS_MOBILE ? 18 : 20,
    marginTop: 4,
  },
  roomTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roomType: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  roomDate: {
    fontSize: 12,
  },
  roomActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  joinButton: {
    flex: 2,
    borderRadius: 12,
    elevation: 3,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.15)',
    } : {}),
  },
  joinButtonContent: {
    paddingVertical: IS_MOBILE ? 10 : 8,
    paddingHorizontal: IS_MOBILE ? 14 : 16,
    minHeight: 44, // iOS/Android minimum touch target
  },
  shareButton: {
    flex: 1,
    borderRadius: 12,
    minWidth: IS_MOBILE ? 70 : 80,
  },
  shareButtonContent: {
    paddingVertical: IS_MOBILE ? 10 : 8,
    paddingHorizontal: IS_MOBILE ? 10 : 12,
    minHeight: 44, // iOS/Android minimum touch target
  },
  roomButtonContent: {
    paddingVertical: 6,
  },
  dialogInput: {
    marginBottom: 16,
  },
  radioLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 12,
    marginTop: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
});

export default DashboardScreen;



