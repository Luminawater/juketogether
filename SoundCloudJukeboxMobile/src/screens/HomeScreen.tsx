import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Animated,
  Dimensions,
  Image,
  Platform,
  Modal,
} from 'react-native';
import {
  Text,
  Title,
  Button,
  TextInput,
  useTheme,
  Dialog,
  Portal,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';

// Import logos
const SoundCloudLogo = require('../../assets/logo-soundcloud.png');
const SpotifyLogo = require('../../assets/Spotify-logo.png');
const YouTubeLogo = require('../../assets/youtube.png');

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const { width, height } = Dimensions.get('window');

// Animated Orb Component
const AnimatedOrb: React.FC<{
  size: number;
  color: string;
  startX: number;
  startY: number;
  duration: number;
  delay: number;
}> = ({ size, color, startX, startY, duration, delay }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Native driver is not supported on web
    const useNativeDriver = Platform.OS !== 'web';
    
    const animate = () => {
      Animated.parallel([
        Animated.loop(
          Animated.sequence([
            Animated.timing(translateX, {
              toValue: 1,
              duration: duration,
              delay: delay,
              useNativeDriver: useNativeDriver,
            }),
            Animated.timing(translateX, {
              toValue: 0,
              duration: duration,
              useNativeDriver: useNativeDriver,
            }),
          ])
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(translateY, {
              toValue: 1,
              duration: duration * 1.3,
              delay: delay,
              useNativeDriver: useNativeDriver,
            }),
            Animated.timing(translateY, {
              toValue: 0,
              duration: duration * 1.3,
              useNativeDriver: useNativeDriver,
            }),
          ])
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 0.6,
              duration: duration * 0.8,
              delay: delay,
              useNativeDriver: useNativeDriver,
            }),
            Animated.timing(opacity, {
              toValue: 0.3,
              duration: duration * 0.8,
              useNativeDriver: useNativeDriver,
            }),
          ])
        ),
      ]).start();
    };

    animate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const x = translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width * 0.3],
  });

  const y = translateY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, height * 0.2],
  });

  return (
    <Animated.View
      style={[
        styles.orb,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          left: startX,
          top: startY,
          transform: [{ translateX: x }, { translateY: y }],
          opacity: opacity,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.orbInner,
          {
            width: size * 0.6,
            height: size * 0.6,
            borderRadius: (size * 0.6) / 2,
            backgroundColor: color,
            opacity: opacity,
          },
        ]}
      />
    </Animated.View>
  );
};

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user, loading } = useAuth();
  const theme = useTheme();

  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomId, setRoomId] = useState('');

  // If user is logged in, redirect to dashboard
  React.useEffect(() => {
    // Wait for auth to finish loading before redirecting
    if (!loading && user) {
      // On web, ensure URL is updated to /dashboard
      if (Platform.OS === 'web') {
        window.location.href = '/dashboard';
      } else {
        navigation.replace('Home');
      }
    }
  }, [user, loading, navigation]);

  const handleLoginSignup = () => {
    navigation.navigate('Auth');
  };

  const handleJoinRoom = () => {
    setShowJoinModal(true);
  };

  const handleJoinRoomSubmit = async () => {
    if (!roomId.trim()) {
      Alert.alert('Error', 'Please enter a room code, ID or invitation link');
      return;
    }

    let searchValue = roomId.trim().toUpperCase();

    // Extract room ID from URL if it's a full URL
    if (searchValue.includes('/ROOM/')) {
      searchValue = searchValue.split('/ROOM/')[1].split('?')[0];
    }

    // If it's a 5-character code, try to find by short_code
    // Otherwise, navigate directly (will work if it's a valid room ID)
    if (searchValue.length === 5 && /^[A-Z0-9]+$/.test(searchValue)) {
      // Likely a short code - navigate and let RoomScreen handle the lookup
      navigation.navigate('Room', { roomId: searchValue, roomName: 'Music Room', isShortCode: true });
    } else {
      // Assume it's a room ID
      navigation.navigate('Room', { roomId: searchValue, roomName: 'Music Room' });
    }
    
    setShowJoinModal(false);
    setRoomId('');
  };

  // Orbs configuration
  const orbs = [
    { size: 200, color: '#667eea', startX: -100, startY: 100, duration: 8000, delay: 0 },
    { size: 150, color: '#03DAC6', startX: width - 50, startY: 200, duration: 10000, delay: 2000 },
    { size: 180, color: '#BB86FC', startX: width / 2, startY: -50, duration: 12000, delay: 4000 },
    { size: 120, color: '#667eea', startX: width + 20, startY: height / 2, duration: 9000, delay: 1000 },
    { size: 160, color: '#03DAC6', startX: -80, startY: height - 200, duration: 11000, delay: 3000 },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Animated Orbs Background */}
      <View style={styles.orbsContainer}>
        {orbs.map((orb, index) => (
          <AnimatedOrb key={index} {...orb} />
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Logo Row */}
        <View style={styles.logoContainer}>
          <Image
            source={SoundCloudLogo}
            style={styles.logo}
            resizeMode="contain"
          />
          <Image
            source={SpotifyLogo}
            style={styles.logo}
            resizeMode="contain"
          />
          <Image
            source={YouTubeLogo}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Title style={[styles.title, { color: theme.colors.onBackground }]}>
          🎵 Music Jukebox
        </Title>
        <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          Listen to music together with friends in real-time
        </Text>

        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={handleLoginSignup}
            style={styles.button}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            icon="account"
          >
            Login / Signup
          </Button>

          <Button
            mode="outlined"
            onPress={handleJoinRoom}
            style={[styles.button, styles.joinButton]}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            icon="door-open"
          >
            Join Room
          </Button>
        </View>
      </View>

      {/* Join Room Dialog */}
      <Portal>
        <Dialog
          visible={showJoinModal}
          onDismiss={() => {
            setShowJoinModal(false);
            setRoomId('');
          }}
          style={{ borderRadius: 20 }}
        >
          <Dialog.Title>Join a Music Room</Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.modalDescription, { color: theme.colors.onSurfaceVariant }]}>
              Enter a 5-character room code, room ID or paste an invitation link
            </Text>
            <TextInput
              label="Room Code, ID or Invitation Link"
              value={roomId}
              onChangeText={setRoomId}
              mode="outlined"
              placeholder="Enter 5-character code or room ID/link"
              style={styles.modalInput}
              autoCapitalize="characters"
              autoFocus
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setShowJoinModal(false);
                setRoomId('');
              }}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleJoinRoomSubmit}
            >
              Join
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  orbsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { pointerEvents: 'none' } : {}),
  },
  orb: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbInner: {
    position: 'absolute',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 1,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  logo: {
    width: 60,
    height: 60,
    opacity: 0.9,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 48,
    opacity: 0.8,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 320,
    gap: 16,
  },
  button: {
    borderRadius: 12,
    elevation: 4,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    }),
  },
  joinButton: {
    borderWidth: 2,
  },
  buttonContent: {
    paddingVertical: 12,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    elevation: 12,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.4)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
    }),
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.8,
  },
  modalInput: {
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  modalButton: {
    flex: 1,
  },
});

export default HomeScreen;

