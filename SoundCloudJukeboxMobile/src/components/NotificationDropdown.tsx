import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import {
  Portal,
  Surface,
  Text,
  Divider,
  ActivityIndicator,
  useTheme,
  Button,
} from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import {
  getNotifications,
  markNotificationAsSeen,
  Notification,
  NotificationType,
} from '../services/notificationService';

// Simple time formatter
const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

interface NotificationDropdownProps {
  visible: boolean;
  onDismiss: () => void;
  onViewAll: () => void;
  onNotificationRead: () => void;
}

const getNotificationIcon = (type: NotificationType): string => {
  switch (type) {
    case 'room_like':
      return 'thumb-up';
    case 'room_fantastic':
      return 'star';
    case 'friend_request':
      return 'account-plus';
    case 'friend_collab':
      return 'account-multiple';
    case 'collab_request':
      return 'account-group';
    case 'collab_accept':
      return 'check-circle';
    default:
      return 'bell';
  }
};

const getNotificationColor = (type: NotificationType, theme: any): string => {
  switch (type) {
    case 'room_like':
      return theme.colors.primary;
    case 'room_fantastic':
      return '#ff9800';
    case 'friend_request':
      return theme.colors.primary;
    case 'friend_collab':
      return theme.colors.primary;
    case 'collab_request':
      return theme.colors.primary;
    case 'collab_accept':
      return theme.colors.primary;
    default:
      return theme.colors.onSurfaceVariant;
  }
};

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  visible,
  onDismiss,
  onViewAll,
  onNotificationRead,
}) => {
  const theme = useTheme();
  const { user, supabase } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [unseenNotifications, setUnseenNotifications] = useState<Notification[]>([]);
  const [seenNotifications, setSeenNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (visible && user) {
      fetchNotifications();
    }
  }, [visible, user]);

  useEffect(() => {
    const unseen = notifications.filter(n => !n.seen);
    const seen = notifications.filter(n => n.seen);
    setUnseenNotifications(unseen);
    setSeenNotifications(seen);
  }, [notifications]);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await getNotifications(supabase, user.id, { limit: 10 });
      setNotifications(data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.seen) {
      await markNotificationAsSeen(supabase, notification.id, user!.id);
      onNotificationRead();
      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notification.id ? { ...n, seen: true } : n
        )
      );
    }

    // Handle navigation based on notification type
    // This would need to be implemented based on your navigation structure
    onDismiss();
  };

  if (!visible) {
    return null;
  }

  const renderNotification = (notification: Notification) => {
    const icon = getNotificationIcon(notification.type);
    const color = getNotificationColor(notification.type, theme);
    const timeAgo = formatTimeAgo(new Date(notification.created_at));

    return (
      <TouchableOpacity
        key={notification.id}
        onPress={() => handleNotificationPress(notification)}
        style={[
          styles.notificationItem,
          {
            backgroundColor: notification.seen
              ? theme.colors.surface
              : theme.colors.primaryContainer,
          },
        ]}
      >
        <View style={styles.notificationContent}>
          <View style={[styles.iconCircle, { backgroundColor: `${color}20` }]}>
            <Text style={[styles.iconText, { color }]}>{icon}</Text>
          </View>
          <View style={styles.textContainer}>
            <Text
              style={[
                styles.title,
                {
                  color: notification.seen
                    ? theme.colors.onSurfaceVariant
                    : theme.colors.onSurface,
                  fontWeight: notification.seen ? 'normal' : 'bold',
                },
              ]}
            >
              {notification.title}
            </Text>
            <Text
              style={[
                styles.message,
                { color: theme.colors.onSurfaceVariant },
              ]}
              numberOfLines={2}
            >
              {notification.message}
            </Text>
            <Text
              style={[
                styles.time,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              {timeAgo}
            </Text>
          </View>
          {!notification.seen && (
            <View
              style={[
                styles.unreadDot,
                { backgroundColor: theme.colors.primary },
              ]}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Portal>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onDismiss}
      >
        <Surface
          style={[
            styles.dropdown,
            {
              backgroundColor: theme.colors.surface,
              shadowColor: theme.colors.shadow,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.header}>
            <Text
              style={[styles.headerTitle, { color: theme.colors.onSurface }]}
            >
              Notifications
            </Text>
          </View>
          <Divider />

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : (
            <ScrollView style={styles.scrollView} nestedScrollEnabled>
              {unseenNotifications.length > 0 && (
                <>
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    Unseen
                  </Text>
                  {unseenNotifications.map(renderNotification)}
                </>
              )}

              {seenNotifications.length > 0 && (
                <>
                  {unseenNotifications.length > 0 && (
                    <Divider style={styles.sectionDivider} />
                  )}
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    Seen
                  </Text>
                  {seenNotifications.map(renderNotification)}
                </>
              )}

              {notifications.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Text
                    style={[
                      styles.emptyText,
                      { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    No notifications
                  </Text>
                </View>
              )}
            </ScrollView>
          )}

          <Divider />
          <View style={styles.footer}>
            <Button
              mode="text"
              onPress={onViewAll}
              style={styles.viewAllButton}
            >
              View all
            </Button>
          </View>
        </Surface>
      </TouchableOpacity>
    </Portal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  dropdown: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 60 : 50,
    right: 16,
    width: 360,
    maxHeight: 600,
    borderRadius: 12,
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1001,
  },
  header: {
    padding: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollView: {
    maxHeight: 400,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  sectionDivider: {
    marginVertical: 8,
  },
  notificationItem: {
    padding: 12,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 8,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    marginBottom: 4,
  },
  message: {
    fontSize: 12,
    marginBottom: 4,
  },
  time: {
    fontSize: 10,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
    marginTop: 4,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  footer: {
    padding: 8,
  },
  viewAllButton: {
    width: '100%',
  },
});

