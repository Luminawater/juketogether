import React from 'react';
import { NavigationContainer, DarkTheme as NavigationDarkTheme, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Provider as PaperProvider } from 'react-native-paper';
import { IconButton } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';

// Import screens
import HomeScreen from './src/screens/HomeScreen';
import AuthScreen from './src/screens/AuthScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import RoomScreen from './src/screens/RoomScreen';
import AdminScreen from './src/screens/AdminScreen';
import DiscoveryScreen from './src/screens/DiscoveryScreen';
import FriendsScreen from './src/screens/FriendsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import PublicProfileScreen from './src/screens/PublicProfileScreen';
import SubscriptionScreen from './src/screens/SubscriptionScreen';
import PaymentSuccessScreen from './src/screens/PaymentSuccessScreen';
import PlaylistScreen from './src/screens/PlaylistScreen';
import DJModeScreen from './src/screens/DJModeScreen';

// Import context
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
// Initialize i18n
import './src/config/i18n';

// Import theme
import darkTheme from './src/config/theme';

// Import components
import { CustomDrawerContent } from './src/components/DrawerContent';
import { NotificationBadge } from './src/components/NotificationBadge';

// Navigation types
export type RootStackParamList = {
  Home: undefined;
  Auth: undefined;
  Dashboard: undefined;
  Room: { roomId: string; roomName?: string; isShortCode?: boolean };
  Admin: undefined;
  Discovery: undefined;
  Friends: undefined;
  Profile: undefined;
  Leaderboard: undefined;
  Subscription: undefined;
  PaymentSuccess: { sessionId?: string };
  PublicProfile: { id: string };
  Playlist: { playlistId?: string } | undefined;
  DJMode: { roomId: string; roomName?: string; isShortCode?: boolean };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<RootStackParamList>();

// Deep linking configuration for web
const linking = {
  prefixes: [
    Linking.createURL('/'),
    ...(Platform.OS === 'web' ? ['/'] : []),
  ],
  config: {
    screens: {
      Home: '',
      Auth: 'auth',
      Dashboard: 'dashboard',
      Room: 'room/:roomId',
      Admin: 'admin',
      Discovery: 'discovery',
      Friends: 'friends',
      Profile: 'profile',
      Leaderboard: 'leaderboard',
      Subscription: 'subscription',
      PaymentSuccess: 'subscription/success',
      PublicProfile: 'profile/:id',
      Playlist: 'playlist/:playlistId?',
      DJMode: 'room/:roomId/dj',
    },
  },
};

// Custom navigation dark theme matching Material Design
const CustomNavigationDarkTheme = {
  ...NavigationDarkTheme,
  colors: {
    ...NavigationDarkTheme.colors,
    primary: darkTheme.colors.primary,
    background: darkTheme.colors.background,
    card: darkTheme.colors.surface,
    text: darkTheme.colors.onSurface,
    border: darkTheme.colors.outline,
    notification: darkTheme.colors.error,
  },
};

// Main authenticated stack with drawer
const AuthenticatedStack = () => {
  const { user, loading } = useAuth();
  const navigation = useNavigation();

  // Redirect to auth if not authenticated
  React.useEffect(() => {
    if (!loading && !user) {
      // Use React Navigation for all platforms to avoid full page reload
      // This ensures session state is preserved during navigation
      navigation.replace('Auth' as never);
    }
  }, [user, loading, navigation]);

  // Show loading while checking auth
  if (loading) {
    return null;
  }

  // Don't render drawer if not authenticated
  if (!user) {
    return null;
  }

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerStyle: {
          backgroundColor: darkTheme.colors.surface,
        },
        headerTintColor: darkTheme.colors.onSurface,
        headerTitleStyle: {
          fontWeight: 'bold',
          color: darkTheme.colors.onSurface,
        },
        headerRight: () => <NotificationBadge />,
        drawerStyle: {
          backgroundColor: darkTheme.colors.surface,
          width: 320,
        },
        drawerActiveTintColor: darkTheme.colors.primary,
        drawerInactiveTintColor: darkTheme.colors.onSurfaceVariant,
        drawerActiveBackgroundColor: darkTheme.colors.primaryContainer,
        drawerItemStyle: {
          borderRadius: 12,
          marginHorizontal: 8,
          marginVertical: 2,
        },
        drawerLabelStyle: {
          marginLeft: -8,
          fontSize: 16,
        },
        contentStyle: {
          backgroundColor: darkTheme.colors.background,
        },
      }}
    >
      <Drawer.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          title: '',
        }}
      />
      <Drawer.Screen
        name="Discovery"
        component={DiscoveryScreen}
        options={{
          title: 'Discover Rooms',
        }}
      />
      <Drawer.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{
          title: 'Leaderboard',
        }}
      />
      <Drawer.Screen
        name="Friends"
        component={FriendsScreen}
        options={{
          title: 'Friends',
        }}
      />
      <Drawer.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Edit Profile',
        }}
      />
      <Drawer.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{
          title: 'Subscription',
        }}
      />
      <Drawer.Screen
        name="Admin"
        component={AdminScreen}
        options={{
          title: 'Admin Panel',
        }}
      />
      <Drawer.Screen
        name="Playlist"
        component={PlaylistScreen}
        options={{
          title: 'Playlists',
        }}
      />
    </Drawer.Navigator>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LanguageProvider>
          <PaperProvider theme={darkTheme}>
            <NavigationContainer 
              theme={CustomNavigationDarkTheme}
              linking={linking}
            >
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerStyle: {
                backgroundColor: darkTheme.colors.surface,
              },
              headerTintColor: darkTheme.colors.onSurface,
              headerTitleStyle: {
                fontWeight: 'bold',
                color: darkTheme.colors.onSurface,
              },
              contentStyle: {
                backgroundColor: darkTheme.colors.background,
              },
            }}
          >
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Auth"
              component={AuthScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Dashboard"
              component={AuthenticatedStack}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Room"
              component={RoomScreen}
              options={({ route, navigation }) => ({
                title: '',
                headerLeft: () => (
                  <IconButton
                    icon="arrow-left"
                    iconColor={darkTheme.colors.onSurface}
                    size={24}
                    onPress={() => {
                      if (navigation.canGoBack()) {
                        navigation.goBack();
                      }
                    }}
                    style={{ backgroundColor: 'transparent' }}
                  />
                ),
                headerRight: () => <NotificationBadge />,
              })}
            />
            <Stack.Screen
              name="PublicProfile"
              component={PublicProfileScreen}
              options={{
                title: 'Profile',
              }}
            />
            <Stack.Screen
              name="PaymentSuccess"
              component={PaymentSuccessScreen}
              options={{
                title: 'Payment Success',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="DJMode"
              component={DJModeScreen}
              options={({ route, navigation }) => ({
                title: '',
                headerShown: false,
              })}
            />
            <Stack.Screen
              name="Subscription"
              component={SubscriptionScreen}
              options={{
                title: 'Subscription',
              }}
            />
          </Stack.Navigator>
          <StatusBar style="light" />
          </NavigationContainer>
        </PaperProvider>
        </LanguageProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
