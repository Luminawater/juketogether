import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Animated,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import {
  Text,
  Divider,
  Avatar,
  useTheme,
} from 'react-native-paper';
import { NavigationProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { hasRole } from '../utils/permissions';
import AdsBanner from './AdsBanner';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(320, SCREEN_WIDTH * 0.85);

interface AppDrawerProps {
  visible: boolean;
  onDismiss: () => void;
  navigation: NavigationProp<RootStackParamList>;
}

interface DrawerItemProps {
  icon: string;
  label: string;
  onPress: () => void;
  active?: boolean;
}

const DrawerItem: React.FC<DrawerItemProps> = ({ icon, label, onPress, active }) => {
  const theme = useTheme();
  
  return (
    <TouchableOpacity
      style={[
        styles.drawerItem,
        active && { backgroundColor: theme.colors.primaryContainer },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.drawerItemIcon, { color: active ? theme.colors.onPrimaryContainer : theme.colors.onSurface }]}>
        {icon}
      </Text>
      <Text
        style={[
          styles.drawerItemLabel,
          {
            color: active ? theme.colors.onPrimaryContainer : theme.colors.onSurface,
            fontWeight: active ? '600' : '400',
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

export const AppDrawer: React.FC<AppDrawerProps> = ({ visible, onDismiss, navigation }) => {
  const { user, profile, signOut } = useAuth();
  const theme = useTheme();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, backdropOpacity]);

  const handleNavigate = (screen: keyof RootStackParamList) => {
    onDismiss();
    // For drawer screens (which are nested in Dashboard), use nested navigation
    const drawerScreens = ['Home', 'Discovery', 'Leaderboard', 'Friends', 'Profile', 'Admin'];
    if (drawerScreens.includes(screen)) {
      // Navigate to Dashboard screen, then to the specific drawer screen
      (navigation as any).navigate('Dashboard', { screen });
    } else {
      navigation.navigate(screen);
    }
  };

  const handleSignOut = async () => {
    onDismiss();
    await signOut();
    navigation.navigate('Home');
  };

  const isAdmin = user && profile && hasRole(profile.role, 'admin');
  
  // Get current route name safely - handle nested navigation
  let currentRoute: string | undefined;
  try {
    const state = navigation.getState();
    if (state && state.routes && state.index !== undefined) {
      const currentRouteState = state.routes[state.index];
      currentRoute = currentRouteState?.name;
      
      // If we're on the Dashboard screen, check the nested drawer state
      if (currentRoute === 'Dashboard' && currentRouteState?.state) {
        const drawerState = currentRouteState.state;
        if (drawerState.routes && drawerState.index !== undefined) {
          currentRoute = drawerState.routes[drawerState.index]?.name;
        }
      }
    }
  } catch (e) {
    // Navigation state not available yet
    currentRoute = undefined;
  }

  // Always render the Modal, but only show content if user exists
  return (
    <Modal
      visible={visible && !!user && !!profile}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onDismiss}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                opacity: backdropOpacity,
              },
            ]}
          />
        </TouchableOpacity>

        {/* Drawer */}
        <Animated.View
          style={[
            styles.drawer,
            {
              backgroundColor: theme.colors.surface,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <ScrollView
            style={styles.drawerContent}
            contentContainerStyle={styles.drawerContentContainer}
            showsVerticalScrollIndicator={false}
          >
            {user && profile && (
              <>
                {/* User Info Header */}
                <View style={[styles.userHeader, { borderBottomColor: theme.colors.outline }]}>
                  <Avatar.Image
                    size={64}
                    source={{
                      uri: user.user_metadata?.avatar_url ||
                           `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || '')}&background=667eea&color=fff`
                    }}
                  />
                  <Text style={[styles.userEmail, { color: theme.colors.onSurface }]} numberOfLines={1}>
                    {user.email}
                  </Text>
                  {profile.username && (
                    <Text style={[styles.userName, { color: theme.colors.onSurfaceVariant }]}>
                      @{profile.username}
                    </Text>
                  )}
                </View>

            {/* Navigation Items */}
            <View style={styles.drawerSection}>
              <DrawerItem
                icon="🏠"
                label="Dashboard"
                onPress={() => handleNavigate('Home')}
                active={currentRoute === 'Home'}
              />
              <DrawerItem
                icon="🔍"
                label="Discover Rooms"
                onPress={() => handleNavigate('Discovery')}
                active={currentRoute === 'Discovery'}
              />
              <DrawerItem
                icon="🏆"
                label="Leaderboard"
                onPress={() => handleNavigate('Leaderboard')}
                active={currentRoute === 'Leaderboard'}
              />
              <DrawerItem
                icon="👥"
                label="Friends"
                onPress={() => handleNavigate('Friends')}
                active={currentRoute === 'Friends'}
              />
              <DrawerItem
                icon="✏️"
                label="Edit Profile"
                onPress={() => handleNavigate('Profile')}
                active={currentRoute === 'Profile'}
              />
              {isAdmin && (
                <DrawerItem
                  icon="🛡️"
                  label="Admin Panel"
                  onPress={() => handleNavigate('Admin')}
                  active={currentRoute === 'Admin'}
                />
              )}
            </View>

                <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />

                {/* Account Section */}
                <View style={styles.drawerSection}>
                  <DrawerItem
                    icon="🚪"
                    label="Sign Out"
                    onPress={handleSignOut}
                  />
                </View>

                {/* Upgrade Ads Banner */}
                <View style={styles.adsContainer}>
                  <AdsBanner
                    onUpgradePress={() => {
                      onDismiss();
                      navigation.navigate('Subscription');
                    }}
                  />
                </View>
              </>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    elevation: 16,
    // Web-compatible shadow
    ...(Platform.OS === 'web' ? {
      boxShadow: '2px 0px 8px rgba(0, 0, 0, 0.25)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 2, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
    }),
  },
  drawerContent: {
    flex: 1,
  },
  drawerContentContainer: {
    flexGrow: 1,
  },
  userHeader: {
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  userName: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  drawerSection: {
    paddingVertical: 8,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    minHeight: 56,
  },
  drawerItemIcon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
    marginRight: 16,
  },
  drawerItemLabel: {
    fontSize: 16,
    flex: 1,
  },
  divider: {
    marginVertical: 8,
    marginHorizontal: 16,
  },
  adsContainer: {
    paddingBottom: 16,
  },
});
