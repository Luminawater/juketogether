import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import {
  Text,
  Card,
  Title,
  Button,
  useTheme,
  ActivityIndicator,
  Chip,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { SubscriptionTier } from '../types';
import { getTierDisplayName, getTierColor } from '../utils/permissions';

type SubscriptionScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Subscription'>;

interface TierConfig {
  tier: SubscriptionTier;
  display_name: string;
  price: number;
  queue_limit: number | null;
  dj_mode: boolean;
  listed_on_discovery: boolean;
  listed_on_leaderboard: boolean;
  ads: boolean;
  description: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2; // 2 columns with padding
const CARD_HEIGHT = CARD_WIDTH * 1.4; // Taller than wider (1.4:1 ratio)

const SubscriptionScreen: React.FC = () => {
  const navigation = useNavigation<SubscriptionScreenNavigationProp>();
  const { supabase, profile, refreshProfile } = useAuth();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<TierConfig[]>([]);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    loadTiers();
  }, []);

  const loadTiers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('subscription_tier_settings')
        .select('*')
        .order('price', { ascending: true });

      if (error) {
        console.error('Error loading tiers:', error);
        Alert.alert('Error', 'Failed to load subscription tiers');
        return;
      }

      if (data) {
        const tierConfigs: TierConfig[] = data.map((item: any) => ({
          tier: item.tier,
          display_name: item.display_name || item.tier,
          price: parseFloat(item.price || 0),
          queue_limit: item.queue_limit,
          dj_mode: item.dj_mode || false,
          listed_on_discovery: item.listed_on_discovery || false,
          listed_on_leaderboard: item.listed_on_leaderboard || false,
          ads: item.ads !== undefined ? item.ads : true,
          description: item.description || '',
        }));
        setTiers(tierConfigs);
      }
    } catch (error: any) {
      console.error('Error loading tiers:', error);
      Alert.alert('Error', error.message || 'Failed to load subscription tiers');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (tier: SubscriptionTier) => {
    if (!profile) return;

    // Don't allow downgrading
    const tierHierarchy: Record<SubscriptionTier, number> = {
      free: 0,
      standard: 1,
      pro: 2,
    };

    const currentTierLevel = tierHierarchy[profile.subscription_tier] || 0;
    const targetTierLevel = tierHierarchy[tier] || 0;

    if (targetTierLevel <= currentTierLevel) {
      Alert.alert('Info', 'You already have this tier or a higher one.');
      return;
    }

    setUpgrading(tier);
    try {
      // In a real app, this would integrate with a payment provider
      // For now, we'll just update the tier (admin can handle payments separately)
      const { error } = await supabase
        .from('user_profiles')
        .update({
          subscription_tier: tier,
          subscription_updated_at: new Date().toISOString(),
          songs_played_count: 0, // Reset count on upgrade
        })
        .eq('id', profile.id);

      if (error) {
        throw error;
      }

      // Refresh profile to show new tier
      await refreshProfile();

      Alert.alert(
        'Success',
        `You have been upgraded to ${getTierDisplayName(tier)}!`
      );
    } catch (error: any) {
      console.error('Error upgrading tier:', error);
      Alert.alert('Error', error.message || 'Failed to upgrade subscription');
    } finally {
      setUpgrading(null);
    }
  };

  const isCurrentTier = (tier: SubscriptionTier) => {
    return profile?.subscription_tier === tier;
  };

  const getQueueLimitText = (limit: number | null) => {
    if (limit === null || limit === Infinity) {
      return 'Unlimited';
    }
    return limit.toString();
  };

  const renderTierCard = (tierConfig: TierConfig) => {
    const isCurrent = isCurrentTier(tierConfig.tier);
    const tierColor = getTierColor(tierConfig.tier);

    return (
      <Card
        key={tierConfig.tier}
        style={[
          styles.tierCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: isCurrent ? tierColor : theme.colors.outline,
            borderWidth: isCurrent ? 3 : 2,
            width: CARD_WIDTH,
            minHeight: CARD_HEIGHT,
          },
        ]}
        elevation={isCurrent ? 5 : 3}
      >
        <Card.Content style={styles.cardContent}>
          {isCurrent && (
            <Chip
              style={[styles.currentChip, { backgroundColor: tierColor }]}
              textStyle={styles.currentChipText}
              icon="check-circle"
            >
              Current Plan
            </Chip>
          )}
          
          <View style={[styles.tierHeader, { borderBottomColor: theme.colors.outline }]}>
            <Title style={[styles.tierTitle, { color: theme.colors.onSurface }]}>
              {tierConfig.display_name}
            </Title>
            
            <View style={styles.priceContainer}>
              <Text style={[styles.price, { color: tierConfig.price === 0 ? theme.colors.primary : tierColor }]}>
                {tierConfig.price === 0 ? 'FREE' : `$${tierConfig.price.toFixed(0)}`}
              </Text>
              {tierConfig.price > 0 && (
                <Text style={[styles.pricePeriod, { color: theme.colors.onSurfaceVariant }]}>
                  /month
                </Text>
              )}
            </View>
          </View>

          <View style={styles.featuresContainer}>
            <View style={styles.featureRow}>
              <Text style={[styles.featureLabel, { color: theme.colors.onSurfaceVariant }]}>Queue:</Text>
              <Text style={[styles.featureValue, { color: theme.colors.onSurface }]}>
                {getQueueLimitText(tierConfig.queue_limit)}
              </Text>
            </View>
            <View style={styles.featureRow}>
              <Text style={[styles.featureLabel, { color: theme.colors.onSurfaceVariant }]}>DJ Mode:</Text>
              <Text style={[styles.featureValue, { color: tierConfig.dj_mode ? theme.colors.primary : theme.colors.onSurface }]}>
                {tierConfig.dj_mode ? 'Yes' : 'No'}
              </Text>
            </View>
            <View style={styles.featureRow}>
              <Text style={[styles.featureLabel, { color: theme.colors.onSurfaceVariant }]}>Discovery:</Text>
              <Text style={[styles.featureValue, { color: tierConfig.listed_on_discovery ? theme.colors.primary : theme.colors.onSurface }]}>
                {tierConfig.listed_on_discovery ? 'Yes' : 'No'}
              </Text>
            </View>
            <View style={styles.featureRow}>
              <Text style={[styles.featureLabel, { color: theme.colors.onSurfaceVariant }]}>Leaderboard:</Text>
              <Text style={[styles.featureValue, { color: tierConfig.listed_on_leaderboard ? theme.colors.primary : theme.colors.onSurface }]}>
                {tierConfig.listed_on_leaderboard ? 'Yes' : 'No'}
              </Text>
            </View>
            <View style={styles.featureRow}>
              <Text style={[styles.featureLabel, { color: theme.colors.onSurfaceVariant }]}>Ads:</Text>
              <Text style={[styles.featureValue, { color: !tierConfig.ads ? theme.colors.primary : theme.colors.error }]}>
                {tierConfig.ads ? 'Yes' : 'No'}
              </Text>
            </View>
          </View>

          {tierConfig.description && (
            <Text
              style={[styles.description, { color: theme.colors.onSurfaceVariant }]}
              numberOfLines={2}
            >
              {tierConfig.description}
            </Text>
          )}

          <Button
            mode={isCurrent ? 'outlined' : 'contained'}
            onPress={() => handleUpgrade(tierConfig.tier)}
            disabled={isCurrent || upgrading === tierConfig.tier}
            loading={upgrading === tierConfig.tier}
            style={[styles.upgradeButton, isCurrent && { borderColor: tierColor }]}
            buttonColor={isCurrent ? undefined : tierColor}
            textColor={isCurrent ? tierColor : undefined}
            icon={isCurrent ? 'check-circle' : 'arrow-up'}
          >
            {isCurrent ? 'Current Plan' : 'Upgrade'}
          </Button>
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
            Loading subscription plans...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Title style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
            Subscription Plans
          </Title>
          <Text style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            Choose the plan that's right for you
          </Text>
        </View>

        <View style={styles.gridContainer}>
          {tiers.map((tier) => renderTierCard(tier))}
        </View>
      </ScrollView>
    </View>
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  tierCard: {
    borderRadius: 16,
    marginBottom: 16,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 16,
  },
  currentChip: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  currentChipText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  tierHeader: {
    borderBottomWidth: 1,
    paddingBottom: 12,
    marginBottom: 16,
  },
  tierTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: -1,
  },
  pricePeriod: {
    fontSize: 14,
    marginLeft: 4,
    opacity: 0.7,
  },
  featuresContainer: {
    marginBottom: 16,
    flex: 1,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 4,
  },
  featureLabel: {
    fontSize: 14,
    flex: 1,
  },
  featureValue: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  description: {
    fontSize: 12,
    marginBottom: 16,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  upgradeButton: {
    marginTop: 'auto',
    borderRadius: 8,
  },
});

export default SubscriptionScreen;

