import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Text,
  Avatar,
  Divider,
  useTheme,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { hasRole } from '../utils/permissions';

type NavigationProp = StackNavigationProp<RootStackParamList>;

export const CustomDrawerContent: React.FC<any> = (props) => {
  const navigation = useNavigation<NavigationProp>();
  const { user, profile, signOut } = useAuth();
  const theme = useTheme();

  const handleNavigate = (screen: keyof RootStackParamList) => {
    navigation.navigate(screen);
  };

  const handleSignOut = async () => {
    await signOut();
    navigation.navigate('Home');
  };

  if (!user || !profile) {
    return null;
  }

  const isAdmin = hasRole(profile.role, 'admin');
  const currentRoute = navigation.getState()?.routes[navigation.getState()?.index || 0]?.name;

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
      <DrawerItem
        label="Dashboard"
        icon={({ color, size }) => (
          <MaterialCommunityIcons name="home" size={size} color={color} />
        )}
        active={currentRoute === 'Dashboard'}
        onPress={() => handleNavigate('Dashboard')}
        labelStyle={[
          styles.drawerItemLabel,
          currentRoute === 'Dashboard' && { color: theme.colors.primary, fontWeight: '600' },
        ]}
        style={[
          styles.drawerItem,
          currentRoute === 'Dashboard' && { backgroundColor: theme.colors.primaryContainer },
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
    padding: 24,
    paddingTop: 60,
    paddingBottom: 24,
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

