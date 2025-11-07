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
  useTheme,
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
  const theme = useTheme();

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
      
      // Celebrate following a user (room creator)! 🎉
      // Note: Confetti would need to be added here if we add it to this screen
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
        <Card style={[styles.emptyCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
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
      <Card key={userItem.id} style={[styles.userCard, { backgroundColor: theme.colors.surface }]}>
        <Card.Content>
          <View style={styles.userHeader}>
            <Avatar.Image
              size={50}
              source={{
                uri: userItem.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userItem.username || userItem.id)}&background=667eea&color=fff`
              }}
            />
            <View style={styles.userInfo}>
              <Title style={[styles.userName, { color: theme.colors.onSurface }]}>
                {userItem.display_name || userItem.username || `User ${userItem.id.substring(0, 8)}`}
              </Title>
              {userItem.username && (
                <Paragraph style={[styles.userUsername, { color: theme.colors.onSurfaceVariant }]}>@{userItem.username}</Paragraph>
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
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <Title style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Friends</Title>
        <Paragraph style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          Connect with other music lovers
        </Paragraph>
      </View>

      <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface }]}>
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
          <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>Loading...</Text>
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
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 8,
    gap: 4,
    elevation: 1,
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
  },
  scrollView: {
    flex: 1,
  },
  emptyCard: {
    margin: 16,
    borderRadius: 16,
    elevation: 2,
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
  },
  userCard: {
    margin: 16,
    marginTop: 8,
    borderRadius: 16,
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
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  userUsername: {
    fontSize: 14,
  },
  followButton: {
    marginTop: 12,
  },
});

export default FriendsScreen;

