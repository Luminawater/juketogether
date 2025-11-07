import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Drawer, DrawerItem, DrawerSection } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { hasRole } from '../utils/permissions';

type NavigationProp = StackNavigationProp<RootStackParamList>;

interface AppDrawerProps {
  visible: boolean;
  onDismiss: () => void;
}

export const AppDrawer: React.FC<AppDrawerProps> = ({ visible, onDismiss }) => {
  const navigation = useNavigation<NavigationProp>();
  const { user, profile, signOut } = useAuth();

  const handleNavigate = (screen: keyof RootStackParamList) => {
    onDismiss();
    navigation.navigate(screen);
  };

  const handleSignOut = async () => {
    onDismiss();
    await signOut();
    navigation.navigate('Home');
  };

  if (!user || !profile) {
    return null;
  }

  const isAdmin = hasRole(profile.role, 'admin');

  return (
    <Drawer.Section title="Navigation" style={styles.drawer}>
      <DrawerItem
        label="Dashboard"
        icon="home"
        onPress={() => handleNavigate('Dashboard')}
      />
      <DrawerItem
        label="Discovery"
        icon="compass"
        onPress={() => handleNavigate('Discovery')}
      />
      <DrawerItem
        label="Leaderboard"
        icon="trophy"
        onPress={() => handleNavigate('Leaderboard')}
      />
      <DrawerItem
        label="Friends"
        icon="account-group"
        onPress={() => handleNavigate('Friends')}
      />
      {isAdmin && (
        <DrawerItem
          label="Admin Panel"
          icon="shield-account"
          onPress={() => handleNavigate('Admin')}
        />
      )}
      <Drawer.Section title="Account" style={styles.section}>
        <DrawerItem
          label="Sign Out"
          icon="logout"
          onPress={handleSignOut}
        />
      </Drawer.Section>
    </Drawer.Section>
  );
};

const styles = StyleSheet.create({
  drawer: {
    flex: 1,
  },
  section: {
    marginTop: 16,
  },
});

