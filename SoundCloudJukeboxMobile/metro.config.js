// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Try to apply NativeWind if available
let finalConfig = config;

// Use a function to safely require nativewind/metro
function tryRequireNativeWind() {
  try {
    // Use require.resolve to check if module exists before requiring
    require.resolve('nativewind/metro');
    const { withNativeWind } = require('nativewind/metro');
    return withNativeWind(config, { input: './global.css' });
  } catch (error) {
    // Module doesn't exist or failed to load - use default config
    return config;
  }
}

finalConfig = tryRequireNativeWind();

module.exports = finalConfig;

