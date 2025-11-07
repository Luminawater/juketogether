import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Card,
  Title,
  Paragraph,
  Button,
  TextInput,
  Divider,
  useTheme,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user } = useAuth();
  const theme = useTheme();

  const [invitationLink, setInvitationLink] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');

  // If user is logged in, redirect to dashboard
  React.useEffect(() => {
    if (user) {
      navigation.replace('Dashboard');
    }
  }, [user, navigation]);

  const handleJoinViaInvitation = () => {
    if (!invitationLink.trim()) {
      Alert.alert('Error', 'Please enter an invitation link');
      return;
    }

    // Extract room ID from URL or use as-is
    let roomId = invitationLink.trim();
    if (invitationLink.includes('/room/')) {
      roomId = invitationLink.split('/room/')[1].split('?')[0];
    }

    // Navigate to room (no auth required for joining via invitation)
    navigation.navigate('Room', { roomId, roomName: 'Music Room' });
  };

  const handleJoinViaRoomId = () => {
    if (!joinRoomId.trim()) {
      Alert.alert('Error', 'Please enter a room ID');
      return;
    }

    // Navigate to room (no auth required for joining)
    navigation.navigate('Room', { roomId: joinRoomId.trim(), roomName: 'Music Room' });
  };

  const handleCreateAccount = () => {
    navigation.navigate('Auth');
  };

  const pricingTiers = [
    {
      name: 'Free',
      price: '$0',
      songs: '1 song',
      features: ['Join rooms via invitation', 'Join via friends list', '1 song playback'],
      color: '#9e9e9e',
    },
    {
      name: 'Rookie',
      price: '$2',
      songs: '10 songs',
      features: ['Everything in Free', 'Create your own room', '10 songs playback'],
      color: '#4caf50',
    },
    {
      name: 'Standard',
      price: '$5',
      songs: 'Unlimited',
      features: ['Everything in Rookie', 'Unlimited songs', 'Priority support'],
      color: '#667eea',
    },
  ];

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.colors.background }]} 
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.header}>
        <Title style={[styles.title, { color: theme.colors.primary }]}>🎵 SoundCloud & Spotify Jukebox</Title>
        <Paragraph style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          Listen to music together with friends in real-time
        </Paragraph>
      </View>

      {/* Join Options - No Signup Required */}
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.cardTitle}>Join a Music Room</Title>
          <Paragraph style={styles.cardDescription}>
            No account needed! Join via invitation link or room ID
          </Paragraph>

          <View style={styles.joinSection}>
            <TextInput
              label="Invitation Link or Room ID"
              value={invitationLink || joinRoomId}
              onChangeText={(text) => {
                setInvitationLink(text);
                setJoinRoomId(text);
              }}
              mode="outlined"
              placeholder="Paste invitation link or enter room ID"
              style={styles.input}
            />
            <Button
              mode="contained"
              onPress={handleJoinViaInvitation}
              style={styles.joinButton}
              icon="login"
            >
              Join Room
            </Button>
          </View>
        </Card.Content>
      </Card>

      <Divider style={styles.divider} />

      {/* Pricing Tiers */}
      <View style={styles.pricingSection}>
        <Title style={styles.sectionTitle}>Subscription Plans</Title>
        <Paragraph style={styles.sectionDescription}>
          Create your own room and unlock more features
        </Paragraph>

        <View style={styles.pricingGrid}>
          {pricingTiers.map((tier, index) => (
            <Card key={index} style={[styles.pricingCard, { borderColor: tier.color }]}>
              <Card.Content>
                <View style={[styles.pricingBadge, { backgroundColor: tier.color }]}>
                  <Text style={styles.pricingName}>{tier.name}</Text>
                </View>
                <View style={styles.pricingHeader}>
                  <Text style={[styles.pricingPrice, { color: theme.colors.onSurface }]}>{tier.price}</Text>
                  <Text style={[styles.pricingSongs, { color: theme.colors.onSurfaceVariant }]}>{tier.songs}</Text>
                </View>
                <View style={styles.featuresList}>
                  {tier.features.map((feature, idx) => (
                    <View key={idx} style={styles.featureItem}>
                      <Text style={[styles.featureText, { color: theme.colors.onSurface }]}>✓ {feature}</Text>
                    </View>
                  ))}
                </View>
                {tier.name === 'Free' ? (
                  <Button
                    mode="outlined"
                    onPress={handleCreateAccount}
                    style={[styles.pricingButton, { borderColor: tier.color }]}
                    textColor={tier.color}
                  >
                    Sign Up Free
                  </Button>
                ) : (
                  <Button
                    mode="contained"
                    onPress={handleCreateAccount}
                    style={[styles.pricingButton, { backgroundColor: tier.color }]}
                  >
                    Upgrade to {tier.name}
                  </Button>
                )}
              </Card.Content>
            </Card>
          ))}
        </View>
      </View>

      {/* Create Account CTA */}
      <Card style={styles.ctaCard}>
        <Card.Content>
          <Title style={styles.ctaTitle}>Ready to create your own room?</Title>
          <Paragraph style={styles.ctaDescription}>
            Sign up for free and get 1 song to start. Upgrade anytime to unlock more features!
          </Paragraph>
          <Button
            mode="contained"
            onPress={handleCreateAccount}
            style={styles.ctaButton}
            icon="account-plus"
          >
            Create Account
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 40,
    paddingVertical: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: '#667eea',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  card: {
    marginBottom: 20,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  joinSection: {
    gap: 12,
  },
  input: {
    marginBottom: 8,
  },
  joinButton: {
    marginTop: 8,
  },
  divider: {
    marginVertical: 30,
  },
  pricingSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  pricingGrid: {
    gap: 16,
  },
  pricingCard: {
    marginBottom: 16,
    borderWidth: 2,
    elevation: 2,
  },
  pricingBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  pricingName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  pricingHeader: {
    marginBottom: 16,
  },
  pricingPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  pricingSongs: {
    fontSize: 16,
  },
  featuresList: {
    marginBottom: 20,
    gap: 8,
  },
  featureItem: {
    marginBottom: 4,
  },
  featureText: {
    fontSize: 14,
  },
  pricingButton: {
    marginTop: 8,
  },
  ctaCard: {
    backgroundColor: '#667eea',
    elevation: 4,
  },
  ctaTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  ctaDescription: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: 20,
  },
  ctaButton: {
    backgroundColor: '#fff',
  },
});

export default HomeScreen;

