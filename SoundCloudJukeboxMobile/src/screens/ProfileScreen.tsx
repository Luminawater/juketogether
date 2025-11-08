import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  Avatar,
  useTheme,
  Divider,
  ActivityIndicator,
  Menu,
  Switch,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { UserBadge } from '../components/UserBadge';
import { getRemainingSongs } from '../utils/permissions';

type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Profile'>;

// Common countries list (matching DiscoveryScreen)
const COUNTRIES = [
  '',
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

interface UserAnalytics {
  total_rooms_created: number;
  total_listeners_all_rooms: number;
  peak_listeners_all_rooms: number;
  total_tracks_played_all_rooms: number;
  total_play_time_all_rooms_seconds: number;
  total_rooms_joined: number;
  total_sessions_hosted: number;
}

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { user, profile, permissions, refreshProfile, supabase } = useAuth();
  const theme = useTheme();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);

  // Form state
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [djName, setDjName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [country, setCountry] = useState('');
  const [countryMenuVisible, setCountryMenuVisible] = useState(false);
  const [showInLeaderboard, setShowInLeaderboard] = useState(true);
  const [showInDiscovery, setShowInDiscovery] = useState(true);
  const [isPrivateAccount, setIsPrivateAccount] = useState(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setDisplayName(profile.display_name || '');
      setDjName(profile.dj_name || '');
      setAvatarUrl(profile.avatar_url || '');
      setCountry(profile.country || '');
      setShowInLeaderboard(profile.show_in_leaderboard !== false);
      setShowInDiscovery(profile.show_in_discovery !== false);
      setIsPrivateAccount(profile.is_private_account === true);
    }
  }, [profile]);

  useEffect(() => {
    loadUserAnalytics();
  }, [user?.id]);

  const loadUserAnalytics = async () => {
    if (!user?.id) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_analytics')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setAnalytics(data as UserAnalytics);
      }
    } catch (error) {
      console.error('Error loading user analytics:', error);
    }
  };

  const handleSave = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    // Validate username
    if (!username.trim()) {
      Alert.alert('Error', 'Username is required');
      return;
    }

    // Validate username format (alphanumeric, underscore, hyphen)
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(username.trim())) {
      Alert.alert('Error', 'Username can only contain letters, numbers, underscores, and hyphens');
      return;
    }

    setSaving(true);
    try {
      const updates: any = {
        username: username.trim(),
        display_name: displayName.trim() || null,
        dj_name: djName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        country: country.trim() || null,
        show_in_leaderboard: showInLeaderboard,
        show_in_discovery: showInDiscovery,
        is_private_account: isPrivateAccount,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        // Check if it's a unique constraint violation
        if (error.code === '23505' || error.message.includes('unique')) {
          Alert.alert('Error', 'This username is already taken. Please choose another one.');
          setSaving(false);
          return;
        }
        throw error;
      }

      // Refresh profile to get updated data
      await refreshProfile();

      Alert.alert('Success', 'Profile updated successfully');
      navigation.goBack();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = () => {
    if (displayName) {
      return displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }
    if (username) {
      return username.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const formatPlayTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Welcome Header Section */}
        <View style={[styles.welcomeHeader, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.welcomeUserInfo}>
            <Avatar.Text
              size={60}
              label={getInitials()}
              style={{ backgroundColor: theme.colors.primary }}
            />
            {avatarUrl ? (
              <Avatar.Image
                size={60}
                source={{ uri: avatarUrl }}
                style={styles.avatarOverlay}
              />
            ) : null}
            <View style={styles.welcomeDetails}>
              <Text style={[styles.welcomeEmail, { color: theme.colors.onSurface }]}>
                {user?.email || 'User'}
              </Text>
              <Text style={[styles.welcomeGreeting, { color: theme.colors.onSurfaceVariant }]}>
                Welcome back!
              </Text>
              {profile && permissions && (
                <View style={styles.welcomeBadges}>
                  <UserBadge
                    role={profile.role}
                    tier={profile.subscription_tier}
                    showLabel={false}
                    size="small"
                  />
                  {permissions.max_songs !== Infinity && (
                    <Text style={[styles.welcomeSongCount, { color: theme.colors.onSurfaceVariant }]}>
                      {permissions.songs_played}/{permissions.max_songs} songs played
                    </Text>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Profile Header Section */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Avatar.Text
              size={80}
              label={getInitials()}
              style={{ backgroundColor: theme.colors.primary }}
            />
            {avatarUrl ? (
              <Avatar.Image
                size={80}
                source={{ uri: avatarUrl }}
                style={styles.avatar}
              />
            ) : null}
          </View>
          <Title style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
            {username || 'user_unknown'}
          </Title>
          {djName ? (
            <Paragraph style={[styles.djName, { color: theme.colors.primary }]}>
              🎧 {djName}
            </Paragraph>
          ) : (
            <Paragraph style={[styles.djNameHint, { color: theme.colors.onSurfaceVariant }]}>
              Add your DJ name below
            </Paragraph>
          )}
        </View>

        {/* Statistics Card */}
        {permissions && (
          <Card style={[styles.card, { marginHorizontal: 20, marginBottom: 20 }]}>
            <Card.Content>
              <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Statistics
              </Title>
              <Divider style={styles.divider} />
              
              <View style={styles.progressContainer}>
                <View style={styles.progressInfo}>
                  <Text style={[styles.progressText, { color: theme.colors.onSurface }]}>
                    {permissions.songs_played}/{permissions.max_songs !== Infinity ? permissions.max_songs : '∞'} Songs played
                  </Text>
                  {permissions.max_songs !== Infinity && (
                    <Text style={[styles.progressRemaining, { color: theme.colors.onSurfaceVariant }]}>
                      {getRemainingSongs(permissions) === Infinity 
                        ? 'Unlimited remaining' 
                        : `${getRemainingSongs(permissions)} remaining`}
                    </Text>
                  )}
                </View>
                {permissions.max_songs !== Infinity && (
                  <View style={[styles.progressBarContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <View 
                      style={[
                        styles.progressBar, 
                        { 
                          width: `${Math.min(100, (permissions.songs_played / permissions.max_songs) * 100)}%`,
                          backgroundColor: theme.colors.primary 
                        }
                      ]} 
                    />
                  </View>
                )}
              </View>

              {analytics && (
                <View style={styles.statsGrid}>
                  <View style={[styles.statItem, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                      {analytics.total_rooms_created || 0}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                      Rooms Created
                    </Text>
                  </View>

                  <View style={[styles.statItem, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                      {analytics.total_listeners_all_rooms || 0}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                      Total Listeners
                    </Text>
                  </View>

                  {analytics.total_play_time_all_rooms_seconds > 0 && (
                    <View style={[styles.statItem, { backgroundColor: theme.colors.surfaceVariant }]}>
                      <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                        {formatPlayTime(analytics.total_play_time_all_rooms_seconds)}
                      </Text>
                      <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                        Total Play Time
                      </Text>
                    </View>
                  )}

                  <View style={[styles.statItem, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                      {analytics.total_rooms_joined || 0}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                      Rooms Joined
                    </Text>
                  </View>
                </View>
              )}
            </Card.Content>
          </Card>
        )}

        <Card style={[styles.card, { marginHorizontal: 20 }]}>
          <Card.Content>
            <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Profile Information
            </Title>
            <Divider style={styles.divider} />

            <TextInput
              label="Username *"
              value={username}
              onChangeText={setUsername}
              mode="outlined"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              disabled={saving}
              error={!username.trim()}
            />
            <Paragraph style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
              Your unique username (required, alphanumeric, underscores, hyphens only)
            </Paragraph>

            <TextInput
              label="Display Name"
              value={displayName}
              onChangeText={setDisplayName}
              mode="outlined"
              style={styles.input}
              placeholder="Your full name or nickname"
              disabled={saving}
            />
            <Paragraph style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
              How others will see your name
            </Paragraph>

            <TextInput
              label="DJ Name / Stage Name"
              value={djName}
              onChangeText={setDjName}
              mode="outlined"
              style={styles.input}
              placeholder="e.g., DJ Awesome, SoundMaster"
              disabled={saving}
              left={<TextInput.Icon icon="music" />}
            />
            <Paragraph style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
              Your DJ or stage name for music rooms
            </Paragraph>

            <TextInput
              label="Avatar URL"
              value={avatarUrl}
              onChangeText={setAvatarUrl}
              mode="outlined"
              style={styles.input}
              placeholder="https://example.com/avatar.jpg"
              disabled={saving}
              left={<TextInput.Icon icon="image" />}
            />
            <Paragraph style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
              URL to your profile picture
            </Paragraph>

            <View style={styles.countryContainer}>
              <Text style={[styles.countryLabel, { color: theme.colors.onSurface }]}>
                Country
              </Text>
              <Menu
                visible={countryMenuVisible}
                onDismiss={() => setCountryMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    onPress={() => setCountryMenuVisible(true)}
                    style={styles.countryButton}
                    disabled={saving}
                    icon="map-marker"
                    contentStyle={styles.countryButtonContent}
                  >
                    {country || 'Select Country'}
                  </Button>
                }
              >
                {COUNTRIES.map((c) => (
                  <Menu.Item
                    key={c || 'none'}
                    onPress={() => {
                      setCountry(c);
                      setCountryMenuVisible(false);
                    }}
                    title={c || 'None'}
                  />
                ))}
              </Menu>
            </View>
            <Paragraph style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
              Your country (used for room discovery and filtering)
            </Paragraph>
          </Card.Content>
        </Card>

        <Card style={[styles.card, { marginHorizontal: 20 }]}>
          <Card.Content>
            <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Privacy Settings
            </Title>
            <Divider style={styles.divider} />

            <View style={styles.privacyRow}>
              <View style={styles.privacyInfo}>
                <Text style={[styles.privacyLabel, { color: theme.colors.onSurface }]}>
                  Show in Leaderboard
                </Text>
                <Paragraph style={[styles.privacyDescription, { color: theme.colors.onSurfaceVariant }]}>
                  Allow your profile to appear in the leaderboard rankings
                </Paragraph>
              </View>
              <Switch
                value={showInLeaderboard}
                onValueChange={setShowInLeaderboard}
                disabled={saving}
              />
            </View>

            <Divider style={styles.divider} />

            <View style={styles.privacyRow}>
              <View style={styles.privacyInfo}>
                <Text style={[styles.privacyLabel, { color: theme.colors.onSurface }]}>
                  Show in Discovery
                </Text>
                <Paragraph style={[styles.privacyDescription, { color: theme.colors.onSurfaceVariant }]}>
                  Allow your rooms to appear in the discovery feed
                </Paragraph>
              </View>
              <Switch
                value={showInDiscovery}
                onValueChange={setShowInDiscovery}
                disabled={saving}
              />
            </View>

            <Divider style={styles.divider} />

            <View style={styles.privacyRow}>
              <View style={styles.privacyInfo}>
                <Text style={[styles.privacyLabel, { color: theme.colors.onSurface }]}>
                  Private Account
                </Text>
                <Paragraph style={[styles.privacyDescription, { color: theme.colors.onSurfaceVariant }]}>
                  Make your profile private. When private, only you can view your profile details
                </Paragraph>
              </View>
              <Switch
                value={isPrivateAccount}
                onValueChange={setIsPrivateAccount}
                disabled={saving}
              />
            </View>
          </Card.Content>
        </Card>

        {profile && (
          <Card style={[styles.card, { marginHorizontal: 20 }]}>
            <Card.Content>
              <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Account Information
              </Title>
              <Divider style={styles.divider} />

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Email:
                </Text>
                <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>
                  {user?.email || 'Not available'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Subscription:
                </Text>
                <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>
                  {profile.subscription_tier
                    ? profile.subscription_tier.charAt(0).toUpperCase() +
                      profile.subscription_tier.slice(1)
                    : 'Free'}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Member since:
                </Text>
                <Text style={[styles.infoValue, { color: theme.colors.onSurface }]}>
                  {profile.created_at
                    ? new Date(profile.created_at).toLocaleDateString()
                    : 'Unknown'}
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}

        <View style={[styles.buttonContainer, { marginHorizontal: 20 }]}>
          <Button
            mode="contained"
            onPress={handleSave}
            style={styles.saveButton}
            loading={saving}
            disabled={saving || !username.trim()}
            icon="content-save"
          >
            Save Changes
          </Button>
          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            style={styles.cancelButton}
            disabled={saving}
          >
            Cancel
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  welcomeHeader: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 20,
    elevation: 6,
    // Web-compatible shadow
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.2)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
    }),
  },
  welcomeUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  welcomeDetails: {
    marginLeft: 16,
    flex: 1,
  },
  welcomeEmail: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  welcomeGreeting: {
    fontSize: 14,
    marginBottom: 8,
  },
  welcomeBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  welcomeSongCount: {
    fontSize: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  avatarOverlay: {
    position: 'absolute',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  djName: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  djNameHint: {
    fontSize: 14,
    marginTop: 8,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  card: {
    marginBottom: 20,
    elevation: 4,
    borderRadius: 16,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.15)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
    }),
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  divider: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    marginBottom: 16,
    marginTop: -8,
  },
  countryContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  countryLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  countryButton: {
    width: '100%',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
  },
  buttonContainer: {
    marginTop: 20,
    gap: 12,
  },
  saveButton: {
    marginBottom: 8,
  },
  cancelButton: {
    marginBottom: 8,
  },
  privacyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  privacyInfo: {
    flex: 1,
    marginRight: 16,
  },
  privacyLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  privacyDescription: {
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 8,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 2,
  },
  statSubtext: {
    fontSize: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressRemaining: {
    fontSize: 12,
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  countryButtonContent: {
    justifyContent: 'flex-start',
  },
});

export default ProfileScreen;

