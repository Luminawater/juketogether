import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Card,
  Title,
  Button,
  List,
  Avatar,
  IconButton,
  Portal,
  Dialog,
  TextInput,
  useTheme,
  ActivityIndicator,
  FAB,
  TabView,
  TabBar,
} from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getThumbnailUrl } from '../utils/imageUtils';

type PlaylistScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Playlist'>;
type PlaylistScreenRouteProp = RouteProp<RootStackParamList, 'Playlist'>;

interface Playlist {
  id: string;
  name: string;
  description?: string;
  created_from_room_id?: string;
  created_at: string;
  updated_at: string;
  track_count?: number;
}

interface PlaylistTrack {
  id: string;
  track_id: string;
  track_url: string;
  track_title?: string;
  track_artist?: string;
  track_thumbnail?: string;
  platform?: string;
  position: number;
}

const PlaylistScreen: React.FC = () => {
  const navigation = useNavigation<PlaylistScreenNavigationProp>();
  const route = useRoute<PlaylistScreenRouteProp>();
  const { supabase, profile } = useAuth();
  const theme = useTheme();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(null);
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [tabIndex, setTabIndex] = useState(0);

  // New playlist form state
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDescription, setNewPlaylistDescription] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  useEffect(() => {
    loadPlaylists();
    
    // If playlistId is provided in route params, open that playlist
    if (route.params?.playlistId) {
      // Load the specific playlist
      loadPlaylistDetails(route.params.playlistId);
    }
  }, [route.params?.playlistId]);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('playlists')
        .select(`
          *,
          playlist_tracks(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const playlistsWithCount = data.map((p: any) => ({
          ...p,
          track_count: p.playlist_tracks?.[0]?.count || 0,
        }));
        setPlaylists(playlistsWithCount);
      }
    } catch (error: any) {
      console.error('Error loading playlists:', error);
      Alert.alert('Error', 'Failed to load playlists');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadPlaylistDetails = async (playlistId: string) => {
    try {
      const { data: playlistData, error: playlistError } = await supabase
        .from('playlists')
        .select('*')
        .eq('id', playlistId)
        .single();

      if (playlistError) throw playlistError;

      if (playlistData) {
        setSelectedPlaylist(playlistData);
        setViewMode('detail');
        await loadPlaylistTracks(playlistId);
      }
    } catch (error: any) {
      console.error('Error loading playlist details:', error);
      Alert.alert('Error', 'Failed to load playlist');
    }
  };

  const loadPlaylistTracks = async (playlistId: string) => {
    try {
      const { data, error } = await supabase
        .from('playlist_tracks')
        .select('*')
        .eq('playlist_id', playlistId)
        .order('position', { ascending: true });

      if (error) throw error;

      if (data) {
        setTracks(data);
      }
    } catch (error: any) {
      console.error('Error loading playlist tracks:', error);
      Alert.alert('Error', 'Failed to load playlist tracks');
    }
  };

  const handleDeletePlaylist = async () => {
    if (!playlistToDelete) return;

    try {
      const { error } = await supabase
        .from('playlists')
        .delete()
        .eq('id', playlistToDelete.id);

      if (error) throw error;

      Alert.alert('Success', 'Playlist deleted successfully');
      setDeleteDialogVisible(false);
      setPlaylistToDelete(null);
      if (viewMode === 'detail' && selectedPlaylist?.id === playlistToDelete.id) {
        setViewMode('list');
        setSelectedPlaylist(null);
        setTracks([]);
      }
      await loadPlaylists();
    } catch (error: any) {
      console.error('Error deleting playlist:', error);
      Alert.alert('Error', 'Failed to delete playlist');
    }
  };

  const handleEditPlaylist = async () => {
    if (!selectedPlaylist) return;

    try {
      const { error } = await supabase
        .from('playlists')
        .update({
          name: editName,
          description: editDescription || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedPlaylist.id);

      if (error) throw error;

      Alert.alert('Success', 'Playlist updated successfully');
      setEditDialogVisible(false);
      await loadPlaylists();
      if (selectedPlaylist) {
        await loadPlaylistDetails(selectedPlaylist.id);
      }
    } catch (error: any) {
      console.error('Error updating playlist:', error);
      Alert.alert('Error', 'Failed to update playlist');
    }
  };

  const handleRemoveTrack = async (trackId: string) => {
    if (!selectedPlaylist) return;

    try {
      const { error } = await supabase
        .from('playlist_tracks')
        .delete()
        .eq('id', trackId);

      if (error) throw error;

      // Reorder remaining tracks
      const remainingTracks = tracks.filter(t => t.id !== trackId);
      for (let i = 0; i < remainingTracks.length; i++) {
        await supabase
          .from('playlist_tracks')
          .update({ position: i })
          .eq('id', remainingTracks[i].id);
      }

      await loadPlaylistTracks(selectedPlaylist.id);
      await loadPlaylists();
    } catch (error: any) {
      console.error('Error removing track:', error);
      Alert.alert('Error', 'Failed to remove track');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (viewMode === 'detail' && selectedPlaylist) {
      loadPlaylistDetails(selectedPlaylist.id);
    } else {
      loadPlaylists();
    }
  };

  const createNewPlaylist = async () => {
    const name = newPlaylistName.trim();
    if (!name) {
      Alert.alert('Error', 'Please enter a playlist name');
      return;
    }

    setCreatingPlaylist(true);
    try {
      const { data, error } = await supabase
        .from('playlists')
        .insert({
          name,
          description: newPlaylistDescription.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      Alert.alert('Success', 'Playlist created successfully!');

      // Reset form and switch to existing playlists tab
      setNewPlaylistName('');
      setNewPlaylistDescription('');
      setTabIndex(1);
      await loadPlaylists();
    } catch (error: any) {
      console.error('Error creating playlist:', error);
      Alert.alert('Error', 'Failed to create playlist');
    } finally {
      setCreatingPlaylist(false);
    }
  };

  // Tab routes
  const routes = [
    { key: 'new', title: 'New Playlist' },
    { key: 'existing', title: 'Existing Playlists' },
  ];

  // Render New Playlist tab
  const renderNewPlaylistTab = () => (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.newPlaylistContainer}>
          <Card style={[styles.newPlaylistCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <View style={styles.newPlaylistHeader}>
                <MaterialCommunityIcons
                  name="playlist-plus"
                  size={48}
                  color={theme.colors.primary}
                />
                <Title style={[styles.newPlaylistTitle, { color: theme.colors.onSurface }]}>
                  Create New Playlist
                </Title>
                <Text style={[styles.newPlaylistSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  Start with an empty playlist and add tracks later
                </Text>
              </View>

              <TextInput
                label="Playlist Name *"
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
                mode="outlined"
                style={styles.newPlaylistInput}
                maxLength={100}
              />

              <TextInput
                label="Description (optional)"
                value={newPlaylistDescription}
                onChangeText={setNewPlaylistDescription}
                mode="outlined"
                style={styles.newPlaylistInput}
                multiline
                numberOfLines={3}
                maxLength={500}
              />

              <Button
                mode="contained"
                onPress={createNewPlaylist}
                disabled={!newPlaylistName.trim() || creatingPlaylist}
                loading={creatingPlaylist}
                style={styles.createButton}
                icon="playlist-plus"
              >
                Create Playlist
              </Button>
            </Card.Content>
          </Card>
        </View>
      </ScrollView>
    </View>
  );

  // Render Existing Playlists tab
  const renderExistingPlaylistsTab = () => (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {viewMode === 'detail' && selectedPlaylist ? (
        // Playlist detail view
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Card style={[styles.headerCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <View style={styles.headerActions}>
                <IconButton
                  icon="arrow-left"
                  size={24}
                  onPress={() => {
                    setViewMode('list');
                    setSelectedPlaylist(null);
                    setTracks([]);
                  }}
                />
                <View style={styles.headerButtons}>
                  <IconButton
                    icon="pencil"
                    size={24}
                    onPress={() => {
                      setEditName(selectedPlaylist.name);
                      setEditDescription(selectedPlaylist.description || '');
                      setEditDialogVisible(true);
                    }}
                  />
                  <IconButton
                    icon="delete"
                    size={24}
                    iconColor={theme.colors.error}
                    onPress={() => {
                      setPlaylistToDelete(selectedPlaylist);
                      setDeleteDialogVisible(true);
                    }}
                  />
                </View>
              </View>
              <Title style={[styles.playlistTitle, { color: theme.colors.onSurface }]}>
                {selectedPlaylist.name}
              </Title>
              {selectedPlaylist.description && (
                <Text style={[styles.playlistDescription, { color: theme.colors.onSurfaceVariant }]}>
                  {selectedPlaylist.description}
                </Text>
              )}
              <Text style={[styles.trackCount, { color: theme.colors.onSurfaceVariant }]}>
                {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
              </Text>
            </Card.Content>
          </Card>

          {tracks.length === 0 ? (
            <Card style={[styles.emptyCard, { backgroundColor: theme.colors.surface }]}>
              <Card.Content style={styles.emptyContent}>
                <MaterialCommunityIcons name="music-off" size={64} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                  This playlist is empty
                </Text>
              </Card.Content>
            </Card>
          ) : (
            <View style={styles.tracksList}>
              {tracks.map((track, index) => (
                <Card
                  key={track.id}
                  style={[styles.trackCard, { backgroundColor: theme.colors.surface }]}
                >
                  <Card.Content>
                    <List.Item
                      title={track.track_title || 'Unknown Track'}
                      description={track.track_artist || track.platform || ''}
                      left={() => (
                        <Avatar.Image
                          size={56}
                          source={{ uri: getThumbnailUrl(track.track_thumbnail, 56) }}
                        />
                      )}
                      right={() => (
                        <IconButton
                          icon="delete-outline"
                          size={24}
                          iconColor={theme.colors.error}
                          onPress={() => handleRemoveTrack(track.id)}
                        />
                      )}
                    />
                  </Card.Content>
                </Card>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        // Playlist list view
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.header}>
            <Title style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
              My Playlists
            </Title>
            <Text style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              {playlists.length} {playlists.length === 1 ? 'playlist' : 'playlists'}
            </Text>
          </View>

          {playlists.length === 0 ? (
            <Card style={[styles.emptyCard, { backgroundColor: theme.colors.surface }]}>
              <Card.Content style={styles.emptyContent}>
                <MaterialCommunityIcons name="playlist-music" size={64} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                  No playlists yet
                </Text>
                <Text style={[styles.emptySubtext, { color: theme.colors.onSurfaceVariant }]}>
                  Switch to the "New Playlist" tab to create your first playlist
                </Text>
              </Card.Content>
            </Card>
          ) : (
            <View style={styles.playlistsList}>
              {playlists.map((playlist) => (
                <Card
                  key={playlist.id}
                  style={[styles.playlistCard, { backgroundColor: theme.colors.surface }]}
                  onPress={() => loadPlaylistDetails(playlist.id)}
                >
                  <Card.Content>
                    <List.Item
                      title={playlist.name}
                      description={playlist.description || `${playlist.track_count || 0} tracks`}
                      left={() => (
                        <Avatar.Icon
                          size={56}
                          icon="playlist-music"
                          style={{ backgroundColor: theme.colors.primaryContainer }}
                        />
                      )}
                      right={() => (
                        <IconButton
                          icon="chevron-right"
                          size={24}
                          onPress={() => loadPlaylistDetails(playlist.id)}
                        />
                      )}
                    />
                  </Card.Content>
                </Card>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Edit Dialog */}
      <Portal>
        <Dialog
          visible={editDialogVisible}
          onDismiss={() => setEditDialogVisible(false)}
        >
          <Dialog.Title>Edit Playlist</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Name"
              value={editName}
              onChangeText={setEditName}
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label="Description (optional)"
              value={editDescription}
              onChangeText={setEditDescription}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleEditPlaylist} mode="contained">Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Delete Confirmation Dialog */}
      <Portal>
        <Dialog
          visible={deleteDialogVisible}
          onDismiss={() => setDeleteDialogVisible(false)}
        >
          <Dialog.Title>Delete Playlist</Dialog.Title>
          <Dialog.Content>
            <Text>
              Are you sure you want to delete "{playlistToDelete?.name}"? This action cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleDeletePlaylist} mode="contained" buttonColor={theme.colors.error}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );

  // Render scene
  const renderScene = ({ route }: { route: { key: string } }) => {
    switch (route.key) {
      case 'new':
        return renderNewPlaylistTab();
      case 'existing':
        return renderExistingPlaylistsTab();
      default:
        return null;
    }
  };

  if (loading && playlists.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
            Loading playlists...
          </Text>
        </View>
      </View>
    );
  }

  if (viewMode === 'detail' && selectedPlaylist) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Card style={[styles.headerCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <View style={styles.headerActions}>
                <IconButton
                  icon="arrow-left"
                  size={24}
                  onPress={() => {
                    setViewMode('list');
                    setSelectedPlaylist(null);
                    setTracks([]);
                  }}
                />
                <View style={styles.headerButtons}>
                  <IconButton
                    icon="pencil"
                    size={24}
                    onPress={() => {
                      setEditName(selectedPlaylist.name);
                      setEditDescription(selectedPlaylist.description || '');
                      setEditDialogVisible(true);
                    }}
                  />
                  <IconButton
                    icon="delete"
                    size={24}
                    iconColor={theme.colors.error}
                    onPress={() => {
                      setPlaylistToDelete(selectedPlaylist);
                      setDeleteDialogVisible(true);
                    }}
                  />
                </View>
              </View>
              <Title style={[styles.playlistTitle, { color: theme.colors.onSurface }]}>
                {selectedPlaylist.name}
              </Title>
              {selectedPlaylist.description && (
                <Text style={[styles.playlistDescription, { color: theme.colors.onSurfaceVariant }]}>
                  {selectedPlaylist.description}
                </Text>
              )}
              <Text style={[styles.trackCount, { color: theme.colors.onSurfaceVariant }]}>
                {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
              </Text>
            </Card.Content>
          </Card>

          {tracks.length === 0 ? (
            <Card style={[styles.emptyCard, { backgroundColor: theme.colors.surface }]}>
              <Card.Content style={styles.emptyContent}>
                <MaterialCommunityIcons name="music-off" size={64} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                  This playlist is empty
                </Text>
              </Card.Content>
            </Card>
          ) : (
            <View style={styles.tracksList}>
              {tracks.map((track, index) => (
                <Card
                  key={track.id}
                  style={[styles.trackCard, { backgroundColor: theme.colors.surface }]}
                >
                  <Card.Content>
                    <List.Item
                      title={track.track_title || 'Unknown Track'}
                      description={track.track_artist || track.platform || ''}
                      left={() => (
                        <Avatar.Image
                          size={56}
                          source={{ uri: getThumbnailUrl(track.track_thumbnail, 56) }}
                        />
                      )}
                      right={() => (
                        <IconButton
                          icon="delete-outline"
                          size={24}
                          iconColor={theme.colors.error}
                          onPress={() => handleRemoveTrack(track.id)}
                        />
                      )}
                    />
                  </Card.Content>
                </Card>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Edit Dialog */}
        <Portal>
          <Dialog
            visible={editDialogVisible}
            onDismiss={() => setEditDialogVisible(false)}
          >
            <Dialog.Title>Edit Playlist</Dialog.Title>
            <Dialog.Content>
              <TextInput
                label="Name"
                value={editName}
                onChangeText={setEditName}
                mode="outlined"
                style={styles.dialogInput}
              />
              <TextInput
                label="Description (optional)"
                value={editDescription}
                onChangeText={setEditDescription}
                mode="outlined"
                multiline
                numberOfLines={3}
                style={styles.dialogInput}
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setEditDialogVisible(false)}>Cancel</Button>
              <Button onPress={handleEditPlaylist} mode="contained">Save</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </View>
    );
  }

  return (
    <TabView
      navigationState={{ index: tabIndex, routes }}
      renderScene={renderScene}
      onIndexChange={setTabIndex}
      renderTabBar={(props) => (
        <TabBar
          {...props}
          style={{ backgroundColor: theme.colors.surface }}
          indicatorStyle={{ backgroundColor: theme.colors.primary }}
          activeColor={theme.colors.primary}
          inactiveColor={theme.colors.onSurfaceVariant}
        />
      )}
    />
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingTop: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  playlistsList: {
    padding: 16,
    paddingTop: 0,
  },
  playlistCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  emptyCard: {
    margin: 16,
    borderRadius: 12,
  },
  emptyContent: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  headerCard: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  playlistTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  playlistDescription: {
    fontSize: 14,
    marginBottom: 8,
  },
  trackCount: {
    fontSize: 12,
  },
  tracksList: {
    padding: 16,
    paddingTop: 0,
  },
  trackCard: {
    marginBottom: 8,
    borderRadius: 12,
  },
  dialogInput: {
    marginBottom: 12,
  },
  newPlaylistContainer: {
    padding: 16,
  },
  newPlaylistCard: {
    borderRadius: 12,
  },
  newPlaylistHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  newPlaylistTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  newPlaylistSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  newPlaylistInput: {
    marginBottom: 16,
  },
  createButton: {
    marginTop: 16,
  },
});

export default PlaylistScreen;

