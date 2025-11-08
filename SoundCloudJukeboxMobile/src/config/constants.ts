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

    // If on localhost, use localhost:8082 for socket server
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:60000';
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
    return 'http://localhost:8082';
  }

  // In production, use your Vercel/deployed URL from app.json or fallback
  return Constants.expoConfig?.extra?.apiUrl || 'https://juketogether.com';
};

// Get the WebSocket server URL (can be different from API URL for Vercel deployments)
const getSocketUrl = () => {
  // Check for explicit WebSocket server URL override
  const socketOverride = process.env.EXPO_PUBLIC_SOCKET_URL;
  if (socketOverride) {
    return socketOverride;
  }

  // On web, detect the current hostname
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // If on localhost, use localhost:8082
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:60000';
    }

    // For Vercel deployments, you need a separate WebSocket server
    // Check if we're on a Vercel domain (or your production domain)
    // If so, use the separate WebSocket server URL
    // Otherwise, try to use the same origin (won't work on Vercel serverless)
    const isVercelDomain = hostname.includes('vercel.app') || hostname.includes('juketogether.com');

    if (isVercelDomain) {
      // Use a separate WebSocket server (Railway, Render, Fly.io, etc.)
      // Set EXPO_PUBLIC_SOCKET_URL environment variable in Vercel
      // For now, fallback to the API URL (will fail, but shows the issue)
      return Constants.expoConfig?.extra?.socketUrl || getApiUrl();
    }

    // For other domains, use the same origin
    return window.location.origin;
  }

  // Check if we're in development mode
  const isDev = __DEV__ || process.env.NODE_ENV === 'development';

  // In development, use localhost
  if (isDev) {
    return 'http://localhost:8082';
  }

  // In production, use separate WebSocket server or fallback
  return Constants.expoConfig?.extra?.socketUrl || getApiUrl();
};

export const API_URL = getApiUrl();
export const SOCKET_URL = getSocketUrl();

// Supabase configuration
export const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || 'https://smryjxchwbfpjvpecffg.supabase.co';
export const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtcnlqeGNod2JmcGp2cGVjZmZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MzcxOTAsImV4cCI6MjA3ODExMzE5MH0.M1jQK3TSWMaAspSOkR-x8FkIi_EECgSZjTpb9lks0hQ';

// RapidAPI is now handled server-side via /api/soundcloud-rapidapi endpoint
// The API key is stored in server environment variables (XRAPID_API_KEY)

// App configuration
export const APP_NAME = 'JukeTogether';
export const APP_VERSION = '1.0.0';

