import React, { useRef } from 'react';
import { View, ScrollView, TouchableOpacity, Alert, Dimensions } from 'react-native';
import {
  Card,
  Title,
  Text,
  Button,
  TextInput,
  List,
  Avatar,
  useTheme,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NowPlayingCard } from './NowPlayingCard';
import { UpgradePrompt } from './UpgradePrompt';
import { DJModeInterface } from './DJModeInterface';
import { YouTubePlayer } from './YouTubePlayer';
import { SoundCloudPlayer } from './SoundCloudPlayer';
import AdsBanner from './AdsBanner';
import { AnimatedQueueItem } from './RoomAnimatedQueueItem';
import { Track, SubscriptionTier } from '../types';
import { ReactionType } from '../services/trackReactionsService';
import { RoomSettings, ActiveBoost, TierSettings, BlockedInfo } from '../screens/RoomScreen.types';
import { roomScreenStyles } from '../screens/RoomScreen.styles';
import { socketService } from '../services/socketService';
import { getThumbnailUrl } from '../utils/imageUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_MOBILE = SCREEN_WIDTH < 768;

interface RoomMainTabProps {
  isDJModeActive: boolean;
  roomSettings: RoomSettings;
  profile: any;
  scrollViewRef: React.RefObject<ScrollView | null>;
  handleScroll: (event: any) => void;
  playbackBlocked: boolean;
  blockedInfo: BlockedInfo | null;
  currentTrack: Track | null;
  isPlaying: boolean;
  trackReactions: any;
  canControl: boolean;
  user: any;
  queue: Track[];
  history: Track[];
  position: number;
  duration: number;
  roomId: string;
  playPause: () => void;
  handlePrevious: () => void;
  nextTrack: () => void;
  handleReaction: (reaction: ReactionType) => void;
  loadingReaction: boolean;
  toggleAutoplay: () => void;
  showMediaPlayer: boolean;
  toggleShowMediaPlayer: () => void;
  isOwner: boolean;
  isAdmin: boolean;
  trackUrl: string;
  setTrackUrl: (url: string) => void;
  addTrack: () => void;
  loading: boolean;
  removingTrackIds: Set<string>;
  handleRemoveTrack: (trackId: string) => void;
  setDuration: (duration: number) => void;
  purchaseBoost: () => void;
  purchasingBoost: boolean;
  creatorTier: SubscriptionTier;
  activeBoost: ActiveBoost | null;
  tierSettings: TierSettings;
  navigation: any;
  djPlayerTracks: (Track | null)[];
  djPlayerPlayingStates: boolean[];
  djPlayerVolumes: number[];
  djPlayerBPMs: (number | null)[];
  djPlayerPositions: number[];
  djPlayerDurations: number[];
  handleDJPlayerPlayPause: (playerIndex: number) => void;
  handleDJPlayerLoadTrack: (playerIndex: number) => void;
  handleDJPlayerVolumeChange: (playerIndex: number, volume: number) => void;
  handleDJPlayerSeek: (playerIndex: number, position: number) => void;
  handleDJPlayerSync: (playerIndex1: number, playerIndex2: number) => void;
  setDjPlayerTracks: React.Dispatch<React.SetStateAction<(Track | null)[]>>;
  setQueue: React.Dispatch<React.SetStateAction<Track[]>>;
  setShowQueueDialog: (show: boolean) => void;
  setCreatePlaylistDialogVisible: (show: boolean) => void;
  setPlaybackBlocked: (blocked: boolean) => void;
  setBlockedInfo: (info: BlockedInfo | null) => void;
}

export const RoomMainTab: React.FC<RoomMainTabProps> = ({
  isDJModeActive,
  roomSettings,
  profile,
  scrollViewRef,
  handleScroll,
  playbackBlocked,
  blockedInfo,
  currentTrack,
  isPlaying,
  trackReactions,
  canControl,
  user,
  queue,
  history,
  position,
  duration,
  roomId,
  playPause,
  handlePrevious,
  nextTrack,
  handleReaction,
  loadingReaction,
  toggleAutoplay,
  showMediaPlayer,
  toggleShowMediaPlayer,
  isOwner,
  isAdmin,
  trackUrl,
  setTrackUrl,
  addTrack,
  loading,
  removingTrackIds,
  handleRemoveTrack,
  setDuration,
  purchaseBoost,
  purchasingBoost,
  creatorTier,
  activeBoost,
  tierSettings,
  navigation,
  djPlayerTracks,
  djPlayerPlayingStates,
  djPlayerVolumes,
  djPlayerBPMs,
  djPlayerPositions,
  djPlayerDurations,
  handleDJPlayerPlayPause,
  handleDJPlayerLoadTrack,
  handleDJPlayerVolumeChange,
  handleDJPlayerSeek,
  handleDJPlayerSync,
  setDjPlayerTracks,
  setQueue,
  setShowQueueDialog,
  setCreatePlaylistDialogVisible,
  setPlaybackBlocked,
  setBlockedInfo,
}) => {
  const theme = useTheme();
  const styles = roomScreenStyles;
  const { hasTier } = require('../utils/permissions');

  // Show DJ Mode interface if active and user has PRO tier
  if (isDJModeActive && roomSettings.djMode && profile && hasTier(profile.subscription_tier, 'pro')) {
    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <DJModeInterface
          djMode={roomSettings.djMode}
          djPlayers={roomSettings.djPlayers}
          playerTracks={djPlayerTracks}
          playerPlayingStates={djPlayerPlayingStates}
          playerVolumes={djPlayerVolumes}
          playerBPMs={djPlayerBPMs}
          playerPositions={djPlayerPositions}
          playerDurations={djPlayerDurations}
          onPlayerPlayPause={handleDJPlayerPlayPause}
          onPlayerLoadTrack={handleDJPlayerLoadTrack}
          onPlayerVolumeChange={handleDJPlayerVolumeChange}
          onPlayerSeek={handleDJPlayerSeek}
          onSyncTracks={handleDJPlayerSync}
        />
        
        {/* Queue for loading tracks into DJ players */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="playlist-music" size={22} color={theme.colors.primary} />
              <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Queue (Load to Players)
              </Title>
            </View>
            {queue.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="music-off" size={48} color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.emptyQueue, { color: theme.colors.onSurfaceVariant }]}>
                  Queue is empty. Add tracks to load into DJ players.
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.queueList} showsVerticalScrollIndicator={false}>
                {queue.map((track) => (
                  <List.Item
                    key={track.id}
                    title={track.info?.fullTitle || 'Unknown Track'}
                    description={`${track.platform} • Click to load into a player`}
                    left={() => (
                      <Avatar.Image
                        size={40}
                        source={{ uri: getThumbnailUrl(track.info?.thumbnail, 40) }}
                      />
                    )}
                    onPress={() => {
                      // Show player selection dialog
                      Alert.alert(
                        'Load Track',
                        'Select a player to load this track into:',
                        [
                          ...Array.from({ length: roomSettings.djPlayers }, (_, i) => ({
                            text: `Player ${i + 1}`,
                            onPress: () => {
                              handleDJPlayerLoadTrack(i);
                            },
                          })),
                          { text: 'Cancel', style: 'cancel' },
                        ]
                      );
                    }}
                  />
                ))}
              </ScrollView>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    );
  }

  // Standard mode interface
  return (
    <ScrollView 
      ref={scrollViewRef}
      style={styles.tabContent} 
      showsVerticalScrollIndicator={false}
      onScroll={handleScroll}
      scrollEventThrottle={16}
    >
      {/* Show UpgradePrompt if playback is blocked, otherwise show NowPlayingCard */}
      {playbackBlocked && blockedInfo ? (
        <UpgradePrompt
          isOwner={blockedInfo.isOwner}
          blockedAt={blockedInfo.blockedAt}
          songsPlayed={blockedInfo.songsPlayed}
          roomId={roomId}
          onBoosterPurchased={() => {
            // Refresh room state after booster purchase
            setPlaybackBlocked(false);
            setBlockedInfo(null);
            if (socketService.socket) {
              socketService.socket.emit('join-room', roomId);
            }
          }}
        />
      ) : (
        <NowPlayingCard
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          trackReactions={trackReactions}
          canControl={canControl}
          onReaction={handleReaction}
          loadingReaction={loadingReaction}
          hasUser={!!user}
          queueLength={queue.length}
          autoplay={roomSettings.autoplay}
          onToggleAutoplay={toggleAutoplay}
          canToggleAutoplay={isOwner || isAdmin}
          showMediaPlayer={showMediaPlayer}
          onToggleShowMediaPlayer={toggleShowMediaPlayer}
          position={position}
          duration={duration}
          onAddToPlaylist={() => setShowQueueDialog(true)}
          onPlayPause={playPause}
          onPrevious={handlePrevious}
          onNext={nextTrack}
          hasQueue={queue.length > 0}
          onCreatePlaylist={() => setCreatePlaylistDialogVisible(true)}
          canCreatePlaylist={!!(profile && hasTier(profile.subscription_tier, 'pro'))}
        />
      )}

      {/* DJ Mode Interface */}
      {roomSettings.djMode && (
        <DJModeInterface
          djMode={roomSettings.djMode}
          djPlayers={roomSettings.djPlayers}
          playerTracks={djPlayerTracks}
          playerPlayingStates={djPlayerPlayingStates}
          onPlayerPlayPause={(playerIndex) => {
            handleDJPlayerPlayPause(playerIndex);
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

      {/* YouTube Player - Show for YouTube tracks (separate from NowPlayingCard) */}
      {showMediaPlayer && currentTrack && (currentTrack.url?.includes('youtube') || currentTrack.url?.includes('youtu.be')) && (
        <View style={styles.youtubePlayerContainer}>
          <YouTubePlayer
            track={currentTrack}
            isPlaying={isPlaying}
            position={position}
            onPositionUpdate={(newPosition) => {
              // Send position update to server (which saves to Supabase)
              if (socketService.socket && !playbackBlocked) {
                socketService.socket.emit('sync-position', {
                  roomId,
                  position: newPosition,
                });
              }
            }}
            onReady={() => {
              console.log('YouTube player ready');
            }}
            onError={(error) => {
              console.error('YouTube player error:', error);
              Alert.alert('YouTube Error', error);
            }}
            onStateChange={(state) => {
              // Update local state based on YouTube player state
              // But Supabase is source of truth, so we sync to it
              if (state === 'playing' && !isPlaying) {
                // YouTube started playing, but wait for Supabase confirmation
              } else if (state === 'paused' && isPlaying) {
                // YouTube paused, but wait for Supabase confirmation
              } else if (state === 'ended') {
                // Track ended - trigger next track if autoplay is enabled
                // Server will handle permission checks, so we don't need canControl here
                if (roomSettings.autoplay && queue.length > 0 && socketService.socket) {
                  console.log('Track ended, autoplay enabled, triggering next track');
                  socketService.socket.emit('next-track', { roomId });
                }
              }
            }}
          />
        </View>
      )}

      {/* SoundCloud Player - Show for SoundCloud tracks (separate from NowPlayingCard) */}
      {showMediaPlayer && currentTrack && currentTrack.url?.includes('soundcloud.com') && (
        <View style={styles.youtubePlayerContainer}>
          <SoundCloudPlayer
            track={currentTrack}
            isPlaying={isPlaying}
            position={position}
            onPositionUpdate={(newPosition) => {
              // Send position update to server (which saves to Supabase)
              console.log('[RoomScreen] SoundCloud position update', { newPosition });
              if (socketService.socket && !playbackBlocked) {
                socketService.socket.emit('sync-position', {
                  roomId,
                  position: newPosition,
                });
              }
            }}
            onDurationUpdate={(newDuration) => {
              console.log('[RoomScreen] SoundCloud duration update', { duration: newDuration });
              setDuration(newDuration);
            }}
            onReady={() => {
              console.log('[RoomScreen] SoundCloud player ready');
            }}
            onError={(error) => {
              console.error('[RoomScreen] SoundCloud player error:', error);
              Alert.alert('SoundCloud Error', error);
            }}
            onStateChange={(state) => {
              console.log('[RoomScreen] SoundCloud state changed', { state, isPlaying });
              // Update local state based on SoundCloud player state
              // But Supabase is source of truth, so we sync to it
              if (state === 'playing' && !isPlaying) {
                // SoundCloud started playing, but wait for Supabase confirmation
              } else if (state === 'paused' && isPlaying) {
                // SoundCloud paused, but wait for Supabase confirmation
              } else if (state === 'ended') {
                // Track ended - trigger next track if autoplay is enabled
                // Server will handle permission checks, so we don't need canControl here
                if (roomSettings.autoplay && queue.length > 0 && socketService.socket) {
                  console.log('[RoomScreen] SoundCloud track ended, autoplay enabled, triggering next track');
                  socketService.socket.emit('next-track', { roomId });
                }
              }
            }}
          />
        </View>
      )}
      {/* Boost Banner - Show if owner is free tier and no active boost */}
      {creatorTier === 'free' && !activeBoost && (
        <Card style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Card.Content>
            <View style={styles.boostContainer}>
              <View style={styles.boostHeader}>
                <MaterialCommunityIcons name="rocket-launch" size={24} color={theme.colors.primary} />
                <Title style={[styles.boostTitle, { color: theme.colors.onSurface }]}>
                  Boost This Room
                </Title>
              </View>
              <Text style={[styles.boostDescription, { color: theme.colors.onSurfaceVariant }]}>
                This room is on Free tier. Purchase a 1-hour boost for $1 USD to unlock Pro tier benefits:
                {'\n'}• Unlimited queue
                {'\n'}• DJ Mode
                {'\n'}• No ads
              </Text>
              <Button
                mode="contained"
                onPress={purchaseBoost}
                loading={purchasingBoost}
                disabled={purchasingBoost}
                style={styles.boostButton}
                buttonColor={theme.colors.primary}
                textColor={theme.colors.onPrimary}
                icon="rocket-launch"
              >
                {purchasingBoost ? 'Processing...' : 'Boost for $1 USD'}
              </Button>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Active Boost Banner */}
      {activeBoost && (
        <Card style={[styles.card, { backgroundColor: `${theme.colors.primary}15`, borderColor: theme.colors.primary, borderWidth: 2 }]}>
          <Card.Content>
            <View style={styles.boostContainer}>
              <View style={styles.boostHeader}>
                <MaterialCommunityIcons name="rocket-launch" size={24} color={theme.colors.primary} />
                <Title style={[styles.boostTitle, { color: theme.colors.primary }]}>
                  Boost Active! 🚀
                </Title>
              </View>
              <Text style={[styles.boostDescription, { color: theme.colors.onSurface }]}>
                Room has Pro tier benefits for {activeBoost.minutesRemaining} more minute{activeBoost.minutesRemaining !== 1 ? 's' : ''}
              </Text>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Ads Banner - Show based on room creator's tier, not current user's tier */}
      {tierSettings.ads && (
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
      <Card style={[styles.card, styles.queueCard]}>
        <Card.Content style={styles.queueCardContent}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionIconContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
                <MaterialCommunityIcons name="playlist-music" size={22} color={theme.colors.primary} />
              </View>
              <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Queue
              </Title>
            </View>
            <View style={[styles.countBadge, { backgroundColor: `${theme.colors.primary}20` }]}>
              <Text style={[styles.countBadgeText, { color: theme.colors.primary }]}>
                {queue.length}
                {tierSettings.queueLimit !== null && ` / ${tierSettings.queueLimit}`}
              </Text>
            </View>
          </View>
          {tierSettings.queueLimit !== null && queue.length >= tierSettings.queueLimit && (
            <View style={[styles.permissionNoticeContainer, { backgroundColor: `${theme.colors.error}15` }]}>
              <MaterialCommunityIcons name="alert-circle" size={16} color={theme.colors.error} />
              <Text style={[styles.permissionNotice, { color: theme.colors.error }]}>
                Queue limit reached ({tierSettings.queueLimit} songs). Room creator needs to upgrade to increase limit.
              </Text>
            </View>
          )}
          {tierSettings.queueLimit !== null && queue.length >= tierSettings.queueLimit * 0.8 && queue.length < tierSettings.queueLimit && (
            <View style={[styles.infoNotice, { backgroundColor: `${theme.colors.primary}15` }]}>
              <MaterialCommunityIcons name="information" size={18} color={theme.colors.primary} />
              <Text style={[styles.infoNoticeText, { color: theme.colors.primary }]}>
                Queue limit: {queue.length} / {tierSettings.queueLimit} songs
              </Text>
            </View>
          )}
          {queue.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="music-off" size={48} color={theme.colors.onSurfaceVariant} />
              <Text style={[styles.emptyQueue, { color: theme.colors.onSurfaceVariant }]}>
                Queue is empty. Add a track to get started!
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.queueList} showsVerticalScrollIndicator={false}>
              {queue.map((track, index) => {
                const canRemove = isOwner || isAdmin || roomSettings.allowQueueRemoval || 
                  (track.addedBy === user?.id);
                const isRemoving = removingTrackIds.has(track.id);
                
                return (
                  <AnimatedQueueItem
                    key={track.id}
                    track={track}
                    index={index}
                    canRemove={canRemove}
                    isRemoving={isRemoving}
                    theme={theme}
                    user={user}
                    onRemove={handleRemoveTrack}
                  />
                );
              })}
            </ScrollView>
          )}
        </Card.Content>
      </Card>

      {/* History */}
      <Card style={[styles.card, styles.historyCard]}>
        <Card.Content style={styles.historyCardContent}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionIconContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
                <MaterialCommunityIcons name="history" size={22} color={theme.colors.primary} />
              </View>
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
                  activeOpacity={0.8}
                  style={[
                    styles.queueItem, 
                    styles.historyItem, 
                    { 
                      backgroundColor: `${theme.colors.surfaceVariant}60`,
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
                      size={IS_MOBILE ? 60 : 64}
                      source={{ uri: getThumbnailUrl(track.info?.thumbnail, IS_MOBILE ? 60 : 64) }}
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
                          size={14} 
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
                    <TouchableOpacity
                      style={[styles.replayButton, { backgroundColor: `${theme.colors.primary}20` }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        if (socketService.socket) {
                          socketService.socket.emit('replay-track', { roomId, trackId: track.id });
                        }
                      }}
                    >
                      <MaterialCommunityIcons 
                        name="replay" 
                        size={20} 
                        color={theme.colors.primary}
                      />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </Card.Content>
      </Card>

      {/* Create Playlist Button - Only show for PRO tier users */}
      {profile && profile.subscription_tier === 'pro' && (
        <Card style={styles.card}>
          <Card.Content>
            <Button
              mode="contained"
              onPress={() => setCreatePlaylistDialogVisible(true)}
              icon="playlist-plus"
              style={styles.addButton}
              buttonColor={theme.colors.primary}
              textColor={theme.colors.onPrimary}
            >
              Create Playlist from Room
            </Button>
            <Text style={[styles.settingDescription, { color: theme.colors.onSurfaceVariant, marginTop: 8 }]}>
              Create a playlist with all tracks from history and queue
            </Text>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
};

