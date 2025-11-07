import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import App from './App';

// Enhanced logging to trace warning sources
if (Platform.OS === 'web') {
  const originalWarn = console.warn;
  const originalError = console.error;
  
  // Track warning sources
  const warningSources = new Map<string, number>();
  
  console.warn = (...args: any[]) => {
    const message = args[0];
    
    if (typeof message === 'string') {
      // Log pointerEvents deprecation with stack trace
      if (message.includes('props.pointerEvents is deprecated')) {
        const stack = new Error().stack;
        const stackLines = stack?.split('\n') || [];
        const source = stackLines.slice(2, 10).join('\n') || 'unknown';
        const count = (warningSources.get('pointerEvents') || 0) + 1;
        warningSources.set('pointerEvents', count);
        
        // Try to extract component/file info from stack
        const componentMatch = stackLines.find(line => 
          line.includes('.tsx') || line.includes('.ts') || line.includes('Component')
        );
        
        console.group(`🔍 [TRACE ${count}] pointerEvents deprecation warning`);
        console.warn(...args);
        console.log('📍 Component/File:', componentMatch || 'unknown');
        console.log('📍 Full Stack trace:');
        console.log(source);
        console.log('📦 Warning args:', args);
        console.log('💡 Tip: Look for View components with pointerEvents prop');
        console.groupEnd();
        return;
      }
      
      // Log shadow props deprecation with stack trace
      if (message.includes('shadow*') && message.includes('deprecated')) {
        const stack = new Error().stack;
        const stackLines = stack?.split('\n') || [];
        const source = stackLines.slice(2, 10).join('\n') || 'unknown';
        const count = (warningSources.get('shadow') || 0) + 1;
        warningSources.set('shadow', count);
        
        // Try to extract component/file info from stack
        const componentMatch = stackLines.find(line => 
          line.includes('.tsx') || line.includes('.ts') || line.includes('Component')
        );
        
        console.group(`🔍 [TRACE ${count}] shadow* props deprecation warning`);
        console.warn(...args);
        console.log('📍 Component/File:', componentMatch || 'unknown');
        console.log('📍 Full Stack trace:');
        console.log(source);
        console.log('📦 Warning args:', args);
        console.log('💡 Tip: Use boxShadow for web, shadow* props for native');
        console.groupEnd();
        return;
      }
      
      // Log useNativeDriver warning with stack trace
      if (
        message.includes('useNativeDriver') ||
        message.includes('native animated module is missing') ||
        message.includes('RCTAnimation')
      ) {
        const stack = new Error().stack;
        const source = stack?.split('\n').slice(2, 6).join('\n') || 'unknown';
        const count = (warningSources.get('useNativeDriver') || 0) + 1;
        warningSources.set('useNativeDriver', count);
        
        console.group(`🔍 [TRACE ${count}] useNativeDriver warning`);
        console.warn(...args);
        console.log('📍 Stack trace:');
        console.log(source);
        console.log('📦 Full args:', args);
        console.groupEnd();
        return;
      }
      
      // Log aria-hidden warnings
      if (message.includes('aria-hidden') || message.includes('Blocked aria-hidden')) {
        const stack = new Error().stack;
        const stackLines = stack?.split('\n') || [];
        const source = stackLines.slice(2, 12).join('\n') || 'unknown';
        const count = (warningSources.get('aria-hidden') || 0) + 1;
        warningSources.set('aria-hidden', count);
        
        // Try to extract component/file info from stack
        const componentMatch = stackLines.find(line => 
          line.includes('.tsx') || line.includes('.ts') || line.includes('Component') || line.includes('Dialog') || line.includes('Portal')
        );
        
        console.group(`🔍 [TRACE ${count}] aria-hidden accessibility warning`);
        console.warn(...args);
        console.log('📍 Component/File:', componentMatch || 'unknown');
        console.log('📍 Full Stack trace:');
        console.log(source);
        console.log('📦 Warning args:', args);
        console.log('💡 Tip: Check Dialog/Portal components - use inert attribute instead of aria-hidden on focused elements');
        console.groupEnd();
        return;
      }
    }
    
    originalWarn.apply(console, args);
  };
  
  // Log summary on page load
  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
      setTimeout(() => {
        if (warningSources.size > 0) {
          console.group('📊 Warning Summary');
          warningSources.forEach((count, type) => {
            console.log(`${type}: ${count} occurrence(s)`);
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
