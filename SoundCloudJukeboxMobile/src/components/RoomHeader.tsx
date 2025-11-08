import React from 'react';
import { View, ScrollView, TouchableOpacity, Platform, Dimensions } from 'react-native';
import {
  Text,
  IconButton,
  Chip,
  ActivityIndicator,
  Badge,
  useTheme,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DJModeToggle } from './DJModeToggle';
import { SubscriptionTier } from '../types';
import { roomScreenStyles } from '../screens/RoomScreen.styles';
import { hasTier } from '../utils/permissions';
import { isSpotifyUser } from '../services/spotifyService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_MOBILE = SCREEN_WIDTH < 768;

interface RoomHeaderProps {
  headerColor: string;
  roomName: string;
  shortCode: string | null;
  connected: boolean;
  activeTab: string;
  isPlaying: boolean;
  currentTrack: any;
  canControl: boolean;
  queue: any[];
  userCount: number;
  profile: any;
  roomSettings: any;
  isDJModeActive: boolean;
  setIsDJModeActive: (active: boolean) => void;
  playPause: () => void;
  handlePrevious: () => void;
  nextTrack: () => void;
  shareRoom: () => void;
  setActiveTab: React.Dispatch<React.SetStateAction<'main' | 'users' | 'settings' | 'spotify' | 'chat' | 'djmode'>>;
  unreadChatCount: number;
  user: any;
  tierSettings: any;
  isOwner: boolean;
  isAdmin: boolean;
  setShowDJModeConfirmDialog: (show: boolean) => void;
}

export const RoomHeader: React.FC<RoomHeaderProps> = ({
  headerColor,
  roomName,
  shortCode,
  connected,
  activeTab,
  isPlaying,
  currentTrack,
  canControl,
  queue,
  userCount,
  profile,
  roomSettings,
  isDJModeActive,
  setIsDJModeActive,
  playPause,
  handlePrevious,
  nextTrack,
  shareRoom,
  setActiveTab,
  unreadChatCount,
  user,
  tierSettings,
  isOwner,
  isAdmin,
  setShowDJModeConfirmDialog,
}) => {
  const theme = useTheme();
  const styles = roomScreenStyles;

  return (
    <>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: headerColor }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={[styles.roomTitle, { color: theme.colors.onSurface }]}>{roomName}</Text>
            <View style={styles.connectionStatus}>
              <View style={[styles.statusDot, { backgroundColor: connected ? '#4CAF50' : '#FF9800' }]} />
            </View>
            <View style={{ flex: 1 }} />
          </View>
          <View style={styles.headerRight}>
            {/* DJ Mode Toggle - Only for PRO users */}
            {profile && hasTier(profile.subscription_tier, 'pro') && roomSettings.djMode && (
              <DJModeToggle
                isDJMode={isDJModeActive}
                onToggle={() => setIsDJModeActive(!isDJModeActive)}
                disabled={!roomSettings.djMode}
              />
            )}
            {/* Playback Controls - Only visible on web/desktop, hidden on mobile (shown via FAB) */}
            {activeTab === 'main' && Platform.OS === 'web' && !IS_MOBILE && (
              <>
                <View style={styles.iconButtonWrapper}>
                  <IconButton
                    icon="skip-previous"
                    iconColor={theme.colors.onSurface}
                    size={20}
                    onPress={handlePrevious}
                    disabled={!currentTrack || !canControl}
                    style={styles.iconButton}
                  />
                </View>
                <View style={styles.iconButtonWrapper}>
                  <IconButton
                    icon={isPlaying ? 'pause' : 'play'}
                    iconColor={theme.colors.onSurface}
                    size={20}
                    onPress={playPause}
                    disabled={!currentTrack || !canControl}
                    style={styles.iconButton}
                  />
                </View>
                <View style={styles.iconButtonWrapper}>
                  <IconButton
                    icon="skip-next"
                    iconColor={theme.colors.onSurface}
                    size={20}
                    onPress={nextTrack}
                    disabled={queue.length === 0 || !canControl}
                    style={styles.iconButton}
                  />
                </View>
              </>
            )}
            <Chip
              icon={({ size, color }) => (
                <MaterialCommunityIcons name="account-group" size={size} color="#FFFFFF" />
              )}
              style={[styles.userCountChip, { backgroundColor: theme.colors.primaryContainer }]}
              textStyle={[styles.userCountChipText, { color: '#FFFFFF' }]}
              onPress={() => setActiveTab('users')}
            >
              {userCount}
            </Chip>
            <Chip
              icon={({ size, color }) => (
                <MaterialCommunityIcons name="format-list-bulleted" size={size} color="#FFFFFF" />
              )}
              style={[styles.userCountChip, { backgroundColor: theme.colors.secondaryContainer }]}
              textStyle={[styles.userCountChipText, { color: '#FFFFFF' }]}
            >
              {queue.length}
            </Chip>
            <View style={styles.iconButtonWrapper}>
              <IconButton
                icon="share-variant"
                iconColor={theme.colors.onSurface}
                size={20}
                onPress={shareRoom}
                style={styles.iconButton}
              />
            </View>
          </View>
        </View>
        {shortCode && (
          <Text style={[styles.roomId, { color: theme.colors.onSurfaceVariant }]}>
            Reference: {shortCode}
          </Text>
        )}
        {!connected && <ActivityIndicator size="small" color={theme.colors.onSurface} style={styles.connectingIndicator} />}
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { backgroundColor: headerColor, borderBottomColor: theme.colors.outline }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
          style={styles.tabsScrollView}
        >
          <TouchableOpacity
            onPress={() => setActiveTab('main')}
            style={[
              styles.tabButton,
              activeTab === 'main' && {
                backgroundColor: theme.colors.primary,
              },
            ]}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="music-note"
              size={20}
              color={activeTab === 'main' ? theme.colors.onPrimary : theme.colors.onSurface}
              style={styles.tabIcon}
            />
            <Text
              style={[
                styles.tabButtonText,
                {
                  color: activeTab === 'main' ? theme.colors.onPrimary : theme.colors.onSurface,
                },
              ]}
            >
              Main
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('users')}
            style={[
              styles.tabButton,
              activeTab === 'users' && {
                backgroundColor: theme.colors.primary,
              },
            ]}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="account-group"
              size={20}
              color={activeTab === 'users' ? theme.colors.onPrimary : theme.colors.onSurface}
              style={styles.tabIcon}
            />
            <Text
              style={[
                styles.tabButtonText,
                {
                  color: activeTab === 'users' ? theme.colors.onPrimary : theme.colors.onSurface,
                },
              ]}
            >
              Users
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('chat')}
            style={[
              styles.tabButton,
              activeTab === 'chat' && {
                backgroundColor: theme.colors.primary,
              },
            ]}
            activeOpacity={0.7}
          >
            <View style={styles.tabIconContainer}>
              <MaterialCommunityIcons
                name="chat"
                size={20}
                color={activeTab === 'chat' ? theme.colors.onPrimary : theme.colors.onSurface}
                style={styles.tabIcon}
              />
              {unreadChatCount > 0 && (
                <Badge
                  visible={unreadChatCount > 0}
                  size={18}
                  style={[
                    styles.chatBadge,
                    { backgroundColor: theme.colors.error }
                  ]}
                >
                  {unreadChatCount > 99 ? '99+' : unreadChatCount}
                </Badge>
              )}
            </View>
            <Text
              style={[
                styles.tabButtonText,
                {
                  color: activeTab === 'chat' ? theme.colors.onPrimary : theme.colors.onSurface,
                },
              ]}
            >
              Chat
            </Text>
          </TouchableOpacity>
          {user && isSpotifyUser(user) && (
            <TouchableOpacity
              onPress={() => setActiveTab('spotify')}
              style={[
                styles.tabButton,
                activeTab === 'spotify' && {
                  backgroundColor: theme.colors.primary,
                },
              ]}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="spotify"
                size={20}
                color={activeTab === 'spotify' ? theme.colors.onPrimary : theme.colors.onSurface}
                style={styles.tabIcon}
              />
              <Text
                style={[
                  styles.tabButtonText,
                  {
                    color: activeTab === 'spotify' ? theme.colors.onPrimary : theme.colors.onSurface,
                  },
                ]}
              >
                Spotify
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              if (profile && hasTier(profile.subscription_tier, 'pro') && !isDJModeActive) {
                setShowDJModeConfirmDialog(true);
              } else {
                setActiveTab('djmode');
              }
            }}
            style={[
              styles.tabButton,
              (activeTab === 'djmode' || isDJModeActive) && {
                backgroundColor: theme.colors.primary,
              },
            ]}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="equalizer"
              size={20}
              color={(activeTab === 'djmode' || isDJModeActive) ? theme.colors.onPrimary : theme.colors.onSurface}
              style={styles.tabIcon}
            />
            <Text
              style={[
                styles.tabButtonText,
                {
                  color: (activeTab === 'djmode' || isDJModeActive) ? theme.colors.onPrimary : theme.colors.onSurface,
                },
              ]}
            >
              DJ Mode
            </Text>
          </TouchableOpacity>
          {(isOwner || isAdmin) && (
            <TouchableOpacity
              onPress={() => setActiveTab('settings')}
              style={[
                styles.tabButton,
                activeTab === 'settings' && {
                  backgroundColor: theme.colors.primary,
                },
              ]}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="cog"
                size={20}
                color={activeTab === 'settings' ? theme.colors.onPrimary : theme.colors.onSurface}
                style={styles.tabIcon}
              />
              <Text
                style={[
                  styles.tabButtonText,
                  {
                    color: activeTab === 'settings' ? theme.colors.onPrimary : theme.colors.onSurface,
                  },
                ]}
              >
                Settings
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </>
  );
};

