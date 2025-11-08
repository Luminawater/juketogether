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
  Searchbar,
  Avatar,
  Chip,
  Divider,
  Portal,
  Dialog,
  TextInput,
  RadioButton,
  DataTable,
  useTheme,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { UserRole, SubscriptionTier } from '../types';
import { getRoleDisplayName, getTierDisplayName, getRoleColor, getTierColor } from '../utils/permissions';

type AdminScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Admin'>;

interface UserProfile {
  id: string;
  email: string;
  username?: string;
  display_name?: string;
  role: UserRole;
  subscription_tier: SubscriptionTier;
  songs_played_count: number;
  created_at: string;
  avatar_url?: string;
}

interface Payment {
  id: string;
  tier: SubscriptionTier;
  amount_paid: number;
  payment_date: string;
  payment_provider?: string;
}

interface UsageHistory {
  date: string;
  songs_played: number;
  rooms_created: number;
}

const AdminScreen: React.FC = () => {
  const navigation = useNavigation<AdminScreenNavigationProp>();
  const { supabase, profile, refreshProfile } = useAuth();
  const theme = useTheme();

  const [activeTab, setActiveTab] = useState(0);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userDialogVisible, setUserDialogVisible] = useState(false);
  
  // User editing state
  const [editingUsername, setEditingUsername] = useState('');
  const [editingDisplayName, setEditingDisplayName] = useState('');
  const [editingRole, setEditingRole] = useState<UserRole>('user');
  const [editingTier, setEditingTier] = useState<SubscriptionTier>('free');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [usageHistory, setUsageHistory] = useState<UsageHistory[]>([]);
  const [loadingUserData, setLoadingUserData] = useState(false);
  const [userDialogTab, setUserDialogTab] = useState<'general' | 'role' | 'subscription' | 'activity'>('general');
  
  // Activity data
  const [activityData, setActivityData] = useState({
    roomsCreated: 0,
    friendsAdded: 0,
    friendsAccepted: 0,
    likes: 0,
    dislikes: 0,
    fantastic: 0,
    queueAdditions: 0,
    tracksPlayed: 0,
    roomsJoined: 0,
  });

  useEffect(() => {
    if (profile?.role !== 'admin') {
      Alert.alert('Access Denied', 'Only administrators can access this screen.');
      navigation.goBack();
      return;
    }
    if (activeTab === 0) {
      loadUsers();
    }
  }, [profile, activeTab]);

  useEffect(() => {
    filterUsers();
  }, [searchQuery, users]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      
      // Try to get all users with emails using RPC function (for admins)
      const { data: usersData, error: rpcError } = await supabase
        .rpc('get_all_users_for_admin');

      if (!rpcError && usersData) {
        // Successfully got users with emails from RPC function
        const usersWithEmails: UserProfile[] = usersData.map((u: any) => ({
          id: u.id,
          email: u.email || `user_${u.id.substring(0, 8)}@jukebox.app`,
          username: u.username,
          display_name: u.display_name,
          role: u.role || 'user',
          subscription_tier: u.subscription_tier || 'free',
          songs_played_count: u.songs_played_count || 0,
          created_at: u.created_at || '',
          avatar_url: u.avatar_url,
        }));

        setUsers(usersWithEmails);
        setFilteredUsers(usersWithEmails);
      } else {
        // Fallback: Get all profiles if RPC fails
        console.warn('RPC function failed, falling back to profiles:', rpcError);
        const { data: profiles, error: profilesError } = await supabase
          .from('user_profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (profilesError) throw profilesError;

        // Map profiles to user profiles
        const usersWithProfiles: UserProfile[] = (profiles || []).map((p) => ({
          id: p.id,
          email: `user_${p.id.substring(0, 8)}@jukebox.app`, // Placeholder
          username: p.username,
          display_name: p.display_name,
          role: p.role || 'user',
          subscription_tier: p.subscription_tier || 'free',
          songs_played_count: p.songs_played_count || 0,
          created_at: p.created_at || '',
          avatar_url: p.avatar_url,
        }));

        setUsers(usersWithProfiles);
        setFilteredUsers(usersWithProfiles);
      }
    } catch (error: any) {
      console.error('Error loading users:', error);
      Alert.alert('Error', `Failed to load users: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterUsers = () => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = users.filter(
      (user) =>
        user.email.toLowerCase().includes(query) ||
        user.username?.toLowerCase().includes(query) ||
        user.display_name?.toLowerCase().includes(query)
    );
    setFilteredUsers(filtered);
  };

  const handleUserClick = async (user: UserProfile) => {
    setSelectedUser(user);
    setEditingUsername(user.username || '');
    setEditingDisplayName(user.display_name || '');
    setEditingRole(user.role);
    setEditingTier(user.subscription_tier);
    setUserDialogTab('general'); // Reset to general tab
    setUserDialogVisible(true);
    await loadUserData(user.id);
  };

  const loadUserData = async (userId: string) => {
    setLoadingUserData(true);
    try {
      // Load payment history
      const { data: paymentData, error: paymentError } = await supabase
        .from('subscription_payments')
        .select('*')
        .eq('user_id', userId)
        .order('payment_date', { ascending: false });

      if (!paymentError && paymentData) {
        setPayments(paymentData.map((p: any) => ({
          id: p.id,
          tier: p.tier,
          amount_paid: parseFloat(p.amount_paid),
          payment_date: p.payment_date,
          payment_provider: p.payment_provider,
        })));
      }

      // Load activity data
      const [
        roomsCreatedResult,
        friendsResult,
        reactionsResult,
        tracksPlayedResult,
        roomsJoinedResult,
        queueAdditionsResult,
      ] = await Promise.all([
        // Rooms created (where user is host)
        supabase
          .from('rooms')
          .select('id')
          .eq('host_user_id', userId),
        
        // Friends (both sent and received)
        supabase
          .from('friends')
          .select('*')
          .or(`user_id.eq.${userId},friend_id.eq.${userId}`),
        
        // Track reactions
        supabase
          .from('track_reactions')
          .select('reaction_type')
          .eq('user_id', userId),
        
        // Tracks played (where user added the track)
        supabase
          .from('track_plays')
          .select('id')
          .eq('user_id', userId),
        
        // Rooms joined (sessions)
        supabase
          .from('room_sessions')
          .select('id')
          .eq('user_id', userId),
        
        // Queue additions - count tracks in queue JSONB where addedBy matches
        // This is approximate - we'll count from room analytics or track_plays
        supabase
          .from('track_plays')
          .select('id')
          .eq('user_id', userId),
      ]);

      // Calculate activity metrics
      const roomsCreated = roomsCreatedResult.data?.length || 0;
      const friends = friendsResult.data || [];
      // Friends added: where user sent the request (requested_by = userId)
      const friendsAdded = friends.filter(f => f.requested_by === userId).length;
      // Friends accepted: where user accepted a request (friend_id = userId and status = 'accepted')
      const friendsAccepted = friends.filter(f => f.friend_id === userId && f.status === 'accepted').length;
      
      const reactions = reactionsResult.data || [];
      const likes = reactions.filter(r => r.reaction_type === 'like').length;
      const dislikes = reactions.filter(r => r.reaction_type === 'dislike').length;
      const fantastic = reactions.filter(r => r.reaction_type === 'fantastic').length;
      
      const tracksPlayed = tracksPlayedResult.data?.length || 0;
      const roomsJoined = roomsJoinedResult.data?.length || 0;
      const queueAdditions = queueAdditionsResult.data?.length || 0; // Approximate

      setActivityData({
        roomsCreated,
        friendsAdded,
        friendsAccepted,
        likes,
        dislikes,
        fantastic,
        queueAdditions,
        tracksPlayed,
        roomsJoined,
      });

      // Load usage history
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('songs_played_count, created_at')
        .eq('id', userId)
        .single();

      if (profileData) {
        setUsageHistory([{
          date: new Date().toISOString().split('T')[0],
          songs_played: profileData.songs_played_count || 0,
          rooms_created: roomsCreated,
        }]);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoadingUserData(false);
    }
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;

    try {
      // Update user profile
      const updates: any = {
        username: editingUsername || null,
        display_name: editingDisplayName || null,
        role: editingRole,
        subscription_tier: editingTier,
        updated_at: new Date().toISOString(),
      };

      // If tier changed, reset songs played count
      if (editingTier !== selectedUser.subscription_tier) {
        updates.songs_played_count = 0;
        updates.subscription_updated_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', selectedUser.id);

      if (updateError) throw updateError;

      Alert.alert('Success', 'User updated successfully');
      setUserDialogVisible(false);
      setSelectedUser(null);
      await loadUsers();
      await refreshProfile();
    } catch (error: any) {
      console.error('Error updating user:', error);
      Alert.alert('Error', error.message || 'Failed to update user');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const renderUsersTab = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search users by email, username..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
        {!loading && (
          <Text style={[styles.userCount, { color: theme.colors.onSurfaceVariant }]}>
            {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
            {searchQuery && filteredUsers.length !== users.length && ` of ${users.length} total`}
          </Text>
        )}
      </View>

      {loading ? (
        <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>Loading users...</Text>
      ) : filteredUsers.length === 0 ? (
        <Card style={[styles.emptyCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>No users found</Text>
          </Card.Content>
        </Card>
      ) : (
        filteredUsers.map((user) => (
          <Card
            key={user.id}
            style={[styles.userCard, { backgroundColor: theme.colors.surface }]}
            onPress={() => handleUserClick(user)}
          >
            <Card.Content>
              <View style={styles.userHeader}>
                <Avatar.Image
                  size={50}
                  source={{
                    uri: user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=667eea&color=fff`
                  }}
                />
                <View style={styles.userInfo}>
                  <Text style={[styles.userEmail, { color: theme.colors.onSurface }]}>{user.email}</Text>
                  {user.username && (
                    <Text style={[styles.userName, { color: theme.colors.onSurfaceVariant }]}>@{user.username}</Text>
                  )}
                  {user.display_name && (
                    <Text style={[styles.userDisplayName, { color: theme.colors.onSurfaceVariant }]}>{user.display_name}</Text>
                  )}
                </View>
              </View>

              <View style={styles.userBadges}>
                <Chip
                  style={[styles.badge, { backgroundColor: getRoleColor(user.role) }]}
                  textStyle={styles.badgeText}
                >
                  {getRoleDisplayName(user.role)}
                </Chip>
                <Chip
                  style={[styles.badge, { backgroundColor: getTierColor(user.subscription_tier) }]}
                  textStyle={styles.badgeText}
                >
                  {getTierDisplayName(user.subscription_tier)}
                </Chip>
              </View>

              <View style={styles.userStats}>
                <Text style={[styles.statText, { color: theme.colors.onSurfaceVariant }]}>
                  Songs played: {user.songs_played_count}
                </Text>
                <Text style={[styles.statText, { color: theme.colors.onSurfaceVariant }]}>
                  Joined: {new Date(user.created_at).toLocaleDateString()}
                </Text>
              </View>
            </Card.Content>
          </Card>
        ))
      )}
    </ScrollView>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <Title style={[styles.title, { color: theme.colors.onSurface }]}>Admin Panel</Title>
        <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>Manage users and system settings</Text>
      </View>

      <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.outline }]}>
        <Button
          mode={activeTab === 0 ? 'contained' : 'outlined'}
          onPress={() => setActiveTab(0)}
          style={styles.tabButton}
          icon="account-group"
        >
          Users
        </Button>
        <Button
          mode={activeTab === 1 ? 'contained' : 'outlined'}
          onPress={() => setActiveTab(1)}
          style={styles.tabButton}
          icon="cog"
        >
          Settings
        </Button>
      </View>

      {activeTab === 0 && renderUsersTab()}
      {activeTab === 1 && (
        <ScrollView style={styles.tabContent}>
          <Card style={[styles.settingsCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <Title style={{ color: theme.colors.onSurface }}>System Settings</Title>
              <Text style={{ color: theme.colors.onSurfaceVariant }}>Settings coming soon...</Text>
            </Card.Content>
          </Card>
        </ScrollView>
      )}

      {/* User Detail Dialog */}
      <Portal>
        <Dialog
          visible={userDialogVisible}
          onDismiss={() => setUserDialogVisible(false)}
          style={styles.dialog}
        >
          <Dialog.Title>{selectedUser?.email || 'User Details'}</Dialog.Title>
          
          {/* Tabs */}
          <View style={[styles.dialogTabs, { borderBottomColor: theme.colors.outline }]}>
            <Button
              mode={userDialogTab === 'general' ? 'contained' : 'text'}
              onPress={() => setUserDialogTab('general')}
              style={styles.dialogTabButton}
              compact
            >
              General
            </Button>
            <Button
              mode={userDialogTab === 'role' ? 'contained' : 'text'}
              onPress={() => setUserDialogTab('role')}
              style={styles.dialogTabButton}
              compact
            >
              Role
            </Button>
            <Button
              mode={userDialogTab === 'subscription' ? 'contained' : 'text'}
              onPress={() => setUserDialogTab('subscription')}
              style={styles.dialogTabButton}
              compact
            >
              Subscription
            </Button>
            <Button
              mode={userDialogTab === 'activity' ? 'contained' : 'text'}
              onPress={() => setUserDialogTab('activity')}
              style={styles.dialogTabButton}
              compact
            >
              Activity
            </Button>
          </View>

          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView>
              <Dialog.Content>
                {selectedUser && (
                  <>
                    {/* General Tab */}
                    {userDialogTab === 'general' && (
                      <View style={styles.dialogSection}>
                        <Title style={styles.sectionTitle}>User Information</Title>
                        
                        <TextInput
                          label="Email"
                          value={selectedUser.email}
                          mode="outlined"
                          editable={false}
                          style={styles.dialogInput}
                        />

                        <TextInput
                          label="Username"
                          value={editingUsername}
                          onChangeText={setEditingUsername}
                          mode="outlined"
                          style={styles.dialogInput}
                        />

                        <TextInput
                          label="Display Name"
                          value={editingDisplayName}
                          onChangeText={setEditingDisplayName}
                          mode="outlined"
                          style={styles.dialogInput}
                        />

                        <View style={[styles.infoCard, { backgroundColor: theme.colors.surfaceVariant }]}>
                          <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>
                            User ID
                          </Text>
                          <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>
                            {selectedUser.id}
                          </Text>
                        </View>

                        <View style={[styles.infoCard, { backgroundColor: theme.colors.surfaceVariant }]}>
                          <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>
                            Joined
                          </Text>
                          <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>
                            {new Date(selectedUser.created_at).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Role Tab */}
                    {userDialogTab === 'role' && (
                      <View style={styles.dialogSection}>
                        <Title style={styles.sectionTitle}>User Role</Title>
                        <Text style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}>
                          Change the user's role to grant different permissions
                        </Text>
                        
                        <RadioButton.Group
                          onValueChange={(value) => setEditingRole(value as UserRole)}
                          value={editingRole}
                        >
                          <View style={styles.radioOption}>
                            <RadioButton value="guest" />
                            <Text style={{ color: theme.colors.onSurface }}>Guest - Limited access</Text>
                          </View>
                          <View style={styles.radioOption}>
                            <RadioButton value="user" />
                            <Text style={{ color: theme.colors.onSurface }}>User - Standard access</Text>
                          </View>
                          <View style={styles.radioOption}>
                            <RadioButton value="moderator" />
                            <Text style={{ color: theme.colors.onSurface }}>Moderator - Can moderate content</Text>
                          </View>
                          <View style={styles.radioOption}>
                            <RadioButton value="admin" />
                            <Text style={{ color: theme.colors.onSurface }}>Admin - Full access</Text>
                          </View>
                        </RadioButton.Group>
                      </View>
                    )}

                    {/* Subscription Tab */}
                    {userDialogTab === 'subscription' && (
                      <View style={styles.dialogSection}>
                        <Title style={styles.sectionTitle}>Subscription Tier</Title>
                        <Text style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}>
                          Change the user's subscription tier
                        </Text>
                        
                        <RadioButton.Group
                          onValueChange={(value) => setEditingTier(value as SubscriptionTier)}
                          value={editingTier}
                        >
                          <View style={styles.radioOption}>
                            <RadioButton value="free" />
                            <Text style={{ color: theme.colors.onSurface }}>Free - 1 song limit</Text>
                          </View>
                          <View style={styles.radioOption}>
                            <RadioButton value="rookie" />
                            <Text style={{ color: theme.colors.onSurface }}>Rookie ($2) - 10 songs</Text>
                          </View>
                          <View style={styles.radioOption}>
                            <RadioButton value="standard" />
                            <Text style={{ color: theme.colors.onSurface }}>Standard ($5) - Unlimited</Text>
                          </View>
                          <View style={styles.radioOption}>
                            <RadioButton value="pro" />
                            <Text style={{ color: theme.colors.onSurface }}>Pro ($10) - Unlimited + Premium</Text>
                          </View>
                        </RadioButton.Group>

                        <Divider style={styles.divider} />

                        <Title style={styles.sectionTitle}>Payment History</Title>
                        {loadingUserData ? (
                          <Text style={{ color: theme.colors.onSurfaceVariant }}>Loading...</Text>
                        ) : payments.length === 0 ? (
                          <Text style={[styles.noDataText, { color: theme.colors.onSurfaceVariant }]}>
                            No payment history
                          </Text>
                        ) : (
                          <DataTable>
                            <DataTable.Header>
                              <DataTable.Title>Date</DataTable.Title>
                              <DataTable.Title>Tier</DataTable.Title>
                              <DataTable.Title numeric>Amount</DataTable.Title>
                            </DataTable.Header>
                            {payments.map((payment) => (
                              <DataTable.Row key={payment.id}>
                                <DataTable.Cell>
                                  {new Date(payment.payment_date).toLocaleDateString()}
                                </DataTable.Cell>
                                <DataTable.Cell>
                                  {getTierDisplayName(payment.tier)}
                                </DataTable.Cell>
                                <DataTable.Cell numeric>
                                  ${payment.amount_paid.toFixed(2)}
                                </DataTable.Cell>
                              </DataTable.Row>
                            ))}
                          </DataTable>
                        )}
                      </View>
                    )}

                    {/* Activity Tab */}
                    {userDialogTab === 'activity' && (
                      <View style={styles.dialogSection}>
                        <Title style={styles.sectionTitle}>User Activity</Title>
                        <Text style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}>
                          Comprehensive activity overview
                        </Text>

                        {loadingUserData ? (
                          <Text style={{ color: theme.colors.onSurfaceVariant }}>Loading activity...</Text>
                        ) : (
                          <>
                            {/* Rooms Activity */}
                            <View style={[styles.activitySection, { backgroundColor: theme.colors.surfaceVariant }]}>
                              <Text style={[styles.activitySectionTitle, { color: theme.colors.onSurface }]}>
                                🎵 Rooms
                              </Text>
                              <View style={styles.activityRow}>
                                <Text style={[styles.activityLabel, { color: theme.colors.onSurfaceVariant }]}>
                                  Rooms Created:
                                </Text>
                                <Text style={[styles.activityValue, { color: theme.colors.onSurface }]}>
                                  {activityData.roomsCreated}
                                </Text>
                              </View>
                              <View style={styles.activityRow}>
                                <Text style={[styles.activityLabel, { color: theme.colors.onSurfaceVariant }]}>
                                  Rooms Joined:
                                </Text>
                                <Text style={[styles.activityValue, { color: theme.colors.onSurface }]}>
                                  {activityData.roomsJoined}
                                </Text>
                              </View>
                            </View>

                            {/* Friends Activity */}
                            <View style={[styles.activitySection, { backgroundColor: theme.colors.surfaceVariant }]}>
                              <Text style={[styles.activitySectionTitle, { color: theme.colors.onSurface }]}>
                                👥 Friends
                              </Text>
                              <View style={styles.activityRow}>
                                <Text style={[styles.activityLabel, { color: theme.colors.onSurfaceVariant }]}>
                                  Friends Added:
                                </Text>
                                <Text style={[styles.activityValue, { color: theme.colors.onSurface }]}>
                                  {activityData.friendsAdded}
                                </Text>
                              </View>
                              <View style={styles.activityRow}>
                                <Text style={[styles.activityLabel, { color: theme.colors.onSurfaceVariant }]}>
                                  Friends Accepted:
                                </Text>
                                <Text style={[styles.activityValue, { color: theme.colors.onSurface }]}>
                                  {activityData.friendsAccepted}
                                </Text>
                              </View>
                            </View>

                            {/* Reactions Activity */}
                            <View style={[styles.activitySection, { backgroundColor: theme.colors.surfaceVariant }]}>
                              <Text style={[styles.activitySectionTitle, { color: theme.colors.onSurface }]}>
                                ⭐ Reactions
                              </Text>
                              <View style={styles.activityRow}>
                                <Text style={[styles.activityLabel, { color: theme.colors.onSurfaceVariant }]}>
                                  👍 Likes:
                                </Text>
                                <Text style={[styles.activityValue, { color: theme.colors.onSurface }]}>
                                  {activityData.likes}
                                </Text>
                              </View>
                              <View style={styles.activityRow}>
                                <Text style={[styles.activityLabel, { color: theme.colors.onSurfaceVariant }]}>
                                  👎 Dislikes:
                                </Text>
                                <Text style={[styles.activityValue, { color: theme.colors.onSurface }]}>
                                  {activityData.dislikes}
                                </Text>
                              </View>
                              <View style={styles.activityRow}>
                                <Text style={[styles.activityLabel, { color: theme.colors.onSurfaceVariant }]}>
                                  ⭐ Fantastic:
                                </Text>
                                <Text style={[styles.activityValue, { color: theme.colors.onSurface }]}>
                                  {activityData.fantastic}
                                </Text>
                              </View>
                            </View>

                            {/* Queue & Tracks Activity */}
                            <View style={[styles.activitySection, { backgroundColor: theme.colors.surfaceVariant }]}>
                              <Text style={[styles.activitySectionTitle, { color: theme.colors.onSurface }]}>
                                🎶 Music
                              </Text>
                              <View style={styles.activityRow}>
                                <Text style={[styles.activityLabel, { color: theme.colors.onSurfaceVariant }]}>
                                  Queue Additions:
                                </Text>
                                <Text style={[styles.activityValue, { color: theme.colors.onSurface }]}>
                                  {activityData.queueAdditions}
                                </Text>
                              </View>
                              <View style={styles.activityRow}>
                                <Text style={[styles.activityLabel, { color: theme.colors.onSurfaceVariant }]}>
                                  Tracks Played:
                                </Text>
                                <Text style={[styles.activityValue, { color: theme.colors.onSurface }]}>
                                  {activityData.tracksPlayed}
                                </Text>
                              </View>
                            </View>
                          </>
                        )}
                      </View>
                    )}
                  </>
                )}
              </Dialog.Content>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setUserDialogVisible(false)}>Close</Button>
            {(userDialogTab === 'general' || userDialogTab === 'role' || userDialogTab === 'subscription') && (
              <Button onPress={handleSaveUser} mode="contained">
                Save Changes
              </Button>
            )}
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    borderBottomWidth: 1,
    elevation: 1,
  },
  tabButton: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchbar: {
    marginBottom: 8,
  },
  userCount: {
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  loadingText: {
    textAlign: 'center',
    padding: 20,
  },
  emptyCard: {
    margin: 16,
    borderRadius: 16,
    elevation: 2,
  },
  emptyText: {
    textAlign: 'center',
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
    marginBottom: 12,
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userEmail: {
    fontSize: 18,
    fontWeight: '600',
  },
  userName: {
    fontSize: 14,
  },
  userDisplayName: {
    fontSize: 14,
  },
  userBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    height: 28,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  userStats: {
    marginBottom: 12,
  },
  statText: {
    fontSize: 12,
    marginBottom: 4,
  },
  settingsCard: {
    margin: 16,
    borderRadius: 16,
    elevation: 2,
  },
  dialog: {
    maxHeight: '90%',
  },
  dialogScrollArea: {
    paddingHorizontal: 0,
  },
  dialogSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 12,
  },
  dialogInput: {
    marginBottom: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  divider: {
    marginVertical: 16,
  },
  noDataText: {
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  usageItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  usageDate: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  usageText: {
    fontSize: 12,
    marginBottom: 2,
  },
  dialogTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  dialogTabButton: {
    flex: 1,
    minWidth: 0,
  },
  infoCard: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionDescription: {
    fontSize: 13,
    marginBottom: 16,
  },
  activitySection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  activitySectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityLabel: {
    fontSize: 14,
    flex: 1,
  },
  activityValue: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AdminScreen;
