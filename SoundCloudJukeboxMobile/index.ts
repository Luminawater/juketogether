import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import './global.css';
import App from './App';

// Ensure MaterialCommunityIcons font loads on web
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  // Inject font-face CSS immediately to ensure fonts load before React Native Web tries to use them
  const fontStyleId = 'material-community-icons-font';
  if (!document.getElementById(fontStyleId)) {
    const style = document.createElement('style');
    style.id = fontStyleId;
    style.textContent = `
      @font-face {
        font-family: 'MaterialCommunityIcons';
        src: url('https://cdn.jsdelivr.net/npm/@expo/vector-icons@15.0.3/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf') format('truetype');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }
    `;
    document.head.insertBefore(style, document.head.firstChild);
  }
}

// Enhanced logging to trace warning sources (throttled to prevent spam)
if (Platform.OS === 'web') {
  const originalWarn = console.warn;
  
  // Track warning sources and detailed logs
  const warningSources = new Map<string, number>();
  const detailedLogs = new Map<string, { stack: string; component: string; args: any[] }>();
  const MAX_DETAILED_LOGS = 3; // Only show detailed info for first 3 occurrences
  
  console.warn = (...args: any[]) => {
    const message = args[0];
    
    if (typeof message === 'string') {
      // Handle pointerEvents deprecation
      // NOTE: This warning comes from React Native Paper's Chip component (third-party)
      // We cannot fix it directly - it needs to be fixed in react-native-paper
      if (message.includes('props.pointerEvents is deprecated') || message.includes('Use style.pointerEvents')) {
        const count = (warningSources.get('pointerEvents') || 0) + 1;
        warningSources.set('pointerEvents', count);
        
        // Only log detailed info for first occurrence
        if (count === 1) {
          const stack = new Error().stack;
          const stackLines = stack?.split('\n') || [];
          const source = stackLines.slice(2, 10).join('\n') || 'unknown';
          const componentMatch = stackLines.find(line => 
            line.includes('.tsx') || line.includes('.ts') || line.includes('Component')
          ) || 'unknown';
          
          detailedLogs.set('pointerEvents', { stack: source, component: componentMatch, args });
          
          console.group(`🔍 [TRACE 1] pointerEvents deprecation warning`);
          originalWarn(...args);
          console.log('📍 Component/File:', componentMatch);
          console.log('📍 Stack trace:', source);
          console.log('💡 Tip: This warning comes from React Native Paper\'s Chip component');
          console.log('💡 Note: This is a known third-party issue and cannot be fixed in our codebase');
          console.groupEnd();
        }
        // Suppress the warning after first log (known third-party issue)
        return;
      }
      
      // Handle shadow props deprecation
      // NOTE: Our code already uses Platform.OS checks correctly, but React Native Web
      // still processes all StyleSheet properties, causing this informational warning
      if ((message.includes('shadow*') && message.includes('deprecated')) || message.includes('Use "boxShadow"')) {
        const count = (warningSources.get('shadow') || 0) + 1;
        warningSources.set('shadow', count);
        
        if (count === 1) {
          const stack = new Error().stack;
          const stackLines = stack?.split('\n') || [];
          const source = stackLines.slice(2, 10).join('\n') || 'unknown';
          const componentMatch = stackLines.find(line => 
            line.includes('.tsx') || line.includes('.ts') || line.includes('Component')
          ) || 'unknown';
          
          detailedLogs.set('shadow', { stack: source, component: componentMatch, args });
          
          console.group(`🔍 [TRACE 1] shadow* props deprecation warning`);
          originalWarn(...args);
          console.log('📍 Component/File:', componentMatch);
          console.log('📍 Stack trace:', source);
          console.log('💡 Tip: Use boxShadow for web, shadow* props for native');
          console.log('💡 Note: Our code already uses Platform.OS checks - this is an informational warning');
          console.groupEnd();
        }
        // Suppress after first log (informational only, code is correct)
        return;
      }
      
      // Handle useNativeDriver warning - completely suppress (expected on web)
      if (
        message.includes('useNativeDriver') ||
        message.includes('native animated module is missing') ||
        message.includes('RCTAnimation')
      ) {
        // This is expected behavior on web - React Native Web doesn't support native animations
        // Suppress completely to reduce console noise
        return;
      }
      
      // Handle touch event warnings - suppress (minor web compatibility issue)
      if (
        message.includes('Cannot record touch end without a touch start') ||
        message.includes('Touch End') ||
        message.includes('Touch Bank')
      ) {
        // This is a minor web compatibility issue with React Native's touch handling
        // Suppress to reduce console noise
        return;
      }
      
      // Handle aria-hidden warnings
      if (message.includes('aria-hidden') || message.includes('Blocked aria-hidden')) {
        const count = (warningSources.get('aria-hidden') || 0) + 1;
        warningSources.set('aria-hidden', count);
        
        if (count <= MAX_DETAILED_LOGS) {
          const stack = new Error().stack;
          const stackLines = stack?.split('\n') || [];
          const source = stackLines.slice(2, 12).join('\n') || 'unknown';
          const componentMatch = stackLines.find(line => 
            line.includes('.tsx') || line.includes('.ts') || line.includes('Component') || line.includes('Dialog') || line.includes('Portal')
          ) || 'unknown';
          
          detailedLogs.set('aria-hidden', { stack: source, component: componentMatch, args });
          
          console.group(`🔍 [TRACE ${count}] aria-hidden accessibility warning`);
          originalWarn(...args);
          console.log('📍 Component/File:', componentMatch);
          console.log('📍 Stack trace:', source);
          console.log('💡 Tip: Check Dialog/Portal components - use inert attribute instead');
          console.groupEnd();
        }
        return;
      }
    }
    
    // Pass through all other warnings
    originalWarn.apply(console, args);
  };
  
  // Log summary on page load
  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
      setTimeout(() => {
        if (warningSources.size > 0) {
          console.group('📊 Warning Summary');
          warningSources.forEach((count, type) => {
            const details = detailedLogs.get(type);
            if (details && count > MAX_DETAILED_LOGS) {
              console.log(`${type}: ${count} occurrence(s) - See first ${MAX_DETAILED_LOGS} detailed logs above`);
            } else {
              console.log(`${type}: ${count} occurrence(s)`);
            }
          });
          console.groupEnd();
        }
      }, 2000);
    });
  }
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
