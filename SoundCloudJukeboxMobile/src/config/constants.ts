import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get the API URL from environment variables or use default
const getApiUrl = () => {
  // Check for explicit override via environment variable
  const envOverride = process.env.EXPO_PUBLIC_API_URL;
  if (envOverride) {
    return envOverride;
  }
  
  // On web, detect the current hostname and use it
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // If on localhost, use localhost:8080 for socket server
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8080';
    }
    
    // Otherwise, use the current origin (production domain)
    // This includes protocol, hostname, and port if present
    // Socket.io will automatically handle websocket upgrade
    return window.location.origin;
  }
  
  // Check if we're in development mode
  const isDev = __DEV__ || process.env.NODE_ENV === 'development';
  
  // In development, use localhost
  if (isDev) {
    return 'http://localhost:8080';
  }
  
  // In production, use your Vercel/deployed URL from app.json or fallback
  return Constants.expoConfig?.extra?.apiUrl || 'https://juketogether.com';
};

export const API_URL = getApiUrl();
export const SOCKET_URL = getApiUrl();

// Supabase configuration
export const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || 'https://smryjxchwbfpjvpecffg.supabase.co';
export const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtcnlqeGNod2JmcGp2cGVjZmZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MzcxOTAsImV4cCI6MjA3ODExMzE5MH0.M1jQK3TSWMaAspSOkR-x8FkIi_EECgSZjTpb9lks0hQ';

// App configuration
export const APP_NAME = 'JukeTogether';
export const APP_VERSION = '1.0.0';

