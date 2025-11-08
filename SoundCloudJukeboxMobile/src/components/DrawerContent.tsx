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
import AdsBanner from './AdsBanner';
import { LanguageSelector } from './LanguageSelector';

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
      <View style={styles.navContainer}>
      <DrawerItem
        label="Dashboard"
        icon={({ color, size }) => (
          <MaterialCommunityIcons 
            name="home" 
            size={size} 
            color={currentRoute === 'Home' ? theme.colors.onPrimaryContainer : color} 
          />
        )}
        active={currentRoute === 'Home'}
        onPress={() => handleNavigate('Home')}
        labelStyle={[
          styles.drawerItemLabel,
          currentRoute === 'Home' && { color: theme.colors.onPrimaryContainer, fontWeight: '600' },
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
          <MaterialCommunityIcons 
            name="compass-outline" 
            size={size} 
            color={currentRoute === 'Discovery' ? theme.colors.onPrimaryContainer : color} 
          />
        )}
        active={currentRoute === 'Discovery'}
        onPress={() => handleNavigate('Discovery')}
        labelStyle={[
          styles.drawerItemLabel,
          currentRoute === 'Discovery' && { color: theme.colors.onPrimaryContainer, fontWeight: '600' },
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
          <MaterialCommunityIcons 
            name="trophy" 
            size={size} 
            color={currentRoute === 'Leaderboard' ? theme.colors.onPrimaryContainer : color} 
          />
        )}
        active={currentRoute === 'Leaderboard'}
        onPress={() => handleNavigate('Leaderboard')}
        labelStyle={[
          styles.drawerItemLabel,
          currentRoute === 'Leaderboard' && { color: theme.colors.onPrimaryContainer, fontWeight: '600' },
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
          <MaterialCommunityIcons 
            name="account-group" 
            size={size} 
            color={currentRoute === 'Friends' ? theme.colors.onPrimaryContainer : color} 
          />
        )}
        active={currentRoute === 'Friends'}
        onPress={() => handleNavigate('Friends')}
        labelStyle={[
          styles.drawerItemLabel,
          currentRoute === 'Friends' && { color: theme.colors.onPrimaryContainer, fontWeight: '600' },
        ]}
        style={[
          styles.drawerItem,
          currentRoute === 'Friends' && { backgroundColor: theme.colors.primaryContainer },
        ]}
        activeBackgroundColor={theme.colors.primaryContainer}
        inactiveBackgroundColor="transparent"
      />
      <DrawerItem
        label="Playlists"
        icon={({ color, size }) => (
          <MaterialCommunityIcons 
            name="playlist-music" 
            size={size} 
            color={currentRoute === 'Playlist' ? theme.colors.onPrimaryContainer : color} 
          />
        )}
        active={currentRoute === 'Playlist'}
        onPress={() => handleNavigate('Playlist')}
        labelStyle={[
          styles.drawerItemLabel,
          currentRoute === 'Playlist' && { color: theme.colors.onPrimaryContainer, fontWeight: '600' },
        ]}
        style={[
          styles.drawerItem,
          currentRoute === 'Playlist' && { backgroundColor: theme.colors.primaryContainer },
        ]}
        activeBackgroundColor={theme.colors.primaryContainer}
        inactiveBackgroundColor="transparent"
      />
      <DrawerItem
        label="Edit Profile"
        icon={({ color, size }) => (
          <MaterialCommunityIcons 
            name="account-edit" 
            size={size} 
            color={currentRoute === 'Profile' ? theme.colors.onPrimaryContainer : color} 
          />
        )}
        active={currentRoute === 'Profile'}
        onPress={() => handleNavigate('Profile')}
        labelStyle={[
          styles.drawerItemLabel,
          currentRoute === 'Profile' && { color: theme.colors.onPrimaryContainer, fontWeight: '600' },
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
            <MaterialCommunityIcons 
              name="shield-account" 
              size={size} 
              color={currentRoute === 'Admin' ? theme.colors.onPrimaryContainer : color} 
            />
          )}
          active={currentRoute === 'Admin'}
          onPress={() => handleNavigate('Admin')}
          labelStyle={[
            styles.drawerItemLabel,
            currentRoute === 'Admin' && { color: theme.colors.onPrimaryContainer, fontWeight: '600' },
          ]}
          style={[
            styles.drawerItem,
            currentRoute === 'Admin' && { backgroundColor: theme.colors.primaryContainer },
          ]}
          activeBackgroundColor={theme.colors.primaryContainer}
          inactiveBackgroundColor="transparent"
        />
      )}
      </View>

      {/* Upgrade Account Ads Banner */}
      {profile.subscription_tier === 'free' && (
        <View style={styles.adsContainer}>
          <AdsBanner
            onUpgradePress={() => {
              handleNavigate('Subscription');
            }}
          />
        </View>
      )}

      {/* Language Selector */}
      <View style={styles.languageSection}>
        <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
        <LanguageSelector />
      </View>

      {/* Footer with Contact Email */}
      <View style={styles.footer}>
        <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
        
        <DrawerItem
          label="Sign Out"
          icon={({ color, size }) => (
            <MaterialCommunityIcons name="logout" size={size} color={theme.colors.error} />
          )}
          onPress={handleSignOut}
          labelStyle={[styles.drawerItemLabel, { color: theme.colors.error }]}
          style={styles.drawerItem}
          inactiveBackgroundColor="transparent"
        />
        
        <TouchableOpacity
          onPress={() => {
            const email = 'mail@juketogether.com';
            const subject = 'Contact from JukeTogether App';
            const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
            Linking.openURL(mailtoUrl).catch(err => {
              console.error('Error opening email:', err);
              // Fallback: copy email to clipboard on web
              if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
                navigator.clipboard.writeText(email);
                alert(`Email copied to clipboard: ${email}`);
              }
            });
          }}
          style={styles.footerContact}
        >
          <MaterialCommunityIcons 
            name="email-outline" 
            size={16} 
            color={theme.colors.onSurfaceVariant} 
            style={styles.footerIcon}
          />
          <Text style={[styles.footerText, { color: theme.colors.onSurfaceVariant }]}>
            mail@juketogether.com
          </Text>
        </TouchableOpacity>
      </View>
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
  adsContainer: {
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 8,
  },
  navContainer: {
    paddingTop: 8,
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
  languageSection: {
    marginTop: 'auto',
    paddingTop: 8,
  },
  footer: {
    paddingBottom: Platform.OS === 'web' ? 20 : 16,
  },
  footerContact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  footerIcon: {
    marginRight: 8,
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

