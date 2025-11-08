import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import {
  Portal,
  Dialog,
  Text,
  Divider,
  ActivityIndicator,
  useTheme,
  IconButton,
  Button,
} from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import {
  getNotifications,
  markNotificationAsSeen,
  markAllNotificationsAsSeen,
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

interface NotificationFullscreenDialogProps {
  visible: boolean;
  onDismiss: () => void;
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

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

export const NotificationFullscreenDialog: React.FC<NotificationFullscreenDialogProps> = ({
  visible,
  onDismiss,
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
      const data = await getNotifications(supabase, user.id);
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
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;

    try {
      await markAllNotificationsAsSeen(supabase, user.id);
      onNotificationRead();
      // Update local state
      setNotifications(prev =>
        prev.map(n => ({ ...n, seen: true }))
      );
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

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
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[
          styles.dialog,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <View style={styles.header}>
          <Text
            style={[styles.headerTitle, { color: theme.colors.onSurface }]}
          >
            Notifications
          </Text>
          <View style={styles.headerActions}>
            {unseenNotifications.length > 0 && (
              <Button
                mode="text"
                onPress={handleMarkAllAsRead}
                style={styles.markAllButton}
              >
                Mark all as read
              </Button>
            )}
            <IconButton
              icon="close"
              iconColor={theme.colors.onSurface}
              size={24}
              onPress={onDismiss}
            />
          </View>
        </View>
        <Divider />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
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
                  Unseen ({unseenNotifications.length})
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
                  Seen ({seenNotifications.length})
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
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    margin: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    maxWidth: SCREEN_WIDTH,
    maxHeight: SCREEN_HEIGHT,
  },
  dialogContent: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    maxWidth: SCREEN_WIDTH,
    maxHeight: SCREEN_HEIGHT,
    padding: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markAllButton: {
    marginRight: 8,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionDivider: {
    marginVertical: 8,
  },
  notificationItem: {
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  iconText: {
    fontSize: 24,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  time: {
    fontSize: 12,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 12,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 64,
  },
  emptyText: {
    fontSize: 16,
  },
});

