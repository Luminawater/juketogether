import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Card, Title, List, Avatar, Button, Chip, Text, useTheme } from 'react-native-paper';
import { RoomUser, Friend } from '../screens/RoomScreen.types';
import { roomScreenStyles } from '../screens/RoomScreen.styles';

interface RoomUsersTabProps {
  users: RoomUser[];
  userCount: number;
  user: any;
  friends: Friend[];
  friendRequests: Friend[];
  onAddFriend: (friendId: string) => void;
  onAcceptFriendRequest: (friendId: string) => void;
  onRejectFriendRequest: (friendId: string) => void;
  onRemoveFriend: (friendId: string) => void;
}

export const RoomUsersTab: React.FC<RoomUsersTabProps> = ({
  users,
  userCount,
  user,
  friends,
  friendRequests,
  onAddFriend,
  onAcceptFriendRequest,
  onRejectFriendRequest,
  onRemoveFriend,
}) => {
  const theme = useTheme();
  const [activeFriendsTab, setActiveFriendsTab] = useState<'list' | 'requests'>('list');
  const styles = roomScreenStyles;

  return (
    <ScrollView style={styles.tabContent}>
      {/* Users in Room */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>Users in Room ({userCount})</Title>
          <ScrollView style={styles.usersList}>
            {users.map((roomUser) => {
              const isMe = roomUser.userId === user?.id;
              const isFriend = friends.some(f => 
                (f.user_id === roomUser.userId && f.friend_id === user?.id) ||
                (f.friend_id === roomUser.userId && f.user_id === user?.id)
              );
              const hasPendingRequest = friendRequests.some(r => 
                (r.user_id === roomUser.userId && r.friend_id === user?.id) ||
                (r.friend_id === roomUser.userId && r.user_id === user?.id)
              );

              return (
                <List.Item
                  key={roomUser.userId}
                  title={roomUser.userProfile?.username || roomUser.userProfile?.display_name || 'Anonymous User'}
                  description={
                    isMe ? 'You' :
                    roomUser.isOwner ? 'Room Owner' :
                    roomUser.isAdmin ? 'Admin' : 'User'
                  }
                  left={() => (
                    <Avatar.Image
                      size={40}
                      source={{
                        uri: roomUser.userProfile?.avatar_url ||
                             `https://ui-avatars.com/api/?name=${encodeURIComponent(roomUser.userProfile?.username || '')}&background=667eea&color=fff`
                      }}
                    />
                  )}
                  right={() => (
                    <View style={styles.userActions}>
                      {isMe && <Chip>You</Chip>}
                      {roomUser.isOwner && <Chip icon="crown">Owner</Chip>}
                      {roomUser.isAdmin && <Chip icon="shield">Admin</Chip>}
                      {!isMe && !isFriend && !hasPendingRequest && (
                        <Button
                          icon="account-plus"
                          mode="text"
                          compact
                          onPress={() => onAddFriend(roomUser.userId)}
                        >
                          Add Friend
                        </Button>
                      )}
                      {!isMe && hasPendingRequest && friendRequests.find(r => r.user_id === user?.id && r.friend_id === roomUser.userId) && (
                        <Text style={styles.requestSent}>Request sent</Text>
                      )}
                      {!isMe && hasPendingRequest && friendRequests.find(r => r.user_id === roomUser.userId && r.friend_id === user?.id) && (
                        <View style={styles.requestActions}>
                          <Button
                            icon="check"
                            mode="text"
                            compact
                            onPress={() => onAcceptFriendRequest(roomUser.userId)}
                          >
                            Accept
                          </Button>
                          <Button
                            icon="close"
                            mode="text"
                            compact
                            onPress={() => onRejectFriendRequest(roomUser.userId)}
                          >
                            Reject
                          </Button>
                        </View>
                      )}
                    </View>
                  )}
                />
              );
            })}
          </ScrollView>
        </Card.Content>
      </Card>

      {/* Friends Section */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>Friends</Title>
          <View style={styles.friendsTabs}>
            <Button
              mode={activeFriendsTab === 'list' ? 'contained' : 'outlined'}
              onPress={() => setActiveFriendsTab('list')}
              style={styles.friendsTabButton}
            >
              My Friends
            </Button>
            <Button
              mode={activeFriendsTab === 'requests' ? 'contained' : 'outlined'}
              onPress={() => setActiveFriendsTab('requests')}
              style={styles.friendsTabButton}
            >
              Requests ({friendRequests.filter(r => r.friend_id === user?.id).length})
            </Button>
          </View>

          {activeFriendsTab === 'list' ? (
            <ScrollView style={styles.friendsList}>
              {friends.length === 0 ? (
                <Text style={styles.emptyQueue}>No friends yet</Text>
              ) : (
                friends.map((friend) => (
                  <List.Item
                    key={friend.id}
                    title={friend.username || 'Friend'}
                    left={() => (
                      <Avatar.Image
                        size={40}
                        source={{
                          uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.username || '')}&background=667eea&color=fff`
                        }}
                      />
                    )}
                    right={() => (
                      <Button
                        icon="account-remove"
                        mode="text"
                        compact
                        onPress={() => onRemoveFriend(friend.friend_id === user?.id ? friend.user_id : friend.friend_id)}
                      >
                        Remove
                      </Button>
                    )}
                  />
                ))
              )}
            </ScrollView>
          ) : (
            <ScrollView style={styles.friendsList}>
              {friendRequests.filter(r => r.friend_id === user?.id).length === 0 ? (
                <Text style={styles.emptyQueue}>No pending requests</Text>
              ) : (
                friendRequests
                  .filter(r => r.friend_id === user?.id)
                  .map((request) => (
                    <List.Item
                      key={request.id}
                      title={request.username || 'User'}
                      description="Wants to be your friend"
                      left={() => (
                        <Avatar.Image
                          size={40}
                          source={{
                            uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(request.username || '')}&background=667eea&color=fff`
                          }}
                        />
                      )}
                      right={() => (
                        <View style={styles.requestActions}>
                          <Button
                            icon="check"
                            mode="contained"
                            compact
                            onPress={() => onAcceptFriendRequest(request.user_id)}
                          >
                            Accept
                          </Button>
                          <Button
                            icon="close"
                            mode="outlined"
                            compact
                            onPress={() => onRejectFriendRequest(request.user_id)}
                          >
                            Reject
                          </Button>
                        </View>
                      )}
                    />
                  ))
              )}
            </ScrollView>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

