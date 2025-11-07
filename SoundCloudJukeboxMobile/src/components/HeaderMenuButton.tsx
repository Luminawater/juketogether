import React, { useState } from 'react';
import { IconButton, useTheme, Portal } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { AppDrawer } from './AppDrawer';

type NavigationProp = StackNavigationProp<RootStackParamList>;

export const HeaderMenuButton: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const [drawerVisible, setDrawerVisible] = useState(false);

  const handleOpenDrawer = () => {
    console.log('Opening drawer...');
    setDrawerVisible(true);
  };

  const handleCloseDrawer = () => {
    console.log('Closing drawer...');
    setDrawerVisible(false);
  };

  return (
    <>
      <IconButton
        icon="menu"
        iconColor={theme.colors.onSurface}
        onPress={handleOpenDrawer}
        size={24}
      />
      <AppDrawer
        visible={drawerVisible}
        onDismiss={handleCloseDrawer}
        navigation={navigation}
      />
    </>
  );
};

