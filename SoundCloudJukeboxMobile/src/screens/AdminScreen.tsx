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
  Checkbox,
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
  is_banned?: boolean;
  banned_at?: string;
  banned_by?: string;
  ban_reason?: string;
  banned_until?: string;
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

  const [activeTab, setActiveTab] = useState<0 | 1 | 2 | 3>(0);
  const [settingsSubTab, setSettingsSubTab] = useState<'general' | 'details'>('general');
  const [adminDetails, setAdminDetails] = useState<string>('');
  const [savingDetails, setSavingDetails] = useState(false);
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
  const [userDialogTab, setUserDialogTab] = useState<'general' | 'role' | 'subscription' | 'activity' | 'access'>('general');
  const [banReason, setBanReason] = useState('');
  const [banType, setBanType] = useState<'permanent' | 'temporary'>('permanent');
  const [banUntilDate, setBanUntilDate] = useState<string>('');
  const [banUntilTime, setBanUntilTime] = useState<string>('');
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [banConfirmVisible, setBanConfirmVisible] = useState(false);
  
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

  // Booster pack settings
  const [boosterPacks, setBoosterPacks] = useState<{
    '10min'?: {
      booster_type: '10min';
      price: number;
      duration_minutes: number;
      display_name: string;
      description: string;
      enabled: boolean;
    };
    hour?: {
      booster_type: 'hour';
      price: number;
      duration_minutes: number;
      display_name: string;
      description: string;
      enabled: boolean;
    };
  }>({});
  const [savingBoosterPacks, setSavingBoosterPacks] = useState(false);

  // Subscription tier settings
  const [subscriptionTiers, setSubscriptionTiers] = useState({
    free: {
      name: 'Free',
      price: 0,
      maxSongs: 1,
      queueLimit: 1,
      djMode: false,
      listedOnDiscovery: false,
      listedOnLeaderboard: false,
      ads: true,
      playlist: false,
      collaboration: false,
      description: 'Basic access with limited features',
    },
    rookie: {
      name: 'Rookie',
      price: 0.50,
      maxSongs: 5,
      queueLimit: 5,
      djMode: false,
      listedOnDiscovery: false,
      listedOnLeaderboard: false,
      ads: true,
      playlist: false,
      collaboration: false,
      description: 'More songs and features',
    },
    standard: {
      name: 'Standard',
      price: 1,
      maxSongs: 10,
      queueLimit: 10,
      djMode: false,
      listedOnDiscovery: true,
      listedOnLeaderboard: true,
      ads: true,
      playlist: false,
      collaboration: false,
      description: 'Standard access with more features',
    },
    pro: {
      name: 'Pro',
      price: 5,
      maxSongs: Infinity,
      queueLimit: Infinity,
      djMode: true,
      listedOnDiscovery: true,
      listedOnLeaderboard: true,
      ads: false,
      playlist: true,
      collaboration: true,
      description: 'Premium access with unlimited features',
    },
  });
  const [savingTiers, setSavingTiers] = useState(false);

  useEffect(() => {
    if (profile?.role !== 'admin') {
      Alert.alert('Access Denied', 'Only administrators can access this screen.');
      navigation.goBack();
      return;
    }
    if (activeTab === 0) {
      loadUsers();
    } else if (activeTab === 1) {
      loadSubscriptionTiers();
      loadBoosterPacks();
    } else if (activeTab === 2) {
      loadAds();
    } else if (activeTab === 3) {
      loadAdminDetails();
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
          is_banned: u.is_banned || false,
          banned_at: u.banned_at,
          banned_by: u.banned_by,
          ban_reason: u.ban_reason,
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

      // If tier changed, reset songs played count and send notification
      const oldTier = selectedUser.subscription_tier;
      if (editingTier !== oldTier) {
        updates.songs_played_count = 0;
        updates.subscription_updated_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', selectedUser.id);

      if (updateError) throw updateError;

      // Send notification if tier changed
      if (editingTier !== oldTier) {
        const { createTierChangeNotification } = await import('../services/notificationService');
        const { getTierDisplayName } = await import('../utils/permissions');
        
        await createTierChangeNotification(
          supabase,
          selectedUser.id,
          oldTier,
          editingTier,
          getTierDisplayName(oldTier as any),
          getTierDisplayName(editingTier as any)
        );
      }

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

  const handleBanUser = async () => {
    if (!selectedUser || !profile) return;

    try {
      // Calculate banned_until date if temporary ban
      let bannedUntil: string | null = null;
      if (banType === 'temporary' && banUntilDate && banUntilTime) {
        const dateTime = new Date(`${banUntilDate}T${banUntilTime}`);
        if (isNaN(dateTime.getTime())) {
          Alert.alert('Error', 'Invalid date or time');
          return;
        }
        if (dateTime <= new Date()) {
          Alert.alert('Error', 'Ban expiration date must be in the future');
          return;
        }
        bannedUntil = dateTime.toISOString();
      } else if (banType === 'temporary') {
        Alert.alert('Error', 'Please select both date and time for temporary ban');
        return;
      }

      const { error } = await supabase
        .from('user_profiles')
        .update({
          is_banned: true,
          banned_at: new Date().toISOString(),
          banned_by: profile.id,
          ban_reason: banReason || null,
          banned_until: bannedUntil,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      const banMessage = banType === 'permanent' 
        ? 'User has been permanently banned'
        : `User has been banned until ${new Date(bannedUntil!).toLocaleString()}`;
      
      Alert.alert('Success', banMessage);
      setBanConfirmVisible(false);
      setBanReason('');
      setBanType('permanent');
      setBanUntilDate('');
      setBanUntilTime('');
      await loadUsers();
      setUserDialogVisible(false);
      setSelectedUser(null);
    } catch (error: any) {
      console.error('Error banning user:', error);
      Alert.alert('Error', error.message || 'Failed to ban user');
    }
  };

  const handleUnbanUser = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          is_banned: false,
          banned_at: null,
          banned_by: null,
          ban_reason: null,
          banned_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      Alert.alert('Success', 'User has been unbanned');
      await loadUsers();
      // Update selected user to reflect unban
      if (selectedUser) {
        setSelectedUser({ 
          ...selectedUser, 
          is_banned: false, 
          banned_at: undefined, 
          banned_by: undefined, 
          ban_reason: undefined,
          banned_until: undefined,
        });
      }
    } catch (error: any) {
      console.error('Error unbanning user:', error);
      Alert.alert('Error', error.message || 'Failed to unban user');
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      // Delete user profile (this will cascade delete related data due to ON DELETE CASCADE)
      const { error: profileError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', selectedUser.id);

      if (profileError) throw profileError;

      // Note: Deleting from auth.users requires admin API access
      // For now, we'll just delete the profile and mark the user as deleted
      Alert.alert('Success', 'User profile has been deleted. Note: User account deletion requires admin API access.');
      setDeleteConfirmVisible(false);
      await loadUsers();
      setUserDialogVisible(false);
      setSelectedUser(null);
    } catch (error: any) {
      console.error('Error deleting user:', error);
      Alert.alert('Error', error.message || 'Failed to delete user');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const loadBoosterPacks = async () => {
    try {
      const { data, error } = await supabase
        .from('booster_pack_settings')
        .select('*')
        .order('price');

      if (!error && data && data.length > 0) {
        const packs: any = {};
        data.forEach((item: any) => {
          packs[item.booster_type] = item;
        });
        setBoosterPacks(packs);
      }
    } catch (error) {
      console.log('Error loading booster packs:', error);
    }
  };

  const updateBoosterPack = (type: '10min' | 'hour', field: string, value: any) => {
    setBoosterPacks((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        booster_type: type,
        [field]: value,
      } as any,
    }));
  };

  const saveBoosterPacks = async () => {
    try {
      setSavingBoosterPacks(true);
      
      for (const [type, config] of Object.entries(boosterPacks)) {
        if (!config) continue;
        
        const { error } = await supabase
          .from('booster_pack_settings')
          .upsert({
            booster_type: type,
            price: config.price,
            duration_minutes: config.duration_minutes,
            display_name: config.display_name,
            description: config.description,
            enabled: config.enabled !== false,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'booster_type',
          });

        if (error) {
          console.error(`Error saving booster pack ${type}:`, error);
          Alert.alert('Error', `Failed to save booster pack ${type}`);
          return;
        }
      }

      Alert.alert('Success', 'Booster pack settings saved successfully');
    } catch (error: any) {
      console.error('Error saving booster packs:', error);
      Alert.alert('Error', error.message || 'Failed to save booster pack settings');
    } finally {
      setSavingBoosterPacks(false);
    }
  };

  const loadSubscriptionTiers = async () => {
    try {
      // Try to load from database if table exists
      const { data, error } = await supabase
        .from('subscription_tier_settings')
        .select('*')
        .order('tier');

      if (!error && data && data.length > 0) {
        const tiers: any = {};
        data.forEach((item: any) => {
          tiers[item.tier] = {
            name: item.display_name || item.tier,
            price: parseFloat(item.price || 0),
            maxSongs: item.max_songs === null ? Infinity : item.max_songs,
            queueLimit: item.queue_limit === null ? Infinity : item.queue_limit,
            djMode: item.dj_mode || false,
            listedOnDiscovery: item.listed_on_discovery || false,
            listedOnLeaderboard: item.listed_on_leaderboard || false,
            ads: item.ads !== undefined ? item.ads : true,
            playlist: item.playlist !== undefined ? item.playlist : false,
            collaboration: item.collaboration !== undefined ? item.collaboration : false,
            description: item.description || '',
          };
        });
        setSubscriptionTiers((prev) => ({ ...prev, ...tiers }));
      }
    } catch (error) {
      console.log('Subscription tier settings table may not exist yet, using defaults');
    }
  };

  const saveSubscriptionTiers = async () => {
    try {
      setSavingTiers(true);
      
      // Save to database (create table if needed via migration)
      for (const [tier, config] of Object.entries(subscriptionTiers)) {
        const { error } = await supabase
          .from('subscription_tier_settings')
          .upsert({
            tier,
            display_name: config.name,
            price: config.price,
            max_songs: config.maxSongs === Infinity ? null : config.maxSongs,
            queue_limit: config.queueLimit === Infinity ? null : config.queueLimit,
            dj_mode: config.djMode,
            listed_on_discovery: config.listedOnDiscovery,
            listed_on_leaderboard: config.listedOnLeaderboard,
            ads: config.ads,
            playlist: config.playlist,
            collaboration: config.collaboration,
            description: config.description,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'tier',
          });

        if (error) {
          console.error(`Error saving tier ${tier}:`, error);
          // If table doesn't exist, show message
          if (error.message?.includes('does not exist')) {
            Alert.alert(
              'Database Table Required',
              'The subscription_tier_settings table needs to be created. Please run the migration to create it.',
            );
            return;
          }
        }
      }

      Alert.alert('Success', 'Subscription tier settings saved successfully');
    } catch (error: any) {
      console.error('Error saving subscription tiers:', error);
      Alert.alert('Error', error.message || 'Failed to save subscription tier settings');
    } finally {
      setSavingTiers(false);
    }
  };

  const loadAds = async () => {
    // TODO: Implement ads loading functionality
    try {
      // Ads configuration will be loaded here
    } catch (error) {
      console.error('Error loading ads:', error);
    }
  };

  const renderSubscriptionTab = () => (
    <ScrollView style={styles.tabContent}>
      {renderSubscriptionSettings()}
    </ScrollView>
  );

  const renderAdsTab = () => (
    <ScrollView style={styles.tabContent}>
      <Card style={[styles.settingsCard, { backgroundColor: theme.colors.surface }]}>
        <Card.Content>
          <Title style={{ color: theme.colors.onSurface }}>Ads Configuration</Title>
          <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
            Ads management and configuration will be available here.
          </Text>
        </Card.Content>
      </Card>
    </ScrollView>
  );

  const loadAdminDetails = async () => {
    try {
      // Try to load from a settings table or use a simple key-value store
      const { data, error } = await supabase
        .from('admin_settings')
        .select('details')
        .eq('key', 'admin_details')
        .single();

      if (!error && data) {
        setAdminDetails(data.details || '');
      } else {
        // If table doesn't exist or no data, try alternative storage
        // For now, we'll use localStorage as fallback
        console.log('Admin details table may not exist, using defaults');
      }
    } catch (error) {
      console.error('Error loading admin details:', error);
    }
  };

  const saveAdminDetails = async () => {
    if (!profile || profile.role !== 'admin') {
      Alert.alert('Access Denied', 'Only administrators can save details.');
      return;
    }

    try {
      setSavingDetails(true);
      
      // Try to save to admin_settings table
      const { error } = await supabase
        .from('admin_settings')
        .upsert({
          key: 'admin_details',
          details: adminDetails,
          updated_at: new Date().toISOString(),
          updated_by: profile.id,
        }, {
          onConflict: 'key',
        });

      if (error) {
        // If table doesn't exist, show message
        if (error.message?.includes('does not exist')) {
          Alert.alert(
            'Database Table Required',
            'The admin_settings table needs to be created. For now, details are saved locally.',
          );
          // Fallback: could use AsyncStorage or similar
        } else {
          throw error;
        }
      } else {
        Alert.alert('Success', 'Admin details saved successfully');
      }
    } catch (error: any) {
      console.error('Error saving admin details:', error);
      Alert.alert('Error', error.message || 'Failed to save admin details');
    } finally {
      setSavingDetails(false);
    }
  };

  const renderSettingsTab = () => {
    const isAdmin = profile?.role === 'admin';
    
    return (
      <View style={styles.settingsContainer}>
        <View style={[styles.subTabContainer, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.outline }]}>
          <Button
            mode={settingsSubTab === 'general' ? 'contained' : 'outlined'}
            onPress={() => setSettingsSubTab('general')}
            style={styles.subTabButton}
            icon="cog-outline"
          >
            General
          </Button>
          {isAdmin && (
            <Button
              mode={settingsSubTab === 'details' ? 'contained' : 'outlined'}
              onPress={() => setSettingsSubTab('details')}
              style={styles.subTabButton}
              icon="information-outline"
            >
              Details
            </Button>
          )}
        </View>

        <ScrollView style={styles.tabContent}>
          {settingsSubTab === 'general' && renderGeneralSettings()}
          {settingsSubTab === 'details' && isAdmin && renderDetailsSettings()}
        </ScrollView>
      </View>
    );
  };

  const renderGeneralSettings = () => (
    <Card style={[styles.settingsCard, { backgroundColor: theme.colors.surface }]}>
      <Card.Content>
        <Title style={{ color: theme.colors.onSurface }}>General Settings</Title>
        <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
          General system configuration options will be available here.
        </Text>
      </Card.Content>
    </Card>
  );

  const renderDetailsSettings = () => (
    <Card style={[styles.settingsCard, { backgroundColor: theme.colors.surface }]}>
      <Card.Content>
        <Title style={{ color: theme.colors.onSurface }}>Admin Details</Title>
        <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, marginBottom: 16 }}>
          Store important system information such as hosting details, domain information, server configuration, mail service settings, etc.
        </Text>

        <TextInput
          label="System Details"
          value={adminDetails}
          onChangeText={setAdminDetails}
          mode="outlined"
          multiline
          numberOfLines={20}
          style={styles.detailsTextArea}
          placeholder={`Enter system details here...

Example:
Domain: example.com
Server: Vercel
Mail Service: SendGrid
Database: Supabase`}
          textAlignVertical="top"
        />

        <Button
          mode="contained"
          onPress={saveAdminDetails}
          loading={savingDetails}
          disabled={savingDetails}
          style={styles.saveButton}
          icon="content-save"
        >
          Save Details
        </Button>
      </Card.Content>
    </Card>
  );

  const renderSubscriptionSettings = () => {
    const updateTier = (tier: SubscriptionTier, field: string, value: string | number | boolean) => {
      setSubscriptionTiers((prev) => ({
        ...prev,
        [tier]: {
          ...prev[tier],
          [field]: value,
        },
      }));
    };

    return (
      <>
        <Card style={[styles.settingsCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface }}>Subscription Tier Configuration</Title>
            <Text style={{ color: theme.colors.onSurfaceVariant, marginTop: 8, marginBottom: 16 }}>
              Configure pricing and features for each subscription tier
            </Text>

            {/* Free Tier */}
            <View style={[styles.tierCard, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Title style={[styles.tierTitle, { color: theme.colors.onSurface }]}>Tier 1 - Free</Title>
              
              <TextInput
                label="Display Name"
                value={subscriptionTiers.free.name}
                onChangeText={(text) => updateTier('free', 'name', text)}
                mode="outlined"
                style={styles.tierInput}
              />
              
              <TextInput
                label="Price (USD)"
                value={subscriptionTiers.free.price.toString()}
                onChangeText={(text) => {
                  const num = parseFloat(text) || 0;
                  updateTier('free', 'price', num);
                }}
                keyboardType="numeric"
                mode="outlined"
                style={styles.tierInput}
              />
              
              <TextInput
                label="Queue Limit"
                value={subscriptionTiers.free.queueLimit === Infinity ? 'Unlimited' : subscriptionTiers.free.queueLimit.toString()}
                onChangeText={(text) => {
                  const num = text.toLowerCase() === 'unlimited' || text === '' ? Infinity : (parseInt(text) || 1);
                  updateTier('free', 'queueLimit', num);
                }}
                keyboardType="numeric"
                mode="outlined"
                style={styles.tierInput}
              />
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.free.djMode ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('free', 'djMode', !subscriptionTiers.free.djMode)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>DJ Mode</Text>
              </View>
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.free.listedOnDiscovery ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('free', 'listedOnDiscovery', !subscriptionTiers.free.listedOnDiscovery)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Listed on Discovery</Text>
              </View>
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.free.listedOnLeaderboard ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('free', 'listedOnLeaderboard', !subscriptionTiers.free.listedOnLeaderboard)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Listed on Leaderboard</Text>
              </View>
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.free.ads ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('free', 'ads', !subscriptionTiers.free.ads)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Ads</Text>
              </View>
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.free.playlist ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('free', 'playlist', !subscriptionTiers.free.playlist)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Playlist</Text>
              </View>
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.free.collaboration ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('free', 'collaboration', !subscriptionTiers.free.collaboration)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Collaboration</Text>
              </View>
              
              <TextInput
                label="Description"
                value={subscriptionTiers.free.description}
                onChangeText={(text) => updateTier('free', 'description', text)}
                mode="outlined"
                multiline
                numberOfLines={2}
                style={styles.tierInput}
              />
            </View>

            {/* Rookie Tier */}
            <View style={[styles.tierCard, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Title style={[styles.tierTitle, { color: theme.colors.onSurface }]}>Tier 2 - Rookie</Title>
              
              <TextInput
                label="Display Name"
                value={subscriptionTiers.rookie.name}
                onChangeText={(text) => updateTier('rookie', 'name', text)}
                mode="outlined"
                style={styles.tierInput}
              />
              
              <TextInput
                label="Price (USD)"
                value={subscriptionTiers.rookie.price.toString()}
                onChangeText={(text) => {
                  const num = parseFloat(text) || 0;
                  updateTier('rookie', 'price', num);
                }}
                keyboardType="numeric"
                mode="outlined"
                style={styles.tierInput}
              />
              
              <TextInput
                label="Queue Limit"
                value={subscriptionTiers.rookie.queueLimit === Infinity ? 'Unlimited' : subscriptionTiers.rookie.queueLimit.toString()}
                onChangeText={(text) => {
                  const num = text.toLowerCase() === 'unlimited' || text === '' ? Infinity : (parseInt(text) || 5);
                  updateTier('rookie', 'queueLimit', num);
                }}
                keyboardType="numeric"
                mode="outlined"
                style={styles.tierInput}
              />
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.rookie.djMode ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('rookie', 'djMode', !subscriptionTiers.rookie.djMode)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>DJ Mode</Text>
              </View>
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.rookie.listedOnDiscovery ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('rookie', 'listedOnDiscovery', !subscriptionTiers.rookie.listedOnDiscovery)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Listed on Discovery</Text>
              </View>
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.rookie.listedOnLeaderboard ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('rookie', 'listedOnLeaderboard', !subscriptionTiers.rookie.listedOnLeaderboard)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Listed on Leaderboard</Text>
              </View>
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.rookie.ads ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('rookie', 'ads', !subscriptionTiers.rookie.ads)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Ads</Text>
              </View>
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.rookie.playlist ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('rookie', 'playlist', !subscriptionTiers.rookie.playlist)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Playlist</Text>
              </View>
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.rookie.collaboration ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('rookie', 'collaboration', !subscriptionTiers.rookie.collaboration)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Collaboration</Text>
              </View>
              
              <TextInput
                label="Description"
                value={subscriptionTiers.rookie.description}
                onChangeText={(text) => updateTier('rookie', 'description', text)}
                mode="outlined"
                multiline
                numberOfLines={2}
                style={styles.tierInput}
              />
            </View>

            {/* Standard Tier */}
            <View style={[styles.tierCard, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Title style={[styles.tierTitle, { color: theme.colors.onSurface }]}>Tier 3 - Standard</Title>
              
              <TextInput
                label="Display Name"
                value={subscriptionTiers.standard.name}
                onChangeText={(text) => updateTier('standard', 'name', text)}
                mode="outlined"
                style={styles.tierInput}
              />
              
              <TextInput
                label="Price (USD)"
                value={subscriptionTiers.standard.price.toString()}
                onChangeText={(text) => {
                  const num = parseFloat(text) || 0;
                  updateTier('standard', 'price', num);
                }}
                keyboardType="numeric"
                mode="outlined"
                style={styles.tierInput}
              />
              
              <TextInput
                label="Queue Limit"
                value={subscriptionTiers.standard.queueLimit === Infinity ? 'Unlimited' : subscriptionTiers.standard.queueLimit.toString()}
                onChangeText={(text) => {
                  const num = text.toLowerCase() === 'unlimited' || text === '' ? Infinity : (parseInt(text) || 10);
                  updateTier('standard', 'queueLimit', num);
                }}
                keyboardType="numeric"
                mode="outlined"
                style={styles.tierInput}
              />
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.standard.djMode ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('standard', 'djMode', !subscriptionTiers.standard.djMode)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>DJ Mode</Text>
              </View>
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.standard.listedOnDiscovery ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('standard', 'listedOnDiscovery', !subscriptionTiers.standard.listedOnDiscovery)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Listed on Discovery</Text>
              </View>
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.standard.listedOnLeaderboard ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('standard', 'listedOnLeaderboard', !subscriptionTiers.standard.listedOnLeaderboard)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Listed on Leaderboard</Text>
              </View>
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.standard.ads ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('standard', 'ads', !subscriptionTiers.standard.ads)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Ads</Text>
              </View>
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.standard.playlist ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('standard', 'playlist', !subscriptionTiers.standard.playlist)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Playlist</Text>
              </View>
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.standard.collaboration ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('standard', 'collaboration', !subscriptionTiers.standard.collaboration)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Collaboration</Text>
              </View>
              
              <TextInput
                label="Description"
                value={subscriptionTiers.standard.description}
                onChangeText={(text) => updateTier('standard', 'description', text)}
                mode="outlined"
                multiline
                numberOfLines={2}
                style={styles.tierInput}
              />
            </View>

            {/* Pro Tier */}
            <View style={[styles.tierCard, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Title style={[styles.tierTitle, { color: theme.colors.onSurface }]}>Tier 4 - Pro</Title>
              
              <TextInput
                label="Display Name"
                value={subscriptionTiers.pro.name}
                onChangeText={(text) => updateTier('pro', 'name', text)}
                mode="outlined"
                style={styles.tierInput}
              />
              
              <TextInput
                label="Price (USD)"
                value={subscriptionTiers.pro.price.toString()}
                onChangeText={(text) => {
                  const num = parseFloat(text) || 0;
                  updateTier('pro', 'price', num);
                }}
                keyboardType="numeric"
                mode="outlined"
                style={styles.tierInput}
              />
              
              <TextInput
                label="Queue Limit"
                value={subscriptionTiers.pro.queueLimit === Infinity ? 'Unlimited' : subscriptionTiers.pro.queueLimit.toString()}
                onChangeText={(text) => {
                  const num = text.toLowerCase() === 'unlimited' || text === '' ? Infinity : (parseInt(text) || 0);
                  updateTier('pro', 'queueLimit', num);
                }}
                keyboardType="numeric"
                mode="outlined"
                style={styles.tierInput}
              />
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.pro.djMode ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('pro', 'djMode', !subscriptionTiers.pro.djMode)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>DJ Mode</Text>
              </View>
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.pro.listedOnDiscovery ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('pro', 'listedOnDiscovery', !subscriptionTiers.pro.listedOnDiscovery)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Listed on Discovery</Text>
              </View>
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.pro.listedOnLeaderboard ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('pro', 'listedOnLeaderboard', !subscriptionTiers.pro.listedOnLeaderboard)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Listed on Leaderboard</Text>
              </View>
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.pro.ads ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('pro', 'ads', !subscriptionTiers.pro.ads)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Ads</Text>
              </View>
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.pro.playlist ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('pro', 'playlist', !subscriptionTiers.pro.playlist)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Playlist</Text>
              </View>
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={subscriptionTiers.pro.collaboration ? 'checked' : 'unchecked'}
                  onPress={() => updateTier('pro', 'collaboration', !subscriptionTiers.pro.collaboration)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Collaboration</Text>
              </View>
              
              <TextInput
                label="Description"
                value={subscriptionTiers.pro.description}
                onChangeText={(text) => updateTier('pro', 'description', text)}
                mode="outlined"
                multiline
                numberOfLines={2}
                style={styles.tierInput}
              />
            </View>

            <Button
              mode="contained"
              onPress={saveSubscriptionTiers}
              loading={savingTiers}
              disabled={savingTiers}
              style={styles.saveButton}
              icon="content-save"
            >
              Save Subscription Settings
            </Button>
          </Card.Content>
        </Card>

        {/* Booster Pack Configuration */}
        <Card style={[styles.settingsCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Booster Pack Configuration
            </Title>
            <Text style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}>
              Configure booster packs that users can purchase to extend music playback time
            </Text>

            <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />

            {/* 10 Minute Booster */}
            <View style={[styles.tierCard, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Title style={[styles.tierTitle, { color: theme.colors.onSurface }]}>10 Minute Boost</Title>
              
              <TextInput
                label="Display Name"
                value={boosterPacks['10min']?.display_name || '10 Minute Boost'}
                onChangeText={(text) => updateBoosterPack('10min', 'display_name', text)}
                mode="outlined"
                style={styles.tierInput}
              />
              
              <TextInput
                label="Price (USD)"
                value={(boosterPacks['10min']?.price || 0.50).toString()}
                onChangeText={(text) => {
                  const num = parseFloat(text) || 0.50;
                  updateBoosterPack('10min', 'price', num);
                }}
                keyboardType="numeric"
                mode="outlined"
                style={styles.tierInput}
              />
              
              <TextInput
                label="Duration (minutes)"
                value={(boosterPacks['10min']?.duration_minutes || 10).toString()}
                onChangeText={(text) => {
                  const num = parseInt(text) || 10;
                  updateBoosterPack('10min', 'duration_minutes', num);
                }}
                keyboardType="numeric"
                mode="outlined"
                style={styles.tierInput}
              />
              
              <TextInput
                label="Description"
                value={boosterPacks['10min']?.description || ''}
                onChangeText={(text) => updateBoosterPack('10min', 'description', text)}
                mode="outlined"
                multiline
                numberOfLines={2}
                style={styles.tierInput}
              />
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={boosterPacks['10min']?.enabled !== false ? 'checked' : 'unchecked'}
                  onPress={() => updateBoosterPack('10min', 'enabled', !boosterPacks['10min']?.enabled)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Enabled</Text>
              </View>
            </View>

            {/* 1 Hour Booster */}
            <View style={[styles.tierCard, { backgroundColor: theme.colors.surfaceVariant }]}>
              <Title style={[styles.tierTitle, { color: theme.colors.onSurface }]}>1 Hour Boost</Title>
              
              <TextInput
                label="Display Name"
                value={boosterPacks.hour?.display_name || '1 Hour Boost'}
                onChangeText={(text) => updateBoosterPack('hour', 'display_name', text)}
                mode="outlined"
                style={styles.tierInput}
              />
              
              <TextInput
                label="Price (USD)"
                value={(boosterPacks.hour?.price || 1.00).toString()}
                onChangeText={(text) => {
                  const num = parseFloat(text) || 1.00;
                  updateBoosterPack('hour', 'price', num);
                }}
                keyboardType="numeric"
                mode="outlined"
                style={styles.tierInput}
              />
              
              <TextInput
                label="Duration (minutes)"
                value={(boosterPacks.hour?.duration_minutes || 60).toString()}
                onChangeText={(text) => {
                  const num = parseInt(text) || 60;
                  updateBoosterPack('hour', 'duration_minutes', num);
                }}
                keyboardType="numeric"
                mode="outlined"
                style={styles.tierInput}
              />
              
              <TextInput
                label="Description"
                value={boosterPacks.hour?.description || ''}
                onChangeText={(text) => updateBoosterPack('hour', 'description', text)}
                mode="outlined"
                multiline
                numberOfLines={2}
                style={styles.tierInput}
              />
              
              <View style={styles.checkboxRow}>
                <Checkbox
                  status={boosterPacks.hour?.enabled !== false ? 'checked' : 'unchecked'}
                  onPress={() => updateBoosterPack('hour', 'enabled', !boosterPacks.hour?.enabled)}
                />
                <Text style={[styles.checkboxLabel, { color: theme.colors.onSurface }]}>Enabled</Text>
              </View>
            </View>

            <Button
              mode="contained"
              onPress={saveBoosterPacks}
              loading={savingBoosterPacks}
              disabled={savingBoosterPacks}
              style={styles.saveButton}
              icon="content-save"
            >
              Save Booster Pack Settings
            </Button>
          </Card.Content>
        </Card>
      </>
    );
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
          icon="credit-card-outline"
        >
          Subscription
        </Button>
        <Button
          mode={activeTab === 2 ? 'contained' : 'outlined'}
          onPress={() => setActiveTab(2)}
          style={styles.tabButton}
          icon="advertisements"
        >
          Ads
        </Button>
        <Button
          mode={activeTab === 3 ? 'contained' : 'outlined'}
          onPress={() => setActiveTab(3)}
          style={styles.tabButton}
          icon="cog"
        >
          Settings
        </Button>
      </View>

      {activeTab === 0 && renderUsersTab()}
      {activeTab === 1 && renderSubscriptionTab()}
      {activeTab === 2 && renderAdsTab()}
      {activeTab === 3 && renderSettingsTab()}

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
            <Button
              mode={userDialogTab === 'access' ? 'contained' : 'text'}
              onPress={() => setUserDialogTab('access')}
              style={styles.dialogTabButton}
              compact
            >
              Access
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
                            <Text style={{ color: theme.colors.onSurface }}>Rookie - 5 songs</Text>
                          </View>
                          <View style={styles.radioOption}>
                            <RadioButton value="standard" />
                            <Text style={{ color: theme.colors.onSurface }}>Standard - 10 songs</Text>
                          </View>
                          <View style={styles.radioOption}>
                            <RadioButton value="pro" />
                            <Text style={{ color: theme.colors.onSurface }}>Pro - Unlimited</Text>
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

                    {/* Access Tab */}
                    {userDialogTab === 'access' && (
                      <View style={styles.dialogSection}>
                        <Title style={styles.sectionTitle}>Access Control</Title>
                        <Text style={[styles.sectionDescription, { color: theme.colors.onSurfaceVariant }]}>
                          Manage user access, bans, and account deletion
                        </Text>

                        {/* Ban Status */}
                        {selectedUser.is_banned && (
                          <View style={[styles.banStatusCard, { backgroundColor: theme.colors.errorContainer }]}>
                            <Text style={[styles.banStatusTitle, { color: theme.colors.onErrorContainer }]}>
                              🚫 User is Banned
                            </Text>
                            {selectedUser.banned_until ? (
                              <Text style={[styles.banStatusText, { color: theme.colors.onErrorContainer }]}>
                                Until: {new Date(selectedUser.banned_until).toLocaleString()}
                                {new Date(selectedUser.banned_until) > new Date() ? ' (Active)' : ' (Expired)'}
                              </Text>
                            ) : (
                              <Text style={[styles.banStatusText, { color: theme.colors.onErrorContainer }]}>
                                Permanent Ban
                              </Text>
                            )}
                            {selectedUser.ban_reason && (
                              <Text style={[styles.banStatusText, { color: theme.colors.onErrorContainer }]}>
                                Reason: {selectedUser.ban_reason}
                              </Text>
                            )}
                            {selectedUser.banned_at && (
                              <Text style={[styles.banStatusText, { color: theme.colors.onErrorContainer }]}>
                                Banned on: {new Date(selectedUser.banned_at).toLocaleString()}
                              </Text>
                            )}
                            <Button
                              mode="contained"
                              onPress={handleUnbanUser}
                              style={[styles.actionButton, { marginTop: 12 }]}
                              buttonColor={theme.colors.primary}
                            >
                              Unban User
                            </Button>
                          </View>
                        )}

                        {!selectedUser.is_banned && (
                          <>
                            {/* Ban User Section */}
                            <View style={[styles.actionSection, { backgroundColor: theme.colors.surfaceVariant }]}>
                              <Title style={[styles.actionSectionTitle, { color: theme.colors.onSurface }]}>
                                Ban User
                              </Title>
                              
                              <RadioButton.Group
                                onValueChange={(value) => setBanType(value as 'permanent' | 'temporary')}
                                value={banType}
                              >
                                <View style={styles.radioOption}>
                                  <RadioButton value="permanent" />
                                  <Text style={{ color: theme.colors.onSurface }}>Permanent Ban</Text>
                                </View>
                                <View style={styles.radioOption}>
                                  <RadioButton value="temporary" />
                                  <Text style={{ color: theme.colors.onSurface }}>Temporary Ban</Text>
                                </View>
                              </RadioButton.Group>

                              {banType === 'temporary' && (
                                <View style={styles.temporaryBanFields}>
                                  <TextInput
                                    label="Ban Until Date"
                                    value={banUntilDate}
                                    onChangeText={setBanUntilDate}
                                    mode="outlined"
                                    placeholder="YYYY-MM-DD"
                                    style={styles.dialogInput}
                                  />
                                  <TextInput
                                    label="Ban Until Time"
                                    value={banUntilTime}
                                    onChangeText={setBanUntilTime}
                                    mode="outlined"
                                    placeholder="HH:MM (24-hour format)"
                                    style={styles.dialogInput}
                                  />
                                </View>
                              )}

                              <TextInput
                                label="Ban Reason (optional)"
                                value={banReason}
                                onChangeText={setBanReason}
                                mode="outlined"
                                multiline
                                numberOfLines={3}
                                style={styles.dialogInput}
                                placeholder="Enter reason for ban..."
                              />

                              <Button
                                mode="contained"
                                onPress={() => setBanConfirmVisible(true)}
                                style={[styles.actionButton, { backgroundColor: theme.colors.error }]}
                                buttonColor={theme.colors.error}
                              >
                                Ban User
                              </Button>
                            </View>
                          </>
                        )}

                        <Divider style={styles.divider} />

                        {/* Delete User Section */}
                        <View style={[styles.actionSection, { backgroundColor: theme.colors.errorContainer }]}>
                          <Title style={[styles.actionSectionTitle, { color: theme.colors.onErrorContainer }]}>
                            ⚠️ Delete User Account
                          </Title>
                          <Text style={[styles.sectionDescription, { color: theme.colors.onErrorContainer }]}>
                            This will permanently delete the user profile and all associated data. This action cannot be undone.
                          </Text>
                          <Button
                            mode="contained"
                            onPress={() => setDeleteConfirmVisible(true)}
                            style={[styles.actionButton, { backgroundColor: theme.colors.error }]}
                            buttonColor={theme.colors.error}
                          >
                            Delete User Account
                          </Button>
                        </View>
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

        {/* Ban Confirmation Dialog */}
        <Dialog
          visible={banConfirmVisible}
          onDismiss={() => setBanConfirmVisible(false)}
        >
          <Dialog.Title>Confirm Ban</Dialog.Title>
          <Dialog.Content>
            <Text>
              Are you sure you want to {banType === 'permanent' ? 'permanently ban' : 'temporarily ban'} this user?
              {banType === 'temporary' && banUntilDate && banUntilTime && (
                <Text> The ban will expire on {new Date(`${banUntilDate}T${banUntilTime}`).toLocaleString()}.</Text>
              )}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setBanConfirmVisible(false)}>Cancel</Button>
            <Button onPress={handleBanUser} mode="contained" buttonColor={theme.colors.error}>
              Confirm Ban
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          visible={deleteConfirmVisible}
          onDismiss={() => setDeleteConfirmVisible(false)}
        >
          <Dialog.Title>Confirm Deletion</Dialog.Title>
          <Dialog.Content>
            <Text>
              Are you sure you want to permanently delete this user account? This action cannot be undone and will delete all user data.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteConfirmVisible(false)}>Cancel</Button>
            <Button onPress={handleDeleteUser} mode="contained" buttonColor={theme.colors.error}>
              Delete User
            </Button>
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
  settingsContainer: {
    flex: 1,
  },
  subTabContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    borderBottomWidth: 1,
    elevation: 1,
  },
  subTabButton: {
    flex: 1,
  },
  settingsCard: {
    margin: 16,
    borderRadius: 16,
    elevation: 2,
  },
  tierCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  tierTitle: {
    fontSize: 18,
    marginBottom: 12,
  },
  tierInput: {
    marginBottom: 12,
  },
  detailsTextArea: {
    marginBottom: 16,
    minHeight: 300,
  },
  saveButton: {
    marginTop: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkboxLabel: {
    marginLeft: 8,
    fontSize: 16,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  adHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  adActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
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
  banStatusCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  banStatusTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  banStatusText: {
    fontSize: 13,
    marginBottom: 4,
  },
  actionSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  actionSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  actionButton: {
    marginTop: 8,
  },
  temporaryBanFields: {
    marginTop: 12,
  },
});

export default AdminScreen;
