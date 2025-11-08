import React, { useState, useEffect, useRef } from 'react';
import {
  View,
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
      <View className="flex-1 justify-center items-center bg-background">
        <Text className="text-on-surface text-lg">Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      style={{ backgroundColor: theme.colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 justify-center max-w-[420px] w-full self-center">
          <Card 
            className="rounded-[20px] overflow-hidden"
            style={{ 
              backgroundColor: theme.colors.surface,
              ...(Platform.OS === 'web' ? {
                boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.2)',
              } : {
                elevation: 4,
              }),
            }}
          >
            <Card.Content className="p-8">
              {/* Logo and Title */}
              <View className="items-center mb-10">
                <Image
                  source={SpotifyLogo}
                  className="w-14 h-14 mb-5"
                  resizeMode="contain"
                />
                <Title 
                  className="text-center text-[32px] font-bold -tracking-[0.5px] mb-2"
                  style={{ color: theme.colors.onSurface }}
                >
                  Music Jukebox
                </Title>
                <Paragraph 
                  className="text-center text-[15px] mt-1"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  {isLogin ? 'Welcome back' : 'Create your account'}
                </Paragraph>
              </View>

              {/* OAuth Buttons */}
              <View className="mb-7">
                <TouchableOpacity
                  onPress={() => handleOAuthSignIn('google')}
                  disabled={!!loadingOAuth}
                  className={`rounded-xl py-4 px-5 items-center justify-center min-h-[56px] ${
                    loadingOAuth === 'google' ? 'opacity-70' : ''
                  } ${!!loadingOAuth ? 'opacity-50' : ''}`}
                  style={{ backgroundColor: '#4285F4' }}
                  activeOpacity={0.8}
                >
                  {loadingOAuth === 'google' ? (
                    <Text className="text-white text-base font-semibold">Loading...</Text>
                  ) : (
                    <View className="flex-row items-center justify-center">
                      <MaterialCommunityIcons name="google" size={24} color="#FFFFFF" />
                      <Text className="text-white text-base font-semibold ml-2.5">Continue with Google</Text>
                    </View>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => handleOAuthSignIn('spotify')}
                  disabled={!!loadingOAuth}
                  className={`rounded-xl py-4 px-5 items-center justify-center min-h-[56px] mt-3 ${
                    loadingOAuth === 'spotify' ? 'opacity-70' : ''
                  } ${!!loadingOAuth ? 'opacity-50' : ''}`}
                  style={{ backgroundColor: '#1DB954' }}
                  activeOpacity={0.8}
                >
                  {loadingOAuth === 'spotify' ? (
                    <Text className="text-white text-base font-semibold">Loading...</Text>
                  ) : (
                    <View className="flex-row items-center justify-center">
                      <Image
                        source={SpotifyLogo}
                        className="w-6 h-6"
                        resizeMode="contain"
                      />
                      <Text className="text-white text-base font-semibold ml-2.5">Continue with Spotify</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <View className="flex-row items-center my-7">
                <Divider className="flex-1 h-[1px]" />
                <Text 
                  className="mx-3 text-[13px] font-medium lowercase"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  or
                </Text>
                <Divider className="flex-1 h-[1px]" />
              </View>

              {/* Email/Password Form */}
              {Platform.OS === 'web' ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAuth();
                  }}
                  className="mt-1"
                  noValidate
                >
                  <View className="flex-row mb-7 gap-3 bg-transparent">
                    <Button
                      mode={isLogin ? 'contained' : 'text'}
                      onPress={() => setIsLogin(true)}
                      className={`flex-1 ${isLogin ? 'rounded-lg' : ''}`}
                      labelStyle={isLogin ? { fontWeight: '600' } : { fontWeight: '400' }}
                    >
                      Sign In
                    </Button>
                    <Button
                      mode={!isLogin ? 'contained' : 'text'}
                      onPress={() => setIsLogin(false)}
                      className={`flex-1 ${!isLogin ? 'rounded-lg' : ''}`}
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
                    className="mb-5"
                    disabled={!!loadingOAuth}
                    autoComplete="email"
                  />

                  <TextInput
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    mode="outlined"
                    secureTextEntry
                    className="mb-5"
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
                      className="mb-5"
                      disabled={!!loadingOAuth}
                      autoComplete="new-password"
                    />
                  )}

                  <Button
                    mode="contained"
                    onPress={handleAuth}
                    loading={loadingAuth}
                    disabled={loadingAuth || !!loadingOAuth}
                    className="mt-3 rounded-xl"
                    contentStyle={{ paddingVertical: 10 }}
                    type="submit"
                  >
                    {isLogin ? 'Sign In' : 'Create Account'}
                  </Button>
                </form>
              ) : (
                <View className="mt-1">
                  <View className="flex-row mb-7 gap-3 bg-transparent">
                    <Button
                      mode={isLogin ? 'contained' : 'text'}
                      onPress={() => setIsLogin(true)}
                      className={`flex-1 ${isLogin ? 'rounded-lg' : ''}`}
                      labelStyle={isLogin ? { fontWeight: '600' } : { fontWeight: '400' }}
                    >
                      Sign In
                    </Button>
                    <Button
                      mode={!isLogin ? 'contained' : 'text'}
                      onPress={() => setIsLogin(false)}
                      className={`flex-1 ${!isLogin ? 'rounded-lg' : ''}`}
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
                    className="mb-5"
                    disabled={!!loadingOAuth}
                  />

                  <TextInput
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    mode="outlined"
                    secureTextEntry
                    className="mb-5"
                    disabled={!!loadingOAuth}
                  />

                  {!isLogin && (
                    <TextInput
                      label="Confirm Password"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      mode="outlined"
                      secureTextEntry
                      className="mb-5"
                      disabled={!!loadingOAuth}
                    />
                  )}

                  <Button
                    mode="contained"
                    onPress={handleAuth}
                    loading={loadingAuth}
                    disabled={loadingAuth || !!loadingOAuth}
                    className="mt-3 rounded-xl"
                    contentStyle={{ paddingVertical: 10 }}
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

export default AuthScreen;
