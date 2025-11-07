import Constants from 'expo-constants';

// Get the API URL from environment variables or use default
const getApiUrl = () => {
  // Check if we're in development mode
  const isDev = __DEV__ || process.env.NODE_ENV === 'development';
  
  // In development, prioritize localhost unless explicitly overridden via env var
  if (isDev) {
    // Check for explicit override via environment variable (e.g., ngrok URL)
    const envOverride = process.env.EXPO_PUBLIC_API_URL;
    if (envOverride) {
      return envOverride;
    }
    // Default to localhost for development (ignore app.json in dev mode)
    return 'http://localhost:8080';
  }
  
  // In production, use your Vercel/deployed URL from app.json or fallback
  return Constants.expoConfig?.extra?.apiUrl || 'https://juketogether.vercel.app';
};

export const API_URL = getApiUrl();
export const SOCKET_URL = getApiUrl();

// Supabase configuration
export const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || 'https://smryjxchwbfpjvpecffg.supabase.co';
export const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtcnlqeGNod2JmcGp2cGVjZmZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MzcxOTAsImV4cCI6MjA3ODExMzE5MH0.M1jQK3TSWMaAspSOkR-x8FkIi_EECgSZjTpb9lks0hQ';

// App configuration
export const APP_NAME = 'JukeTogether';
export const APP_VERSION = '1.0.0';

