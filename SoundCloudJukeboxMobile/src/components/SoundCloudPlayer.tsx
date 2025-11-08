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

interface SoundCloudPlayerProps {
  track: Track | null;
  isPlaying: boolean;
  position: number; // Position in milliseconds (from Supabase)
  onPositionUpdate?: (position: number) => void;
  onDurationUpdate?: (duration: number) => void; // Duration in milliseconds
  onReady?: () => void;
  onError?: (error: string) => void;
  onStateChange?: (state: 'playing' | 'paused' | 'ended' | 'buffering') => void;
}

// Convert SoundCloud URL to embed format
function convertToEmbedUrl(url: string): string {
  if (!url) return '';
  
  // Remove query parameters and fragments
  const cleanUrl = url.split('?')[0].split('#')[0];
  
  // If already in embed format, return as is
  if (cleanUrl.includes('w.soundcloud.com/player')) {
    return cleanUrl;
  }
  
  // Convert regular SoundCloud URL to embed format
  return cleanUrl;
}

export const SoundCloudPlayer: React.FC<SoundCloudPlayerProps> = ({
  track,
  isPlaying,
  position,
  onPositionUpdate,
  onDurationUpdate,
  onReady,
  onError,
  onStateChange,
}) => {
  const theme = useTheme();
  const webViewRef = useRef<any>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const lastPositionRef = useRef(0);
  const lastSupabasePositionRef = useRef(0);
  const containerRef = useRef<any>(null);
  
  // Web-specific state (hooks must be called unconditionally)
  const [scWidget, setScWidget] = useState<any>(null);
  const positionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoadedTrackUrlRef = useRef<string>(''); // Track last loaded track URL to avoid reloading

  const trackUrl = track?.url || '';
  const embedUrl = trackUrl ? convertToEmbedUrl(trackUrl) : '';

  const getSoundCloudHTML = (url: string) => {
    const embedUrl = convertToEmbedUrl(url);
    const widgetUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(embedUrl)}&color=%23667eea&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=false&visual=true&buying=false&sharing=false&download=false&show_artwork=true&single_active=false`;
    
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
    }
    #soundcloud-widget {
      width: 100%;
      height: 100%;
    }
    #soundcloud-widget iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
  </style>
</head>
<body>
  <div id="player-container">
    <div id="soundcloud-widget"></div>
  </div>
  <script src="https://w.soundcloud.com/player/api.js"></script>
  <script>
    let widget = null;
    let lastReportedPosition = 0;
    let positionUpdateInterval = null;
    let isSyncing = false;

    // Initialize SoundCloud widget
    function initializeWidget() {
      const widgetContainer = document.getElementById('soundcloud-widget');
      if (!widgetContainer) return;

      // Create iframe
      const iframe = document.createElement('iframe');
      iframe.width = '100%';
      iframe.height = '400';
      iframe.scrolling = 'no';
      iframe.frameBorder = 'no';
      iframe.allow = 'autoplay; encrypted-media';
      iframe.setAttribute('allowfullscreen', '');
      iframe.src = '${widgetUrl}';
      
      widgetContainer.appendChild(iframe);

      // Wait for iframe to load
      iframe.onload = function() {
        try {
          widget = SC.Widget(iframe);
          
          widget.bind(SC.Widget.Events.READY, function() {
            console.log('SoundCloud widget ready');
            
            // Get duration when ready
            try {
              widget.getDuration(function(duration) {
                const durationMs = duration;
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'durationUpdate',
                  data: { duration: durationMs }
                }));
              });
            } catch (e) {
              console.error('Error getting duration:', e);
            }
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'ready',
              data: {}
            }));
            
            // Start position update interval
            positionUpdateInterval = setInterval(function() {
              if (widget && !isSyncing) {
                try {
                  widget.getPosition(function(currentPos) {
                    const positionMs = currentPos;
                    if (Math.abs(positionMs - lastReportedPosition) > 500) {
                      lastReportedPosition = positionMs;
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'positionUpdate',
                        data: { position: positionMs }
                      }));
                    }
                  });
                } catch (e) {
                  // Widget might not be ready
                }
              }
            }, 1000);
          });

          widget.bind(SC.Widget.Events.PLAY, function() {
            console.log('SoundCloud widget playing');
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'stateChange',
              data: { state: 'playing' }
            }));
          });

          widget.bind(SC.Widget.Events.PAUSE, function() {
            console.log('SoundCloud widget paused');
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'stateChange',
              data: { state: 'paused' }
            }));
          });

          widget.bind(SC.Widget.Events.FINISH, function() {
            console.log('SoundCloud widget finished');
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'stateChange',
              data: { state: 'ended' }
            }));
          });

          widget.bind(SC.Widget.Events.ERROR, function(error) {
            console.error('SoundCloud widget error:', error);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'error',
              data: { error: 'SoundCloud player error: ' + (error || 'Unknown error') }
            }));
          });
        } catch (error) {
          console.error('Error initializing SoundCloud widget:', error);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'error',
            data: { error: 'Failed to initialize SoundCloud widget: ' + error.message }
          }));
        }
      };
    }

    // Handle messages from React Native
    window.addEventListener('message', function(event) {
      try {
        const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        
        if (!widget) {
          return;
        }

        switch (message.type) {
          case 'play':
            if (!isSyncing) {
              console.log('SoundCloud: play command');
              widget.play();
            }
            break;
          case 'pause':
            if (!isSyncing) {
              console.log('SoundCloud: pause command');
              widget.pause();
            }
            break;
          case 'seek':
            isSyncing = true;
            const seekPosition = message.data.position || 0;
            console.log('SoundCloud: seek to', seekPosition);
            widget.seekTo(seekPosition);
            setTimeout(function() {
              isSyncing = false;
            }, 1000);
            break;
          case 'loadTrack':
            if (message.data.url) {
              console.log('SoundCloud: load track', message.data.url);
              const newEmbedUrl = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(message.data.url) + '&color=%23667eea&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=false&visual=true&buying=false&sharing=false&download=false&show_artwork=true&single_active=false';
              widget.load(newEmbedUrl, {
                auto_play: false
              });
            }
            break;
        }
      } catch (e) {
        console.error('Error handling message:', e);
      }
    });

    // Initialize when SoundCloud API is ready
    if (typeof SC !== 'undefined' && SC.Widget) {
      initializeWidget();
    } else {
      // Wait for API to load
      window.addEventListener('load', function() {
        if (typeof SC !== 'undefined' && SC.Widget) {
          initializeWidget();
        }
      });
    }

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
      console.log('[SoundCloudPlayer] Received message from WebView', { 
        type: message.type, 
        data: message.data,
        track: track?.url 
      });
      
      switch (message.type) {
        case 'ready':
          console.log('[SoundCloudPlayer] Player ready');
          setPlayerReady(true);
          if (onReady) onReady();
          // Sync to Supabase position when ready
          if (position > 0 && !isSyncing) {
            console.log('[SoundCloudPlayer] Syncing to position on ready', { position });
            syncToPosition(position);
          }
          break;
        
        case 'stateChange':
          console.log('[SoundCloudPlayer] State changed', { state: message.data?.state });
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
        
        case 'durationUpdate':
          if (onDurationUpdate && message.data?.duration !== undefined) {
            console.log('[SoundCloudPlayer] Duration update', { duration: message.data.duration });
            onDurationUpdate(message.data.duration);
          }
          break;
        
        case 'error':
          console.error('[SoundCloudPlayer] Player error', { error: message.data?.error });
          if (onError && message.data?.error) {
            onError(message.data.error);
          }
          break;
      }
    } catch (error) {
      console.error('[SoundCloudPlayer] Error parsing WebView message:', error);
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
    console.log('[SoundCloudPlayer] Play/pause effect triggered', { 
      isPlaying, 
      playerReady, 
      hasWebView: !!webViewRef.current, 
      isSyncing,
      track: track?.url 
    });
    
    if (!playerReady || !webViewRef.current || isSyncing) {
      console.log('[SoundCloudPlayer] Skipping play/pause - not ready', { 
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
    console.log('[SoundCloudPlayer] Sending message to player', { type: isPlaying ? 'play' : 'pause', message });
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
    console.log('[SoundCloudPlayer] Track change effect triggered', { 
      trackUrl, 
      hasWebView: !!webViewRef.current,
      track: track?.url 
    });
    
    if (!trackUrl || !webViewRef.current) {
      console.log('[SoundCloudPlayer] Skipping load - no trackUrl or webView', { trackUrl, hasWebView: !!webViewRef.current });
      return;
    }
    
    console.log('[SoundCloudPlayer] Loading new track', { trackUrl });
    setPlayerReady(false);
    const message = JSON.stringify({
      type: 'loadTrack',
      data: { url: trackUrl }
    });
    webViewRef.current.postMessage(message);
  }, [trackUrl]);

  // Web implementation - Initialize SoundCloud Widget API (only once, when trackUrl is available)
  useEffect(() => {
    if (Platform.OS !== 'web' || !trackUrl || scWidget) return; // Don't initialize if no trackUrl or widget already exists

    // Load SoundCloud Widget API script if not already loaded
    if (!(window as any).SC) {
      const tag = document.createElement('script');
      tag.src = 'https://w.soundcloud.com/player/api.js';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    // Initialize widget when API is ready
    const initializeWidget = () => {
      if (!containerRef.current || scWidget) return; // Don't recreate if widget exists

      const containerElement = containerRef.current as any;
      const domNode = containerElement?._internalFiberInstanceHandleDEV?.stateNode || 
                     containerElement?.base || 
                     containerElement;

      if (!domNode) return;

      // Clear any existing widget
      domNode.innerHTML = '';

      const widgetId = `soundcloud-widget-${Date.now()}`;
      const widgetDiv = document.createElement('div');
      widgetDiv.id = widgetId;
      widgetDiv.style.width = '100%';
      widgetDiv.style.height = '400px';
      domNode.appendChild(widgetDiv);

      // Create iframe with initial track
      const iframe = document.createElement('iframe');
      iframe.width = '100%';
      iframe.height = '400';
      iframe.scrolling = 'no';
      iframe.frameBorder = 'no';
      iframe.allow = 'autoplay; encrypted-media';
      iframe.setAttribute('allowfullscreen', '');
      
      const embedUrl = convertToEmbedUrl(trackUrl);
      iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(embedUrl)}&color=%23667eea&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=false&visual=true&buying=false&sharing=false&download=false&show_artwork=true&single_active=false`;
      
      widgetDiv.appendChild(iframe);

      // Initialize widget API after iframe loads
      iframe.onload = () => {
        try {
          const widget = (window as any).SC.Widget(iframe);
          
          widget.bind((window as any).SC.Widget.Events.READY, () => {
            console.log('[SoundCloudPlayer Web] Widget ready');
            setPlayerReady(true);
            setScWidget(widget);
            // Update last loaded track URL when widget becomes ready
            if (trackUrl) {
              lastLoadedTrackUrlRef.current = trackUrl;
            }
            if (onReady) onReady();
            
            // Get duration when ready
            try {
              widget.getDuration((duration: number) => {
                const durationMs = duration;
                console.log('[SoundCloudPlayer Web] Duration', { duration: durationMs });
                if (onDurationUpdate) {
                  onDurationUpdate(durationMs);
                }
              });
            } catch (e) {
              console.error('[SoundCloudPlayer Web] Error getting duration:', e);
            }
            
            // Start position update interval
            if (positionIntervalRef.current) {
              clearInterval(positionIntervalRef.current);
            }
            positionIntervalRef.current = setInterval(() => {
              if (widget && !isSyncing) {
                try {
                  widget.getPosition((currentPos: number) => {
                    const positionMs = currentPos;
                    if (onPositionUpdate && Math.abs(positionMs - lastPositionRef.current) > 500) {
                      lastPositionRef.current = positionMs;
                      onPositionUpdate(positionMs);
                    }
                  });
                } catch (e) {
                  // Widget might not be ready
                }
              }
            }, 1000);
            
            // Sync to position if needed
            if (position > 0 && !isSyncing) {
              try {
                widget.seekTo(position);
              } catch (e) {
                console.error('[SoundCloudPlayer Web] Error seeking on ready:', e);
              }
            }
          });

          widget.bind((window as any).SC.Widget.Events.PLAY, () => {
            console.log('[SoundCloudPlayer Web] Playing');
            if (onStateChange) onStateChange('playing');
          });

          widget.bind((window as any).SC.Widget.Events.PAUSE, () => {
            console.log('[SoundCloudPlayer Web] Paused');
            if (onStateChange) onStateChange('paused');
          });

          widget.bind((window as any).SC.Widget.Events.FINISH, () => {
            console.log('[SoundCloudPlayer Web] Finished');
            if (onStateChange) onStateChange('ended');
          });

          widget.bind((window as any).SC.Widget.Events.ERROR, (error: any) => {
            console.error('[SoundCloudPlayer Web] Error', error);
            if (onError) {
              onError(`SoundCloud player error: ${error || 'Unknown error'}`);
            }
          });
        } catch (error) {
          console.error('[SoundCloudPlayer Web] Error initializing widget:', error);
          if (onError) {
            onError(`Failed to initialize SoundCloud widget: ${error}`);
          }
        }
      };
    };

    if ((window as any).SC && (window as any).SC.Widget) {
      initializeWidget();
    } else {
      (window as any).onSoundCloudAPIReady = initializeWidget;
    }

    return () => {
      if (positionIntervalRef.current) {
        clearInterval(positionIntervalRef.current);
        positionIntervalRef.current = null;
      }
      // Don't destroy widget on cleanup - let it persist for track changes
    };
  }, [Platform.OS, trackUrl, scWidget]); // Initialize when trackUrl becomes available (if widget doesn't exist)

  // Web implementation - Load new track using widget.load() (more efficient than recreating iframe)
  useEffect(() => {
    if (Platform.OS !== 'web' || !trackUrl || !scWidget) return;
    
    // Avoid reloading the same track
    if (lastLoadedTrackUrlRef.current === trackUrl) {
      return;
    }

    console.log('[SoundCloudPlayer Web] Loading new track via widget.load()', { trackUrl });
    setPlayerReady(false); // Reset ready state until new track loads
    lastLoadedTrackUrlRef.current = trackUrl; // Update last loaded track
    
    try {
      const embedUrl = convertToEmbedUrl(trackUrl);
      const widgetUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(embedUrl)}&color=%23667eea&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=false&visual=true&buying=false&sharing=false&download=false&show_artwork=true&single_active=false`;
      
      // Use widget.load() to change tracks without recreating iframe (SoundCloud best practice)
      scWidget.load(widgetUrl, {
        auto_play: false
      });
      
      // Widget will fire READY event when new track is loaded
      // The existing READY handler will update playerReady state
    } catch (error) {
      console.error('[SoundCloudPlayer Web] Error loading track:', error);
      if (onError) {
        onError(`Failed to load track: ${error}`);
      }
      setPlayerReady(true); // Reset ready state on error
      lastLoadedTrackUrlRef.current = ''; // Reset on error so we can retry
    }
  }, [trackUrl, scWidget, Platform.OS]);

  // Web implementation - Handle play/pause
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    
    console.log('[SoundCloudPlayer Web] Play/pause effect triggered', { 
      isPlaying, 
      hasWidget: !!scWidget, 
      playerReady,
      track: track?.url 
    });
    
    if (!scWidget || !playerReady) {
      console.log('[SoundCloudPlayer Web] Skipping play/pause - not ready', { 
        hasWidget: !!scWidget, 
        playerReady 
      });
      return;
    }
    
    try {
      if (!scWidget || typeof scWidget.play !== 'function' || typeof scWidget.pause !== 'function') {
        console.log('[SoundCloudPlayer Web] Widget not ready or methods not available', { 
          hasWidget: !!scWidget,
          hasPlay: typeof scWidget?.play === 'function',
          hasPause: typeof scWidget?.pause === 'function'
        });
        return;
      }
      
      if (isPlaying) {
        console.log('[SoundCloudPlayer Web] Calling play()');
        scWidget.play();
      } else {
        console.log('[SoundCloudPlayer Web] Calling pause()');
        scWidget.pause();
      }
    } catch (error) {
      console.error('[SoundCloudPlayer Web] Error in play/pause:', error);
    }
  }, [isPlaying, scWidget, playerReady, Platform.OS]);

  // Web implementation - Handle position sync
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    
    if (!scWidget || !playerReady || isSyncing) return;
    if (typeof scWidget.seekTo !== 'function') {
      console.log('[SoundCloudPlayer Web] seekTo method not available');
      return;
    }
    const diff = Math.abs(position - lastSupabasePositionRef.current);
    if (diff > 2000) {
      lastSupabasePositionRef.current = position;
      setIsSyncing(true);
      try {
        scWidget.seekTo(position);
        setTimeout(() => setIsSyncing(false), 1500);
      } catch (error) {
        console.error('[SoundCloudPlayer Web] Error seeking:', error);
        setIsSyncing(false);
      }
    }
  }, [position, scWidget, playerReady, Platform.OS]);

  // Web implementation render - hidden but functional
  if (Platform.OS === 'web') {
    if (!trackUrl) return null;

    return (
      <View 
        style={[
          styles.container, 
          { 
            backgroundColor: theme.colors.surface,
            // Keep widget functional but hidden
            position: 'absolute',
            left: -9999,
            width: 400,
            height: 400,
            opacity: 0,
            pointerEvents: 'none',
            zIndex: -1,
          }
        ]}
        // @ts-ignore - web-specific ref
        ref={containerRef}
      >
        {/* Widget will be injected into containerRef - hidden but functional */}
      </View>
    );
  }

  // Native implementation using WebView
  if (!trackUrl) {
    return null;
  }

  if (!WebView) {
    console.warn('[SoundCloudPlayer] WebView not available on native platform');
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <WebView
        ref={webViewRef}
        source={{ html: getSoundCloudHTML(trackUrl) }}
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
          console.error('[SoundCloudPlayer] WebView error:', nativeEvent);
          if (onError) {
            onError(`WebView error: ${nativeEvent.description || 'Unknown error'}`);
          }
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('[SoundCloudPlayer] WebView HTTP error:', nativeEvent);
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
    height: IS_MOBILE ? 300 : 400,
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 8,
    // Hide the player visually but keep it functional
    position: 'absolute',
    left: -9999,
    width: 1,
    height: 1,
    opacity: 0,
    pointerEvents: 'none',
  },
  webview: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' ? {
      display: 'none', // Web implementation uses direct DOM manipulation
    } : {}),
  },
});

