import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import {
  Text,
  Card,
  Title,
  Button,
  useTheme,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ConfettiCannon from 'react-native-confetti-cannon';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/constants';
import { getTierDisplayName, getTierColor } from '../utils/permissions';

type PaymentSuccessScreenRouteProp = RouteProp<RootStackParamList, 'PaymentSuccess'>;
type PaymentSuccessScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PaymentSuccess'>;

interface ReceiptData {
  sessionId: string;
  amount: number;
  currency: string;
  tier: string;
  tierDisplayName: string;
  paymentDate: string;
  customerEmail?: string;
  paymentMethod?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PaymentSuccessScreen: React.FC = () => {
  const navigation = useNavigation<PaymentSuccessScreenNavigationProp>();
  const route = useRoute<PaymentSuccessScreenRouteProp>();
  const { refreshProfile, profile, supabase } = useAuth();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confettiRef = useRef<ConfettiCannon>(null);
  const [confettiFired, setConfettiFired] = useState(false);

  useEffect(() => {
    // Fire confetti once when component mounts
    if (!confettiFired && confettiRef.current) {
      setTimeout(() => {
        confettiRef.current?.start();
        setConfettiFired(true);
      }, 300);
    }
  }, [confettiFired]);

  useEffect(() => {
    const fetchReceiptData = async () => {
      try {
        setLoading(true);
        
        // Get session_id from route params or URL
        let sessionId: string | null = null;
        
        if (route.params?.sessionId) {
          sessionId = route.params.sessionId;
        } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          sessionId = urlParams.get('session_id');
          
          // Clean up URL after reading session_id
          if (sessionId) {
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
          }
        }

        if (!sessionId) {
          setError('No payment session found');
          setLoading(false);
          return;
        }

        // Fetch receipt data from server
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('Please sign in to view receipt');
          setLoading(false);
          return;
        }

        const response = await fetch(`${API_URL}/api/stripe/get-session-details`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ sessionId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch receipt data');
        }

        const data = await response.json();
        setReceiptData(data);
        
        // Refresh user profile to get updated subscription tier
        await refreshProfile();
      } catch (err: any) {
        console.error('Error fetching receipt data:', err);
        setError(err.message || 'Failed to load receipt');
      } finally {
        setLoading(false);
      }
    };

    fetchReceiptData();
  }, [route.params, refreshProfile]);

  const handleContinue = () => {
    // Navigate to subscription screen or home
    navigation.navigate('Subscription');
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100); // Stripe amounts are in cents
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
            Loading receipt...
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {error}
          </Text>
          <Button
            mode="contained"
            onPress={() => navigation.goBack()}
            style={styles.button}
          >
            Go Back
          </Button>
        </View>
      </View>
    );
  }

  if (!receiptData) {
    return null;
  }

  const tierColor = getTierColor(receiptData.tier as any);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ConfettiCannon
        ref={confettiRef}
        count={200}
        origin={{ x: SCREEN_WIDTH / 2, y: 0 }}
        fadeOut={true}
        autoStart={false}
      />
      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Header */}
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: tierColor + '20' }]}>
            <Text style={[styles.checkIcon, { color: tierColor }]}>✓</Text>
          </View>
          <Title style={[styles.title, { color: theme.colors.onSurface }]}>
            Payment Successful!
          </Title>
          <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            Thank you for your purchase
          </Text>
        </View>

        {/* Receipt Card */}
        <Card style={[styles.receiptCard, { backgroundColor: theme.colors.surface }]}>
          <Card.Content>
            <Title style={[styles.receiptTitle, { color: theme.colors.onSurface }]}>
              Receipt
            </Title>
            
            <Divider style={styles.divider} />

            {/* Subscription Tier */}
            <View style={styles.receiptRow}>
              <Text style={[styles.receiptLabel, { color: theme.colors.onSurfaceVariant }]}>
                Subscription Plan:
              </Text>
              <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
                <Text style={styles.tierBadgeText}>
                  {receiptData.tierDisplayName}
                </Text>
              </View>
            </View>

            {/* Amount */}
            <View style={styles.receiptRow}>
              <Text style={[styles.receiptLabel, { color: theme.colors.onSurfaceVariant }]}>
                Amount Paid:
              </Text>
              <Text style={[styles.receiptValue, { color: theme.colors.onSurface }]}>
                {formatCurrency(receiptData.amount, receiptData.currency)}
              </Text>
            </View>

            {/* Payment Date */}
            <View style={styles.receiptRow}>
              <Text style={[styles.receiptLabel, { color: theme.colors.onSurfaceVariant }]}>
                Payment Date:
              </Text>
              <Text style={[styles.receiptValue, { color: theme.colors.onSurface }]}>
                {formatDate(receiptData.paymentDate)}
              </Text>
            </View>

            {/* Customer Email */}
            {receiptData.customerEmail && (
              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Email:
                </Text>
                <Text style={[styles.receiptValue, { color: theme.colors.onSurface }]}>
                  {receiptData.customerEmail}
                </Text>
              </View>
            )}

            {/* Payment Method */}
            {receiptData.paymentMethod && (
              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Payment Method:
                </Text>
                <Text style={[styles.receiptValue, { color: theme.colors.onSurface }]}>
                  {receiptData.paymentMethod}
                </Text>
              </View>
            )}

            <Divider style={[styles.divider, styles.dividerTop]} />

            {/* Session ID */}
            <View style={styles.receiptRow}>
              <Text style={[styles.receiptLabel, { color: theme.colors.onSurfaceVariant }]}>
                Transaction ID:
              </Text>
              <Text style={[styles.receiptValueSmall, { color: theme.colors.onSurfaceVariant }]}>
                {receiptData.sessionId}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Updated Profile Info */}
        {profile && (
          <Card style={[styles.infoCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              <Text style={[styles.infoText, { color: theme.colors.onSurface }]}>
                Your subscription has been upgraded to{' '}
                <Text style={[styles.infoTextBold, { color: tierColor }]}>
                  {getTierDisplayName(profile.subscription_tier)}
                </Text>
                . You now have access to all premium features!
              </Text>
            </Card.Content>
          </Card>
        )}

        {/* Continue Button */}
        <Button
          mode="contained"
          onPress={handleContinue}
          style={[styles.button, { backgroundColor: tierColor }]}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
          icon="check-circle"
        >
          Continue
        </Button>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkIcon: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
  },
  receiptCard: {
    marginBottom: 24,
    borderRadius: 16,
    elevation: 4,
  },
  receiptTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  divider: {
    marginVertical: 16,
  },
  dividerTop: {
    marginTop: 8,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  receiptLabel: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  receiptValue: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  receiptValueSmall: {
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tierBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  infoCard: {
    marginBottom: 24,
    borderRadius: 16,
  },
  infoText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  infoTextBold: {
    fontWeight: 'bold',
  },
  button: {
    borderRadius: 12,
    paddingVertical: 4,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default PaymentSuccessScreen;

