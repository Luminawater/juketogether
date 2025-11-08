import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Badge, IconButton, useTheme } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { getUnreadNotificationCount, Notification } from '../services/notificationService';
import { NotificationDropdown } from './NotificationDropdown';
import { NotificationFullscreenDialog } from './NotificationFullscreenDialog';

export const NotificationBadge: React.FC = () => {
  const theme = useTheme();
  const { user, supabase } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch unread count
  const fetchUnreadCount = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const count = await getUnreadNotificationCount(supabase, user.id);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch and set up real-time subscription
  useEffect(() => {
    if (!user) return;

    fetchUnreadCount();

    // Subscribe to notification changes
    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    // Poll for updates every 30 seconds as backup
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [user]);

  const handleBadgePress = () => {
    setDropdownVisible(true);
  };

  const handleViewAll = () => {
    setDropdownVisible(false);
    setFullscreenVisible(true);
  };

  const handleCloseDropdown = () => {
    setDropdownVisible(false);
  };

  const handleCloseFullscreen = () => {
    setFullscreenVisible(false);
    // Refresh count after closing
    fetchUnreadCount();
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        onPress={handleBadgePress}
        style={styles.container}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <IconButton
            icon="bell-outline"
            iconColor={theme.colors.onSurface}
            size={24}
            style={[styles.icon, { backgroundColor: 'transparent' }]}
          />
          {unreadCount > 0 && (
            <Badge
              visible={unreadCount > 0}
              size={20}
              style={[
                styles.badge,
                { backgroundColor: theme.colors.error }
              ]}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </View>
      </TouchableOpacity>

      <NotificationDropdown
        visible={dropdownVisible}
        onDismiss={handleCloseDropdown}
        onViewAll={handleViewAll}
        onNotificationRead={() => fetchUnreadCount()}
      />

      <NotificationFullscreenDialog
        visible={fullscreenVisible}
        onDismiss={handleCloseFullscreen}
        onNotificationRead={() => fetchUnreadCount()}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginRight: 8,
  },
  iconContainer: {
    position: 'relative',
  },
  icon: {
    margin: 0,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
  },
});

