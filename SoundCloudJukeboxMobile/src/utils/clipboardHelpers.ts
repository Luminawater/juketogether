import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

/**
 * Cross-platform clipboard helper
 * Uses expo-clipboard on mobile, navigator.clipboard on web
 */
export const clipboardHelpers = {
  /**
   * Copy text to clipboard
   */
  async copy(text: string): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(text);
          return true;
        }
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        return success;
      } else {
        await Clipboard.setStringAsync(text);
        return true;
      }
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      return false;
    }
  },

  /**
   * Get text from clipboard
   */
  async get(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          return await navigator.clipboard.readText();
        }
        return null;
      } else {
        return await Clipboard.getStringAsync();
      }
    } catch (error) {
      console.error('Error reading from clipboard:', error);
      return null;
    }
  },
};

