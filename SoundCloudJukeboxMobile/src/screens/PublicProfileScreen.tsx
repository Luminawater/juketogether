import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import {
  Text,
  Card,
  Title,
  Paragraph,
  Avatar,
  useTheme,
  Divider,
  ActivityIndicator,
  Button,
} from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';
import { UserBadge } from '../components/UserBadge';

type PublicProfileScreenRouteProp = RouteProp<RootStackParamList, 'PublicProfile'>;
type PublicProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, 'PublicProfile'>;

interface UserAnalytics {
  total_rooms_created: number;
  total_listeners_all_rooms: number;
  peak_listeners_all_rooms: number;
  total_tracks_played_all_rooms: number;
  total_play_time_all_rooms_seconds: number;
  total_rooms_joined: number;
  total_sessions_hosted: number;
}

const PublicProfileScreen: React.FC = () => {
  const route = useRoute<PublicProfileScreenRouteProp>();
  const navigation = useNavigation<PublicProfileScreenNavigationProp>();
  const { user, supabase } = useAuth();
  const theme = useTheme();

  const { id } = route.params;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [id]);

  const loadProfile = async () => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (profileError || !profileData) {
        console.error('Error loading profile:', profileError);
        setNotFound(true);
        setLoading(false);
        return;
      }

      const profile = profileData as UserProfile;
      setProfile(profile);

      // Check if profile is private
      if (profile.is_private_account === true) {
        // If it's private and not the current user's profile, show private message
        if (user?.id !== id) {
          setIsPrivate(true);
          setLoading(false);
          return;
        }
      }

      // Load analytics if profile is public or it's the current user
      await loadUserAnalytics(id);
      setLoading(false);
    } catch (error) {
      console.error('Error loading profile:', error);
      setNotFound(true);
      setLoading(false);
    }
  };

  const loadUserAnalytics = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_analytics')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!error && data) {
        setAnalytics(data as UserAnalytics);
      }
    } catch (error) {
      console.error('Error loading user analytics:', error);
    }
  };

  const getInitials = () => {
    if (profile?.display_name) {
      return profile.display_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }
    if (profile?.username) {
      return profile.username.substring(0, 2).toUpperCase();
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

  if (notFound) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Card style={[styles.card, { marginHorizontal: 20 }]}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface, textAlign: 'center' }}>
              Profile Not Found
            </Title>
            <Paragraph style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 16 }}>
              The profile you're looking for doesn't exist or has been removed.
            </Paragraph>
            <Button
              mode="contained"
              onPress={() => navigation.goBack()}
              style={{ marginTop: 20 }}
            >
              Go Back
            </Button>
          </Card.Content>
        </Card>
      </View>
    );
  }

  if (isPrivate && user?.id !== id) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Card style={[styles.card, { marginHorizontal: 20 }]}>
          <Card.Content>
            <Title style={{ color: theme.colors.onSurface, textAlign: 'center' }}>
              Private Profile
            </Title>
            <Paragraph style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 16 }}>
              This profile is private. Only the profile owner can view it.
            </Paragraph>
            <Button
              mode="contained"
              onPress={() => navigation.goBack()}
              style={{ marginTop: 20 }}
            >
              Go Back
            </Button>
          </Card.Content>
        </Card>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* Profile Header Section */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Avatar.Text
            size={80}
            label={getInitials()}
            style={{ backgroundColor: theme.colors.primary }}
          />
          {profile.avatar_url ? (
            <Avatar.Image
              size={80}
              source={{ uri: profile.avatar_url }}
              style={styles.avatar}
            />
          ) : null}
        </View>
        <Title style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
          {profile.username || 'user_unknown'}
        </Title>
        {profile.display_name && (
          <Paragraph style={[styles.displayName, { color: theme.colors.onSurfaceVariant }]}>
            {profile.display_name}
          </Paragraph>
        )}
        {profile.dj_name ? (
          <Paragraph style={[styles.djName, { color: theme.colors.primary }]}>
            🎧 {profile.dj_name}
          </Paragraph>
        ) : null}
        {profile.country && (
          <Paragraph style={[styles.country, { color: theme.colors.onSurfaceVariant }]}>
            📍 {profile.country}
          </Paragraph>
        )}
        <View style={styles.badgeContainer}>
          <UserBadge
            role={profile.role}
            tier={profile.subscription_tier}
            showLabel={true}
            size="small"
          />
        </View>
      </View>

      {/* Statistics Card */}
      {analytics && (
        <Card style={[styles.card, { marginHorizontal: 20, marginBottom: 20 }]}>
          <Card.Content>
            <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
              Statistics
            </Title>
            <Divider style={styles.divider} />
            
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
          </Card.Content>
        </Card>
      )}

      {/* Account Information Card */}
      <Card style={[styles.card, { marginHorizontal: 20 }]}>
        <Card.Content>
          <Title style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Account Information
          </Title>
          <Divider style={styles.divider} />

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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  displayName: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  djName: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  country: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  badgeContainer: {
    marginTop: 16,
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
});

export default PublicProfileScreen;

