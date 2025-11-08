import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Cross-platform localStorage helper
 * Uses window.localStorage on web, AsyncStorage on React Native
 */
export const localStorageHelpers = {
  /**
   * Get a value from storage
   */
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          return Promise.resolve(window.localStorage.getItem(key));
        } catch (error) {
          console.error('Error reading from localStorage:', error);
          return Promise.resolve(null);
        }
      }
      return Promise.resolve(null);
    } else {
      try {
        return await AsyncStorage.getItem(key);
      } catch (error) {
        console.error('Error reading from AsyncStorage:', error);
        return null;
      }
    }
  },

  /**
   * Set a value in storage
   */
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(key, value);
          return Promise.resolve();
        } catch (error) {
          console.error('Error writing to localStorage:', error);
          return Promise.resolve();
        }
      }
      return Promise.resolve();
    } else {
      try {
        await AsyncStorage.setItem(key, value);
      } catch (error) {
        console.error('Error writing to AsyncStorage:', error);
      }
    }
  },

  /**
   * Remove a value from storage
   */
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.removeItem(key);
          return Promise.resolve();
        } catch (error) {
          console.error('Error removing from localStorage:', error);
          return Promise.resolve();
        }
      }
      return Promise.resolve();
    } else {
      try {
        await AsyncStorage.removeItem(key);
      } catch (error) {
        console.error('Error removing from AsyncStorage:', error);
      }
    }
  },

  /**
   * Clear all values from storage (use with caution)
   */
  async clear(): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.clear();
          return Promise.resolve();
        } catch (error) {
          console.error('Error clearing localStorage:', error);
          return Promise.resolve();
        }
      }
      return Promise.resolve();
    } else {
      try {
        await AsyncStorage.clear();
      } catch (error) {
        console.error('Error clearing AsyncStorage:', error);
      }
    }
  },
};

