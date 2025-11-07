import Constants from 'expo-constants';

// Get the API URL from environment variables or use default
const getApiUrl = () => {
  // In development, use localhost or ngrok URL
  if (__DEV__) {
    // You can set this via .env or Expo Constants
    return Constants.expoConfig?.extra?.apiUrl || 'http://localhost:8080';
  }
  
  // In production, use your Vercel/deployed URL
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

