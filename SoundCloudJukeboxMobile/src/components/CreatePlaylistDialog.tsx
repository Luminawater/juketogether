import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform, TouchableOpacity, Alert } from 'react-native';
import {
  Dialog,
  Button,
  Text,
  TextInput,
  useTheme,
  ActivityIndicator,
  Chip,
  Avatar,
  IconButton,
  Divider,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Track } from '../types';
import { SupabaseClient } from '@supabase/supabase-js';

interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  status: 'pending' | 'accepted' | 'blocked';
}

interface CreatePlaylistDialogProps {
  visible: boolean;
  onDismiss: () => void;
  onCreate: (playlistData: {
    name: string;
    description: string;
    tracks: Track[];
    invitedFriendIds: string[];
  }) => Promise<void>;
  queue: Track[];
  history: Track[];
  userId: string | undefined;
  supabase: SupabaseClient;
}

export const CreatePlaylistDialog: React.FC<CreatePlaylistDialogProps> = ({
  visible,
  onDismiss,
  onCreate,
  queue,
  history,
  userId,
  supabase,
}) => {
  const theme = useTheme();
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');
  const [selectedTracks, setSelectedTracks] = useState<Track[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [creating, setCreating] = useState(false);

  // Initialize tracks when dialog opens
  useEffect(() => {
    if (visible) {
      // Combine queue and history, removing duplicates by track ID
      const allTracks = [...history, ...queue];
      const uniqueTracks = allTracks.filter((track, index, self) =>
        index === self.findIndex((t) => t.id === track.id)
      );
      setSelectedTracks(uniqueTracks);
      setPlaylistName('');
      setPlaylistDescription('');
      setSelectedFriendIds(new Set());
    }
  }, [visible, queue, history]);

  // Load friends when dialog opens
  useEffect(() => {
    if (visible && userId) {
      loadFriends();
    }
  }, [visible, userId]);

  const loadFriends = async () => {
    if (!userId) return;
    
    setLoadingFriends(true);
    try {
      // Get accepted friends
      const { data: friendships, error } = await supabase
        .from('friends')
        .select('id, user_id, friend_id, status')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted');

      if (error) throw error;

      if (!friendships || friendships.length === 0) {
        setFriends([]);
        return;
      }

      // Get all friend IDs
      const friendIds = friendships.map((f: any) => 
        f.user_id === userId ? f.friend_id : f.user_id
      );

      // Fetch profiles for all friends
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', friendIds);

      if (profilesError) throw profilesError;

      // Create a map of profiles by ID
      const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      // Transform the data to get friend profiles
      const friendsList: Friend[] = friendships.map((item: any) => {
        const friendId = item.user_id === userId ? item.friend_id : item.user_id;
        const friendProfile = profilesMap.get(friendId);
        
        return {
          id: item.id,
          user_id: item.user_id,
          friend_id: item.friend_id,
          username: friendProfile?.username,
          display_name: friendProfile?.display_name,
          avatar_url: friendProfile?.avatar_url,
          status: item.status,
        };
      });

      setFriends(friendsList);
    } catch (error: any) {
      console.error('Error loading friends:', error);
      Alert.alert('Error', 'Failed to load friends');
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleRemoveTrack = (trackId: string) => {
    setSelectedTracks(prev => prev.filter(track => track.id !== trackId));
  };

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriendIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(friendId)) {
        newSet.delete(friendId);
      } else {
        newSet.add(friendId);
      }
      return newSet;
    });
  };

  const handleCreate = async () => {
    const name = playlistName.trim();
    if (!name) {
      Alert.alert('Error', 'Playlist name cannot be empty');
      return;
    }

    if (selectedTracks.length === 0) {
      Alert.alert('Error', 'Please select at least one track for the playlist');
      return;
    }

    setCreating(true);
    try {
      await onCreate({
        name,
        description: playlistDescription.trim(),
        tracks: selectedTracks,
        invitedFriendIds: Array.from(selectedFriendIds),
      });
      // Reset form
      setPlaylistName('');
      setPlaylistDescription('');
      setSelectedTracks([]);
      setSelectedFriendIds(new Set());
    } catch (error: any) {
      console.error('Error creating playlist:', error);
      Alert.alert('Error', error.message || 'Failed to create playlist');
    } finally {
      setCreating(false);
    }
  };

  const getPlatformIcon = (track: Track) => {
    const url = track.url?.toLowerCase() || '';
    if (url.includes('youtube') || url.includes('youtu.be')) {
      return 'youtube';
    } else if (url.includes('spotify')) {
      return 'spotify';
    } else if (url.includes('soundcloud')) {
      return 'soundcloud';
    }
    return 'music-note';
  };

  const getThumbnailUrl = (thumbnail: string | null | undefined) => {
    if (thumbnail) return thumbnail;
    return `https://ui-avatars.com/api/?name=Track&background=667eea&color=fff`;
  };

  return (
    <Dialog
      visible={visible}
      onDismiss={onDismiss}
      style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
    >
      <Dialog.Title style={{ color: theme.colors.onSurface }}>
        <View style={styles.titleContainer}>
          <MaterialCommunityIcons
            name="playlist-music"
            size={24}
            color={theme.colors.primary}
            style={styles.titleIcon}
          />
          <Text style={{ color: theme.colors.onSurface }}>Create Playlist</Text>
        </View>
      </Dialog.Title>
      <Dialog.Content>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Playlist Name */}
          <TextInput
            label="Playlist Name *"
            value={playlistName}
            onChangeText={setPlaylistName}
            mode="outlined"
            style={styles.input}
            maxLength={100}
          />

          {/* Playlist Description */}
          <TextInput
            label="Description"
            value={playlistDescription}
            onChangeText={setPlaylistDescription}
            mode="outlined"
            style={styles.input}
            multiline
            numberOfLines={3}
            maxLength={500}
          />

          {/* Invite Friends Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Invite Friends
            </Text>
            {loadingFriends ? (
              <ActivityIndicator size="small" style={styles.loader} />
            ) : friends.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                No friends to invite
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.friendsList}
              >
                {friends.map((friend) => {
                  const friendId = friend.user_id === userId ? friend.friend_id : friend.user_id;
                  const isSelected = selectedFriendIds.has(friendId);
                  
                  return (
                    <TouchableOpacity
                      key={friend.id}
                      onPress={() => toggleFriendSelection(friendId)}
                      style={[
                        styles.friendItem,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.primaryContainer
                            : theme.colors.surfaceVariant,
                          borderColor: isSelected ? theme.colors.primary : 'transparent',
                          borderWidth: isSelected ? 2 : 0,
                        },
                      ]}
                    >
                      <Avatar.Image
                        size={40}
                        source={{
                          uri: friend.avatar_url ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.username || friend.display_name || '')}&background=667eea&color=fff`,
                        }}
                      />
                      <Text
                        style={[
                          styles.friendName,
                          {
                            color: isSelected
                              ? theme.colors.onPrimaryContainer
                              : theme.colors.onSurfaceVariant,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {friend.display_name || friend.username || 'Friend'}
                      </Text>
                      {isSelected && (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={20}
                          color={theme.colors.primary}
                          style={styles.checkIcon}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          <Divider style={styles.divider} />

          {/* Tracks Preview Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Tracks ({selectedTracks.length})
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Remove tracks you don't want in the playlist
            </Text>
            {selectedTracks.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                No tracks selected
              </Text>
            ) : (
              <ScrollView style={styles.tracksList} nestedScrollEnabled>
                {selectedTracks.map((track) => (
                  <View
                    key={track.id}
                    style={[
                      styles.trackItem,
                      { backgroundColor: theme.colors.surfaceVariant },
                    ]}
                  >
                    <Avatar.Image
                      size={50}
                      source={{ uri: getThumbnailUrl(track.info?.thumbnail) }}
                    />
                    <View style={styles.trackInfo}>
                      <Text
                        style={[styles.trackTitle, { color: theme.colors.onSurface }]}
                        numberOfLines={1}
                      >
                        {track.info?.fullTitle || track.info?.title || 'Unknown Track'}
                      </Text>
                      <View style={styles.trackMeta}>
                        <MaterialCommunityIcons
                          name={getPlatformIcon(track)}
                          size={14}
                          color={theme.colors.onSurfaceVariant}
                        />
                        <Text
                          style={[styles.trackArtist, { color: theme.colors.onSurfaceVariant }]}
                          numberOfLines={1}
                        >
                          {track.info?.artist || 'Unknown Artist'}
                        </Text>
                      </View>
                    </View>
                    <IconButton
                      icon="close"
                      size={20}
                      iconColor={theme.colors.error}
                      onPress={() => handleRemoveTrack(track.id)}
                    />
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </ScrollView>
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss} disabled={creating}>
          Cancel
        </Button>
        <Button
          mode="contained"
          onPress={handleCreate}
          disabled={!playlistName.trim() || selectedTracks.length === 0 || creating}
          loading={creating}
          icon="playlist-plus"
        >
          Create Playlist
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
};

const styles = StyleSheet.create({
  dialog: {
    borderRadius: 16,
    ...(Platform.OS === 'web' ? { maxHeight: '85%' as any, maxWidth: 600 } : {}),
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleIcon: {
    marginRight: 8,
  },
  content: {
    maxHeight: Platform.OS === 'web' ? 500 : 400,
  },
  input: {
    marginBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  divider: {
    marginVertical: 16,
  },
  loader: {
    marginVertical: 16,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
    marginVertical: 16,
  },
  friendsList: {
    marginTop: 8,
  marginBottom: 8,
  maxHeight: 120,
  flexGrow: 0,
  flexShrink: 0,
  flexBasis: 'auto',
  flexDirection: 'row',
  flexWrap: 'nowrap',
  overflow: 'scroll',
  paddingVertical: 4,
  paddingHorizontal: 4,
  gap: 8,
  display: 'flex',
  alignItems: 'stretch',
  alignContent: 'flex-start',
  justifyContent: 'flex-start',
  flex: 0,
},
  friendItem: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    minWidth: 80,
    marginRight: 8,
    position: 'relative',
  },
  friendName: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 80,
  },
  checkIcon: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  tracksList: {
    maxHeight: 300,
    marginTop: 8,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  trackInfo: {
    flex: 1,
    marginLeft: 12,
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  trackMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trackArtist: {
    fontSize: 12,
  },
});

