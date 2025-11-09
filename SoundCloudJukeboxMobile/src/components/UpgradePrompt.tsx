import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Linking, Platform, Alert } from 'react-native';
import {
  Card,
  Text,
  Title,
  Button,
  useTheme,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/constants';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface UpgradePromptProps {
  isOwner: boolean;
  blockedAt: number;
  songsPlayed: number;
  roomId: string;
  onBoosterPurchased?: () => void;
}

interface BoosterPack {
  booster_type: '10min' | 'hour';
  price: number;
  duration_minutes: number;
  display_name: string;
  description: string;
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  isOwner,
  blockedAt,
  songsPlayed,
  roomId,
  onBoosterPurchased,
}) => {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { session, profile } = useAuth();
  const [boosterPacks, setBoosterPacks] = useState<BoosterPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    // Wrap in async IIFE to properly handle promise rejections
    (async () => {
      try {
        await loadBoosterPacks();
      } catch (error) {
        // Error already handled in loadBoosterPacks, but ensure promise is caught
        console.error('Failed to load booster packs:', error);
      }
    })();
  }, []);

  const loadBoosterPacks = async () => {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(`${API_URL}/api/booster-packs`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        setBoosterPacks(data.packs || []);
      } else {
        console.warn('Failed to load booster packs:', response.status, response.statusText);
        setBoosterPacks([]);
      }
    } catch (error: any) {
      // Handle network errors gracefully - don't throw, just log
      if (error.name === 'AbortError') {
        console.warn('Booster packs request timed out');
      } else if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('NetworkError'))) {
        console.warn('Network error loading booster packs - API may be unavailable');
      } else {
        console.warn('Error loading booster packs:', error.message || error);
      }
      // Set empty array on error so UI doesn't break
      setBoosterPacks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => {
    navigation.navigate('Subscription');
  };

  const handlePurchaseBooster = async (boosterType: '10min' | 'hour') => {
    if (!session) {
      Alert.alert('Error', 'Please sign in to purchase booster packs');
      return;
    }

    setPurchasing(boosterType);
    try {
      const response = await fetch(`${API_URL}/api/stripe/create-booster-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          roomId,
          boosterType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();

      if (!url) {
        throw new Error('No checkout URL received');
      }

      // Open Stripe checkout URL
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        throw new Error('Cannot open payment URL');
      }
    } catch (error: any) {
      console.error('Error purchasing booster:', error);
      Alert.alert('Error', error.message || 'Failed to start payment process');
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <Card.Content style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: `${theme.colors.error}20` }]}>
            <MaterialCommunityIcons 
              name="lock" 
              size={32} 
              color={theme.colors.error} 
            />
          </View>
          <Title style={[styles.title, { color: theme.colors.onSurface }]}>
            Playback Blocked
          </Title>
        </View>

        <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
          {isOwner ? (
            <>
              You've reached the limit for your <Text style={{ fontWeight: 'bold' }}>Free</Text> tier.{'\n'}
              You've played <Text style={{ fontWeight: 'bold' }}>{songsPlayed}</Text> song{songsPlayed !== 1 ? 's' : ''}.{'\n\n'}
              Upgrade your subscription to continue the party!
            </>
          ) : (
            <>
              The room owner has reached their tier limit.{'\n'}
              Purchase a booster pack to keep the music playing!
            </>
          )}
        </Text>

        <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />

        {isOwner ? (
          <View style={styles.upgradeSection}>
            <Button
              mode="contained"
              onPress={handleUpgrade}
              style={styles.upgradeButton}
              buttonColor={theme.colors.primary}
              icon="arrow-up-circle"
            >
              Upgrade Subscription
            </Button>
            <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
              Unlock unlimited playback and more features
            </Text>
          </View>
        ) : (
          <View style={styles.boosterSection}>
            {loading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <>
                <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                  Booster Packs
                </Text>
                {boosterPacks.map((pack) => (
                  <Card
                    key={pack.booster_type}
                    style={[styles.boosterCard, { backgroundColor: theme.colors.surfaceVariant }]}
                  >
                    <Card.Content>
                      <View style={styles.boosterHeader}>
                        <View>
                          <Title style={[styles.boosterTitle, { color: theme.colors.onSurface }]}>
                            {pack.display_name}
                          </Title>
                          <Text style={[styles.boosterDescription, { color: theme.colors.onSurfaceVariant }]}>
                            {pack.description}
                          </Text>
                        </View>
                        <Text style={[styles.boosterPrice, { color: theme.colors.primary }]}>
                          ${pack.price.toFixed(2)}
                        </Text>
                      </View>
                      <Button
                        mode="contained"
                        onPress={() => handlePurchaseBooster(pack.booster_type)}
                        loading={purchasing === pack.booster_type}
                        disabled={purchasing !== null}
                        style={styles.purchaseButton}
                        buttonColor={theme.colors.primary}
                        icon="cart"
                      >
                        Purchase
                      </Button>
                    </Card.Content>
                  </Card>
                ))}
              </>
            )}
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 16,
    borderRadius: 16,
    elevation: 4,
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
    textAlign: 'center',
  },
  divider: {
    marginVertical: 20,
    height: 1,
  },
  upgradeSection: {
    alignItems: 'center',
  },
  upgradeButton: {
    marginBottom: 12,
    minWidth: 200,
  },
  hint: {
    fontSize: 14,
    textAlign: 'center',
  },
  boosterSection: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  boosterCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  boosterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  boosterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  boosterDescription: {
    fontSize: 14,
  },
  boosterPrice: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  purchaseButton: {
    marginTop: 8,
  },
});

