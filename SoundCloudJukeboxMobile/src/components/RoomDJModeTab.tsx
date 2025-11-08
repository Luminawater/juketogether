import React from 'react';
import { ScrollView, View, Alert } from 'react-native';
import {
  Card,
  Title,
  Text,
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DJModeInterface } from './DJModeInterface';
import { DJModeUpgradeAd } from './DJModeUpgradeAd';
import { Track } from '../types';
import { RoomSettings, TierSettings } from '../screens/RoomScreen.types';
import { roomScreenStyles } from '../screens/RoomScreen.styles';
import { djAudioService } from '../services/djAudioService';
import { bpmDetectionService } from '../services/bpmDetectionService';

interface RoomDJModeTabProps {
  profile: any;
  navigation: any;
  isOwner: boolean;
  isAdmin: boolean;
  roomSettings: RoomSettings;
  tierSettings: TierSettings;
  queue: Track[];
  djPlayerTracks: (Track | null)[];
  djPlayerPlayingStates: boolean[];
  djPlayerVolumes: number[];
  djPlayerBPMs: (number | null)[];
  djPlayerPositions: number[];
  djPlayerDurations: number[];
  onPlayerPlayPause: (playerIndex: number) => void;
  onPlayerLoadTrack: (playerIndex: number) => void;
  onPlayerVolumeChange: (playerIndex: number, volume: number) => void;
  onPlayerSeek: (playerIndex: number, position: number) => void;
  onSyncTracks: (playerIndex1: number, playerIndex2: number) => void;
  onSetDjPlayerTracks: (tracks: (Track | null)[]) => void;
  onSetDjPlayerBPMs: (bpms: (number | null)[]) => void;
}

export const RoomDJModeTab: React.FC<RoomDJModeTabProps> = ({
  profile,
  navigation,
  isOwner,
  isAdmin,
  roomSettings,
  tierSettings,
  queue,
  djPlayerTracks,
  djPlayerPlayingStates,
  djPlayerVolumes,
  djPlayerBPMs,
  djPlayerPositions,
  djPlayerDurations,
  onPlayerPlayPause,
  onPlayerLoadTrack,
  onPlayerVolumeChange,
  onPlayerSeek,
  onSyncTracks,
  onSetDjPlayerTracks,
  onSetDjPlayerBPMs,
}) => {
  const theme = useTheme();
  const styles = roomScreenStyles;
  const { hasTier } = require('../utils/permissions');
  const isPro = profile && hasTier(profile.subscription_tier, 'pro');

  if (!isPro) {
    return (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <DJModeUpgradeAd
          onUpgrade={() => {
            navigation.navigate('Subscription');
          }}
        />
      </ScrollView>
    );
  }

  // Check if DJ mode is available (room creator has Pro tier)
  if (!tierSettings.djMode) {
    return (
      <ScrollView
        style={styles.tabContent}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.centerContent}>
            <MaterialCommunityIcons
              name="equalizer"
              size={64}
              color={theme.colors.primary}
              style={styles.centerIcon}
            />
            <Text style={[styles.noAccess, { color: theme.colors.onSurface, fontSize: 18, marginBottom: 8 }]}>
              DJ Mode Not Available
            </Text>
            <Text style={[styles.noAccessSubtext, { color: theme.colors.onSurfaceVariant }]}>
              The room creator needs to have a Pro tier subscription to enable DJ Mode.
            </Text>
          </Card.Content>
        </Card>
      </ScrollView>
    );
  }

  // If user is pro and DJ mode is available, show the DJ interface
  if (roomSettings.djMode || (isOwner || isAdmin)) {
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
          onPlayerPlayPause={onPlayerPlayPause}
          onPlayerLoadTrack={onPlayerLoadTrack}
          onPlayerVolumeChange={onPlayerVolumeChange}
          onPlayerSeek={onPlayerSeek}
          onSyncTracks={onSyncTracks}
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
              <Text style={[styles.emptyQueue, { color: theme.colors.onSurfaceVariant }]}>
                No tracks in queue
              </Text>
            ) : (
              <ScrollView style={styles.queueList}>
                {queue.map((track, index) => (
                  <Card
                    key={index}
                    style={[styles.queueItem, { backgroundColor: theme.colors.surfaceVariant }]}
                    onPress={() => {
                      // Track can be loaded to a player from here
                      Alert.alert('Load Track', `Select a player to load "${track.info?.fullTitle || 'Unknown Track'}"`, [
                        { text: 'Cancel', style: 'cancel' },
                        ...Array.from({ length: roomSettings.djPlayers }, (_, i) => ({
                          text: `Player ${i + 1}`,
                          onPress: async () => {
                            // Load the selected track to the player
                            const success = await djAudioService.loadTrack(i, track);
                            if (success) {
                              const newTracks = [...djPlayerTracks];
                              newTracks[i] = track;
                              onSetDjPlayerTracks(newTracks);
                              
                              // Detect BPM
                              const bpmResult = await bpmDetectionService.detectBPM(track);
                              const newBPMs = [...djPlayerBPMs];
                              newBPMs[i] = bpmResult.bpm;
                              onSetDjPlayerBPMs(newBPMs);
                            } else {
                              Alert.alert('Error', 'Failed to load track to player');
                            }
                          },
                        })),
                      ]);
                    }}
                  >
                    <Card.Content style={styles.queueItemContent}>
                      <MaterialCommunityIcons name="music" size={20} color={theme.colors.primary} />
                      <View style={styles.queueItemDetails}>
                        <Text style={[styles.queueItemTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
                          {track.info?.fullTitle || 'Unknown Track'}
                        </Text>
                        <View style={styles.queueItemMeta}>
                          <MaterialCommunityIcons 
                            name="account" 
                            size={12} 
                            color={theme.colors.onSurfaceVariant} 
                          />
                          <Text style={[styles.queueItemDescription, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                            {track.info?.artist || 'Unknown Artist'}
                          </Text>
                        </View>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={20} color={theme.colors.onSurfaceVariant} />
                    </Card.Content>
                  </Card>
                ))}
              </ScrollView>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    );
  }

  // Loading state while DJ mode is being enabled
  return (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Card.Content style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.noAccess, { color: theme.colors.onSurface, fontSize: 18, marginTop: 16 }]}>
            Enabling DJ Mode...
          </Text>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

