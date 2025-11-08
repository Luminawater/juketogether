import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import {
  Text,
  Card,
  Title,
  Button,
  useTheme,
  ActivityIndicator,
  Chip,
  Divider,
} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { SubscriptionTier } from '../types';
import { getTierDisplayName, getTierColor } from '../utils/permissions';
import { API_URL } from '../config/constants';

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
  playlist: boolean;
  collaboration: boolean;
  description: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_MOBILE = SCREEN_WIDTH < 768;
const CARD_WIDTH = IS_MOBILE ? SCREEN_WIDTH - 32 : Math.min(320, Math.max(280, (SCREEN_WIDTH - 120) / 4));
const CARD_MIN_HEIGHT = 680;

const SubscriptionScreen: React.FC = () => {
  const navigation = useNavigation<SubscriptionScreenNavigationProp>();
  const { supabase, profile, refreshProfile } = useAuth();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<TierConfig[]>([]);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    loadTiers();
  }, []);

  // Handle deep link callbacks from Stripe
  useFocusEffect(
    React.useCallback(() => {
      // Check if we're returning from a successful payment
      // This will be handled via URL parameters in web, or deep linking in mobile
      const checkPaymentStatus = async () => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const sessionId = urlParams.get('session_id');
          const canceled = urlParams.get('canceled');
          
          if (sessionId) {
            // Payment was successful, refresh profile
            await refreshProfile();
            Alert.alert(
              'Payment Successful!',
              'Your subscription has been upgraded. Thank you!'
            );
            // Clean up URL
            window.history.replaceState({}, '', '/subscription');
          } else if (canceled) {
            Alert.alert('Payment Canceled', 'Your payment was canceled.');
            // Clean up URL
            window.history.replaceState({}, '', '/subscription');
          }
        }
      };
      
      checkPaymentStatus();
    }, [refreshProfile])
  );

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
          playlist: item.playlist !== undefined ? item.playlist : false,
          collaboration: item.collaboration !== undefined ? item.collaboration : false,
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
    const tierHierarchy: Partial<Record<SubscriptionTier, number>> = {
      free: 0,
      rookie: 1,
      standard: 2,
      pro: 3,
    };

    const currentTierLevel = tierHierarchy[profile.subscription_tier] || 0;
    const targetTierLevel = tierHierarchy[tier] || 0;

    if (targetTierLevel <= currentTierLevel) {
      Alert.alert('Info', 'You already have this tier or a higher one.');
      return;
    }

    // Check if tier is free
    const tierConfig = tiers.find(t => t.tier === tier);
    if (tierConfig && tierConfig.price === 0) {
      // Free tier - upgrade directly without payment
      setUpgrading(tier);
      try {
        const oldTier = profile.subscription_tier;
        
        const { error } = await supabase
          .from('user_profiles')
          .update({
            subscription_tier: tier,
            subscription_updated_at: new Date().toISOString(),
            songs_played_count: 0,
          })
          .eq('id', profile.id);

        if (error) {
          throw error;
        }

        // Send notification if tier changed
        if (oldTier !== tier) {
          const { createTierChangeNotification } = await import('../services/notificationService');
          await createTierChangeNotification(
            supabase,
            profile.id,
            oldTier,
            tier,
            getTierDisplayName(oldTier),
            getTierDisplayName(tier)
          );
        }

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
      return;
    }

    // Paid tier - redirect to Stripe checkout
    setProcessingPayment(true);
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Error', 'Please sign in to upgrade your subscription');
        return;
      }

      // Create Stripe checkout session
      const response = await fetch(`${API_URL}/api/stripe/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tier }),
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
      console.error('Error creating checkout session:', error);
      Alert.alert('Error', error.message || 'Failed to start payment process');
    } finally {
      setProcessingPayment(false);
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

  const isProTier = (tier: SubscriptionTier) => {
    return tier === 'pro';
  };

  const getFeatureDisplayValue = (tierConfig: TierConfig, featureName: string, value: boolean | number | null) => {
    // For PRO tier, show "All included" or "Unlimited" for enabled features
    if (isProTier(tierConfig.tier)) {
      if (featureName === 'queue_limit') {
        return 'Unlimited';
      }
      if (typeof value === 'boolean' && value) {
        return 'All included';
      }
      if (typeof value === 'boolean' && !value) {
        return '✗';
      }
    }
    
    // For other tiers, show normal values
    if (featureName === 'queue_limit') {
      return getQueueLimitText(value as number | null);
    }
    if (typeof value === 'boolean') {
      return value ? '✓' : '✗';
    }
    return value?.toString() || 'N/A';
  };

  const getFeatureIcon = (featureName: string, enabled: boolean) => {
    const iconMap: Record<string, string> = {
      queue_limit: 'playlist-music',
      dj_mode: 'record-player',
      listed_on_discovery: 'compass-outline',
      listed_on_leaderboard: 'trophy',
      ads: 'advertisements-off',
      playlist: 'playlist-play',
      collaboration: 'account-group',
    };
    return iconMap[featureName] || 'check-circle';
  };

  const renderTierCard = (tierConfig: TierConfig) => {
    const isCurrent = isCurrentTier(tierConfig.tier);
    const tierColor = getTierColor(tierConfig.tier);
    const isPopular = tierConfig.tier === 'pro' || tierConfig.tier === 'standard';

    return (
      <Card
        key={tierConfig.tier}
        style={[
          styles.tierCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: isCurrent ? tierColor : isPopular ? `${tierColor}60` : theme.colors.outline,
            borderWidth: isCurrent ? 3 : isPopular ? 2 : 1.5,
            minHeight: CARD_MIN_HEIGHT,
            ...(Platform.OS === 'web' ? {
              boxShadow: isCurrent 
                ? `0 12px 32px ${tierColor}50, 0 6px 16px rgba(0, 0, 0, 0.2)`
                : isPopular
                ? `0 8px 20px ${tierColor}30, 0 4px 12px rgba(0, 0, 0, 0.15)`
                : '0 4px 16px rgba(0, 0, 0, 0.12)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: 'translateY(0)',
            } : {
              shadowColor: isCurrent ? tierColor : isPopular ? tierColor : '#000',
              shadowOffset: { width: 0, height: isCurrent ? 10 : isPopular ? 6 : 4 },
              shadowOpacity: isCurrent ? 0.35 : isPopular ? 0.2 : 0.12,
              shadowRadius: isCurrent ? 16 : isPopular ? 12 : 8,
              elevation: isCurrent ? 10 : isPopular ? 6 : 4,
            }),
          },
        ]}
      >
        {isPopular && !isCurrent && (
          <View style={[styles.popularBadge, { backgroundColor: `${tierColor}20` }]}>
            <MaterialCommunityIcons name="star" size={14} color={tierColor} />
            <Text style={[styles.popularBadgeText, { color: tierColor }]}>Popular</Text>
          </View>
        )}
        
        <Card.Content style={styles.cardContent}>
          {isCurrent && (
            <Chip
              style={[styles.currentChip, { backgroundColor: tierColor }]}
              textStyle={styles.currentChipText}
              icon="check-circle"
              compact
            >
              Current Plan
            </Chip>
          )}
          
          <View style={[styles.tierHeader, { borderBottomColor: `${theme.colors.outline}80` }]}>
            <View style={[styles.tierIconContainer, { backgroundColor: `${tierColor}15` }]}>
              <MaterialCommunityIcons 
                name={isPopular ? 'crown' : 'account'} 
                size={28} 
                color={tierColor} 
              />
            </View>
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
            <Text style={[styles.featuresTitle, { color: theme.colors.onSurfaceVariant }]}>
              Features
            </Text>
            <Divider style={[styles.featuresDivider, { backgroundColor: theme.colors.outline }]} />
            
            <View style={styles.featureRow}>
              <View style={styles.featureLeft}>
                <MaterialCommunityIcons 
                  name={getFeatureIcon('queue_limit', true)} 
                  size={18} 
                  color={tierConfig.queue_limit === null || tierConfig.queue_limit === Infinity ? tierColor : theme.colors.onSurfaceVariant} 
                  style={styles.featureIcon}
                />
                <Text style={[styles.featureLabel, { color: theme.colors.onSurfaceVariant }]}>Queue Limit</Text>
              </View>
              <Text style={[styles.featureValue, { 
                color: isProTier(tierConfig.tier) || tierConfig.queue_limit === null || tierConfig.queue_limit === Infinity
                  ? tierColor 
                  : theme.colors.onSurface 
              }]}>
                {getFeatureDisplayValue(tierConfig, 'queue_limit', tierConfig.queue_limit)}
              </Text>
            </View>
            
            <View style={styles.featureRow}>
              <View style={styles.featureLeft}>
                <MaterialCommunityIcons 
                  name={getFeatureIcon('dj_mode', tierConfig.dj_mode)} 
                  size={18} 
                  color={tierConfig.dj_mode ? tierColor : theme.colors.onSurfaceVariant} 
                  style={styles.featureIcon}
                />
                <Text style={[styles.featureLabel, { color: theme.colors.onSurfaceVariant }]}>DJ Mode</Text>
              </View>
              <Text style={[styles.featureValue, { 
                color: tierConfig.dj_mode ? tierColor : theme.colors.onSurface 
              }]}>
                {getFeatureDisplayValue(tierConfig, 'dj_mode', tierConfig.dj_mode)}
              </Text>
            </View>
            
            <View style={styles.featureRow}>
              <View style={styles.featureLeft}>
                <MaterialCommunityIcons 
                  name={getFeatureIcon('listed_on_discovery', tierConfig.listed_on_discovery)} 
                  size={18} 
                  color={tierConfig.listed_on_discovery ? tierColor : theme.colors.onSurfaceVariant} 
                  style={styles.featureIcon}
                />
                <Text style={[styles.featureLabel, { color: theme.colors.onSurfaceVariant }]}>Discovery</Text>
              </View>
              <Text style={[styles.featureValue, { 
                color: tierConfig.listed_on_discovery ? tierColor : theme.colors.onSurface 
              }]}>
                {getFeatureDisplayValue(tierConfig, 'listed_on_discovery', tierConfig.listed_on_discovery)}
              </Text>
            </View>
            
            <View style={styles.featureRow}>
              <View style={styles.featureLeft}>
                <MaterialCommunityIcons 
                  name={getFeatureIcon('listed_on_leaderboard', tierConfig.listed_on_leaderboard)} 
                  size={18} 
                  color={tierConfig.listed_on_leaderboard ? tierColor : theme.colors.onSurfaceVariant} 
                  style={styles.featureIcon}
                />
                <Text style={[styles.featureLabel, { color: theme.colors.onSurfaceVariant }]}>Leaderboard</Text>
              </View>
              <Text style={[styles.featureValue, { 
                color: tierConfig.listed_on_leaderboard ? tierColor : theme.colors.onSurface 
              }]}>
                {getFeatureDisplayValue(tierConfig, 'listed_on_leaderboard', tierConfig.listed_on_leaderboard)}
              </Text>
            </View>
            
            <View style={styles.featureRow}>
              <View style={styles.featureLeft}>
                <MaterialCommunityIcons 
                  name={getFeatureIcon('ads', !tierConfig.ads)} 
                  size={18} 
                  color={!tierConfig.ads ? tierColor : theme.colors.error} 
                  style={styles.featureIcon}
                />
                <Text style={[styles.featureLabel, { color: theme.colors.onSurfaceVariant }]}>No Ads</Text>
              </View>
              <Text style={[styles.featureValue, { 
                color: !tierConfig.ads ? tierColor : theme.colors.error 
              }]}>
                {getFeatureDisplayValue(tierConfig, 'ads', !tierConfig.ads)}
              </Text>
            </View>
            
            <View style={styles.featureRow}>
              <View style={styles.featureLeft}>
                <MaterialCommunityIcons 
                  name={getFeatureIcon('playlist', tierConfig.playlist)} 
                  size={18} 
                  color={tierConfig.playlist ? tierColor : theme.colors.onSurfaceVariant} 
                  style={styles.featureIcon}
                />
                <Text style={[styles.featureLabel, { color: theme.colors.onSurfaceVariant }]}>Playlists</Text>
              </View>
              <Text style={[styles.featureValue, { 
                color: tierConfig.playlist ? tierColor : theme.colors.onSurface 
              }]}>
                {getFeatureDisplayValue(tierConfig, 'playlist', tierConfig.playlist)}
              </Text>
            </View>
            
            <View style={styles.featureRow}>
              <View style={styles.featureLeft}>
                <MaterialCommunityIcons 
                  name={getFeatureIcon('collaboration', tierConfig.collaboration)} 
                  size={18} 
                  color={tierConfig.collaboration ? tierColor : theme.colors.onSurfaceVariant} 
                  style={styles.featureIcon}
                />
                <Text style={[styles.featureLabel, { color: theme.colors.onSurfaceVariant }]}>Collaboration</Text>
              </View>
              <Text style={[styles.featureValue, { 
                color: tierConfig.collaboration ? tierColor : theme.colors.onSurface 
              }]}>
                {getFeatureDisplayValue(tierConfig, 'collaboration', tierConfig.collaboration)}
              </Text>
            </View>
          </View>

          {tierConfig.description && (
            <View style={[styles.descriptionContainer, { borderTopColor: `${theme.colors.outline}40` }]}>
              <Text
                style={[styles.description, { color: theme.colors.onSurfaceVariant }]}
                numberOfLines={3}
              >
                {tierConfig.description}
              </Text>
            </View>
          )}

          <View style={styles.buttonContainer}>
            <Button
              mode={isCurrent ? 'outlined' : 'contained'}
              onPress={() => handleUpgrade(tierConfig.tier)}
              disabled={isCurrent || upgrading === tierConfig.tier || processingPayment}
              loading={upgrading === tierConfig.tier || processingPayment}
              style={[
                styles.upgradeButton, 
                isCurrent && { borderColor: tierColor, borderWidth: 2 },
                !isCurrent && Platform.OS === 'web' && {
                  boxShadow: `0 4px 12px ${tierColor}40`,
                }
              ]}
              buttonColor={isCurrent ? undefined : tierColor}
              textColor={isCurrent ? tierColor : undefined}
              icon={isCurrent ? 'check-circle' : processingPayment ? 'loading' : 'arrow-up'}
              contentStyle={styles.upgradeButtonContent}
              labelStyle={styles.upgradeButtonLabel}
            >
              {isCurrent ? 'Current Plan' : processingPayment ? 'Processing...' : 'Upgrade Now'}
            </Button>
          </View>
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
      <View style={styles.header}>
        <View style={[styles.headerIconContainer, { backgroundColor: `${theme.colors.primary}15` }]}>
          <MaterialCommunityIcons 
            name="crown-outline" 
            size={32} 
            color={theme.colors.primary} 
          />
        </View>
        <Title style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
          Subscription Plans
        </Title>
        <Text style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          Choose the plan that's right for you
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalScrollContent}
        style={styles.horizontalScroll}
      >
        {tiers.map((tier) => renderTierCard(tier))}
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
    fontWeight: '500',
  },
  header: {
    padding: IS_MOBILE ? 20 : 24,
    paddingTop: IS_MOBILE ? 28 : 32,
    paddingBottom: IS_MOBILE ? 20 : 24,
    alignItems: 'center',
  },
  headerIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: IS_MOBILE ? 28 : 36,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: IS_MOBILE ? 14 : 16,
    textAlign: 'center',
    opacity: 0.75,
    fontWeight: '400',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  horizontalScroll: {
    flex: 1,
  },
  horizontalScrollContent: {
    paddingHorizontal: IS_MOBILE ? 16 : 24,
    paddingVertical: 20,
    paddingBottom: 40,
    gap: IS_MOBILE ? 16 : 20,
    alignItems: 'flex-start',
  },
  tierCard: {
    borderRadius: 24,
    flex: 0,
    width: CARD_WIDTH,
    maxWidth: CARD_WIDTH,
    overflow: 'hidden',
    position: 'relative',
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      ':hover': {
        transform: 'translateY(-4px)',
      },
    } : {}),
  },
  popularBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    zIndex: 10,
    gap: 4,
  },
  popularBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardContent: {
    justifyContent: 'flex-start',
    padding: IS_MOBILE ? 18 : 24,
    paddingTop: IS_MOBILE ? 18 : 24,
    minHeight: CARD_MIN_HEIGHT,
    width: '100%',
  },
  currentChip: {
    alignSelf: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  currentChipText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  tierHeader: {
    borderBottomWidth: 2,
    paddingBottom: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  tierIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  tierTitle: {
    fontSize: IS_MOBILE ? 22 : 26,
    fontWeight: '800',
    marginBottom: 14,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginTop: 4,
  },
  price: {
    fontSize: IS_MOBILE ? 36 : 44,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: IS_MOBILE ? 40 : 48,
  },
  pricePeriod: {
    fontSize: IS_MOBILE ? 14 : 16,
    marginLeft: 6,
    opacity: 0.65,
    fontWeight: '500',
  },
  featuresContainer: {
    marginBottom: 24,
    width: '100%',
    minHeight: 240,
  },
  featuresTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    opacity: 0.6,
  },
  featuresDivider: {
    marginBottom: 16,
    height: 1,
    opacity: 0.3,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingVertical: 10,
    minHeight: 36,
  },
  featureLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  featureIcon: {
    marginRight: 0,
  },
  featureLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    flex: 1,
  },
  featureValue: {
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
    flexShrink: 0,
    minWidth: 90,
    letterSpacing: 0.2,
  },
  descriptionContainer: {
    marginBottom: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  description: {
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 18,
    textAlign: 'center',
    opacity: 0.7,
    paddingHorizontal: 8,
  },
  buttonContainer: {
    marginTop: 'auto',
    paddingTop: 20,
  },
  upgradeButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  upgradeButtonContent: {
    paddingVertical: IS_MOBILE ? 6 : 8,
    paddingHorizontal: 16,
  },
  upgradeButtonLabel: {
    fontSize: IS_MOBILE ? 14 : 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default SubscriptionScreen;

