import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Dimensions,
  TouchableOpacity,
  Animated,
} from 'react-native';
import {
  Text,
  Card,
  Title,
  Button,
  IconButton,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';
import { RouteProp, useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { Track } from '../types';
import { socketService, RoomState } from '../services/socketService';
import { DJModeInterface } from '../components/DJModeInterface';
import { DJModePlayer } from '../components/DJModePlayer';
import { djAudioService } from '../services/djAudioService';
import { bpmDetectionService } from '../services/bpmDetectionService';
import { hasTier } from '../utils/permissions';

type DJModeScreenRouteProp = RouteProp<RootStackParamList, 'DJMode'>;
type DJModeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'DJMode'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_MOBILE = SCREEN_WIDTH < 768;

// DJ Mode specific theme colors
const DJ_THEME_COLORS = {
  background: '#0a0a0a',
  surface: '#151515',
  surfaceVariant: '#1f1f1f',
  primary: '#ff6b6b',
  secondary: '#4ecdc4',
  accent: '#ffe66d',
  onSurface: '#ffffff',
  onSurfaceVariant: '#b0b0b0',
};

const DJModeScreen: React.FC = () => {
  const route = useRoute<DJModeScreenRouteProp>();
  const navigation = useNavigation<DJModeScreenNavigationProp>();
  const { user, session, supabase, profile } = useAuth();
  const theme = useTheme();

  const { roomId, roomName } = route.params;

  // State
  const [queue, setQueue] = useState<Track[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roomSettings, setRoomSettings] = useState({
    djMode: false,
    djPlayers: 0,
  });
  const [tierSettings, setTierSettings] = useState<{
    djMode: boolean;
  }>({ djMode: false });
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEnablingDJMode, setIsEnablingDJMode] = useState(false);

  // DJ Mode state
  const [djPlayerTracks, setDjPlayerTracks] = useState<(Track | null)[]>([null, null, null, null]);
  const [djPlayerPlayingStates, setDjPlayerPlayingStates] = useState<boolean[]>([false, false, false, false]);
  const [djPlayerVolumes, setDjPlayerVolumes] = useState<number[]>([0.5, 0.5, 0.5, 0.5]);
  const [djPlayerBPMs, setDjPlayerBPMs] = useState<(number | null)[]>([null, null, null, null]);
  const [djPlayerPositions, setDjPlayerPositions] = useState<number[]>([0, 0, 0, 0]);
  const [djPlayerDurations, setDjPlayerDurations] = useState<number[]>([0, 0, 0, 0]);

  // Animation state for glowing background effects
  const glowAnimation1 = useRef(new Animated.Value(0)).current;
  const glowAnimation2 = useRef(new Animated.Value(0)).current;
  const glowAnimation3 = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(0)).current;

  // Initialize DJ Audio Service
  useEffect(() => {
    if (roomSettings.djMode) {
      djAudioService.initialize();
    }

    return () => {
      if (roomSettings.djMode) {
        djAudioService.cleanup();
      }
    };
  }, [roomSettings.djMode]);

  // Update DJ player positions periodically
  useEffect(() => {
    if (!roomSettings.djMode) return;

    const interval = setInterval(() => {
      const states = djAudioService.getAllPlayerStates();
      const newPositions = states.map(s => s.position);
      const newDurations = states.map(s => s.duration);
      setDjPlayerPositions(newPositions);
      setDjPlayerDurations(newDurations);
    }, 100);

    return () => clearInterval(interval);
  }, [roomSettings.djMode]);

  // Automatically enable DJ mode if user is Pro and room creator has Pro tier
  useEffect(() => {
    const isPro = profile && hasTier(profile.subscription_tier, 'pro');
    if (isPro && tierSettings.djMode && !roomSettings.djMode && (isOwner || isAdmin) && !isEnablingDJMode) {
      setIsEnablingDJMode(true);
      
      // Check if Socket.io is available
      if (socketService.socket && connected) {
        // Use Socket.io if available
        socketService.socket.emit('update-room-settings', {
          roomId,
          settings: {
            djMode: true,
            djPlayers: roomSettings.djPlayers || 1,
          },
        });
        // Reset enabling flag after a short delay (Socket.io will update via roomSettingsUpdated event)
        setTimeout(() => setIsEnablingDJMode(false), 2000);
      } else if (supabase && user) {
        // Fallback to Supabase when Socket.io is disabled
        const updateRoomSettings = async () => {
          try {
            const { error } = await supabase
              .from('room_settings')
              .upsert({
                room_id: roomId,
                dj_mode: true,
                dj_players: roomSettings.djPlayers || 1,
              }, {
                onConflict: 'room_id'
              });

            if (error) {
              console.error('Error enabling DJ mode via Supabase:', error);
              setIsEnablingDJMode(false);
            } else {
              console.log('DJ mode enabled via Supabase');
              // Update local state
              setRoomSettings(prev => ({
                ...prev,
                djMode: true,
                djPlayers: prev.djPlayers || 1,
              }));
              setIsEnablingDJMode(false);
            }
          } catch (error) {
            console.error('Error updating room settings:', error);
            setIsEnablingDJMode(false);
          }
        };

        updateRoomSettings();
      } else {
        setIsEnablingDJMode(false);
      }
    }
  }, [profile, tierSettings.djMode, roomSettings.djMode, isOwner, isAdmin, roomId, connected, supabase, user, isEnablingDJMode]);

  // Control glowing background animations based on music playing state
  useEffect(() => {
    const isAnyPlayerPlaying = djPlayerPlayingStates.some(playing => playing);

    if (isAnyPlayerPlaying) {
      // Start glowing animations
      const startGlowAnimation = () => {
        Animated.parallel([
          // Glow animation 1 - slow pulsing
          Animated.loop(
            Animated.sequence([
              Animated.timing(glowAnimation1, {
                toValue: 1,
                duration: 2000,
                useNativeDriver: false,
              }),
              Animated.timing(glowAnimation1, {
                toValue: 0.3,
                duration: 2000,
                useNativeDriver: false,
              }),
            ])
          ),
          // Glow animation 2 - medium pulsing
          Animated.loop(
            Animated.sequence([
              Animated.timing(glowAnimation2, {
                toValue: 0.8,
                duration: 1500,
                useNativeDriver: false,
              }),
              Animated.timing(glowAnimation2, {
                toValue: 0.2,
                duration: 1500,
                useNativeDriver: false,
              }),
            ])
          ),
          // Glow animation 3 - fast pulsing
          Animated.loop(
            Animated.sequence([
              Animated.timing(glowAnimation3, {
                toValue: 0.6,
                duration: 1000,
                useNativeDriver: false,
              }),
              Animated.timing(glowAnimation3, {
                toValue: 0.1,
                duration: 1000,
                useNativeDriver: false,
              }),
            ])
          ),
          // Pulse animation for overall effect
          Animated.loop(
            Animated.sequence([
              Animated.timing(pulseAnimation, {
                toValue: 1,
                duration: 800,
                useNativeDriver: false,
              }),
              Animated.timing(pulseAnimation, {
                toValue: 0.4,
                duration: 800,
                useNativeDriver: false,
              }),
            ])
          ),
        ]).start();
      };

      startGlowAnimation();
    } else {
      // Stop all animations
      glowAnimation1.stopAnimation();
      glowAnimation2.stopAnimation();
      glowAnimation3.stopAnimation();
      pulseAnimation.stopAnimation();

      // Reset to base values
      glowAnimation1.setValue(0);
      glowAnimation2.setValue(0);
      glowAnimation3.setValue(0);
      pulseAnimation.setValue(0);
    }

    return () => {
      // Cleanup animations on unmount
      glowAnimation1.stopAnimation();
      glowAnimation2.stopAnimation();
      glowAnimation3.stopAnimation();
      pulseAnimation.stopAnimation();
    };
  }, [djPlayerPlayingStates, glowAnimation1, glowAnimation2, glowAnimation3, pulseAnimation]);

  // Load room settings and connect to socket
  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      let loadingTimeout: NodeJS.Timeout | null = null;
      let roomStateReceived = false;

      // Define handlers
      const handleConnect = () => {
        if (!mounted) return;
        setConnected(true);
        console.log('Connected to room:', roomId);
        // Join room
        if (socketService.socket) {
          socketService.socket.emit('join-room', roomId);
        }
      };

      const handleConnectionError = (error: any) => {
        console.error('Socket connection error:', error);
        if (mounted && !roomStateReceived) {
          setLoading(false);
          if (loadingTimeout) {
            clearTimeout(loadingTimeout);
            loadingTimeout = null;
          }
          Alert.alert('Connection Error', 'Failed to connect to room. Please check your connection and try again.');
        }
      };

      const handleSocketError = (error: any) => {
        console.error('Socket error:', error);
        if (mounted && !roomStateReceived) {
          setLoading(false);
          if (loadingTimeout) {
            clearTimeout(loadingTimeout);
            loadingTimeout = null;
          }
        }
      };

      const handleRoomState = (state: RoomState & {
        roomSettings?: any;
        isOwner?: boolean;
        isAdmin?: boolean;
        tierSettings?: {
          djMode: boolean;
        };
      }) => {
        if (mounted) {
          roomStateReceived = true;
          setQueue(state.queue || []);
          if (state.roomSettings) {
            setRoomSettings({
              djMode: state.roomSettings.djMode || false,
              djPlayers: state.roomSettings.djPlayers || 0,
            });
          }
          if (state.tierSettings) {
            setTierSettings(state.tierSettings);
          }
          if (state.isOwner !== undefined) {
            setIsOwner(state.isOwner);
          }
          if (state.isAdmin !== undefined) {
            setIsAdmin(state.isAdmin);
          }
          // Stop loading once we have room state
          setLoading(false);
          if (loadingTimeout) {
            clearTimeout(loadingTimeout);
            loadingTimeout = null;
          }
        }
      };

      const handleTrackAdded = (track: Track) => {
        if (mounted) {
          setQueue(prev => [...prev, track]);
        }
      };

      const handleTrackRemoved = (trackId: string) => {
        if (mounted) {
          setQueue(prev => prev.filter(t => t.id !== trackId));
        }
      };

      const handleRoomSettingsUpdated = (updatedSettings: any) => {
        if (mounted) {
          setRoomSettings({
            djMode: updatedSettings.djMode || false,
            djPlayers: updatedSettings.djPlayers || 0,
          });
          // Reset enabling flag when settings are updated
          if (updatedSettings.djMode) {
            setIsEnablingDJMode(false);
          }
        }
      };

      const initializeRoom = async () => {
        try {
          setLoading(true);
          roomStateReceived = false;

        // Load room settings and tier settings from Supabase
        const [settingsResult, tierResult] = await Promise.all([
          supabase
            .from('room_settings')
            .select('dj_mode, dj_players, room_id')
            .eq('room_id', roomId)
            .single(),
          supabase
            .from('rooms')
            .select('host_user_id')
            .eq('id', roomId)
            .maybeSingle()
        ]);

        const { data: settingsData, error: settingsError } = settingsResult;
        const { data: roomData } = tierResult;

        if (settingsError && settingsError.code !== 'PGRST116') {
          console.error('Error loading room settings:', settingsError);
        }

        // Load tier settings for the room creator
        let loadedTierSettings = { djMode: false };
        const creatorId = roomData?.host_user_id;
        if (creatorId) {
          const { data: creatorProfile, error: creatorProfileError } = await supabase
            .from('user_profiles')
            .select('subscription_tier')
            .eq('id', creatorId)
            .maybeSingle();
          
          if (creatorProfileError) {
            console.error('Error loading creator profile:', creatorProfileError);
          }
          
          if (creatorProfile) {
            loadedTierSettings = {
              djMode: hasTier(creatorProfile.subscription_tier, 'pro'),
            };
            console.log('Creator tier loaded:', {
              creatorId: creatorId,
              tier: creatorProfile.subscription_tier,
              djModeAvailable: loadedTierSettings.djMode
            });
          } else {
            console.warn('Creator profile not found for room:', roomId);
            // If current user is the creator and is Pro, allow DJ mode
            if (user && user.id === creatorId) {
              const isPro = profile && hasTier(profile.subscription_tier, 'pro');
              if (isPro) {
                console.log('Current user is Pro creator, enabling DJ mode');
                loadedTierSettings = { djMode: true };
              }
            }
          }
        }

        // Check if user is owner
        let loadedIsOwner = false;
        if (user && creatorId) {
          loadedIsOwner = user.id === creatorId;
        }

        // If current user is the creator and is Pro, allow DJ mode even if creator profile query failed
        if (loadedIsOwner && profile) {
          const isPro = hasTier(profile.subscription_tier, 'pro');
          if (isPro && !loadedTierSettings.djMode) {
            console.log('Current user is Pro creator, overriding tier settings to enable DJ mode');
            loadedTierSettings = { djMode: true };
          }
        }

        if (mounted) {
          if (settingsData) {
            setRoomSettings({
              djMode: settingsData.dj_mode || false,
              djPlayers: settingsData.dj_players || 0,
            });
          }
          setTierSettings(loadedTierSettings);
          setIsOwner(loadedIsOwner);
          // Admin status will be set from socket roomState if available

          // Stop loading once we've loaded the data from Supabase
          // Socket roomState will update these values if it arrives later, but we don't need to wait
          console.log('Room settings loaded from Supabase, stopping loading');
          setLoading(false);
          roomStateReceived = true; // Mark as received to prevent timeout
        }

        // Connect to socket
        const userId = user?.id || `anonymous_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const authToken = session?.access_token;

        // Only connect if not already connected to this room
        if (!socketService.isConnected() || socketService.socket === null) {
          socketService.connect(roomId, userId, authToken);
        }

        // Set up event listeners
        socketService.on('connect', handleConnect);
        socketService.on('connectionError', handleConnectionError);
        socketService.on('error', handleSocketError);
        socketService.on('roomState', handleRoomState);
        socketService.on('trackAdded', handleTrackAdded);
        socketService.on('trackRemoved', handleTrackRemoved);
        socketService.on('roomSettingsUpdated', handleRoomSettingsUpdated);

        // Check if socket is already connected (handles fast connections)
        if (socketService.isConnected()) {
          handleConnect();
        }

        // Set a timeout to stop loading after 5 seconds if roomState never arrives
        // Reduced from 10 seconds since we now have fallback data
        loadingTimeout = setTimeout(() => {
          if (mounted && !roomStateReceived) {
            console.warn('Room state timeout - stopping loading with fallback data');
            setLoading(false);
            // Don't show alert if we already have the settings loaded
            if (!settingsData?.dj_mode) {
              Alert.alert(
                'Connection Timeout',
                'Failed to receive room state. Using cached settings. Some features may be limited.'
              );
            }
          }
        }, 5000);
      } catch (error) {
        console.error('Error initializing room:', error);
        if (mounted) {
          setLoading(false);
          Alert.alert('Error', 'Failed to load room. Please try again.');
        }
      }
    };

      initializeRoom();

      return () => {
        mounted = false;
        if (loadingTimeout) {
          clearTimeout(loadingTimeout);
        }
        // Clean up event listeners
        socketService.off('connect', handleConnect);
        socketService.off('connectionError', handleConnectionError);
        socketService.off('error', handleSocketError);
        socketService.off('roomState', handleRoomState);
        socketService.off('trackAdded', handleTrackAdded);
        socketService.off('trackRemoved', handleTrackRemoved);
        socketService.off('roomSettingsUpdated', handleRoomSettingsUpdated);
        // Note: We don't disconnect here as the socket might be used by other screens
        // The socket will be disconnected when navigating away from all socket-using screens
      };
    }, [roomId, supabase, user, session])
  );

  // DJ Mode Handlers
  const handleDJPlayerLoadTrack = async (playerIndex: number) => {
    if (queue.length === 0) {
      Alert.alert('No Tracks', 'Queue is empty. Add tracks to load into DJ players.');
      return;
    }

    // Show track selection
    Alert.alert(
      'Load Track',
      'Select a track from the queue',
      [
        { text: 'Cancel', style: 'cancel' },
        ...queue.map((track, index) => ({
          text: `${track.info?.fullTitle || 'Unknown Track'}`,
          onPress: async () => {
            const success = await djAudioService.loadTrack(playerIndex, track);
            if (success) {
              const newTracks = [...djPlayerTracks];
              newTracks[playerIndex] = track;
              setDjPlayerTracks(newTracks);

              // Detect BPM
              const bpmResult = await bpmDetectionService.detectBPM(track);
              const newBPMs = [...djPlayerBPMs];
              newBPMs[playerIndex] = bpmResult.bpm;
              setDjPlayerBPMs(newBPMs);

              const playerState = djAudioService.getPlayerState(playerIndex);
              if (playerState) {
                const newDurations = [...djPlayerDurations];
                newDurations[playerIndex] = playerState.duration;
                setDjPlayerDurations(newDurations);
              }
            } else {
              Alert.alert('Error', 'Failed to load track to player');
            }
          },
        })),
      ]
    );
  };

  const handleDJPlayerPlayPause = async (playerIndex: number) => {
    const playerState = djAudioService.getPlayerState(playerIndex);
    if (!playerState || !playerState.player) return;

    if (playerState.isPlaying) {
      await djAudioService.pause(playerIndex);
    } else {
      await djAudioService.play(playerIndex);
    }

    const newStates = [...djPlayerPlayingStates];
    newStates[playerIndex] = !playerState.isPlaying;
    setDjPlayerPlayingStates(newStates);
  };

  const handleDJPlayerVolumeChange = async (playerIndex: number, volume: number) => {
    await djAudioService.setVolume(playerIndex, volume);
    const newVolumes = [...djPlayerVolumes];
    newVolumes[playerIndex] = volume;
    setDjPlayerVolumes(newVolumes);
  };

  const handleDJPlayerSeek = async (playerIndex: number, position: number) => {
    await djAudioService.seekTo(playerIndex, position);
    const newPositions = [...djPlayerPositions];
    newPositions[playerIndex] = position;
    setDjPlayerPositions(newPositions);
  };

  const handleDJPlayerSync = async (playerIndex1: number, playerIndex2: number) => {
    const state1 = djAudioService.getPlayerState(playerIndex1);
    const state2 = djAudioService.getPlayerState(playerIndex2);

    if (!state1 || !state2 || !state1.player || !state2.player) {
      Alert.alert('Error', 'Both players must have tracks loaded to sync');
      return;
    }

    const bpm1 = djPlayerBPMs[playerIndex1];
    const bpm2 = djPlayerBPMs[playerIndex2];

    if (bpm1 && bpm2 && Math.abs(bpm1 - bpm2) > 5) {
      Alert.alert(
        'BPM Mismatch',
        `Player ${playerIndex1 + 1} is ${Math.round(bpm1)} BPM and Player ${playerIndex2 + 1} is ${Math.round(bpm2)} BPM. They may not sync well.`
      );
    }

    // Sync position
    const offset = djPlayerPositions[playerIndex1] - djPlayerPositions[playerIndex2];
    if (Math.abs(offset) > 1000) {
      const newPosition = Math.max(0, djPlayerPositions[playerIndex2] + offset);
      await handleDJPlayerSeek(playerIndex2, newPosition);
    } else {
      await handleDJPlayerSeek(playerIndex2, djPlayerPositions[playerIndex1]);
    }
  };

  const handleExitDJMode = () => {
    Alert.alert(
      'Exit DJ Mode',
      'Are you sure you want to exit DJ Mode?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Exit',
          style: 'destructive',
          onPress: () => {
            navigation.navigate('Room', { roomId, roomName });
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: DJ_THEME_COLORS.background }]}>
        <ActivityIndicator size="large" color={DJ_THEME_COLORS.primary} />
      </View>
    );
  }

  if (!profile || !hasTier(profile.subscription_tier, 'pro')) {
    return (
      <View style={[styles.container, { backgroundColor: DJ_THEME_COLORS.background }]}>
        <Card style={[styles.card, { backgroundColor: DJ_THEME_COLORS.surface }]}>
          <Card.Content style={styles.centerContent}>
            <MaterialCommunityIcons
              name="lock"
              size={64}
              color={DJ_THEME_COLORS.primary}
              style={styles.centerIcon}
            />
            <Title style={[styles.title, { color: DJ_THEME_COLORS.onSurface }]}>
              Pro Tier Required
            </Title>
            <Text style={[styles.description, { color: DJ_THEME_COLORS.onSurfaceVariant }]}>
              DJ Mode is only available for Pro tier users.
            </Text>
            <Button
              mode="contained"
              onPress={() => navigation.navigate('Room', { roomId, roomName })}
              style={styles.button}
              buttonColor={DJ_THEME_COLORS.primary}
            >
              Back to Room
            </Button>
          </Card.Content>
        </Card>
      </View>
    );
  }

  // Show error if DJ mode is not available
  if (!tierSettings.djMode) {
    return (
      <View style={[styles.container, { backgroundColor: DJ_THEME_COLORS.background }]}>
        <Card style={[styles.card, { backgroundColor: DJ_THEME_COLORS.surface }]}>
          <Card.Content style={styles.centerContent}>
            <MaterialCommunityIcons
              name="equalizer"
              size={64}
              color={DJ_THEME_COLORS.primary}
              style={styles.centerIcon}
            />
            <Title style={[styles.title, { color: DJ_THEME_COLORS.onSurface }]}>
              DJ Mode Not Available
            </Title>
            <Text style={[styles.description, { color: DJ_THEME_COLORS.onSurfaceVariant }]}>
              The room creator needs to have a Pro tier subscription to enable DJ Mode.
            </Text>
            <Button
              mode="contained"
              onPress={() => navigation.navigate('Room', { roomId, roomName })}
              style={styles.button}
              buttonColor={DJ_THEME_COLORS.primary}
            >
              Back to Room
            </Button>
          </Card.Content>
        </Card>
      </View>
    );
  }

  // Show loading while DJ mode is being enabled
  if (isEnablingDJMode && !loading) {
    return (
      <View style={[styles.container, { backgroundColor: DJ_THEME_COLORS.background }]}>
        <Card style={[styles.card, { backgroundColor: DJ_THEME_COLORS.surface }]}>
          <Card.Content style={styles.centerContent}>
            <ActivityIndicator size="large" color={DJ_THEME_COLORS.primary} />
            <Title style={[styles.title, { color: DJ_THEME_COLORS.onSurface, marginTop: 16 }]}>
              Enabling DJ Mode...
            </Title>
          </Card.Content>
        </Card>
      </View>
    );
  }

  // If not owner/admin and DJ mode not enabled, show message
  if (!roomSettings.djMode && !isOwner && !isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: DJ_THEME_COLORS.background }]}>
        <Card style={[styles.card, { backgroundColor: DJ_THEME_COLORS.surface }]}>
          <Card.Content style={styles.centerContent}>
            <MaterialCommunityIcons
              name="equalizer"
              size={64}
              color={DJ_THEME_COLORS.primary}
              style={styles.centerIcon}
            />
            <Title style={[styles.title, { color: DJ_THEME_COLORS.onSurface }]}>
              DJ Mode Not Enabled
            </Title>
            <Text style={[styles.description, { color: DJ_THEME_COLORS.onSurfaceVariant }]}>
              The room owner needs to enable DJ Mode.
            </Text>
            <Button
              mode="contained"
              onPress={() => navigation.navigate('Room', { roomId, roomName })}
              style={styles.button}
              buttonColor={DJ_THEME_COLORS.primary}
            >
              Back to Room
            </Button>
          </Card.Content>
        </Card>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: DJ_THEME_COLORS.background }]}>
      {/* Animated Glowing Background Lights */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: glowAnimation1.interpolate({
              inputRange: [0, 1],
              outputRange: ['transparent', 'rgba(255, 107, 107, 0.15)'], // DJ_THEME_COLORS.primary with opacity
            }),
            borderRadius: 50,
            transform: [
              {
                scale: glowAnimation1.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1.2],
                }),
              },
            ],
          },
          styles.glowLight1,
        ]}
      />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: glowAnimation2.interpolate({
              inputRange: [0, 1],
              outputRange: ['transparent', 'rgba(76, 205, 196, 0.12)'], // DJ_THEME_COLORS.secondary with opacity
            }),
            borderRadius: 70,
            transform: [
              {
                scale: glowAnimation2.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1.1],
                }),
              },
            ],
          },
          styles.glowLight2,
        ]}
      />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: glowAnimation3.interpolate({
              inputRange: [0, 1],
              outputRange: ['transparent', 'rgba(255, 230, 109, 0.1)'], // DJ_THEME_COLORS.accent with opacity
            }),
            borderRadius: 40,
            transform: [
              {
                scale: glowAnimation3.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.7, 1.3],
                }),
              },
            ],
          },
          styles.glowLight3,
        ]}
      />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: pulseAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: ['transparent', 'rgba(255, 255, 255, 0.05)'], // Subtle white pulse
            }),
          },
        ]}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: DJ_THEME_COLORS.surface }]}>
        <View style={styles.headerLeft}>
          <IconButton
            icon="arrow-left"
            iconColor={DJ_THEME_COLORS.onSurface}
            size={24}
            onPress={handleExitDJMode}
          />
          <View style={styles.headerTitleContainer}>
            <MaterialCommunityIcons
              name="equalizer"
              size={28}
              color={DJ_THEME_COLORS.primary}
            />
            <Title style={[styles.headerTitle, { color: DJ_THEME_COLORS.onSurface }]}>
              DJ Mode
            </Title>
          </View>
        </View>
        <View style={[styles.headerBadge, { backgroundColor: `${DJ_THEME_COLORS.primary}20` }]}>
          <Text style={[styles.headerBadgeText, { color: DJ_THEME_COLORS.primary }]}>
            {roomSettings.djPlayers} / 4 Players
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* DJ Interface */}
        <DJModeInterface
          djMode={roomSettings.djMode}
          djPlayers={roomSettings.djPlayers}
          playerTracks={djPlayerTracks}
          playerPlayingStates={djPlayerPlayingStates}
          playerVolumes={djPlayerVolumes}
          playerBPMs={djPlayerBPMs}
          playerPositions={djPlayerPositions}
          playerDurations={djPlayerDurations}
          onPlayerPlayPause={handleDJPlayerPlayPause}
          onPlayerLoadTrack={handleDJPlayerLoadTrack}
          onPlayerVolumeChange={handleDJPlayerVolumeChange}
          onPlayerSeek={handleDJPlayerSeek}
          onSyncTracks={handleDJPlayerSync}
        />

        {/* Queue for loading tracks */}
        <Card style={[styles.card, { backgroundColor: DJ_THEME_COLORS.surface }]}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons
                name="playlist-music"
                size={24}
                color={DJ_THEME_COLORS.primary}
              />
              <Title style={[styles.sectionTitle, { color: DJ_THEME_COLORS.onSurface }]}>
                Queue (Load to Players)
              </Title>
            </View>
            {queue.length === 0 ? (
              <Text style={[styles.emptyQueue, { color: DJ_THEME_COLORS.onSurfaceVariant }]}>
                No tracks in queue. Add tracks from the main room view.
              </Text>
            ) : (
              <ScrollView style={styles.queueList}>
                {queue.map((track, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.queueItem,
                      { backgroundColor: DJ_THEME_COLORS.surfaceVariant },
                    ]}
                    onPress={() => {
                      Alert.alert(
                        'Load Track',
                        `Select a player to load "${track.info?.fullTitle || 'Unknown Track'}"`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          ...Array.from({ length: roomSettings.djPlayers }, (_, i) => ({
                            text: `Player ${i + 1}`,
                            onPress: async () => {
                              const success = await djAudioService.loadTrack(i, track);
                              if (success) {
                                const newTracks = [...djPlayerTracks];
                                newTracks[i] = track;
                                setDjPlayerTracks(newTracks);

                                const bpmResult = await bpmDetectionService.detectBPM(track);
                                const newBPMs = [...djPlayerBPMs];
                                newBPMs[i] = bpmResult.bpm;
                                setDjPlayerBPMs(newBPMs);

                                const playerState = djAudioService.getPlayerState(i);
                                if (playerState) {
                                  const newDurations = [...djPlayerDurations];
                                  newDurations[i] = playerState.duration;
                                  setDjPlayerDurations(newDurations);
                                }
                              } else {
                                Alert.alert('Error', 'Failed to load track to player');
                              }
                            },
                          })),
                        ]
                      );
                    }}
                  >
                    <View style={styles.queueItemContent}>
                      <MaterialCommunityIcons
                        name="music"
                        size={20}
                        color={DJ_THEME_COLORS.primary}
                      />
                      <View style={styles.queueItemDetails}>
                        <Text
                          style={[styles.queueItemTitle, { color: DJ_THEME_COLORS.onSurface }]}
                          numberOfLines={1}
                        >
                          {track.info?.fullTitle || 'Unknown Track'}
                        </Text>
                        <View style={styles.queueItemMeta}>
                          <MaterialCommunityIcons
                            name="account"
                            size={12}
                            color={DJ_THEME_COLORS.onSurfaceVariant}
                          />
                          <Text
                            style={[
                              styles.queueItemDescription,
                              { color: DJ_THEME_COLORS.onSurfaceVariant },
                            ]}
                            numberOfLines={1}
                          >
                            {track.info?.artist || 'Unknown Artist'}
                          </Text>
                        </View>
                      </View>
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={20}
                        color={DJ_THEME_COLORS.onSurfaceVariant}
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IS_MOBILE ? 8 : 16,
    paddingVertical: IS_MOBILE ? 8 : 12,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.3)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    }),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: IS_MOBILE ? 20 : 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  headerBadgeText: {
    fontSize: IS_MOBILE ? 11 : 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: IS_MOBILE ? 12 : 16,
  },
  card: {
    marginBottom: IS_MOBILE ? 12 : 16,
    borderRadius: 20,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.4)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 8,
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: IS_MOBILE ? 12 : 16,
  },
  sectionTitle: {
    fontSize: IS_MOBILE ? 18 : 20,
    fontWeight: '700',
  },
  emptyQueue: {
    fontSize: IS_MOBILE ? 13 : 14,
    textAlign: 'center',
    paddingVertical: IS_MOBILE ? 24 : 32,
  },
  queueList: {
    maxHeight: IS_MOBILE ? 300 : 400,
  },
  queueItem: {
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  queueItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: IS_MOBILE ? 12 : 16,
    gap: 12,
  },
  queueItemDetails: {
    flex: 1,
  },
  queueItemTitle: {
    fontSize: IS_MOBILE ? 14 : 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  queueItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  queueItemDescription: {
    fontSize: IS_MOBILE ? 11 : 12,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: IS_MOBILE ? 48 : 64,
    paddingHorizontal: IS_MOBILE ? 24 : 32,
  },
  centerIcon: {
    marginBottom: 16,
  },
  title: {
    fontSize: IS_MOBILE ? 20 : 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: IS_MOBILE ? 14 : 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    marginTop: 8,
  },
  // Glowing light effect styles
  glowLight1: {
    position: 'absolute',
    top: '20%',
    left: '10%',
    width: '60%',
    height: '40%',
    opacity: 0.3,
  },
  glowLight2: {
    position: 'absolute',
    top: '40%',
    right: '15%',
    width: '50%',
    height: '35%',
    opacity: 0.25,
  },
  glowLight3: {
    position: 'absolute',
    bottom: '25%',
    left: '20%',
    width: '55%',
    height: '30%',
    opacity: 0.2,
  },
});

export default DJModeScreen;

