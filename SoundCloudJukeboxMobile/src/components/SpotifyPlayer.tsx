import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform, Dimensions } from 'react-native';
import { useTheme, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Track } from '../types';
import { extractSpotifyTrackId } from '../services/spotifyService';

// Conditionally import WebView only for native platforms
let WebView: any = null;
if (Platform.OS !== 'web') {
  try {
    WebView = require('react-native-webview').WebView;
  } catch (e) {
    console.warn('react-native-webview not available');
  }
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_MOBILE = SCREEN_WIDTH < 768;

interface SpotifyPlayerProps {
  track: Track | null;
  isPlaying: boolean;
  position: number; // Position in milliseconds (from Supabase)
  onPositionUpdate?: (position: number) => void;
  onReady?: () => void;
  onError?: (error: string) => void;
  onStateChange?: (state: 'playing' | 'paused' | 'ended' | 'buffering') => void;
}

// Spotify Embed HTML for WebView
const getSpotifyHTML = (trackId: string) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      width: 100%;
      height: 100vh;
      overflow: hidden;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #spotify-player-container {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    iframe {
      width: 100%;
      height: 352px;
      border: none;
      border-radius: 12px;
    }
  </style>
</head>
<body>
  <div id="spotify-player-container">
    <iframe
      src="https://open.spotify.com/embed/track/${trackId}?utm_source=generator"
      width="100%"
      height="352"
      frameBorder="0"
      allowfullscreen=""
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
    ></iframe>
  </div>
  <script>
    // Spotify embed doesn't provide a JavaScript API for control
    // The embed is controlled by user interaction only
    // We can detect when the iframe loads
    window.addEventListener('load', function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'ready',
        data: {}
      }));
    });

    // Listen for messages from React Native
    window.addEventListener('message', function(event) {
      try {
        const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        // Spotify embed doesn't support programmatic control
        // We can only show/hide or reload the iframe
        if (message.type === 'reload') {
          location.reload();
        }
      } catch (e) {
        console.error('Error handling message:', e);
      }
    });
  </script>
</body>
</html>
  `;
};

export const SpotifyPlayer: React.FC<SpotifyPlayerProps> = ({
  track,
  isPlaying,
  position,
  onPositionUpdate,
  onReady,
  onError,
  onStateChange,
}) => {
  const theme = useTheme();
  const webViewRef = useRef<any>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const lastTrackIdRef = useRef<string | null>(null);
  const iframeRef = useRef<any>(null);
  const containerRef = useRef<any>(null);
  const webviewContainerRef = useRef<any>(null);

  const trackId = track ? extractSpotifyTrackId(track.url) : null;

  // Handle messages from WebView (native only)
  const handleMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'ready':
          if (!playerReady) {
            setPlayerReady(true);
            if (onReady) {
              onReady();
            }
          }
          break;
        case 'error':
          if (onError) {
            onError(message.data?.error || 'Unknown error');
          }
          break;
        default:
          console.log('[SpotifyPlayer] Unknown message type:', message.type);
      }
    } catch (e) {
      console.error('[SpotifyPlayer] Error parsing message:', e);
    }
  };

  // Reload player when track changes (native only)
  useEffect(() => {
    if (Platform.OS !== 'web' && trackId && trackId !== lastTrackIdRef.current) {
      lastTrackIdRef.current = trackId;
      setPlayerReady(false);
      
      if (webViewRef.current) {
        // Reload the WebView when track changes (native)
        webViewRef.current.reload();
      }
    }
  }, [trackId]);

  // Spotify embeds don't support programmatic control due to browser security policies
  // Users must manually interact with the embed to start playback
  useEffect(() => {
    if (Platform.OS === 'web' && playerReady && trackId) {
      console.log('[SpotifyPlayer Web] Spotify embed loaded. User must click play manually due to browser autoplay restrictions.');
      // Show a one-time notification to user about manual playback requirement
      if (isPlaying && !playerReady) {
        console.warn('[SpotifyPlayer Web] Spotify embeds require manual user interaction to start playback due to browser security policies.');
      }
    }
  }, [isPlaying, playerReady, Platform.OS, trackId]);

  // Web implementation using iframe via DOM manipulation
  useEffect(() => {
    if (Platform.OS === 'web' && trackId) {
      // Reset ready state and interaction state when track changes
      if (trackId !== lastTrackIdRef.current) {
        lastTrackIdRef.current = trackId;
        setPlayerReady(false);
        setUserInteracted(false);
      }

      // Use a small delay to ensure the container is rendered
      const timer = setTimeout(() => {
        if (!webviewContainerRef.current) return;

        // Get the actual DOM element from React Native Web ref
        const containerElement = webviewContainerRef.current as any;
        const domNode = containerElement?._internalFiberInstanceHandleDEV?.stateNode || 
                       containerElement?.base || 
                       containerElement;

        if (!domNode) return;

        // Clear any existing content
        domNode.innerHTML = '';

        // Create iframe element
        const iframe = document.createElement('iframe');
        iframe.src = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator`;
        iframe.width = '100%';
        iframe.height = '352';
        iframe.frameBorder = '0';
        iframe.allowFullscreen = true;
        iframe.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture');
        iframe.setAttribute('loading', 'lazy');
        iframe.style.width = '100%';
        iframe.style.height = '352px';
        iframe.style.border = 'none';
        iframe.style.borderRadius = '12px';

        // Handle iframe load
        iframe.onload = () => {
          if (!playerReady) {
            setPlayerReady(true);
            if (onReady) {
              onReady();
            }
          }
        };

        // Handle user interaction
        const handleUserInteraction = () => {
          setUserInteracted(true);
        };

        // Add event listeners for user interaction
        iframe.addEventListener('click', handleUserInteraction);
        iframe.addEventListener('touchstart', handleUserInteraction);

        // Handle iframe error
        iframe.onerror = () => {
          if (onError) {
            onError('Failed to load Spotify embed');
          }
        };

        domNode.appendChild(iframe);
        iframeRef.current = iframe;
      }, 100);

      return () => {
        clearTimeout(timer);
        if (iframeRef.current && iframeRef.current.parentNode) {
          iframeRef.current.parentNode.removeChild(iframeRef.current);
        }
      };
    }
  }, [trackId, Platform.OS, playerReady, onReady, onError]);

  // Show error if no track ID
  if (!trackId) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.errorContainer}>
          {onError && onError('Invalid Spotify track URL')}
        </View>
      </View>
    );
  }

  // Web implementation
  if (Platform.OS === 'web') {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.colors.surface }]}
        // @ts-ignore - web-specific ref
        ref={containerRef}
      >
        <View
          style={styles.webview}
          // @ts-ignore - web-specific ref
          ref={webviewContainerRef}
        />
        {/* Overlay to inform users about manual interaction requirement */}
        {playerReady && isPlaying && !userInteracted && (
          <View style={styles.overlay}>
            <View style={[styles.overlayContent, { backgroundColor: theme.colors.surface }]}>
              <MaterialCommunityIcons
                name="play-circle"
                size={48}
                color={theme.colors.primary}
              />
              <Text style={[styles.overlayTitle, { color: theme.colors.onSurface }]}>
                Click to Play
              </Text>
              <Text style={[styles.overlayText, { color: theme.colors.onSurfaceVariant }]}>
                Spotify requires manual interaction to start playback due to browser security policies.
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  // Native implementation using WebView
  if (!WebView) {
    console.warn('[SpotifyPlayer] WebView not available on this platform');
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.errorContainer}>
          {onError && onError('WebView not supported on this platform')}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <WebView
        ref={webViewRef}
        source={{ html: getSpotifyHTML(trackId) }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        bounces={false}
        scrollEnabled={false}
        mixedContentMode="always"
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('[SpotifyPlayer] WebView error:', nativeEvent);
          if (onError) {
            onError(`WebView error: ${nativeEvent.description || 'Unknown error'}`);
          }
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('[SpotifyPlayer] WebView HTTP error:', nativeEvent);
          if (onError) {
            onError(`HTTP error: ${nativeEvent.statusCode || 'Unknown'}`);
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: 352,
    borderRadius: 12,
    overflow: 'hidden',
  },
  webview: {
    width: '100%',
    height: 352,
    backgroundColor: 'transparent',
  },
  errorContainer: {
    width: '100%',
    height: 352,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 10,
  },
  overlayContent: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    maxWidth: 300,
    margin: 20,
  },
  overlayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  overlayText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

