import React from 'react';
import { NavigationContainer, DarkTheme as NavigationDarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Provider as PaperProvider } from 'react-native-paper';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
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

// Import context
import { AuthProvider } from './src/context/AuthContext';

// Import theme
import darkTheme from './src/config/theme';

// Import components
import { CustomDrawerContent } from './src/components/DrawerContent';

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
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'SoundCloud & Spotify Jukebox',
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
        name="Admin"
        component={AdminScreen}
        options={{
          title: 'Admin Panel',
        }}
      />
    </Drawer.Navigator>
  );
};

export default function App() {
  return (
    <AuthProvider>
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
              options={({ route }) => ({
                title: route.params.roomName || 'Music Room',
              })}
            />
            <Stack.Screen
              name="Admin"
              component={AuthenticatedStack}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Discovery"
              component={AuthenticatedStack}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Friends"
              component={AuthenticatedStack}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Profile"
              component={AuthenticatedStack}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Leaderboard"
              component={AuthenticatedStack}
              options={{ headerShown: false }}
            />
          </Stack.Navigator>
          <StatusBar style="light" />
        </NavigationContainer>
      </PaperProvider>
    </AuthProvider>
  );
}
