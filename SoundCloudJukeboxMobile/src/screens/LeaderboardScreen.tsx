import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Card,
  Title,
  Avatar,
  Chip,
  ActivityIndicator,
  useTheme,
  Divider,
  Button,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';

type LeaderboardScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Leaderboard'>;

interface LeaderboardEntry {
  user_id: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  total_listeners?: number;
  peak_listeners?: number;
  total_rooms_created?: number;
  total_tracks_played?: number;
  total_play_time_hours?: number;
  // Reaction stats
  total_likes?: number;
  total_dislikes?: number;
  total_fantastic?: number;
  reaction_score?: number;
  tracks_with_reactions?: number;
  total_reactions?: number;
}

type LeaderboardType = 'total_listeners' | 'peak_listeners' | 'rooms_created' | 'tracks_played' | 'reactions';

const LeaderboardScreen: React.FC = () => {
  const navigation = useNavigation<LeaderboardScreenNavigationProp>();
  const { supabase } = useAuth();
  const theme = useTheme();

  const [activeTab, setActiveTab] = useState<LeaderboardType>('total_listeners');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadLeaderboard();
  }, [activeTab]);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      
      let viewName = 'leaderboard_total_listeners';
      switch (activeTab) {
        case 'peak_listeners':
          viewName = 'leaderboard_peak_listeners';
          break;
        case 'rooms_created':
          viewName = 'leaderboard_rooms_created';
          break;
        case 'tracks_played':
          viewName = 'leaderboard_tracks_played';
          break;
        case 'reactions':
          viewName = 'leaderboard_reactions';
          break;
        default:
          viewName = 'leaderboard_total_listeners';
      }

      const { data, error } = await supabase
        .from(viewName)
        .select('*')
        .limit(100);

      if (error) throw error;
      setLeaderboard((data || []) as LeaderboardEntry[]);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLeaderboard();
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'total_listeners':
        return 'Total Listeners';
      case 'peak_listeners':
        return 'Peak Listeners';
      case 'rooms_created':
        return 'Rooms Created';
      case 'tracks_played':
        return 'Tracks Played';
      case 'reactions':
        return 'Track Reactions';
      default:
        return 'Leaderboard';
    }
  };

  const getStatValue = (entry: LeaderboardEntry) => {
    switch (activeTab) {
      case 'total_listeners':
        return entry.total_listeners || 0;
      case 'peak_listeners':
        return entry.peak_listeners || 0;
      case 'rooms_created':
        return entry.total_rooms_created || 0;
      case 'tracks_played':
        return entry.total_tracks_played || 0;
      case 'reactions':
        return entry.reaction_score || 0;
      default:
        return 0;
    }
  };

  const getStatLabel = () => {
    switch (activeTab) {
      case 'total_listeners':
        return 'Total Listeners';
      case 'peak_listeners':
        return 'Peak Listeners';
      case 'rooms_created':
        return 'Rooms';
      case 'tracks_played':
        return 'Tracks';
      case 'reactions':
        return 'Reaction Score';
      default:
        return '';
    }
  };

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  };

  const getInitials = (entry: LeaderboardEntry) => {
    const name = entry.display_name || entry.username || 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <Title style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
          🏆 Leaderboard
        </Title>
        <Text style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          Top DJs by {getTabTitle().toLowerCase()}
        </Text>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabsContainer, { backgroundColor: theme.colors.surface }]}
        contentContainerStyle={styles.tabsContent}
      >
        <Button
          mode={activeTab === 'total_listeners' ? 'contained' : 'outlined'}
          onPress={() => setActiveTab('total_listeners')}
          style={styles.tabButton}
          icon="account-group"
        >
          Listeners
        </Button>
        <Button
          mode={activeTab === 'peak_listeners' ? 'contained' : 'outlined'}
          onPress={() => setActiveTab('peak_listeners')}
          style={styles.tabButton}
          icon="trending-up"
        >
          Peak
        </Button>
        <Button
          mode={activeTab === 'rooms_created' ? 'contained' : 'outlined'}
          onPress={() => setActiveTab('rooms_created')}
          style={styles.tabButton}
          icon="door-open"
        >
          Rooms
        </Button>
        <Button
          mode={activeTab === 'tracks_played' ? 'contained' : 'outlined'}
          onPress={() => setActiveTab('tracks_played')}
          style={styles.tabButton}
          icon="music-note"
        >
          Tracks
        </Button>
        <Button
          mode={activeTab === 'reactions' ? 'contained' : 'outlined'}
          onPress={() => setActiveTab('reactions')}
          style={styles.tabButton}
          icon="star"
        >
          Reactions
        </Button>
      </ScrollView>

      {/* Leaderboard List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      ) : leaderboard.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
            No data available yet. Start creating rooms and playing music!
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {leaderboard.map((entry, index) => {
            const rank = index + 1;
            const statValue = getStatValue(entry);
            const displayName = entry.display_name || entry.username || 'Anonymous';

            return (
              <Card
                key={entry.user_id}
                style={[
                  styles.entryCard,
                  rank <= 3 && styles.topThreeCard,
                  { backgroundColor: theme.colors.surface },
                ]}
              >
                <Card.Content>
                  <View style={styles.entryContent}>
                    {/* Rank */}
                    <View style={styles.rankContainer}>
                      <Text style={[styles.rankText, { color: theme.colors.onSurface }]}>
                        {getMedalEmoji(rank) || `#${rank}`}
                      </Text>
                    </View>

                    {/* Avatar */}
                    <Avatar.Image
                      size={50}
                      source={{
                        uri: entry.avatar_url ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff`,
                      }}
                      style={styles.avatar}
                    />
                    {!entry.avatar_url && (
                      <Avatar.Text
                        size={50}
                        label={getInitials(entry)}
                        style={[styles.avatar, { backgroundColor: theme.colors.primary }]}
                      />
                    )}

                    {/* User Info */}
                    <View style={styles.userInfo}>
                      <Text
                        style={[styles.userName, { color: theme.colors.onSurface }]}
                        numberOfLines={1}
                      >
                        {displayName}
                      </Text>
                      {entry.username && entry.username !== displayName && (
                        <Text
                          style={[styles.username, { color: theme.colors.onSurfaceVariant }]}
                          numberOfLines={1}
                        >
                          @{entry.username}
                        </Text>
                      )}
                    </View>

                    {/* Stats */}
                    <View style={styles.statsContainer}>
                      <Text
                        style={[styles.statValue, { color: theme.colors.primary }]}
                      >
                        {statValue.toLocaleString()}
                      </Text>
                      <Text
                        style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}
                      >
                        {getStatLabel()}
                      </Text>
                    </View>
                  </View>

                  {/* Additional Stats */}
                  {activeTab === 'reactions' ? (
                    <>
                      <Divider style={styles.divider} />
                      <View style={styles.additionalStats}>
                        <Chip
                          icon="thumb-up"
                          style={[styles.chip, { backgroundColor: theme.colors.primaryContainer }]}
                          textStyle={[styles.chipText, { color: theme.colors.onPrimaryContainer }]}
                        >
                          👍 {entry.total_likes || 0}
                        </Chip>
                        <Chip
                          icon="star"
                          style={[styles.chip, { backgroundColor: theme.colors.tertiaryContainer }]}
                          textStyle={[styles.chipText, { color: theme.colors.onTertiaryContainer }]}
                        >
                          ⭐ {entry.total_fantastic || 0}
                        </Chip>
                        <Chip
                          icon="thumb-down"
                          style={[styles.chip, { backgroundColor: theme.colors.errorContainer }]}
                          textStyle={[styles.chipText, { color: theme.colors.onErrorContainer }]}
                        >
                          👎 {entry.total_dislikes || 0}
                        </Chip>
                        {entry.tracks_with_reactions !== undefined && (
                          <Chip
                            icon="music-note"
                            style={styles.chip}
                            textStyle={styles.chipText}
                          >
                            {entry.tracks_with_reactions} tracks
                          </Chip>
                        )}
                      </View>
                    </>
                  ) : activeTab !== 'total_listeners' && (
                    <>
                      <Divider style={styles.divider} />
                      <View style={styles.additionalStats}>
                        <Chip
                          icon="account-group"
                          style={styles.chip}
                          textStyle={styles.chipText}
                        >
                          {entry.total_listeners || 0} listeners
                        </Chip>
                        {entry.total_rooms_created !== undefined && (
                          <Chip
                            icon="door-open"
                            style={styles.chip}
                            textStyle={styles.chipText}
                          >
                            {entry.total_rooms_created} rooms
                          </Chip>
                        )}
                        {entry.total_tracks_played !== undefined && (
                          <Chip
                            icon="music-note"
                            style={styles.chip}
                            textStyle={styles.chipText}
                          >
                            {entry.total_tracks_played} tracks
                          </Chip>
                        )}
                        {entry.total_play_time_hours !== undefined && (
                          <Chip
                            icon="clock-outline"
                            style={styles.chip}
                            textStyle={styles.chipText}
                          >
                            {entry.total_play_time_hours}h
                          </Chip>
                        )}
                      </View>
                    </>
                  )}
                </Card.Content>
              </Card>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 16,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  tabsContainer: {
    maxHeight: 60,
    elevation: 1,
  },
  tabsContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  tabButton: {
    marginRight: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  listContainer: {
    flex: 1,
  },
  entryCard: {
    margin: 12,
    marginBottom: 8,
    elevation: 2,
  },
  topThreeCard: {
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  entryContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankContainer: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  avatar: {
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  username: {
    fontSize: 12,
  },
  statsContainer: {
    alignItems: 'flex-end',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    marginTop: 12,
    marginBottom: 8,
  },
  additionalStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginRight: 4,
    marginBottom: 4,
  },
  chipText: {
    fontSize: 11,
  },
});

export default LeaderboardScreen;

