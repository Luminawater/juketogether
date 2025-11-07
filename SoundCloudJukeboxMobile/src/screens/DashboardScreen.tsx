import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
  TouchableOpacity,
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
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { Room } from '../types';
import { UserBadge } from '../components/UserBadge';
import {
  getRemainingSongs,
  canPlaySong,
  getTierDisplayName,
  hasRole,
} from '../utils/permissions';

type DashboardScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Dashboard'>;

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const { user, profile, permissions, signOut, supabase } = useAuth();
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

  useEffect(() => {
    loadUserRooms();
  }, []);

  const loadUserRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('created_by', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error('Error loading rooms:', error);
      Alert.alert('Error', 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async () => {
    if (!roomName.trim()) {
      Alert.alert('Error', 'Please enter a room name');
      return;
    }

    try {
      const roomId = generateRoomId();
      const shortCode = await generateShortCode();
      const { data, error } = await supabase
        .from('rooms')
        .insert({
          id: roomId,
          name: roomName.trim(),
          description: roomDescription.trim() || null,
          type: roomType,
          created_by: user?.id,
          short_code: shortCode,
        })
        .select()
        .single();

      if (error) throw error;

      setCreateDialogVisible(false);
      setRoomName('');
      setRoomDescription('');
      setRoomType('public');

      Alert.alert(
        'Success',
        `Room created! Share code: ${shortCode}\nOr link: ${getRoomUrl(roomId)}`,
        [
          { text: 'Copy Code', onPress: () => Share.share({ message: `Join my music room with code: ${shortCode}` }) },
          { text: 'Copy Link', onPress: () => Share.share({ message: getRoomUrl(roomId) }) },
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
        // Likely a short code
        const result = await supabase
          .from('rooms')
          .select('*')
          .eq('short_code', searchValue)
          .single();
        data = result.data;
        error = result.error;
      }

      // If not found by short_code, try by room ID
      if (error || !data) {
        const result = await supabase
          .from('rooms')
          .select('*')
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
      joinRoom(data.id, data.name);
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

  const getRoomUrl = (roomId: string) => {
    // In a real app, this would be your actual domain
    return `https://yourapp.com/room/${roomId}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.onBackground }}>Loading...</Text>
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

        <Text style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>My Rooms</Text>
        {rooms.length === 0 ? (
          <Card style={[styles.emptyCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content style={styles.emptyCardContent}>
              <Text style={[styles.emptyText, { color: theme.colors.onSurface }]}>
                You haven't created any rooms yet.
              </Text>
              <Text style={[styles.emptySubtext, { color: theme.colors.onSurfaceVariant }]}>
                Create your first room to get started!
              </Text>
            </Card.Content>
          </Card>
        ) : (
          rooms.map((room) => (
            <Card 
              key={room.id} 
              style={[styles.roomCard, { backgroundColor: theme.colors.surface }]}
              elevation={2}
            >
              <Card.Content style={styles.roomCardContent}>
                <View style={styles.roomHeader}>
                  <View style={styles.roomInfo}>
                    <Title style={[styles.roomTitle, { color: theme.colors.onSurface }]}>
                      {room.name}
                    </Title>
                    {room.description && (
                      <Paragraph style={[styles.roomDescription, { color: theme.colors.onSurfaceVariant }]}>
                        {room.description}
                      </Paragraph>
                    )}
                  </View>
                  <View style={styles.roomMeta}>
                    <View style={[styles.roomTypeBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                      <Text style={[styles.roomType, { color: theme.colors.onPrimaryContainer }]}>
                        {room.type}
                      </Text>
                    </View>
                    <Text style={[styles.roomDate, { color: theme.colors.onSurfaceVariant }]}>
                      {formatDate(room.created_at)}
                    </Text>
                  </View>
                </View>
                <View style={styles.roomActions}>
                  <Button
                    mode="contained"
                    onPress={() => joinRoom(room.id, room.name)}
                    style={styles.joinButton}
                    contentStyle={styles.roomButtonContent}
                  >
                    Join
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() => Share.share({ message: getRoomUrl(room.id) })}
                    style={styles.shareButton}
                    contentStyle={styles.roomButtonContent}
                    icon="share-variant"
                  >
                    Share
                  </Button>
                </View>
              </Card.Content>
            </Card>
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
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    elevation: 0,
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
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  emptyCard: {
    borderRadius: 16,
    elevation: 2,
  },
  emptyCardContent: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  roomCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  roomCardContent: {
    padding: 20,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 16,
  },
  roomInfo: {
    flex: 1,
  },
  roomTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  roomDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  roomMeta: {
    alignItems: 'flex-end',
    gap: 8,
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
    elevation: 0,
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



