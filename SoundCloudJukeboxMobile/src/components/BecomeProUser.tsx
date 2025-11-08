import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Button, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';

type BecomeProUserNavigationProp = StackNavigationProp<RootStackParamList>;

interface BecomeProUserProps {
  roomId: string;
  hostTier?: string;
}

const MESSAGES = [
  'Go DJ Mode instead? Sign up for PRO membership.',
  'Get unlimited queues with PRO membership',
];

const MESSAGE_ROTATION_INTERVAL = 5000; // 5 seconds

const BecomeProUser: React.FC<BecomeProUserProps> = ({ roomId, hostTier }) => {
  const navigation = useNavigation<BecomeProUserNavigationProp>();
  const theme = useTheme();
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  // Rotate messages
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, MESSAGE_ROTATION_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  // Don't show if host is pro
  if (hostTier === 'pro') {
    return null;
  }

  const handleUpgrade = () => {
    // Navigate to subscription screen
    navigation.navigate('Subscription');
  };

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <Card.Content style={styles.content}>
        <View style={styles.messageContainer}>
          <Text style={[styles.message, { color: theme.colors.onSurface }]}>
            {MESSAGES[currentMessageIndex]}
          </Text>
        </View>
        <Button
          mode="contained"
          onPress={handleUpgrade}
          style={styles.button}
          buttonColor={theme.colors.primary}
        >
          Become Pro
        </Button>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  content: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 12,
    minHeight: 40,
    justifyContent: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  button: {
    marginTop: 4,
  },
});

export default BecomeProUser;

