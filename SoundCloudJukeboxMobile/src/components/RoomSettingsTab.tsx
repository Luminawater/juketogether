import React from 'react';
import { View, ScrollView } from 'react-native';
import {
  Card,
  Title,
  Text,
  Switch,
  Divider,
  Button,
  TextInput,
  List,
  Avatar,
  useTheme,
} from 'react-native-paper';
import { RoomSettings, RoomUser } from '../screens/RoomScreen.types';
import { roomScreenStyles } from '../screens/RoomScreen.styles';

interface RoomSettingsTabProps {
  isOwner: boolean;
  isAdmin: boolean;
  roomSettings: RoomSettings;
  users: RoomUser[];
  addAdminInput: string;
  onSettingsChange: (settings: RoomSettings) => void;
  onAddAdminInputChange: (value: string) => void;
  onAddAdmin: () => void;
  onRemoveAdmin: (adminId: string) => void;
  onSaveSettings: () => void;
}

export const RoomSettingsTab: React.FC<RoomSettingsTabProps> = ({
  isOwner,
  isAdmin,
  roomSettings,
  users,
  addAdminInput,
  onSettingsChange,
  onAddAdminInputChange,
  onAddAdmin,
  onRemoveAdmin,
  onSaveSettings,
}) => {
  const theme = useTheme();
  const styles = roomScreenStyles;

  if (!isOwner && !isAdmin) {
    return (
      <View style={styles.tabContent}>
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Text style={[styles.noAccess, { color: theme.colors.onSurfaceVariant }]}>You don't have access to room settings.</Text>
            <Text style={[styles.noAccessSubtext, { color: theme.colors.onSurfaceVariant }]}>Only room owners and admins can access settings.</Text>
          </Card.Content>
        </Card>
      </View>
    );
  }

  return (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Card.Content>
          <Title style={{ color: theme.colors.onSurface }}>Room Settings</Title>
          
          <View style={styles.settingItem}>
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: theme.colors.onSurface }]}>Private Room</Text>
              <Switch
                value={roomSettings.isPrivate}
                onValueChange={(value) => onSettingsChange({ ...roomSettings, isPrivate: value })}
                disabled={!isOwner}
              />
            </View>
            <Text style={[styles.settingDescription, { color: theme.colors.onSurfaceVariant }]}>
              Only users with the reference code can join
            </Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.settingItem}>
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: theme.colors.onSurface }]}>Allow Users to Control Playback</Text>
              <Switch
                value={roomSettings.allowControls}
                onValueChange={(value) => onSettingsChange({ ...roomSettings, allowControls: value })}
                disabled={!isOwner && !isAdmin}
              />
            </View>
            <Text style={[styles.settingDescription, { color: theme.colors.onSurfaceVariant }]}>
              If disabled, only room owner and admins can control playback
            </Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.settingItem}>
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: theme.colors.onSurface }]}>Allow Users to Queue Songs</Text>
              <Switch
                value={roomSettings.allowQueue}
                onValueChange={(value) => onSettingsChange({ ...roomSettings, allowQueue: value })}
                disabled={!isOwner && !isAdmin}
              />
            </View>
            <Text style={[styles.settingDescription, { color: theme.colors.onSurfaceVariant }]}>
              If disabled, only room owner and admins can add tracks to the queue
            </Text>
            
            <Divider style={[styles.divider, { marginVertical: 12 }]} />
            
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: theme.colors.onSurface }]}>Allow Users to Remove from Queue</Text>
              <Switch
                value={roomSettings.allowQueueRemoval}
                onValueChange={(value) => onSettingsChange({ ...roomSettings, allowQueueRemoval: value })}
                disabled={!isOwner && !isAdmin}
              />
            </View>
            <Text style={[styles.settingDescription, { color: theme.colors.onSurfaceVariant }]}>
              If disabled, only room owner and admins can remove tracks. Users can always remove their own tracks.
            </Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.settingItem}>
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: theme.colors.onSurface }]}>Can other people add to playlist?</Text>
              <Switch
                value={roomSettings.allowPlaylistAdditions}
                onValueChange={(value) => onSettingsChange({ ...roomSettings, allowPlaylistAdditions: value })}
                disabled={!isOwner && !isAdmin}
              />
            </View>
            <Text style={[styles.settingDescription, { color: theme.colors.onSurfaceVariant }]}>
              If enabled, other users can add tracks to playlists created from this room
            </Text>
          </View>

          <Divider style={styles.divider} />

          {isOwner && (
            <View style={styles.settingItem}>
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: theme.colors.onSurface }]}>Session Mode</Text>
                <Switch
                  value={roomSettings.sessionEnabled}
                  onValueChange={(value) => {
                    onSettingsChange({ ...roomSettings, sessionEnabled: value });
                  }}
                  disabled={!isOwner}
                />
              </View>
              <Text style={[styles.settingDescription, { color: theme.colors.onSurfaceVariant }]}>
                When enabled, users will be prompted to open a mini player when trying to leave the room during an active session
              </Text>
            </View>
          )}

          {isOwner && (
            <>
              <Divider style={styles.divider} />
              <View style={styles.settingItem}>
                <Text style={[styles.settingLabel, { color: theme.colors.onSurface }]}>Room Admins</Text>
                <Text style={[styles.settingDescription, { color: theme.colors.onSurfaceVariant }]}>
                  Admins can access settings and control playback
                </Text>
                
                <ScrollView style={styles.adminsList}>
                  {roomSettings.admins.length === 0 ? (
                    <Text style={[styles.emptyQueue, { color: theme.colors.onSurfaceVariant }]}>No admins added yet</Text>
                  ) : (
                    roomSettings.admins.map((adminId) => {
                      const adminUser = users.find(u => u.userId === adminId);
                      return (
                        <List.Item
                          key={adminId}
                          title={adminUser?.userProfile?.username || 'Admin'}
                          left={() => (
                            <Avatar.Image
                              size={40}
                              source={{
                                uri: adminUser?.userProfile?.avatar_url ||
                                     `https://ui-avatars.com/api/?name=${encodeURIComponent(adminUser?.userProfile?.username || '')}&background=667eea&color=fff`
                              }}
                            />
                          )}
                          right={() => (
                            <Button
                              icon="delete"
                              mode="text"
                              compact
                              onPress={() => onRemoveAdmin(adminId)}
                            >
                              Remove
                            </Button>
                          )}
                        />
                      );
                    })
                  )}
                </ScrollView>

                <View style={styles.addAdminForm}>
                  <TextInput
                    label="Username"
                    value={addAdminInput}
                    onChangeText={onAddAdminInputChange}
                    mode="outlined"
                    placeholder="Enter username to add as admin"
                    style={styles.adminInput}
                    onSubmitEditing={onAddAdmin}
                  />
                  <Button
                    mode="contained"
                    onPress={onAddAdmin}
                    icon="account-plus"
                    style={styles.addAdminButton}
                  >
                    Add Admin
                  </Button>
                </View>
              </View>
            </>
          )}

          <Divider style={styles.divider} />

          <Button
            mode="contained"
            onPress={onSaveSettings}
            icon="content-save"
            style={styles.saveButton}
          >
            Save Settings
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

