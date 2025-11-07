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
  Menu,
  IconButton,
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

  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogVisible, setCreateDialogVisible] = useState(false);
  const [joinDialogVisible, setJoinDialogVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

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
      const { error } = await supabase
        .from('rooms')
        .insert({
          id: roomId,
          name: roomName.trim(),
          description: roomDescription.trim() || null,
          type: roomType,
          created_by: user?.id,
        });

      if (error) throw error;

      setCreateDialogVisible(false);
      setRoomName('');
      setRoomDescription('');
      setRoomType('public');

      Alert.alert(
        'Success',
        `Room created! Share this link: ${getRoomUrl(roomId)}`,
        [
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
      Alert.alert('Error', 'Please enter a room ID or URL');
      return;
    }

    let roomId = joinRoomId.trim();

    // Extract room ID from URL if it's a full URL
    if (roomId.includes('/room/')) {
      roomId = roomId.split('/room/')[1];
    }

    try {
      // Check if room exists
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (error || !data) {
        Alert.alert('Error', 'Room not found');
        return;
      }

      setJoinDialogVisible(false);
      setJoinRoomId('');
      joinRoom(roomId, data.name);
    } catch (error) {
      console.error('Error joining room:', error);
      Alert.alert('Error', 'Failed to join room');
    }
  };

  const generateRoomId = () => {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
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
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with user info */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Avatar.Image
            size={50}
            source={{
              uri: user?.user_metadata?.avatar_url ||
                   `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.email || '')}&background=667eea&color=fff`
            }}
          />
          <View style={styles.userDetails}>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <Text style={styles.userGreeting}>Welcome back!</Text>
            {profile && permissions && (
              <View style={styles.userBadges}>
                <UserBadge
                  role={profile.role}
                  tier={profile.subscription_tier}
                  showLabel={false}
                  size="small"
                />
                {permissions.max_songs !== Infinity && (
                  <Text style={styles.songCount}>
                    {permissions.songs_played}/{permissions.max_songs} songs played
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <IconButton
              icon="menu"
              iconColor="#fff"
              onPress={() => setMenuVisible(true)}
            />
          }
        >
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              navigation.navigate('Dashboard');
            }}
            title="Dashboard"
            leadingIcon="home"
          />
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              navigation.navigate('Discovery');
            }}
            title="Discover Rooms"
            leadingIcon="compass"
          />
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              navigation.navigate('Leaderboard');
            }}
            title="Leaderboard"
            leadingIcon="trophy"
          />
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              navigation.navigate('Friends');
            }}
            title="Friends"
            leadingIcon="account-group"
          />
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              navigation.navigate('Profile');
            }}
            title="Edit Profile"
            leadingIcon="account-edit"
          />
          {profile && hasRole(profile.role, 'admin') && (
            <Menu.Item
              onPress={() => {
                setMenuVisible(false);
                navigation.navigate('Admin');
              }}
              title="Admin Panel"
              leadingIcon="shield-account"
            />
          )}
          <Menu.Item
            onPress={() => {
              setMenuVisible(false);
              handleSignOut();
            }}
            title="Sign Out"
            leadingIcon="logout"
          />
        </Menu>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Create New Room</Text>
        <Card style={styles.createCard}>
          <Card.Content>
            <TextInput
              label="Room Name"
              value={roomName}
              onChangeText={setRoomName}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Description (optional)"
              value={roomDescription}
              onChangeText={setRoomDescription}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
            />
            <Text style={styles.radioLabel}>Room Type:</Text>
            <RadioButton.Group onValueChange={value => setRoomType(value as 'public' | 'private')} value={roomType}>
              <View style={styles.radioOption}>
                <RadioButton value="public" />
                <Text>Public - Anyone with the link can join</Text>
              </View>
              <View style={styles.radioOption}>
                <RadioButton value="private" />
                <Text>Private - Only invited users can join</Text>
              </View>
            </RadioButton.Group>
            <Button
              mode="contained"
              onPress={createRoom}
              style={styles.createButton}
            >
              Create Room
            </Button>
          </Card.Content>
        </Card>

        <Text style={styles.sectionTitle}>My Rooms</Text>
        {rooms.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text style={styles.emptyText}>You haven't created any rooms yet.</Text>
              <Text style={styles.emptySubtext}>Create your first room above to get started!</Text>
            </Card.Content>
          </Card>
        ) : (
          rooms.map((room) => (
            <Card key={room.id} style={styles.roomCard}>
              <Card.Content>
                <View style={styles.roomHeader}>
                  <View style={styles.roomInfo}>
                    <Title style={styles.roomTitle}>{room.name}</Title>
                    {room.description && (
                      <Paragraph style={styles.roomDescription}>{room.description}</Paragraph>
                    )}
                  </View>
                  <View style={styles.roomMeta}>
                    <Text style={styles.roomType}>{room.type}</Text>
                    <Text style={styles.roomDate}>{formatDate(room.created_at)}</Text>
                  </View>
                </View>
                <View style={styles.roomActions}>
                  <Button
                    mode="contained"
                    onPress={() => joinRoom(room.id, room.name)}
                    style={styles.joinButton}
                  >
                    Join Room
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() => Share.share({ message: getRoomUrl(room.id) })}
                  >
                    Share
                  </Button>
                </View>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      {/* FAB for joining rooms */}
      <FAB
        icon="account-plus"
        style={styles.fab}
        onPress={() => setJoinDialogVisible(true)}
      />

      {/* Create Room Dialog */}
      <Portal>
        <Dialog visible={createDialogVisible} onDismiss={() => setCreateDialogVisible(false)}>
          <Dialog.Title>Quick Create Room</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Room Name"
              value={roomName}
              onChangeText={setRoomName}
              mode="outlined"
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCreateDialogVisible(false)}>Cancel</Button>
            <Button onPress={createRoom}>Create</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Join Room Dialog */}
      <Portal>
        <Dialog visible={joinDialogVisible} onDismiss={() => setJoinDialogVisible(false)}>
          <Dialog.Title>Join Room</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Room URL or ID"
              value={joinRoomId}
              onChangeText={setJoinRoomId}
              mode="outlined"
              placeholder="Paste room URL or enter room ID"
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setJoinDialogVisible(false)}>Cancel</Button>
            <Button onPress={joinRoomById}>Join</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#667eea',
    paddingTop: 50,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userDetails: {
    marginLeft: 12,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  userGreeting: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  userBadges: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  songCount: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    marginTop: 16,
  },
  createCard: {
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
  },
  radioLabel: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  createButton: {
    marginTop: 16,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    textAlign: 'center',
    color: '#666',
  },
  roomCard: {
    marginBottom: 12,
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  roomInfo: {
    flex: 1,
  },
  roomTitle: {
    fontSize: 18,
  },
  roomDescription: {
    fontSize: 14,
    color: '#666',
  },
  roomMeta: {
    alignItems: 'flex-end',
  },
  roomType: {
    fontSize: 12,
    backgroundColor: '#667eea',
    color: 'white',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    textTransform: 'uppercase',
  },
  roomDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  roomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  joinButton: {
    flex: 1,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#667eea',
  },
  dialogInput: {
    marginBottom: 0,
  },
});

export default DashboardScreen;



