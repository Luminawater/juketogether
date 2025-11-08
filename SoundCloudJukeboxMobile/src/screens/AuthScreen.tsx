import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { TextInput, Button, Text, Card, Title, Paragraph, Divider, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
      navigation.replace('Home');
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
        <Text style={[styles.loadingText, { color: theme.colors.onSurface }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cardWrapper}>
          <Card 
            style={[
              styles.card,
              { 
                backgroundColor: theme.colors.surface,
                ...(Platform.OS === 'web' ? {
                  boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.2)',
                } : {
                  elevation: 4,
                }),
              }
            ]}
          >
            <Card.Content style={styles.cardContent}>
              {/* Logo and Title */}
              <View style={styles.header}>
                <Image
                  source={SpotifyLogo}
                  style={styles.logo}
                  resizeMode="contain"
                />
                <Title 
                  style={[styles.title, { color: theme.colors.onSurface }]}
                >
                  Music Jukebox
                </Title>
                <Paragraph 
                  style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
                >
                  {isLogin ? 'Welcome back' : 'Create your account'}
                </Paragraph>
              </View>

              {/* OAuth Buttons */}
              <View style={styles.oauthContainer}>
                {/* Google Sign-In Button - Official Design */}
                <TouchableOpacity
                  onPress={() => handleOAuthSignIn('google')}
                  disabled={!!loadingOAuth}
                  style={[
                    styles.oauthButton,
                    styles.googleButton,
                    loadingOAuth === 'google' && styles.oauthButtonLoading,
                    !!loadingOAuth && styles.oauthButtonDisabled,
                  ]}
                  activeOpacity={0.8}
                >
                  {loadingOAuth === 'google' ? (
                    <Text style={styles.googleButtonText}>Loading...</Text>
                  ) : (
                    <View style={styles.oauthButtonContent}>
                      {/* Google Logo SVG */}
                      <View style={styles.googleLogoContainer}>
                        <View style={styles.googleLogo}>
                          <View style={[styles.googleLogoPart, { backgroundColor: '#4285F4', top: 0, left: 0 }]} />
                          <View style={[styles.googleLogoPart, { backgroundColor: '#EA4335', top: 0, right: 0 }]} />
                          <View style={[styles.googleLogoPart, { backgroundColor: '#FBBC05', bottom: 0, left: 0 }]} />
                          <View style={[styles.googleLogoPart, { backgroundColor: '#34A853', bottom: 0, right: 0 }]} />
                        </View>
                      </View>
                      <Text style={[styles.googleButtonText, { marginLeft: 12 }]}>Sign in with Google</Text>
                    </View>
                  )}
                </TouchableOpacity>
                
                {/* Spotify Button - Official Design */}
                <TouchableOpacity
                  onPress={() => handleOAuthSignIn('spotify')}
                  disabled={!!loadingOAuth}
                  style={[
                    styles.oauthButton,
                    styles.spotifyButton,
                    loadingOAuth === 'spotify' && styles.oauthButtonLoading,
                    !!loadingOAuth && styles.oauthButtonDisabled,
                  ]}
                  activeOpacity={0.8}
                >
                  {loadingOAuth === 'spotify' ? (
                    <Text style={styles.spotifyButtonText}>Loading...</Text>
                  ) : (
                    <View style={styles.oauthButtonContent}>
                      <Image
                        source={SpotifyLogo}
                        style={styles.spotifyIcon}
                        resizeMode="contain"
                      />
                      <Text style={[styles.spotifyButtonText, { marginLeft: 12 }]}>Continue with Spotify</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.dividerContainer}>
                <Divider style={styles.divider} />
                <Text 
                  style={[styles.dividerText, { color: theme.colors.onSurfaceVariant }]}
                >
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
                  style={styles.form}
                  noValidate
                >
                  <View style={styles.toggleContainer}>
                    <Button
                      mode={isLogin ? 'contained' : 'text'}
                      onPress={() => setIsLogin(true)}
                      style={[styles.toggleButton, isLogin && styles.toggleButtonActive]}
                      labelStyle={isLogin ? { fontWeight: '600' } : { fontWeight: '400' }}
                    >
                      Sign In
                    </Button>
                    <Button
                      mode={!isLogin ? 'contained' : 'text'}
                      onPress={() => setIsLogin(false)}
                      style={[styles.toggleButton, !isLogin && styles.toggleButtonActive]}
                      labelStyle={!isLogin ? { fontWeight: '600' } : { fontWeight: '400' }}
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
                    style={styles.submitButton}
                    contentStyle={styles.submitButtonContent}
                    type="submit"
                  >
                    {isLogin ? 'Sign In' : 'Create Account'}
                  </Button>
                </form>
              ) : (
                <View style={styles.form}>
                  <View style={styles.toggleContainer}>
                    <Button
                      mode={isLogin ? 'contained' : 'text'}
                      onPress={() => setIsLogin(true)}
                      style={[styles.toggleButton, isLogin && styles.toggleButtonActive]}
                      labelStyle={isLogin ? { fontWeight: '600' } : { fontWeight: '400' }}
                    >
                      Sign In
                    </Button>
                    <Button
                      mode={!isLogin ? 'contained' : 'text'}
                      onPress={() => setIsLogin(false)}
                      style={[styles.toggleButton, !isLogin && styles.toggleButtonActive]}
                      labelStyle={!isLogin ? { fontWeight: '600' } : { fontWeight: '400' }}
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
                    style={styles.submitButton}
                    contentStyle={styles.submitButtonContent}
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
    backgroundColor: '#121212',
  },
  loadingText: {
    fontSize: 18,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  cardWrapper: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
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
    fontWeight: 'bold',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 15,
    marginTop: 4,
  },
  oauthContainer: {
    marginBottom: 28,
  },
  oauthButton: {
    borderRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.12,
      shadowRadius: 2,
      elevation: 2,
    }),
  },
  // Google Button - Official Design (White with border)
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#dadce0',
    marginBottom: 12,
    ...(Platform.OS === 'web' ? {
      ':hover': {
        boxShadow: '0 2px 6px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.3)',
      },
    } : {}),
  },
  // Spotify Button - Official Design (Green)
  spotifyButton: {
    backgroundColor: '#1DB954',
    borderWidth: 0,
    ...(Platform.OS === 'web' ? {
      ':hover': {
        backgroundColor: '#1ed760',
        boxShadow: '0 2px 6px rgba(29, 185, 84, 0.3), 0 1px 3px rgba(29, 185, 84, 0.2)',
      },
    } : {}),
  },
  oauthButtonLoading: {
    opacity: 0.7,
  },
  oauthButtonDisabled: {
    opacity: 0.5,
  },
  oauthButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Google Button Text
  googleButtonText: {
    color: '#3c4043',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: Platform.OS === 'web' ? 'Roboto, sans-serif' : undefined,
    letterSpacing: 0.25,
  },
  // Spotify Button Text
  spotifyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // Google Logo (4-color square)
  googleLogoContainer: {
    width: 20,
    height: 20,
    marginRight: 0,
  },
  googleLogo: {
    width: 20,
    height: 20,
    position: 'relative',
    borderRadius: 2,
    overflow: 'hidden',
  },
  googleLogoPart: {
    position: 'absolute',
    width: '50%',
    height: '50%',
  },
  spotifyIcon: {
    width: 20,
    height: 20,
    marginRight: 0,
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
  form: {
    marginTop: 4,
  },
  toggleContainer: {
    flexDirection: 'row',
    marginBottom: 28,
    backgroundColor: 'transparent',
  },
  toggleButton: {
    flex: 1,
    marginHorizontal: 6,
  },
  toggleButtonActive: {
    borderRadius: 8,
  },
  input: {
    marginBottom: 20,
  },
  submitButton: {
    marginTop: 12,
    borderRadius: 12,
  },
  submitButtonContent: {
    paddingVertical: 10,
  },
});

export default AuthScreen;
