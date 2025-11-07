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
  Tabs,
  Tab,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';

type FriendsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Friends'>;

interface User {
  id: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  is_following?: boolean;
  is_follower?: boolean;
}

const FriendsScreen: React.FC = () => {
  const navigation = useNavigation<FriendsScreenNavigationProp>();
  const { supabase, user, profile } = useAuth();

  const [activeTab, setActiveTab] = useState(0);
  const [friends, setFriends] = useState<User[]>([]);
  const [following, setFollowing] = useState<User[]>([]);
  const [followers, setFollowers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      loadFriendsData();
    }
  }, [user, activeTab]);

  const loadFriendsData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadFriends(),
        loadFollowing(),
        loadFollowers(),
        loadAllUsers(),
      ]);
    } catch (error) {
      console.error('Error loading friends data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadFriends = async () => {
    try {
      // Get mutual follows (friends)
      const { data, error } = await supabase.rpc('get_user_friends', {
        user_uuid: user?.id,
      });

      if (error) throw error;
      setFriends((data || []) as User[]);
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  };

  const loadFollowing = async () => {
    try {
      const { data, error } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', user?.id);

      if (error) throw error;

      const followingIds = (data || []).map((item: any) => item.following_id);
      if (followingIds.length === 0) {
        setFollowing([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', followingIds);

      if (profilesError) throw profilesError;
      setFollowing((profiles || []).map((p) => ({ ...p, is_following: true })));
    } catch (error) {
      console.error('Error loading following:', error);
    }
  };

  const loadFollowers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_follows')
        .select('follower_id')
        .eq('following_id', user?.id);

      if (error) throw error;

      const followerIds = (data || []).map((item: any) => item.follower_id);
      if (followerIds.length === 0) {
        setFollowers([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', followerIds);

      if (profilesError) throw profilesError;
      setFollowers((profiles || []).map((p) => ({ ...p, is_follower: true })));
    } catch (error) {
      console.error('Error loading followers:', error);
    }
  };

  const loadAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url')
        .neq('id', user?.id)
        .limit(100);

      if (error) throw error;

      // Check which users are being followed
      const { data: followsData } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', user?.id);

      const followingIds = new Set((followsData || []).map(f => f.following_id));

      const usersWithFollowStatus = (data || []).map((u) => ({
        ...u,
        is_following: followingIds.has(u.id),
      }));

      setAllUsers(usersWithFollowStatus);
    } catch (error) {
      console.error('Error loading all users:', error);
    }
  };

  const handleFollow = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_follows')
        .insert({
          follower_id: user?.id,
          following_id: userId,
        });

      if (error) throw error;
      await loadFriendsData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to follow user');
    }
  };

  const handleUnfollow = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', user?.id)
        .eq('following_id', userId);

      if (error) throw error;
      await loadFriendsData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to unfollow user');
    }
  };

  const getCurrentUsers = () => {
    switch (activeTab) {
      case 0:
        return friends;
      case 1:
        return following;
      case 2:
        return followers;
      case 3:
        return allUsers.filter(
          (u) =>
            !searchQuery ||
            u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      default:
        return [];
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadFriendsData();
  };

  const renderUserList = (users: User[]) => {
    if (users.length === 0) {
      return (
        <Card style={styles.emptyCard}>
          <Card.Content>
            <Text style={styles.emptyText}>
              {activeTab === 0 && 'No friends yet'}
              {activeTab === 1 && 'Not following anyone'}
              {activeTab === 2 && 'No followers yet'}
              {activeTab === 3 && 'No users found'}
            </Text>
          </Card.Content>
        </Card>
      );
    }

    return users.map((userItem) => (
      <Card key={userItem.id} style={styles.userCard}>
        <Card.Content>
          <View style={styles.userHeader}>
            <Avatar.Image
              size={50}
              source={{
                uri: userItem.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userItem.username || userItem.id)}&background=667eea&color=fff`
              }}
            />
            <View style={styles.userInfo}>
              <Title style={styles.userName}>
                {userItem.display_name || userItem.username || `User ${userItem.id.substring(0, 8)}`}
              </Title>
              {userItem.username && (
                <Paragraph style={styles.userUsername}>@{userItem.username}</Paragraph>
              )}
            </View>
          </View>
          {activeTab === 3 && (
            <Button
              mode={userItem.is_following ? 'outlined' : 'contained'}
              onPress={() =>
                userItem.is_following
                  ? handleUnfollow(userItem.id)
                  : handleFollow(userItem.id)
              }
              style={styles.followButton}
            >
              {userItem.is_following ? 'Unfollow' : 'Follow'}
            </Button>
          )}
        </Card.Content>
      </Card>
    ));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Title style={styles.headerTitle}>Friends</Title>
        <Paragraph style={styles.headerSubtitle}>
          Connect with other music lovers
        </Paragraph>
      </View>

      <View style={styles.tabContainer}>
        <Button
          mode={activeTab === 0 ? 'contained' : 'outlined'}
          onPress={() => setActiveTab(0)}
          style={styles.tabButton}
          compact
        >
          Friends
        </Button>
        <Button
          mode={activeTab === 1 ? 'contained' : 'outlined'}
          onPress={() => setActiveTab(1)}
          style={styles.tabButton}
          compact
        >
          Following
        </Button>
        <Button
          mode={activeTab === 2 ? 'contained' : 'outlined'}
          onPress={() => setActiveTab(2)}
          style={styles.tabButton}
          compact
        >
          Followers
        </Button>
        <Button
          mode={activeTab === 3 ? 'contained' : 'outlined'}
          onPress={() => setActiveTab(3)}
          style={styles.tabButton}
          compact
        >
          Discover
        </Button>
      </View>

      {activeTab === 3 && (
        <Searchbar
          placeholder="Search users..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {renderUserList(getCurrentUsers())}
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
  tabContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#fff',
    gap: 4,
  },
  tabButton: {
    flex: 1,
  },
  searchbar: {
    margin: 16,
    marginBottom: 8,
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
  scrollView: {
    flex: 1,
  },
  emptyCard: {
    margin: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    padding: 20,
  },
  userCard: {
    margin: 16,
    marginTop: 8,
    elevation: 2,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    marginBottom: 4,
  },
  userUsername: {
    fontSize: 14,
    color: '#666',
  },
  followButton: {
    marginTop: 12,
  },
});

export default FriendsScreen;

