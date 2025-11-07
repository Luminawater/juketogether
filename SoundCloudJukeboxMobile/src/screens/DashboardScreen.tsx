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
} from 'react-native';
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

type DashboardScreenNavigationProp = NavigationProp<RootStackParamList, 'Dashboard'>;

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const { user, session, profile, permissions, signOut, supabase } = useAuth();
  const theme = useTheme();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogVisible, setCreateDialogVisible] = useState(false);
  const [joinDialogVisible, setJoinDialogVisible] = useState(false);

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

    // Add timeout to prevent infinite hanging
    const timeoutId = setTimeout(() => {
      console.error('[DashboardScreen] Query timeout after 10 seconds');
      isLoadingRef.current = false;
      setLoading(false);
      Alert.alert('Timeout', 'Loading rooms took too long. Please try again.');
    }, 10000);

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
            throw new Error('Session restoration failed. Please sign in again.');
          }
          console.log('[DashboardScreen] Session manually restored, retrying query...');
        } else {
          throw new Error('No active session. Please sign in again.');
        }
      }
      
      // Query rooms by host_user_id and join with room_settings
      const queryPromise = supabase
        .from('rooms')
        .select(`
          *,
          room_settings (
            name,
            description,
            is_private,
            created_at
          )
        `)
        .eq('host_user_id', userId)
        .order('updated_at', { ascending: false });

      console.log('[DashboardScreen] Query created, awaiting response...');
      const { data, error } = await queryPromise;
      clearTimeout(timeoutId);

      console.log('[DashboardScreen] Query response received', {
        hasData: !!data,
        dataLength: data?.length,
        hasError: !!error,
      });

      if (error) {
        console.error('[DashboardScreen] Supabase error:', error);
        console.error('[DashboardScreen] Error details:', JSON.stringify(error, null, 2));
        throw error;
      }
      
      console.log('[DashboardScreen] Rooms fetched:', data?.length || 0);
      console.log('[DashboardScreen] Raw data:', data);
      
      // Transform the data to match the Room interface
      const transformedRooms = (data || []).map((room: any) => {
        console.log('[DashboardScreen] Transforming room:', room.id);
        return {
          id: room.id,
          name: room.room_settings?.name || 'Unnamed Room',
          description: room.room_settings?.description,
          type: (room.room_settings?.is_private ? 'private' : 'public') as 'public' | 'private',
          created_by: room.host_user_id || '',
          created_at: room.room_settings?.created_at || room.updated_at,
          short_code: room.short_code,
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

      const roomUrl = getRoomUrl(roomId, shortCode);
      const shareMessage = getRoomShareMessage(roomName, roomId, shortCode);

      Alert.alert(
        'Success',
        `Room created! Share code: ${shortCode}\nOr link: ${roomUrl}`,
        [
          { text: 'Copy Code', onPress: () => Share.share({ message: `Join my music room with code: ${shortCode}` }) },
          { text: 'Copy Link', onPress: () => Share.share({ message: shareMessage }) },
          { text: 'Join Room', onPress: () => joinRoom(roomId, roomName) },
          { text: 'OK' },
        ]
      );

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
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.userInfo}>
          <Avatar.Image
            size={50}
            source={{
              uri: user?.user_metadata?.avatar_url ||
                   `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.email || '')}&background=667eea&color=fff`
            }}
          />
          <View style={styles.userDetails}>
            <Text style={[styles.userEmail, { color: theme.colors.onSurface }]}>{user?.email}</Text>
            <Text style={[styles.userGreeting, { color: theme.colors.onSurfaceVariant }]}>Welcome back!</Text>
            {profile && permissions && (
              <View style={styles.userBadges}>
                <UserBadge
                  role={profile.role}
                  tier={profile.subscription_tier}
                  showLabel={false}
                  size="small"
                />
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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.actionsSection}>
          <Button
            mode="contained"
            onPress={() => setCreateDialogVisible(true)}
            style={styles.primaryActionButton}
            contentStyle={styles.primaryActionContent}
            icon="plus"
          >
            Create Room
          </Button>
          <Button
            mode="outlined"
            onPress={() => setJoinDialogVisible(true)}
            style={styles.secondaryActionButton}
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
                      contentStyle={styles.roomButtonContent}
                      icon="play"
                    >
                      Join Room
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={(e) => {
                        e.stopPropagation();
                        const roomUrl = getRoomUrl(room.id, room.short_code);
                        const shareMessage = getRoomShareMessage(room.name, room.id, room.short_code);
                        Share.share({ message: shareMessage, url: roomUrl });
                      }}
                      style={styles.shareButton}
                      contentStyle={styles.roomButtonContent}
                      icon="share-variant"
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
    padding: 20,
    paddingTop: 60,
    paddingBottom: 20,
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
  userDetails: {
    marginLeft: 16,
    flex: 1,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userGreeting: {
    fontSize: 14,
    marginBottom: 8,
  },
  userBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  songCount: {
    fontSize: 12,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  actionsSection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
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
    paddingVertical: 8,
  },
  secondaryActionButton: {
    flex: 1,
    borderRadius: 12,
  },
  secondaryActionContent: {
    paddingVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  roomCount: {
    fontSize: 14,
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
    padding: 48,
    alignItems: 'center',
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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
    padding: 20,
  },
  roomHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  roomIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  roomDescription: {
    fontSize: 14,
    lineHeight: 20,
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
    flex: 1,
    borderRadius: 12,
    elevation: 2,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    } : {}),
  },
  shareButton: {
    flex: 1,
    borderRadius: 12,
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



