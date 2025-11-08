import { SupabaseClient } from '@supabase/supabase-js';

export type NotificationType = 
  | 'room_like' 
  | 'room_fantastic' 
  | 'friend_request' 
  | 'friend_collab' 
  | 'collab_request' 
  | 'collab_accept';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  seen: boolean;
  metadata: {
    room_id?: string;
    track_id?: string;
    user_id?: string;
    friend_id?: string;
    collab_request_id?: string;
    [key: string]: any;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationMetadata {
  room_id?: string;
  track_id?: string;
  user_id?: string;
  friend_id?: string;
  collab_request_id?: string;
  [key: string]: any;
}

/**
 * Get all notifications for a user
 */
export async function getNotifications(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    limit?: number;
    seen?: boolean;
  }
): Promise<Notification[]> {
  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.seen !== undefined) {
      query = query.eq('seen', options.seen);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }

    return (data || []) as Notification[];
  } catch (error) {
    console.error('Error in getNotifications:', error);
    return [];
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadNotificationCount(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('seen', false);

    if (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error in getUnreadNotificationCount:', error);
    return 0;
  }
}

/**
 * Mark notification as seen
 */
export async function markNotificationAsSeen(
  supabase: SupabaseClient,
  notificationId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ seen: true })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error marking notification as seen:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in markNotificationAsSeen:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Mark all notifications as seen
 */
export async function markAllNotificationsAsSeen(
  supabase: SupabaseClient,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ seen: true })
      .eq('user_id', userId)
      .eq('seen', false);

    if (error) {
      console.error('Error marking all notifications as seen:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in markAllNotificationsAsSeen:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Create a notification (typically called from server-side or database triggers)
 */
export async function createNotification(
  supabase: SupabaseClient,
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  metadata?: NotificationMetadata
): Promise<{ success: boolean; error?: string; notificationId?: string }> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        metadata: metadata || null,
        seen: false,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      return { success: false, error: error.message };
    }

    return { success: true, notificationId: data.id };
  } catch (error: any) {
    console.error('Error in createNotification:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(
  supabase: SupabaseClient,
  notificationId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting notification:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in deleteNotification:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

