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
      // Get all profiles - email will be shown as user ID if not available
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Map profiles to user profiles
      // Note: Email from auth.users requires admin access, so we'll use ID as identifier
      const usersWithProfiles: UserProfile[] = (profiles || []).map((p) => ({
        id: p.id,
        email: `user_${p.id.substring(0, 8)}@jukebox.app`, // Placeholder - you can add email to user_profiles table
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
    } catch (error: any) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'Failed to load users');
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

      // Load usage history (simplified - you can expand this)
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('songs_played_count, created_at')
        .eq('id', userId)
        .single();

      if (profileData) {
        setUsageHistory([{
          date: new Date().toISOString().split('T')[0],
          songs_played: profileData.songs_played_count || 0,
          rooms_created: 0, // You can add room creation tracking later
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
      <Searchbar
        placeholder="Search users by email, username..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

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
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView>
              <Dialog.Title>User Details</Dialog.Title>
              <Dialog.Content>
                {selectedUser && (
                  <>
                    {/* User Info Section */}
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
                    </View>

                    <Divider style={styles.divider} />

                    {/* Role Section */}
                    <View style={styles.dialogSection}>
                      <Title style={styles.sectionTitle}>Role</Title>
                      <RadioButton.Group
                        onValueChange={(value) => setEditingRole(value as UserRole)}
                        value={editingRole}
                      >
                        <View style={styles.radioOption}>
                          <RadioButton value="user" />
                          <Text>User</Text>
                        </View>
                        <View style={styles.radioOption}>
                          <RadioButton value="moderator" />
                          <Text>Moderator</Text>
                        </View>
                        <View style={styles.radioOption}>
                          <RadioButton value="admin" />
                          <Text>Admin</Text>
                        </View>
                      </RadioButton.Group>
                    </View>

                    <Divider style={styles.divider} />

                    {/* Tier Section */}
                    <View style={styles.dialogSection}>
                      <Title style={styles.sectionTitle}>Subscription Tier</Title>
                      <RadioButton.Group
                        onValueChange={(value) => setEditingTier(value as SubscriptionTier)}
                        value={editingTier}
                      >
                        <View style={styles.radioOption}>
                          <RadioButton value="free" />
                          <Text>Free (1 song)</Text>
                        </View>
                        <View style={styles.radioOption}>
                          <RadioButton value="standard" />
                          <Text>Standard ($2, 10 songs)</Text>
                        </View>
                        <View style={styles.radioOption}>
                          <RadioButton value="pro" />
                          <Text>Pro ($5, unlimited)</Text>
                        </View>
                      </RadioButton.Group>
                    </View>

                    <Divider style={styles.divider} />

                    {/* Payment History */}
                    <View style={styles.dialogSection}>
                      <Title style={styles.sectionTitle}>Payment History</Title>
                      {loadingUserData ? (
                        <Text>Loading...</Text>
                      ) : payments.length === 0 ? (
                        <Text style={[styles.noDataText, { color: theme.colors.onSurfaceVariant }]}>No payment history</Text>
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

                    <Divider style={styles.divider} />

                    {/* Usage History */}
                    <View style={styles.dialogSection}>
                      <Title style={styles.sectionTitle}>Usage History</Title>
                      {loadingUserData ? (
                        <Text>Loading...</Text>
                      ) : usageHistory.length === 0 ? (
                        <Text style={[styles.noDataText, { color: theme.colors.onSurfaceVariant }]}>No usage history</Text>
                      ) : (
                        <View>
                          {usageHistory.map((usage, index) => (
                            <View key={index} style={[styles.usageItem, { backgroundColor: theme.colors.surfaceVariant }]}>
                              <Text style={[styles.usageDate, { color: theme.colors.onSurface }]}>
                                {new Date(usage.date).toLocaleDateString()}
                              </Text>
                              <Text style={[styles.usageText, { color: theme.colors.onSurfaceVariant }]}>
                                Songs played: {usage.songs_played}
                              </Text>
                              <Text style={[styles.usageText, { color: theme.colors.onSurfaceVariant }]}>
                                Rooms created: {usage.rooms_created}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </>
                )}
              </Dialog.Content>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setUserDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleSaveUser}>Save Changes</Button>
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
  searchbar: {
    margin: 16,
    marginBottom: 8,
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
});

export default AdminScreen;
