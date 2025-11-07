import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/constants';
import { UserProfile, UserPermissions } from '../types';

// Web-compatible storage adapter
const getStorage = () => {
  if (Platform.OS === 'web') {
    // Use localStorage for web
    return {
      getItem: (key: string) => {
        if (typeof window !== 'undefined') {
          return Promise.resolve(window.localStorage.getItem(key));
        }
        return Promise.resolve(null);
      },
      setItem: (key: string, value: string) => {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, value);
        }
        return Promise.resolve();
      },
      removeItem: (key: string) => {
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(key);
        }
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
  const fetchUserProfile = async (userId: string) => {
    try {
      // Fetch profile
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
          setProfile(newProfile as UserProfile);
        }
        return;
      }

      setProfile(profileData as UserProfile);

      // Fetch permissions using the database function
      const { data: permissionsData, error: permissionsError } = await supabase
        .rpc('get_user_permissions', { user_uuid: userId });

      if (!permissionsError && permissionsData && permissionsData.length > 0) {
        const perm = permissionsData[0];
        setPermissions({
          role: perm.role,
          tier: perm.tier,
          songs_played: perm.songs_played,
          max_songs: perm.max_songs,
        });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchUserProfile(user.id);
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
    const sessionPromise = supabase.auth.getSession()
      .then(async ({ data: { session }, error }) => {
        if (error) {
          console.error('[AuthContext] Error getting session:', error);
        }
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user?.id) {
          await fetchUserProfile(session.user.id);
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error('[AuthContext] Failed to get session:', error);
        setLoading(false);
      });

    // Safety timeout to ensure loading always resolves (5 seconds)
    timeoutRef.current = setTimeout(() => {
      console.warn('[AuthContext] Session check timeout, setting loading to false');
      setLoading(false);
    }, 5000);

    // Clear timeout when session promise resolves
    sessionPromise.finally(() => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user?.id) {
            await fetchUserProfile(session.user.id);
          } else {
            setProfile(null);
            setPermissions(null);
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
