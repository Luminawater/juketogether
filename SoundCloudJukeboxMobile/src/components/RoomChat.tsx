import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Avatar,
  Card,
  List,
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import {
  loadChatMessages,
  sendChatMessage,
  subscribeToChatMessages,
  unsubscribeFromChatMessages,
  ChatMessageWithProfile,
  RealtimeChannel,
} from '../services/chatService';
import { SupabaseClient } from '@supabase/supabase-js';

interface RoomChatProps {
  roomId: string;
  supabase: SupabaseClient;
}

const RoomChat: React.FC<RoomChatProps> = ({ roomId, supabase }) => {
  const { user } = useAuth();
  const theme = useTheme();
  const [messages, setMessages] = useState<ChatMessageWithProfile[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    loadInitialMessages();

    // Subscribe to real-time messages
    if (user) {
      channelRef.current = subscribeToChatMessages(
        supabase,
        roomId,
        handleNewMessage,
        (error) => {
          console.error('Real-time subscription error:', error);
        }
      );
    }

    return () => {
      // Cleanup subscription
      if (channelRef.current) {
        unsubscribeFromChatMessages(supabase, channelRef.current);
      }
    };
  }, [roomId, user]);

  const loadInitialMessages = async () => {
    try {
      setLoading(true);
      const loadedMessages = await loadChatMessages(supabase, roomId, 50);
      setMessages(loadedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewMessage = (message: ChatMessageWithProfile) => {
    setMessages((prev) => [...prev, message]);
    // Auto-scroll to bottom after a short delay
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSendMessage = async () => {
    if (!user || !newMessage.trim() || sending) return;

    setSending(true);
    try {
      const result = await sendChatMessage(
        supabase,
        roomId,
        user.id,
        newMessage.trim()
      );

      if (result.success) {
        setNewMessage('');
      } else {
        console.error('Error sending message:', result.error);
      }
    } catch (error) {
      console.error('Error in handleSendMessage:', error);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;

    return date.toLocaleDateString();
  };

  const isMyMessage = (message: ChatMessageWithProfile) => {
    return message.user_id === user?.id;
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>Loading chat...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Messages List */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => {
          scrollViewRef.current?.scrollToEnd({ animated: false });
        }}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              No messages yet. Be the first to say something! 👋
            </Text>
          </View>
        ) : (
          messages.map((message) => {
            const isMine = isMyMessage(message);
            return (
              <View
                key={message.id}
                style={[
                  styles.messageWrapper,
                  isMine && styles.myMessageWrapper,
                ]}
              >
                {!isMine && (
                  message.avatarUrl ? (
                    <Avatar.Image
                      size={32}
                      source={{ uri: message.avatarUrl }}
                      style={styles.avatar}
                    />
                  ) : (
                    <Avatar.Text
                      size={32}
                      label={(message.displayName || message.username || 'U').substring(0, 2).toUpperCase()}
                      style={styles.avatar}
                    />
                  )
                )}
                <View
                  style={[
                    styles.messageBubble,
                    isMine 
                      ? [styles.myMessageBubble, { backgroundColor: theme.colors.primary }]
                      : { backgroundColor: theme.colors.surfaceVariant },
                  ]}
                >
                  {!isMine && (
                    <Text style={[styles.messageAuthor, { color: theme.colors.primary }]}>
                      {message.displayName || message.username || 'Anonymous'}
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.messageText,
                      isMine 
                        ? styles.myMessageText 
                        : { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {message.message}
                  </Text>
                  <Text
                    style={[
                      styles.messageTime,
                      isMine 
                        ? styles.myMessageTime 
                        : { color: theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {formatTime(message.created_at)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Input Area */}
      {user ? (
        <View style={[styles.inputContainer, { 
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outline,
        }]}>
          <TextInput
            mode="outlined"
            placeholder="Type a message..."
            value={newMessage}
            onChangeText={setNewMessage}
            onSubmitEditing={handleSendMessage}
            multiline
            maxLength={500}
            style={styles.input}
            right={
              <TextInput.Icon
                icon="send"
                onPress={handleSendMessage}
                disabled={!newMessage.trim() || sending}
              />
            }
            disabled={sending}
          />
        </View>
      ) : (
        <Card style={[styles.signInPrompt, { backgroundColor: theme.colors.tertiaryContainer }]}>
          <Card.Content>
            <Text style={[styles.signInText, { color: theme.colors.onTertiaryContainer }]}>
              Sign in to join the conversation
            </Text>
          </Card.Content>
        </Card>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  myMessageWrapper: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    marginRight: 8,
    marginLeft: 0,
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomLeftRadius: 4,
    elevation: 1,
  },
  myMessageBubble: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  messageAuthor: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    opacity: 0.7,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  inputContainer: {
    padding: 12,
    borderTopWidth: 1,
  },
  input: {
    // Theme colors applied via TextInput props
  },
  signInPrompt: {
    margin: 12,
  },
  signInText: {
    textAlign: 'center',
  },
});

export default RoomChat;

