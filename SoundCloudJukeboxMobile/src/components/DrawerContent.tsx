import React from 'react';
import { View, StyleSheet, Linking, TouchableOpacity, Platform } from 'react-native';
import {
  Text,
  Avatar,
  Divider,
  useTheme,
  Chip,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DrawerContentScrollView, DrawerItem, DrawerContentComponentProps } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { hasRole, getTierDisplayName, getTierColor, getRoleDisplayName, getRoleColor } from '../utils/permissions';

type NavigationProp = StackNavigationProp<RootStackParamList>;

export const CustomDrawerContent: React.FC<DrawerContentComponentProps> = (props) => {
  const navigation = useNavigation<NavigationProp>();
  const { user, profile, signOut } = useAuth();
  const theme = useTheme();

  const handleNavigate = (screen: keyof RootStackParamList) => {
    props.navigation.navigate(screen);
    // Close drawer after navigation
    props.navigation.closeDrawer();
  };

  const handleSignOut = async () => {
    await signOut();
    props.navigation.closeDrawer();
    navigation.navigate('Home');
  };

  if (!user || !profile) {
    return null;
  }

  const isAdmin = hasRole(profile.role, 'admin');
  
  // Get current route from drawer navigation state
  const currentRoute = props.state?.routes[props.state?.index || 0]?.name;

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={[
        styles.drawerContent,
        { backgroundColor: theme.colors.surface },
      ]}
    >
      {/* User Info Header */}
      <View style={[styles.userHeader, { borderBottomColor: theme.colors.outline }]}>
        <Avatar.Image
          size={72}
          source={{
            uri: user.user_metadata?.avatar_url ||
                 `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || '')}&background=667eea&color=fff`
          }}
        />
        <View style={styles.userInfo}>
          <Text style={[styles.userEmail, { color: theme.colors.onSurface }]} numberOfLines={1}>
            {profile.display_name || user.email}
          </Text>
          {profile.username && (
            <Text style={[styles.userName, { color: theme.colors.onSurfaceVariant }]}>
              @{profile.username}
            </Text>
          )}
          <View style={styles.badgeContainer}>
            <Chip
              icon={() => <MaterialCommunityIcons name="crown" size={14} color={getTierColor(profile.subscription_tier)} />}
              style={[styles.badge, { backgroundColor: getTierColor(profile.subscription_tier) + '20' }]}
              textStyle={[styles.badgeText, { color: getTierColor(profile.subscription_tier) }]}
              compact
            >
              {getTierDisplayName(profile.subscription_tier)}
            </Chip>
            {hasRole(profile.role, 'admin') && (
              <Chip
                icon={() => <MaterialCommunityIcons name="shield-account" size={14} color={getRoleColor(profile.role)} />}
                style={[styles.badge, { backgroundColor: getRoleColor(profile.role) + '20' }]}
                textStyle={[styles.badgeText, { color: getRoleColor(profile.role) }]}
                compact
              >
                {getRoleDisplayName(profile.role)}
              </Chip>
            )}
          </View>
        </View>
      </View>

      {/* Navigation Items */}
      <DrawerItem
        label="Dashboard"
        icon={({ color, size }) => (
          <MaterialCommunityIcons name="home" size={size} color={color} />
        )}
        active={currentRoute === 'Home'}
        onPress={() => handleNavigate('Home')}
        labelStyle={[
          styles.drawerItemLabel,
          currentRoute === 'Home' && { color: theme.colors.primary, fontWeight: '600' },
        ]}
        style={[
          styles.drawerItem,
          currentRoute === 'Home' && { backgroundColor: theme.colors.primaryContainer },
        ]}
        activeBackgroundColor={theme.colors.primaryContainer}
        inactiveBackgroundColor="transparent"
      />
      <DrawerItem
        label="Discover Rooms"
        icon={({ color, size }) => (
          <MaterialCommunityIcons name="compass-outline" size={size} color={color} />
        )}
        active={currentRoute === 'Discovery'}
        onPress={() => handleNavigate('Discovery')}
        labelStyle={[
          styles.drawerItemLabel,
          currentRoute === 'Discovery' && { color: theme.colors.primary, fontWeight: '600' },
        ]}
        style={[
          styles.drawerItem,
          currentRoute === 'Discovery' && { backgroundColor: theme.colors.primaryContainer },
        ]}
        activeBackgroundColor={theme.colors.primaryContainer}
        inactiveBackgroundColor="transparent"
      />
      <DrawerItem
        label="Leaderboard"
        icon={({ color, size }) => (
          <MaterialCommunityIcons name="trophy" size={size} color={color} />
        )}
        active={currentRoute === 'Leaderboard'}
        onPress={() => handleNavigate('Leaderboard')}
        labelStyle={[
          styles.drawerItemLabel,
          currentRoute === 'Leaderboard' && { color: theme.colors.primary, fontWeight: '600' },
        ]}
        style={[
          styles.drawerItem,
          currentRoute === 'Leaderboard' && { backgroundColor: theme.colors.primaryContainer },
        ]}
        activeBackgroundColor={theme.colors.primaryContainer}
        inactiveBackgroundColor="transparent"
      />
      <DrawerItem
        label="Friends"
        icon={({ color, size }) => (
          <MaterialCommunityIcons name="account-group" size={size} color={color} />
        )}
        active={currentRoute === 'Friends'}
        onPress={() => handleNavigate('Friends')}
        labelStyle={[
          styles.drawerItemLabel,
          currentRoute === 'Friends' && { color: theme.colors.primary, fontWeight: '600' },
        ]}
        style={[
          styles.drawerItem,
          currentRoute === 'Friends' && { backgroundColor: theme.colors.primaryContainer },
        ]}
        activeBackgroundColor={theme.colors.primaryContainer}
        inactiveBackgroundColor="transparent"
      />
      <DrawerItem
        label="Edit Profile"
        icon={({ color, size }) => (
          <MaterialCommunityIcons name="account-edit" size={size} color={color} />
        )}
        active={currentRoute === 'Profile'}
        onPress={() => handleNavigate('Profile')}
        labelStyle={[
          styles.drawerItemLabel,
          currentRoute === 'Profile' && { color: theme.colors.primary, fontWeight: '600' },
        ]}
        style={[
          styles.drawerItem,
          currentRoute === 'Profile' && { backgroundColor: theme.colors.primaryContainer },
        ]}
        activeBackgroundColor={theme.colors.primaryContainer}
        inactiveBackgroundColor="transparent"
      />
      {isAdmin && (
        <DrawerItem
          label="Admin Panel"
          icon={({ color, size }) => (
            <MaterialCommunityIcons name="shield-account" size={size} color={color} />
          )}
          active={currentRoute === 'Admin'}
          onPress={() => handleNavigate('Admin')}
          labelStyle={[
            styles.drawerItemLabel,
            currentRoute === 'Admin' && { color: theme.colors.primary, fontWeight: '600' },
          ]}
          style={[
            styles.drawerItem,
            currentRoute === 'Admin' && { backgroundColor: theme.colors.primaryContainer },
          ]}
          activeBackgroundColor={theme.colors.primaryContainer}
          inactiveBackgroundColor="transparent"
        />
      )}

      <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />

      <DrawerItem
        label="Sign Out"
        icon={({ color, size }) => (
          <MaterialCommunityIcons name="logout" size={size} color={color} />
        )}
        onPress={handleSignOut}
        labelStyle={[styles.drawerItemLabel, { color: theme.colors.error }]}
        style={styles.drawerItem}
        inactiveBackgroundColor="transparent"
      />
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  drawerContent: {
    flex: 1,
  },
  userHeader: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  userInfo: {
    alignItems: 'center',
    marginTop: 12,
    width: '100%',
  },
  userEmail: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  userName: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
    opacity: 0.7,
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  badge: {
    marginHorizontal: 4,
    height: 24,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  drawerItem: {
    borderRadius: 12,
    marginHorizontal: 8,
    marginVertical: 2,
  },
  drawerItemLabel: {
    fontSize: 16,
    marginLeft: -8,
  },
  divider: {
    marginVertical: 12,
    marginHorizontal: 16,
    height: 1,
  },
});

