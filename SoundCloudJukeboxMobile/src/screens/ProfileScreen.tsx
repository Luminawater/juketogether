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
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';

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

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { user, profile, refreshProfile, supabase } = useAuth();
  const theme = useTheme();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [djName, setDjName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [country, setCountry] = useState('');
  const [countryMenuVisible, setCountryMenuVisible] = useState(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setDisplayName(profile.display_name || '');
      setDjName(profile.dj_name || '');
      setAvatarUrl(profile.avatar_url || '');
      setCountry(profile.country || '');
    }
  }, [profile]);

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
        <View style={styles.header}>
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
          <Title style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
            {displayName || username || 'User Profile'}
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

        <Card style={styles.card}>
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
                Country:
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

        {profile && (
          <Card style={styles.card}>
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

        <View style={styles.buttonContainer}>
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
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  avatar: {
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
    elevation: 2,
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
});

export default ProfileScreen;

