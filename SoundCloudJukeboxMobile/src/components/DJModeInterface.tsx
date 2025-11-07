import React from 'react';
import { View, StyleSheet, ScrollView, Platform, Dimensions } from 'react-native';
import { Card, Text, Title, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DJModePlayer } from './DJModePlayer';
import { Track } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_MOBILE = SCREEN_WIDTH < 768;

interface DJModeInterfaceProps {
  djMode: boolean;
  djPlayers: number;
  playerTracks: (Track | null)[];
  playerPlayingStates: boolean[];
  onPlayerPlayPause?: (playerIndex: number) => void;
  onPlayerLoadTrack?: (playerIndex: number) => void;
}

export const DJModeInterface: React.FC<DJModeInterfaceProps> = ({
  djMode,
  djPlayers,
  playerTracks,
  playerPlayingStates,
  onPlayerPlayPause,
  onPlayerLoadTrack,
}) => {
  const theme = useTheme();

  if (!djMode || djPlayers === 0) {
    return null;
  }

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <Card.Content style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.iconContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
              <MaterialCommunityIcons 
                name="turntable" 
                size={24} 
                color={theme.colors.primary} 
              />
            </View>
            <Title style={[styles.title, { color: theme.colors.onSurface }]}>
              DJ Mode
            </Title>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${theme.colors.primary}20` }]}>
            <Text style={[styles.statusText, { color: theme.colors.primary }]}>
              {djPlayers} / 3 Active
            </Text>
          </View>
        </View>

        <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
          Mix tracks across multiple players for seamless transitions
        </Text>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.playersContainer}
          contentContainerStyle={styles.playersContent}
        >
          {[1, 2, 3].map((playerNum) => {
            const isActive = playerNum <= djPlayers;
            const playerIndex = playerNum - 1;
            const track = isActive ? (playerTracks[playerIndex] || null) : null;
            const isPlaying = isActive ? (playerPlayingStates[playerIndex] || false) : false;

            return (
              <DJModePlayer
                key={playerNum}
                playerNumber={playerNum}
                track={track}
                isPlaying={isPlaying}
                isActive={isActive}
                onPlayPause={isActive && onPlayerPlayPause ? () => onPlayerPlayPause(playerIndex) : undefined}
                onLoadTrack={isActive && onPlayerLoadTrack ? () => onPlayerLoadTrack(playerIndex) : undefined}
              />
            );
          })}
        </ScrollView>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: IS_MOBILE ? 12 : 16,
    borderRadius: 24,
    elevation: 8,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.25)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
    }),
  },
  content: {
    padding: IS_MOBILE ? 16 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: IS_MOBILE ? 12 : 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: IS_MOBILE ? 18 : 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: IS_MOBILE ? 11 : 12,
    fontWeight: '600',
  },
  description: {
    fontSize: IS_MOBILE ? 12 : 14,
    marginBottom: IS_MOBILE ? 16 : 20,
    lineHeight: 20,
  },
  playersContainer: {
    marginHorizontal: -IS_MOBILE ? 12 : -16,
  },
  playersContent: {
    paddingHorizontal: IS_MOBILE ? 12 : 16,
    gap: IS_MOBILE ? 8 : 12,
  },
});

