import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform, Dimensions } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Track } from '../types';

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

interface YouTubePlayerProps {
  track: Track | null;
  isPlaying: boolean;
  position: number; // Position in milliseconds (from Supabase)
  onPositionUpdate?: (position: number) => void;
  onReady?: () => void;
  onError?: (error: string) => void;
  onStateChange?: (state: 'playing' | 'paused' | 'ended' | 'buffering') => void;
}

// Extract YouTube video ID from URL
function extractVideoId(url: string): string | null {
  if (!url) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  track,
  isPlaying,
  position,
  onPositionUpdate,
  onReady,
  onError,
  onStateChange,
}) => {
  const theme = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const lastPositionRef = useRef<number>(0);
  const positionUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSupabasePositionRef = useRef<number>(0);

  const videoId = track ? extractVideoId(track.url) : null;

  // YouTube IFrame API HTML with responsive design
  const getYouTubeHTML = (videoId: string) => {
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
    }
    #player-container {
      position: relative;
      width: 100%;
      height: 100%;
      padding-top: 56.25%; /* 16:9 Aspect Ratio */
    }
    #youtube-player {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="player-container">
    <div id="youtube-player"></div>
  </div>
  <script src="https://www.youtube.com/iframe_api"></script>
  <script>
    let player;
    let lastReportedPosition = 0;
    let positionUpdateInterval = null;
    let isSyncing = false;

    // YouTube IFrame API ready callback
    window.onYouTubeIframeAPIReady = function() {
      player = new YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: '${videoId}',
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          playsinline: 1, // Important for mobile
          iv_load_policy: 3, // Hide annotations
        },
        events: {
          onReady: function(event) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'ready',
              data: {}
            }));
          },
          onStateChange: function(event) {
            // YouTube player states: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
            let state = 'paused';
            if (event.data === YT.PlayerState.PLAYING) {
              state = 'playing';
            } else if (event.data === YT.PlayerState.PAUSED) {
              state = 'paused';
            } else if (event.data === YT.PlayerState.ENDED) {
              state = 'ended';
            } else if (event.data === YT.PlayerState.BUFFERING) {
              state = 'buffering';
            }
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'stateChange',
              data: { state: state }
            }));
          },
          onError: function(event) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'error',
              data: { error: 'YouTube player error: ' + event.data }
            }));
          }
        }
      });

      // Start position update interval
      positionUpdateInterval = setInterval(function() {
        if (player && player.getCurrentTime) {
          try {
            const currentTime = player.getCurrentTime();
            const positionMs = Math.floor(currentTime * 1000);
            
            // Only report if position changed significantly (> 500ms) to reduce message frequency
            if (Math.abs(positionMs - lastReportedPosition) > 500) {
              lastReportedPosition = positionMs;
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'positionUpdate',
                data: { position: positionMs }
              }));
            }
          } catch (e) {
            // Player might not be ready yet
          }
        }
      }, 1000); // Update every second
    };

    // Handle messages from React Native
    window.addEventListener('message', function(event) {
      try {
        const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        
        if (!player || !player.getCurrentTime) {
          return;
        }

        switch (message.type) {
          case 'play':
            if (!isSyncing) {
              player.playVideo();
            }
            break;
          case 'pause':
            if (!isSyncing) {
              player.pauseVideo();
            }
            break;
          case 'seek':
            isSyncing = true;
            const seekPosition = message.data.position || 0;
            const seekSeconds = Math.floor(seekPosition / 1000);
            player.seekTo(seekSeconds, true);
            // Reset syncing flag after seek completes
            setTimeout(function() {
              isSyncing = false;
            }, 1000);
            break;
          case 'loadVideo':
            if (message.data.videoId) {
              player.loadVideoById(message.data.videoId);
            }
            break;
        }
      } catch (e) {
        console.error('Error handling message:', e);
      }
    });

    // Cleanup on unload
    window.addEventListener('beforeunload', function() {
      if (positionUpdateInterval) {
        clearInterval(positionUpdateInterval);
      }
    });
  </script>
</body>
</html>
    `;
  };

  // Handle messages from WebView
  const handleMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      console.log('[YouTubePlayer] Received message from WebView', { 
        type: message.type, 
        data: message.data,
        track: track?.url 
      });
      
      switch (message.type) {
        case 'ready':
          console.log('[YouTubePlayer] Player ready');
          setPlayerReady(true);
          if (onReady) onReady();
          // Sync to Supabase position when ready
          if (position > 0 && !isSyncing) {
            console.log('[YouTubePlayer] Syncing to position on ready', { position });
            syncToPosition(position);
          }
          break;
        
        case 'stateChange':
          console.log('[YouTubePlayer] State changed', { state: message.data?.state });
          if (onStateChange && message.data?.state) {
            onStateChange(message.data.state);
          }
          break;
        
        case 'positionUpdate':
          if (onPositionUpdate && message.data?.position !== undefined) {
            const newPosition = message.data.position;
            lastPositionRef.current = newPosition;
            // Only update if not currently syncing (to avoid feedback loop)
            if (!isSyncing) {
              onPositionUpdate(newPosition);
            }
          }
          break;
        
        case 'error':
          console.error('[YouTubePlayer] Player error', { error: message.data?.error });
          if (onError && message.data?.error) {
            onError(message.data.error);
          }
          break;
      }
    } catch (error) {
      console.error('[YouTubePlayer] Error parsing WebView message:', error);
    }
  };

  // Sync player to Supabase position
  const syncToPosition = (targetPosition: number) => {
    if (!playerReady || !webViewRef.current || isSyncing) return;
    
    // Only sync if position difference is significant (> 2 seconds) to prevent constant seeking
    const currentPosition = lastPositionRef.current;
    const diff = Math.abs(targetPosition - currentPosition);
    
    if (diff > 2000) {
      setIsSyncing(true);
      const message = JSON.stringify({
        type: 'seek',
        data: { position: targetPosition }
      });
      webViewRef.current.postMessage(message);
      
      // Reset syncing flag after seek
      setTimeout(() => {
        setIsSyncing(false);
      }, 1500);
    }
  };

  // Handle play/pause from Supabase state
  useEffect(() => {
    console.log('[YouTubePlayer] Play/pause effect triggered', { 
      isPlaying, 
      playerReady, 
      hasWebView: !!webViewRef.current, 
      isSyncing,
      track: track?.url 
    });
    
    if (!playerReady || !webViewRef.current || isSyncing) {
      console.log('[YouTubePlayer] Skipping play/pause - not ready', { 
        playerReady, 
        hasWebView: !!webViewRef.current, 
        isSyncing 
      });
      return;
    }

    const message = JSON.stringify({
      type: isPlaying ? 'play' : 'pause',
      data: {}
    });
    console.log('[YouTubePlayer] Sending message to player', { type: isPlaying ? 'play' : 'pause', message });
    webViewRef.current.postMessage(message);
  }, [isPlaying, playerReady]);

  // Handle position sync from Supabase (source of truth)
  useEffect(() => {
    if (!playerReady || isSyncing) return;
    
    // Only sync if Supabase position changed significantly
    const diff = Math.abs(position - lastSupabasePositionRef.current);
    if (diff > 2000) {
      lastSupabasePositionRef.current = position;
      syncToPosition(position);
    }
  }, [position, playerReady]);

  // Load new video when track changes
  useEffect(() => {
    if (!videoId || !webViewRef.current) return;
    
    setPlayerReady(false);
    const message = JSON.stringify({
      type: 'loadVideo',
      data: { videoId }
    });
    webViewRef.current.postMessage(message);
  }, [videoId]);

  // Web implementation using iframe
  if (Platform.OS === 'web') {
    const [ytPlayer, setYtPlayer] = useState<any>(null);
    const containerRef = useRef<any>(null);

    // Load YouTube IFrame API for web
    useEffect(() => {
      if (!videoId) return;

      // Load YouTube IFrame API script if not already loaded
      if (!(window as any).YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }

      // Initialize player when API is ready
      const onYouTubeIframeAPIReady = () => {
        if (!containerRef.current) return;

        // Get the actual DOM element from React Native Web View ref
        const containerElement = containerRef.current as any;
        const domNode = containerElement?._internalFiberInstanceHandleDEV?.stateNode || 
                       containerElement?.base || 
                       containerElement;

        if (!domNode) return;

        const playerId = `youtube-player-${videoId}`;
        let playerDiv = document.getElementById(playerId);
        if (!playerDiv) {
          playerDiv = document.createElement('div');
          playerDiv.id = playerId;
          playerDiv.style.width = '100%';
          playerDiv.style.height = '100%';
          domNode.appendChild(playerDiv);
        }

        const player = new (window as any).YT.Player(playerId, {
          height: '100%',
          width: '100%',
          videoId: videoId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            enablejsapi: 1,
            origin: window.location.origin,
            playsinline: 1,
            iv_load_policy: 3,
          },
          events: {
            onReady: () => {
              setPlayerReady(true);
              if (onReady) onReady();
              setYtPlayer(player);
            },
            onStateChange: (event: any) => {
              let state: 'playing' | 'paused' | 'ended' | 'buffering' = 'paused';
              if (event.data === (window as any).YT.PlayerState.PLAYING) {
                state = 'playing';
              } else if (event.data === (window as any).YT.PlayerState.PAUSED) {
                state = 'paused';
              } else if (event.data === (window as any).YT.PlayerState.ENDED) {
                state = 'ended';
              } else if (event.data === (window as any).YT.PlayerState.BUFFERING) {
                state = 'buffering';
              }
              if (onStateChange) onStateChange(state);
            },
            onError: (event: any) => {
              if (onError) {
                onError(`YouTube player error: ${event.data}`);
              }
            },
          },
        });
      };

      if ((window as any).YT && (window as any).YT.Player) {
        onYouTubeIframeAPIReady();
      } else {
        (window as any).onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
      }

      return () => {
        if (ytPlayer && ytPlayer.destroy) {
          ytPlayer.destroy();
        }
      };
    }, [videoId]);

    // Handle play/pause
    useEffect(() => {
      console.log('[YouTubePlayer Web] Play/pause effect triggered', { 
        isPlaying, 
        hasPlayer: !!ytPlayer, 
        playerReady,
        track: track?.url 
      });
      
      if (!ytPlayer || !playerReady) {
        console.log('[YouTubePlayer Web] Skipping play/pause - not ready', { 
          hasPlayer: !!ytPlayer, 
          playerReady 
        });
        return;
      }
      
      try {
        if (isPlaying) {
          console.log('[YouTubePlayer Web] Calling playVideo()');
          ytPlayer.playVideo();
        } else {
          console.log('[YouTubePlayer Web] Calling pauseVideo()');
          ytPlayer.pauseVideo();
        }
      } catch (error) {
        console.error('[YouTubePlayer Web] Error in play/pause:', error);
      }
    }, [isPlaying, ytPlayer, playerReady]);

    // Handle position sync
    useEffect(() => {
      if (!ytPlayer || !playerReady || isSyncing) return;
      const diff = Math.abs(position - lastSupabasePositionRef.current);
      if (diff > 2000) {
        lastSupabasePositionRef.current = position;
        setIsSyncing(true);
        ytPlayer.seekTo(position / 1000, true);
        setTimeout(() => setIsSyncing(false), 1500);
      }
    }, [position, ytPlayer, playerReady]);

    // Position update interval
    useEffect(() => {
      if (!ytPlayer || !playerReady) return;
      const interval = setInterval(() => {
        try {
          const currentTime = ytPlayer.getCurrentTime();
          const positionMs = Math.floor(currentTime * 1000);
          if (onPositionUpdate && Math.abs(positionMs - lastPositionRef.current) > 500) {
            lastPositionRef.current = positionMs;
            onPositionUpdate(positionMs);
          }
        } catch (e) {
          // Player might not be ready
        }
      }, 1000);
      return () => clearInterval(interval);
    }, [ytPlayer, playerReady, onPositionUpdate]);

    if (!videoId) return null;

    return (
      <View 
        style={[styles.container, { backgroundColor: theme.colors.surface }]}
        // @ts-ignore - web-specific ref
        ref={containerRef}
      >
        <View style={styles.webview} />
      </View>
    );
  }

  // Native implementation using WebView
  if (!WebView) {
    console.warn('WebView not available on this platform');
    return null;
  }

  if (!videoId) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <WebView
        ref={webViewRef}
        source={{ html: getYouTubeHTML(videoId) }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={true}
        // Important for mobile performance
        startInLoadingState={true}
        scalesPageToFit={true}
        // iOS specific
        bounces={false}
        scrollEnabled={false}
        // Android specific
        mixedContentMode="always"
        // Error handling
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error:', nativeEvent);
          if (onError) {
            onError(`WebView error: ${nativeEvent.description || 'Unknown error'}`);
          }
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView HTTP error:', nativeEvent);
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
    aspectRatio: 16 / 9, // Maintain 16:9 aspect ratio
    borderRadius: 12,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.3)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    }),
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' ? {
      width: '100%',
      height: '100%',
      border: 'none',
    } : {}),
  },
});

