import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import './global.css';
import App from './App';

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
      if (message.includes('props.pointerEvents is deprecated')) {
        const count = (warningSources.get('pointerEvents') || 0) + 1;
        warningSources.set('pointerEvents', count);
        
        // Only log detailed info for first few occurrences
        if (count <= MAX_DETAILED_LOGS) {
          const stack = new Error().stack;
          const stackLines = stack?.split('\n') || [];
          const source = stackLines.slice(2, 10).join('\n') || 'unknown';
          const componentMatch = stackLines.find(line => 
            line.includes('.tsx') || line.includes('.ts') || line.includes('Component')
          ) || 'unknown';
          
          detailedLogs.set('pointerEvents', { stack: source, component: componentMatch, args });
          
          console.group(`🔍 [TRACE ${count}] pointerEvents deprecation warning`);
          originalWarn(...args);
          console.log('📍 Component/File:', componentMatch);
          console.log('📍 Stack trace:', source);
          console.log('💡 Tip: Look for View components with pointerEvents prop');
          console.groupEnd();
        }
        // Suppress the warning after first few detailed logs
        return;
      }
      
      // Handle shadow props deprecation
      if (message.includes('shadow*') && message.includes('deprecated')) {
        const count = (warningSources.get('shadow') || 0) + 1;
        warningSources.set('shadow', count);
        
        if (count <= MAX_DETAILED_LOGS) {
          const stack = new Error().stack;
          const stackLines = stack?.split('\n') || [];
          const source = stackLines.slice(2, 10).join('\n') || 'unknown';
          const componentMatch = stackLines.find(line => 
            line.includes('.tsx') || line.includes('.ts') || line.includes('Component')
          ) || 'unknown';
          
          detailedLogs.set('shadow', { stack: source, component: componentMatch, args });
          
          console.group(`🔍 [TRACE ${count}] shadow* props deprecation warning`);
          originalWarn(...args);
          console.log('📍 Component/File:', componentMatch);
          console.log('📍 Stack trace:', source);
          console.log('💡 Tip: Use boxShadow for web, shadow* props for native');
          console.groupEnd();
        }
        return;
      }
      
      // Handle useNativeDriver warning
      if (
        message.includes('useNativeDriver') ||
        message.includes('native animated module is missing') ||
        message.includes('RCTAnimation')
      ) {
        const count = (warningSources.get('useNativeDriver') || 0) + 1;
        warningSources.set('useNativeDriver', count);
        
        if (count <= MAX_DETAILED_LOGS) {
          const stack = new Error().stack;
          const source = stack?.split('\n').slice(2, 6).join('\n') || 'unknown';
          
          console.group(`🔍 [TRACE ${count}] useNativeDriver warning`);
          originalWarn(...args);
          console.log('📍 Stack trace:', source);
          console.groupEnd();
        }
        // Suppress after first few - this is expected on web
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
