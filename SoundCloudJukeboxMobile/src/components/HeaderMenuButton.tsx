import React, { useState } from 'react';
import { IconButton, Menu, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { hasRole } from '../utils/permissions';

type NavigationProp = StackNavigationProp<RootStackParamList>;

export const HeaderMenuButton: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { profile, signOut } = useAuth();
  const theme = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);

  const handleNavigate = (screen: keyof RootStackParamList) => {
    setMenuVisible(false);
    navigation.navigate(screen);
  };

  const handleSignOut = async () => {
    setMenuVisible(false);
    await signOut();
    navigation.navigate('Home');
  };

  const isAdmin = profile && hasRole(profile.role, 'admin');

  return (
    <Menu
      visible={menuVisible}
      onDismiss={() => setMenuVisible(false)}
      anchor={
        <IconButton
          icon="menu"
          iconColor={theme.colors.onSurface}
          onPress={() => setMenuVisible(true)}
          size={24}
        />
      }
    >
      <Menu.Item
        onPress={() => handleNavigate('Dashboard')}
        title="Dashboard"
        leadingIcon="home"
      />
      <Menu.Item
        onPress={() => handleNavigate('Discovery')}
        title="Discover Rooms"
        leadingIcon="compass"
      />
      <Menu.Item
        onPress={() => handleNavigate('Leaderboard')}
        title="Leaderboard"
        leadingIcon="trophy"
      />
      <Menu.Item
        onPress={() => handleNavigate('Friends')}
        title="Friends"
        leadingIcon="account-group"
      />
      <Menu.Item
        onPress={() => handleNavigate('Profile')}
        title="Edit Profile"
        leadingIcon="account-edit"
      />
      {isAdmin && (
        <Menu.Item
          onPress={() => handleNavigate('Admin')}
          title="Admin Panel"
          leadingIcon="shield-account"
        />
      )}
      <Menu.Item
        onPress={handleSignOut}
        title="Sign Out"
        leadingIcon="logout"
      />
    </Menu>
  );
};

