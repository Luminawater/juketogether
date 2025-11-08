import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import {
  Dialog,
  Button,
  Text,
  TextInput,
  useTheme,
  ActivityIndicator,
  Chip,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { extractMusicUrlsSmart, isValidMusicUrl } from '../utils/roomUtils';

interface QueueDialogProps {
  visible: boolean;
  onDismiss: () => void;
  onQueue: (urls: string[]) => Promise<void>;
  canQueue: boolean;
}

export const QueueDialog: React.FC<QueueDialogProps> = ({
  visible,
  onDismiss,
  onQueue,
  canQueue,
}) => {
  const theme = useTheme();
  const [inputText, setInputText] = useState('');
  const [extractedUrls, setExtractedUrls] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversionAttempts, setConversionAttempts] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isQueuing, setIsQueuing] = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!visible) {
      setInputText('');
      setExtractedUrls([]);
      setConversionAttempts(0);
      setError(null);
      setIsProcessing(false);
    }
  }, [visible]);

  // Process input text when it changes
  useEffect(() => {
    if (!inputText.trim()) {
      setExtractedUrls([]);
      setError(null);
      setConversionAttempts(0);
      return;
    }

    setIsProcessing(true);
    setError(null);

    // Debounce processing
    const timeoutId = setTimeout(() => {
      try {
        // Try extraction with up to 3 conversion attempts
        const maxAttempts = Math.min(conversionAttempts + 1, 3);
        const urls = extractMusicUrlsSmart(inputText, maxAttempts);
        
        if (urls.length > 0) {
          setExtractedUrls(urls);
          setError(null);
        } else {
          // If no URLs found and we haven't tried all attempts, increment
          if (conversionAttempts < 3) {
            setConversionAttempts(prev => prev + 1);
            setError(`No URLs found. Attempting conversion (${conversionAttempts + 1}/3)...`);
          } else {
            setExtractedUrls([]);
            setError('No valid music URLs found. Please paste YouTube, Spotify, or SoundCloud links.');
          }
        }
      } catch (err) {
        setError('Error processing input. Please try again.');
        setExtractedUrls([]);
      } finally {
        setIsProcessing(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [inputText, conversionAttempts]);

  const handleQueue = async () => {
    if (extractedUrls.length === 0) {
      setError('No valid URLs to queue. Please paste music links.');
      return;
    }

    setIsQueuing(true);
    setError(null);

    try {
      await onQueue(extractedUrls);
      setInputText('');
      setExtractedUrls([]);
      onDismiss();
    } catch (err: any) {
      setError(err.message || 'Failed to queue tracks. Please try again.');
    } finally {
      setIsQueuing(false);
    }
  };

  const getPlatformIcon = (url: string) => {
    const normalized = url.toLowerCase();
    if (normalized.includes('youtube') || normalized.includes('youtu.be')) {
      return 'youtube';
    } else if (normalized.includes('spotify')) {
      return 'spotify';
    } else if (normalized.includes('soundcloud')) {
      return 'soundcloud';
    }
    return 'music-note';
  };

  const getPlatformName = (url: string) => {
    const normalized = url.toLowerCase();
    if (normalized.includes('youtube') || normalized.includes('youtu.be')) {
      return 'YouTube';
    } else if (normalized.includes('spotify')) {
      return 'Spotify';
    } else if (normalized.includes('soundcloud')) {
      return 'SoundCloud';
    }
    return 'Unknown';
  };

  return (
    <Dialog 
      visible={visible} 
      onDismiss={onDismiss} 
      style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
    >
      <Dialog.Title style={{ color: theme.colors.onSurface }}>
        <View style={styles.titleContainer}>
          <MaterialCommunityIcons 
            name="playlist-plus" 
            size={24} 
            color={theme.colors.primary} 
            style={styles.titleIcon}
          />
          <Text style={{ color: theme.colors.onSurface }}>Add to Queue</Text>
        </View>
      </Dialog.Title>
      <Dialog.Content>
        <View style={styles.content}>
          <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
            Paste URLs or text containing YouTube, Spotify, or SoundCloud links. 
            The system will automatically extract and convert them.
          </Text>

          <TextInput
            mode="outlined"
            label="Paste URLs or text here"
            value={inputText}
            onChangeText={setInputText}
            multiline
            numberOfLines={4}
            style={styles.input}
            placeholder="https://youtube.com/watch?v=... or spotify:track:... or soundcloud.com/..."
            placeholderTextColor={theme.colors.onSurfaceVariant}
            disabled={isQueuing}
            right={
              isProcessing ? (
                <TextInput.Icon icon={() => <ActivityIndicator size="small" color={theme.colors.primary} />} />
              ) : extractedUrls.length > 0 ? (
                <TextInput.Icon 
                  icon="check-circle" 
                  iconColor={theme.colors.primary}
                />
              ) : null
            }
          />

          {error && (
            <View style={[styles.errorContainer, { backgroundColor: `${theme.colors.error}15` }]}>
              <MaterialCommunityIcons 
                name="alert-circle" 
                size={18} 
                color={theme.colors.error} 
              />
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {error}
              </Text>
            </View>
          )}

          {extractedUrls.length > 0 && (
            <View style={styles.urlsContainer}>
              <Text style={[styles.urlsTitle, { color: theme.colors.onSurface }]}>
                Found {extractedUrls.length} URL{extractedUrls.length !== 1 ? 's' : ''}:
              </Text>
              <ScrollView 
                style={styles.urlsList} 
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                {extractedUrls.map((url, index) => (
                  <View 
                    key={index} 
                    style={[
                      styles.urlItem, 
                      { backgroundColor: `${theme.colors.primary}10` }
                    ]}
                  >
                    <MaterialCommunityIcons 
                      name={getPlatformIcon(url)} 
                      size={18} 
                      color={theme.colors.primary} 
                      style={styles.urlIcon}
                    />
                    <View style={styles.urlContent}>
                      <Chip 
                        mode="flat" 
                        compact
                        style={[styles.platformChip, { backgroundColor: `${theme.colors.primary}20` }]}
                        textStyle={{ color: theme.colors.primary, fontSize: 11 }}
                      >
                        {getPlatformName(url)}
                      </Chip>
                      <Text 
                        style={[styles.urlText, { color: theme.colors.onSurface }]}
                        numberOfLines={2}
                      >
                        {url}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {!canQueue && (
            <View style={[styles.warningContainer, { backgroundColor: `${theme.colors.error}15` }]}>
              <MaterialCommunityIcons 
                name="alert" 
                size={18} 
                color={theme.colors.error} 
              />
              <Text style={[styles.warningText, { color: theme.colors.error }]}>
                Only room owner and admins can add tracks to the queue.
              </Text>
            </View>
          )}
        </View>
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss} disabled={isQueuing}>
          Cancel
        </Button>
        <Button
          mode="contained"
          onPress={handleQueue}
          disabled={extractedUrls.length === 0 || isQueuing || !canQueue}
          loading={isQueuing}
          icon="playlist-plus"
        >
          Queue {extractedUrls.length > 0 ? `(${extractedUrls.length})` : ''}
        </Button>
      </Dialog.Actions>
    </Dialog>
  );
};

const styles = StyleSheet.create({
  dialog: {
    borderRadius: 16,
    maxHeight: Platform.OS === 'web' ? '80vh' : undefined,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleIcon: {
    marginRight: 8,
  },
  content: {
    paddingVertical: 8,
  },
  description: {
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  input: {
    marginBottom: 16,
    minHeight: 100,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  urlsContainer: {
    marginTop: 8,
  },
  urlsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  urlsList: {
    maxHeight: 200,
  },
  urlItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  urlIcon: {
    marginRight: 4,
  },
  urlContent: {
    flex: 1,
    gap: 6,
  },
  platformChip: {
    alignSelf: 'flex-start',
  },
  urlText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'monospace',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  warningText: {
    fontSize: 13,
    flex: 1,
  },
});

