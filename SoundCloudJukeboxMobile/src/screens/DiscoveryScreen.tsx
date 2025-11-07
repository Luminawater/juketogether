import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Title,
  Paragraph,
  Button,
  Searchbar,
  Avatar,
  Chip,
  ActivityIndicator,
  Menu,
  Divider,
  TextInput,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { Room } from '../types';

type DiscoveryScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Discovery'>;

// Common countries list
const COUNTRIES = [
  'All Countries',
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Germany',
  'France',
  'Spain',
  'Italy',
  'Netherlands',
  'Sweden',
  'Norway',
  'Denmark',
  'Finland',
  'Poland',
  'Brazil',
  'Mexico',
  'Argentina',
  'Japan',
  'South Korea',
  'India',
  'China',
  'Other',
];

const formatPlaytime = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

const DiscoveryScreen: React.FC = () => {
  const navigation = useNavigation<DiscoveryScreenNavigationProp>();
  const { supabase, user, profile } = useAuth();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string>('All Countries');
  const [minFollowers, setMinFollowers] = useState<string>('');
  const [minFollowersNum, setMinFollowersNum] = useState<number>(0);
  const [minPlaytime, setMinPlaytime] = useState<string>('');
  const [minPlaytimeNum, setMinPlaytimeNum] = useState<number>(0);
  const [minUsers, setMinUsers] = useState<string>('');
  const [minUsersNum, setMinUsersNum] = useState<number>(0);

  // Country menu state
  const [countryMenuVisible, setCountryMenuVisible] = useState(false);

  useEffect(() => {
    loadPublicRooms();
  }, []);

  useEffect(() => {
    filterRooms();
  }, [searchQuery, rooms, selectedCountry, minFollowersNum, minPlaytimeNum, minUsersNum]);

  // Update numeric values from text inputs
  useEffect(() => {
    setMinFollowersNum(parseInt(minFollowers) || 0);
  }, [minFollowers]);

  useEffect(() => {
    setMinPlaytimeNum(parseInt(minPlaytime) || 0);
  }, [minPlaytime]);

  useEffect(() => {
    setMinUsersNum(parseInt(minUsers) || 0);
  }, [minUsers]);

  const loadPublicRooms = async () => {
    try {
      setLoading(true);
      // Get public rooms from room_settings
      const { data: roomSettings, error: settingsError } = await supabase
        .from('room_settings')
        .select('*')
        .eq('is_private', false)
        .order('created_at', { ascending: false })
        .limit(100);

      if (settingsError) throw settingsError;

      // Get room data
      const roomIds = roomSettings?.map(rs => rs.room_id) || [];
      if (roomIds.length === 0) {
        setRooms([]);
        setFilteredRooms([]);
        return;
      }

      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('*')
        .in('id', roomIds);

      if (roomsError) throw roomsError;

      // Get stats for each room
      const roomsWithStats = await Promise.all(
        (roomsData || []).map(async (room) => {
          const settings = roomSettings?.find(rs => rs.room_id === room.id);
          
          // Get follower count for host
          let followerCount = 0;
          if (room.host_user_id) {
            const { data: followsData } = await supabase
              .from('user_follows')
              .select('follower_id', { count: 'exact', head: true })
              .eq('following_id', room.host_user_id);
            followerCount = followsData?.length || 0;
          }

          // Get user count
          const { data: volumesData } = await supabase
            .from('user_volumes')
            .select('user_id', { count: 'exact', head: true })
            .eq('room_id', room.id);
          const userCount = volumesData?.length || 0;

          return {
            id: room.id,
            name: settings?.name || `Room ${room.id.substring(0, 8)}`,
            description: settings?.description,
            type: 'public' as const,
            created_by: room.host_user_id || '',
            created_at: settings?.created_at || room.updated_at || '',
            country: settings?.country || undefined,
            follower_count: followerCount,
            total_playtime_seconds: settings?.total_playtime_seconds || 0,
            user_count: userCount,
          };
        })
      );

      setRooms(roomsWithStats);
      setFilteredRooms(roomsWithStats);
    } catch (error) {
      console.error('Error loading public rooms:', error);
      Alert.alert('Error', 'Failed to load public rooms');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterRooms = () => {
    let filtered = [...rooms];

    // Text search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (room) =>
          room.name.toLowerCase().includes(query) ||
          room.description?.toLowerCase().includes(query)
      );
    }

    // Country filter
    if (selectedCountry && selectedCountry !== 'All Countries') {
      filtered = filtered.filter(
        (room) => room.country === selectedCountry
      );
    }

    // Followers filter
    if (minFollowersNum > 0) {
      filtered = filtered.filter(
        (room) => (room.follower_count || 0) >= minFollowersNum
      );
    }

    // Playtime filter
    if (minPlaytimeNum > 0) {
      filtered = filtered.filter(
        (room) => (room.total_playtime_seconds || 0) >= minPlaytimeNum
      );
    }

    // User count filter
    if (minUsersNum > 0) {
      filtered = filtered.filter(
        (room) => (room.user_count || 0) >= minUsersNum
      );
    }

    setFilteredRooms(filtered);
  };

  const handleJoinRoom = (room: Room) => {
    navigation.navigate('Room', { roomId: room.id, roomName: room.name });
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPublicRooms();
  };

  const clearFilters = () => {
    setSelectedCountry('All Countries');
    setMinFollowers('');
    setMinPlaytime('');
    setMinUsers('');
  };

  const hasActiveFilters = selectedCountry !== 'All Countries' || 
    minFollowersNum > 0 || 
    minPlaytimeNum > 0 || 
    minUsersNum > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Title style={styles.headerTitle}>Discover Rooms</Title>
        <Paragraph style={styles.headerSubtitle}>
          Explore public music rooms
        </Paragraph>
      </View>

      <Searchbar
        placeholder="Search rooms..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      <View style={styles.filterContainer}>
        <Button
          mode={showFilters ? 'contained' : 'outlined'}
          onPress={() => setShowFilters(!showFilters)}
          icon="filter"
          style={styles.filterButton}
        >
          Filters
        </Button>
        {hasActiveFilters && (
          <Button
            mode="text"
            onPress={clearFilters}
            icon="close"
            style={styles.clearButton}
          >
            Clear
          </Button>
        )}
      </View>

      {showFilters && (
        <Card style={styles.filterCard}>
          <Card.Content>
            <Title style={styles.filterTitle}>Filter Rooms</Title>
            
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Country:</Text>
              <Menu
                visible={countryMenuVisible}
                onDismiss={() => setCountryMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setCountryMenuVisible(true)}
                    style={styles.countryButton}
                  >
                    {selectedCountry}
                  </Button>
                }
              >
                {COUNTRIES.map((country) => (
                  <Menu.Item
                    key={country}
                    onPress={() => {
                      setSelectedCountry(country);
                      setCountryMenuVisible(false);
                    }}
                    title={country}
                  />
                ))}
              </Menu>
            </View>

            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Min Followers:</Text>
              <TextInput
                mode="outlined"
                value={minFollowers}
                onChangeText={setMinFollowers}
                keyboardType="numeric"
                placeholder="0"
                style={styles.filterInput}
              />
            </View>

            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Min Playtime (seconds):</Text>
              <TextInput
                mode="outlined"
                value={minPlaytime}
                onChangeText={setMinPlaytime}
                keyboardType="numeric"
                placeholder="0"
                style={styles.filterInput}
              />
            </View>

            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Min Users:</Text>
              <TextInput
                mode="outlined"
                value={minUsers}
                onChangeText={setMinUsers}
                keyboardType="numeric"
                placeholder="0"
                style={styles.filterInput}
              />
            </View>

            {hasActiveFilters && (
              <View style={styles.activeFiltersContainer}>
                <Text style={styles.activeFiltersLabel}>Active filters:</Text>
                <View style={styles.chipContainer}>
                  {selectedCountry !== 'All Countries' && (
                    <Chip
                      icon="map-marker"
                      onClose={() => setSelectedCountry('All Countries')}
                      style={styles.filterChip}
                    >
                      {selectedCountry}
                    </Chip>
                  )}
                  {minFollowersNum > 0 && (
                    <Chip
                      icon="account-group"
                      onClose={() => setMinFollowers('')}
                      style={styles.filterChip}
                    >
                      {minFollowersNum}+ followers
                    </Chip>
                  )}
                  {minPlaytimeNum > 0 && (
                    <Chip
                      icon="clock-outline"
                      onClose={() => setMinPlaytime('')}
                      style={styles.filterChip}
                    >
                      {formatPlaytime(minPlaytimeNum)}+ playtime
                    </Chip>
                  )}
                  {minUsersNum > 0 && (
                    <Chip
                      icon="account-multiple"
                      onClose={() => setMinUsers('')}
                      style={styles.filterChip}
                    >
                      {minUsersNum}+ users
                    </Chip>
                  )}
                </View>
              </View>
            )}
          </Card.Content>
        </Card>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading rooms...</Text>
        </View>
      ) : filteredRooms.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Card.Content>
            <Text style={styles.emptyText}>
              {searchQuery || hasActiveFilters
                ? 'No rooms found matching your filters'
                : 'No public rooms available'}
            </Text>
          </Card.Content>
        </Card>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {filteredRooms.map((room) => (
            <Card
              key={room.id}
              style={styles.roomCard}
              onPress={() => handleJoinRoom(room)}
            >
              <Card.Content>
                <View style={styles.roomHeader}>
                  <Avatar.Icon
                    size={50}
                    icon="music-note"
                    style={styles.roomAvatar}
                  />
                  <View style={styles.roomInfo}>
                    <Title style={styles.roomTitle}>{room.name}</Title>
                    {room.description && (
                      <Paragraph style={styles.roomDescription} numberOfLines={2}>
                        {room.description}
                      </Paragraph>
                    )}
                  </View>
                </View>
                <View style={styles.roomStats}>
                  {room.country && (
                    <Chip icon="map-marker" style={styles.statChip}>
                      {room.country}
                    </Chip>
                  )}
                  {room.follower_count !== undefined && (
                    <Chip icon="account-group" style={styles.statChip}>
                      {room.follower_count} followers
                    </Chip>
                  )}
                  {room.user_count !== undefined && (
                    <Chip icon="account-multiple" style={styles.statChip}>
                      {room.user_count} users
                    </Chip>
                  )}
                  {room.total_playtime_seconds !== undefined && room.total_playtime_seconds > 0 && (
                    <Chip icon="clock-outline" style={styles.statChip}>
                      {formatPlaytime(room.total_playtime_seconds)}
                    </Chip>
                  )}
                </View>
                <View style={styles.roomFooter}>
                  <Chip icon="public" style={styles.publicChip}>
                    Public
                  </Chip>
                  <Text style={styles.roomDate}>
                    {new Date(room.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Button
                  mode="contained"
                  onPress={() => handleJoinRoom(room)}
                  style={styles.joinButton}
                  icon="login"
                >
                  Join Room
                </Button>
              </Card.Content>
            </Card>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#667eea',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  searchbar: {
    margin: 16,
    marginBottom: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  filterButton: {
    flex: 1,
  },
  clearButton: {
    minWidth: 80,
  },
  filterCard: {
    margin: 16,
    marginTop: 0,
    marginBottom: 8,
  },
  filterTitle: {
    fontSize: 18,
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '500',
    width: 150,
  },
  filterInput: {
    flex: 1,
    height: 40,
  },
  countryButton: {
    flex: 1,
  },
  activeFiltersContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  activeFiltersLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    color: '#666',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    marginRight: 4,
    marginBottom: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  emptyCard: {
    margin: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    padding: 20,
  },
  scrollView: {
    flex: 1,
  },
  roomCard: {
    margin: 16,
    marginTop: 8,
    elevation: 2,
  },
  roomHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  roomAvatar: {
    backgroundColor: '#667eea',
  },
  roomInfo: {
    flex: 1,
    marginLeft: 12,
  },
  roomTitle: {
    fontSize: 18,
    marginBottom: 4,
  },
  roomDescription: {
    fontSize: 14,
    color: '#666',
  },
  roomStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 8,
  },
  statChip: {
    height: 28,
    marginRight: 4,
    marginBottom: 4,
  },
  roomFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  publicChip: {
    height: 28,
  },
  roomDate: {
    fontSize: 12,
    color: '#999',
  },
  joinButton: {
    marginTop: 8,
  },
});

export default DiscoveryScreen;
