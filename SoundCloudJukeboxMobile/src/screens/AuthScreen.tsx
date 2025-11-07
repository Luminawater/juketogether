import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  TouchableOpacity,
} from 'react-native';
import { TextInput, Button, Text, Card, Title, Paragraph, Divider, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';

// Import logos
const SpotifyLogo = require('../../assets/Spotify-logo.png');

type AuthScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Auth'>;

const AuthScreen: React.FC = () => {
  const navigation = useNavigation<AuthScreenNavigationProp>();
  const { signIn, signUp, signInWithProvider, loading, user } = useAuth();
  const theme = useTheme();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [loadingOAuth, setLoadingOAuth] = useState<string | null>(null);
  const hasNavigatedRef = useRef(false);

  // Reset navigation ref when user logs out
  useEffect(() => {
    if (!user) {
      hasNavigatedRef.current = false;
    }
  }, [user]);

  // Navigate to dashboard when user is authenticated (only once)
  useEffect(() => {
    if (user && !loading && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      // Use React Navigation for all platforms to avoid full page reload
      // This ensures session state is preserved
      navigation.replace('Dashboard');
    }
  }, [user, loading, navigation]);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (!isLogin && password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoadingAuth(true);
    try {
      const { error } = isLogin
        ? await signIn(email, password)
        : await signUp(email, password);

      if (error) {
        Alert.alert('Error', error.message);
      }
      // Navigation will be handled by auth state change
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'spotify' | 'google' | 'github') => {
    setLoadingOAuth(provider);
    try {
      const { error } = await signInWithProvider(provider);
      if (error) {
        Alert.alert('Error', error.message || `Failed to sign in with ${provider}`);
        setLoadingOAuth(null);
      }
      // OAuth will redirect, so we don't need to handle success here
    } catch (error: any) {
      Alert.alert('Error', error.message || `Failed to sign in with ${provider}`);
      setLoadingOAuth(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Card.Content style={styles.cardContent}>
              {/* Logo and Title */}
              <View style={styles.header}>
                <Image
                  source={SpotifyLogo}
                  style={styles.logo}
                  resizeMode="contain"
                />
                <Title style={[styles.title, { color: theme.colors.onSurface }]}>
                  Music Jukebox
                </Title>
                <Paragraph style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                  {isLogin ? 'Welcome back' : 'Create your account'}
                </Paragraph>
              </View>

              {/* OAuth Buttons */}
              <View style={styles.oauthSection}>
                <TouchableOpacity
                  onPress={() => handleOAuthSignIn('spotify')}
                  disabled={!!loadingOAuth}
                  style={[
                    styles.oauthButton,
                    { backgroundColor: '#1DB954' },
                    loadingOAuth === 'spotify' && styles.oauthButtonLoading,
                    !!loadingOAuth && styles.oauthButtonDisabled,
                  ]}
                  activeOpacity={0.8}
                >
                  {loadingOAuth === 'spotify' ? (
                    <Text style={styles.oauthButtonText}>Loading...</Text>
                  ) : (
                    <View style={styles.oauthButtonInner}>
                      <Image
                        source={SpotifyLogo}
                        style={styles.oauthIcon}
                        resizeMode="contain"
                      />
                      <Text style={styles.oauthButtonText}>Continue with Spotify</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.dividerContainer}>
                <Divider style={styles.divider} />
                <Text style={[styles.dividerText, { color: theme.colors.onSurfaceVariant }]}>
                  or
                </Text>
                <Divider style={styles.divider} />
              </View>

              {/* Email/Password Form */}
              {Platform.OS === 'web' ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAuth();
                  }}
                  style={styles.formSection}
                  noValidate
                >
                  <View style={styles.tabContainer}>
                    <Button
                      mode={isLogin ? 'contained' : 'text'}
                      onPress={() => setIsLogin(true)}
                      style={[styles.tabButton, isLogin && styles.activeTab]}
                      labelStyle={isLogin ? styles.activeTabLabel : styles.inactiveTabLabel}
                    >
                      Sign In
                    </Button>
                    <Button
                      mode={!isLogin ? 'contained' : 'text'}
                      onPress={() => setIsLogin(false)}
                      style={[styles.tabButton, !isLogin && styles.activeTab]}
                      labelStyle={!isLogin ? styles.activeTabLabel : styles.inactiveTabLabel}
                    >
                      Sign Up
                    </Button>
                  </View>

                  <TextInput
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    mode="outlined"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                    disabled={!!loadingOAuth}
                    autoComplete="email"
                  />

                  <TextInput
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    mode="outlined"
                    secureTextEntry
                    style={styles.input}
                    disabled={!!loadingOAuth}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                  />

                  {!isLogin && (
                    <TextInput
                      label="Confirm Password"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      mode="outlined"
                      secureTextEntry
                      style={styles.input}
                      disabled={!!loadingOAuth}
                      autoComplete="new-password"
                    />
                  )}

                  <Button
                    mode="contained"
                    onPress={handleAuth}
                    loading={loadingAuth}
                    disabled={loadingAuth || !!loadingOAuth}
                    style={styles.authButton}
                    contentStyle={styles.authButtonContent}
                    type="submit"
                  >
                    {isLogin ? 'Sign In' : 'Create Account'}
                  </Button>
                </form>
              ) : (
                <View style={styles.formSection}>
                  <View style={styles.tabContainer}>
                    <Button
                      mode={isLogin ? 'contained' : 'text'}
                      onPress={() => setIsLogin(true)}
                      style={[styles.tabButton, isLogin && styles.activeTab]}
                      labelStyle={isLogin ? styles.activeTabLabel : styles.inactiveTabLabel}
                    >
                      Sign In
                    </Button>
                    <Button
                      mode={!isLogin ? 'contained' : 'text'}
                      onPress={() => setIsLogin(false)}
                      style={[styles.tabButton, !isLogin && styles.activeTab]}
                      labelStyle={!isLogin ? styles.activeTabLabel : styles.inactiveTabLabel}
                    >
                      Sign Up
                    </Button>
                  </View>

                  <TextInput
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    mode="outlined"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.input}
                    disabled={!!loadingOAuth}
                  />

                  <TextInput
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    mode="outlined"
                    secureTextEntry
                    style={styles.input}
                    disabled={!!loadingOAuth}
                  />

                  {!isLogin && (
                    <TextInput
                      label="Confirm Password"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      mode="outlined"
                      secureTextEntry
                      style={styles.input}
                      disabled={!!loadingOAuth}
                    />
                  )}

                  <Button
                    mode="contained"
                    onPress={handleAuth}
                    loading={loadingAuth}
                    disabled={loadingAuth || !!loadingOAuth}
                    style={styles.authButton}
                    contentStyle={styles.authButtonContent}
                  >
                    {isLogin ? 'Sign In' : 'Create Account'}
                  </Button>
                </View>
              )}
            </Card.Content>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    elevation: 4,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 56,
    height: 56,
    marginBottom: 20,
  },
  title: {
    textAlign: 'center',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 15,
    marginTop: 4,
  },
  oauthSection: {
    marginBottom: 28,
  },
  oauthButton: {
    borderRadius: 12,
    elevation: 0,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  oauthButtonLoading: {
    opacity: 0.7,
  },
  oauthButtonDisabled: {
    opacity: 0.5,
  },
  oauthButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  oauthButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  oauthIcon: {
    width: 24,
    height: 24,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 28,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'lowercase',
  },
  formSection: {
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 28,
    gap: 12,
    backgroundColor: 'transparent',
  },
  tabButton: {
    flex: 1,
  },
  activeTab: {
    borderRadius: 8,
  },
  activeTabLabel: {
    fontWeight: '600',
  },
  inactiveTabLabel: {
    fontWeight: '400',
  },
  input: {
    marginBottom: 20,
  },
  authButton: {
    marginTop: 12,
    borderRadius: 12,
    elevation: 0,
  },
  authButtonContent: {
    paddingVertical: 10,
  },
});

export default AuthScreen;
