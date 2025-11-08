import React from 'react';
import { ScrollView, View, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import {
  Card,
  Title,
  Text,
  Button,
  List,
  Avatar,
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import { SpotifyPlaylist, SpotifyTrack } from '../services/spotifyService';
import { isSpotifyUser } from '../services/spotifyService';
import { getThumbnailUrl } from '../utils/imageUtils';
import { roomScreenStyles } from '../screens/RoomScreen.styles';

// Import Spotify logo
const SpotifyLogo = require('../../assets/Spotify-logo.png');

interface RoomSpotifyTabProps {
  user: any;
  navigation: any;
  spotifyPlaylists: SpotifyPlaylist[];
  selectedPlaylist: SpotifyPlaylist | null;
  playlistTracks: SpotifyTrack[];
  loadingPlaylists: boolean;
  loadingTracks: boolean;
  spotifyError: string | null;
  onLoadPlaylists: () => void;
  onSelectPlaylist: (playlist: SpotifyPlaylist) => void;
  onQueueTrack: (track: SpotifyTrack) => void;
  onQueueAllTracks: () => void;
}

export const RoomSpotifyTab: React.FC<RoomSpotifyTabProps> = ({
  user,
  navigation,
  spotifyPlaylists,
  selectedPlaylist,
  playlistTracks,
  loadingPlaylists,
  loadingTracks,
  spotifyError,
  onLoadPlaylists,
  onSelectPlaylist,
  onQueueTrack,
  onQueueAllTracks,
}) => {
  const theme = useTheme();
  const styles = roomScreenStyles;
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
            <TouchableOpacity
              onPress={() => navigation.navigate('Auth')}
              style={[
                spotifyButtonStyles.spotifyButton,
                { backgroundColor: '#1DB954' },
                Platform.OS === 'web' ? {
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
                } : {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.12,
                  shadowRadius: 2,
                  elevation: 2,
                },
              ]}
              activeOpacity={0.8}
            >
              <View style={spotifyButtonStyles.oauthButtonContent}>
                <Image
                  source={SpotifyLogo}
                  style={spotifyButtonStyles.spotifyIcon}
                  resizeMode="contain"
                />
                <Text style={spotifyButtonStyles.spotifyButtonText}>Continue with Spotify</Text>
              </View>
            </TouchableOpacity>
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
                onPress={() => onSelectPlaylist(null as any)}
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
                onPress={() => onSelectPlaylist(selectedPlaylist)}
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
                  onPress={onQueueAllTracks}
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
                          onPress={() => onQueueTrack(track)}
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
              onPress={onLoadPlaylists}
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
              onPress={onLoadPlaylists}
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
                  onPress={() => onSelectPlaylist(playlist)}
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

// Spotify Button Styles (Official Design)
const spotifyButtonStyles = StyleSheet.create({
  spotifyButton: {
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    marginTop: 16,
  },
  oauthButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotifyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginLeft: 12,
  },
  spotifyIcon: {
    width: 20,
    height: 20,
  },
});

