import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Text,
  Title,
  useTheme,
  Avatar,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface AdDialogProps {
  visible: boolean;
  ad: {
    title: string;
    description?: string;
    image_url?: string;
    action_url?: string;
  } | null;
  countdown: number;
  onDismiss: () => void;
  onUpgrade?: () => void;
  onBooster?: () => void;
}

export const AdDialog: React.FC<AdDialogProps> = ({
  visible,
  ad,
  countdown,
  onDismiss,
  onUpgrade,
  onBooster,
}) => {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const [timeRemaining, setTimeRemaining] = useState(countdown);

  useEffect(() => {
    if (visible && countdown > 0) {
      setTimeRemaining(countdown);
      const interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [visible, countdown]);

  useEffect(() => {
    if (timeRemaining === 0 && visible) {
      // Auto-dismiss when countdown reaches 0
      setTimeout(() => {
        onDismiss();
      }, 500);
    }
  }, [timeRemaining, visible, onDismiss]);

  if (!ad) return null;

  const handleUpgrade = () => {
    onDismiss();
    if (onUpgrade) {
      onUpgrade();
    } else {
      navigation.navigate('Subscription');
    }
  };

  const handleBooster = () => {
    onDismiss();
    if (onBooster) {
      onBooster();
    }
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={timeRemaining === 0 ? onDismiss : undefined}
        dismissable={timeRemaining === 0}
        style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title style={[styles.title, { color: theme.colors.onSurface }]}>
          {ad.title}
        </Dialog.Title>
        
        <Dialog.Content style={styles.content}>
        {ad.image_url && (
          <View style={styles.imageContainer}>
            <Avatar.Image
              size={120}
              source={{ uri: ad.image_url }}
              style={styles.image}
            />
          </View>
        )}
        
        {ad.description && (
          <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
            {ad.description}
          </Text>
        )}

        <View style={[styles.countdownContainer, { backgroundColor: `${theme.colors.primary}20` }]}>
          <Text style={[styles.countdownText, { color: theme.colors.primary }]}>
            {timeRemaining > 0 ? `${timeRemaining}s` : '0s'}
          </Text>
          <Text style={[styles.countdownLabel, { color: theme.colors.onSurfaceVariant }]}>
            {timeRemaining > 0 ? 'Please wait...' : 'You can continue'}
          </Text>
        </View>
      </Dialog.Content>

      <Dialog.Actions style={styles.actions}>
        {timeRemaining === 0 && (
          <>
            <Button
              mode="outlined"
              onPress={handleBooster}
              icon="rocket-launch"
              style={styles.actionButton}
            >
              Buy Booster
            </Button>
            <Button
              mode="contained"
              onPress={handleUpgrade}
              icon="arrow-up-circle"
              buttonColor={theme.colors.primary}
              style={styles.actionButton}
            >
              Upgrade
            </Button>
          </>
        )}
        {timeRemaining > 0 && (
          <Button
            mode="text"
            disabled
            style={styles.actionButton}
          >
            Wait {timeRemaining}s
          </Button>
        )}
      </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    borderRadius: 16,
    maxWidth: 400,
    width: '90%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  image: {
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  countdownContainer: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  countdownText: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  countdownLabel: {
    fontSize: 12,
  },
  actions: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    justifyContent: 'space-around',
  },
  actionButton: {
    marginHorizontal: 4,
  },
});

