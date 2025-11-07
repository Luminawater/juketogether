import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/constants';
import { UserProfile, UserPermissions } from '../types';

// localStorage helper functions for web
const localStorageHelpers = {
  get: (key: string): string | null => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.error('[localStorage] Error getting item:', error);
      return null;
    }
  },
  set: (key: string, value: string): void => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.error('[localStorage] Error setting item:', error);
    }
  },
  remove: (key: string): void => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error('[localStorage] Error removing item:', error);
    }
  },
};

// Web-compatible storage adapter for Supabase
const getStorage = () => {
  if (Platform.OS === 'web') {
    // Use localStorage for web with proper error handling
    return {
      getItem: (key: string) => {
        const value = localStorageHelpers.get(key);
        return Promise.resolve(value);
      },
      setItem: (key: string, value: string) => {
        localStorageHelpers.set(key, value);
        return Promise.resolve();
      },
      removeItem: (key: string) => {
        localStorageHelpers.remove(key);
        return Promise.resolve();
      },
    };
  }
  // Use AsyncStorage for mobile
  return AsyncStorage;
};

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: getStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  permissions: UserPermissions | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error?: any }>;
  signIn: (email: string, password: string) => Promise<{ error?: any }>;
  signInWithProvider: (provider: 'spotify' | 'google' | 'github') => Promise<{ error?: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  supabase: SupabaseClient;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch user profile and permissions
  const fetchUserProfile = async (userId: string, useCache = true) => {
    try {
      // Try to load from localStorage cache first (web only) for instant display
      if (Platform.OS === 'web' && useCache) {
        const cachedProfile = localStorageHelpers.get(`auth_profile_${userId}`);
        const cachedPermissions = localStorageHelpers.get(`auth_permissions_${userId}`);
        
        if (cachedProfile) {
          try {
            const profile = JSON.parse(cachedProfile);
            setProfile(profile);
          } catch (e) {
            // Invalid cache, continue to fetch
          }
        }
        
        if (cachedPermissions) {
          try {
            const permissions = JSON.parse(cachedPermissions);
            setPermissions(permissions);
          } catch (e) {
            // Invalid cache, continue to fetch
          }
        }
      }

      // Always fetch fresh data from database (cache is just for instant display)
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError || !profileData) {
        // Create default profile if it doesn't exist
        const { data: newProfile, error: createError } = await supabase
          .from('user_profiles')
          .insert({
            id: userId,
            username: `user_${userId.substring(0, 8)}`,
            role: 'user',
            subscription_tier: 'free',
          })
          .select()
          .single();

        if (newProfile) {
          const profile = newProfile as UserProfile;
          setProfile(profile);
          // Cache profile in localStorage
          if (Platform.OS === 'web') {
            localStorageHelpers.set(`auth_profile_${userId}`, JSON.stringify(profile));
          }
        }
        return;
      }

      const profile = profileData as UserProfile;
      setProfile(profile);
      
      // Cache profile in localStorage
      if (Platform.OS === 'web') {
        localStorageHelpers.set(`auth_profile_${userId}`, JSON.stringify(profile));
      }

      // Fetch permissions using the database function
      const { data: permissionsData, error: permissionsError } = await supabase
        .rpc('get_user_permissions', { user_uuid: userId });

      if (!permissionsError && permissionsData && permissionsData.length > 0) {
        const perm = permissionsData[0];
        const permissions = {
          role: perm.role,
          tier: perm.tier,
          songs_played: perm.songs_played,
          max_songs: perm.max_songs,
        };
        setPermissions(permissions);
        
        // Cache permissions in localStorage
        if (Platform.OS === 'web') {
          localStorageHelpers.set(`auth_permissions_${userId}`, JSON.stringify(permissions));
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      // Force refresh from database, don't use cache
      await fetchUserProfile(user.id, false);
    }
  };

  useEffect(() => {
    // Handle OAuth callback on web
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Check for OAuth callback in URL hash (Supabase uses hash for tokens)
      const hash = window.location.hash;
      const hasAuthParams = hash.includes('access_token') || hash.includes('error');
      
      if (hasAuthParams) {
        // Clean up URL after processing
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
      
      // Handle OAuth errors in query params
      const urlParams = new URLSearchParams(window.location.search);
      const error = urlParams.get('error');
      const errorDescription = urlParams.get('error_description');
      
      if (error) {
        console.error('[AuthCallback] OAuth error:', error, errorDescription);
        
        // Clean up URL
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        
        // Show user-friendly error message
        if (error === 'access_denied' && errorDescription?.includes('Unverified email')) {
          // Spotify email verification error
          alert('Please verify your email with Spotify. A confirmation email has been sent to your Spotify email address.');
        } else if (errorDescription) {
          alert(`Authentication error: ${decodeURIComponent(errorDescription)}`);
        } else {
          alert(`Authentication error: ${error}`);
        }
      }
    }

    // Get initial session with error handling and timeout
    let loadingResolved = false;
    
    const resolveLoading = () => {
      if (!loadingResolved) {
        loadingResolved = true;
        setLoading(false);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
    };

    // Safety timeout to ensure loading always resolves (2 seconds)
    timeoutRef.current = setTimeout(() => {
      // Silently resolve loading as fallback
      resolveLoading();
    }, 2000);

    // Get session with immediate timeout protection
    const sessionTimeout = setTimeout(() => {
      // Silently resolve loading if session check takes too long (common in web)
      resolveLoading();
    }, 1500);

    // Try to get session, but don't wait forever
    // This will automatically check localStorage for persisted session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        clearTimeout(sessionTimeout);
        
        if (error) {
          console.error('[AuthContext] Error getting session:', error);
          // If there's an error, try to clear potentially corrupted session data
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            // Check if there's a session in localStorage that might be corrupted
            const sessionKey = Object.keys(window.localStorage).find(key => 
              key.includes('supabase.auth.token')
            );
            if (sessionKey) {
              console.warn('[AuthContext] Found potentially corrupted session, clearing...');
              window.localStorage.removeItem(sessionKey);
            }
          }
        } else {
          if (session) {
            console.log('[AuthContext] Session restored from localStorage');
          } else {
            console.log('[AuthContext] No session found in localStorage');
          }
          setSession(session);
          setUser(session?.user ?? null);
          
          // Fetch profile in background, don't block loading
          // Use cache for initial load to speed up app startup
          if (session?.user?.id) {
            fetchUserProfile(session.user.id, true).catch((err) => {
              console.error('[AuthContext] Error fetching profile:', err);
            });
          }
        }
        
        resolveLoading();
      })
      .catch((error) => {
        clearTimeout(sessionTimeout);
        console.error('[AuthContext] Failed to get session:', error);
        resolveLoading();
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          console.log('[AuthContext] Auth state changed:', event, session ? 'has session' : 'no session');
          
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user?.id) {
            // Session exists - ensure it's persisted in localStorage
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              // Supabase should handle this automatically, but we can verify
              const sessionKey = Object.keys(window.localStorage).find(key => 
                key.includes('supabase.auth.token')
              );
              if (!sessionKey && event === 'SIGNED_IN') {
                console.warn('[AuthContext] Session not found in localStorage after sign in');
              }
            }
            
            // Clear cache on sign out, use cache on sign in
            const useCache = event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED';
            await fetchUserProfile(session.user.id, useCache);
          } else {
            // Clear profile and permissions
            setProfile(null);
            setPermissions(null);
            
            // Clear localStorage cache on sign out
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              // Clear all auth-related cache
              Object.keys(window.localStorage).forEach(key => {
                if (key.startsWith('auth_profile_') || key.startsWith('auth_permissions_')) {
                  window.localStorage.removeItem(key);
                }
              });
            }
          }
        } catch (error) {
          console.error('[AuthContext] Error in auth state change:', error);
        } finally {
          setLoading(false);
        }
      }
    );

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signInWithProvider = async (provider: 'spotify' | 'google' | 'github') => {
    const redirectUrl = Platform.OS === 'web' && typeof window !== 'undefined'
      ? `${window.location.origin}/auth`
      : undefined;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
      },
    });
    return { error };
  };

  const signOut = async () => {
    // Clear localStorage cache before signing out
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Clear all auth-related cache
      Object.keys(window.localStorage).forEach(key => {
        if (key.startsWith('auth_profile_') || key.startsWith('auth_permissions_')) {
          window.localStorage.removeItem(key);
        }
      });
    }
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    profile,
    permissions,
    loading,
    signUp,
    signIn,
    signInWithProvider,
    signOut,
    refreshProfile,
    supabase,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
