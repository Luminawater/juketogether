import { MD3DarkTheme } from 'react-native-paper';

// Material Design 3 Dark Theme
export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    // Primary colors
    primary: '#667eea',
    onPrimary: '#FFFFFF',
    primaryContainer: '#4c63d2',
    onPrimaryContainer: '#FFFFFF',
    
    // Secondary colors
    secondary: '#03DAC6',
    onSecondary: '#000000',
    secondaryContainer: '#018786',
    onSecondaryContainer: '#FFFFFF',
    
    // Tertiary colors
    tertiary: '#BB86FC',
    onTertiary: '#000000',
    tertiaryContainer: '#6200EE',
    onTertiaryContainer: '#FFFFFF',
    
    // Error colors
    error: '#CF6679',
    onError: '#000000',
    errorContainer: '#B00020',
    onErrorContainer: '#FFFFFF',
    
    // Background colors
    background: '#121212',
    onBackground: '#FFFFFF',
    
    // Surface colors
    surface: '#1E1E1E',
    onSurface: '#FFFFFF',
    surfaceVariant: '#2C2C2C',
    onSurfaceVariant: '#B0B0B0',
    
    // Outline
    outline: '#3A3A3A',
    outlineVariant: '#4A4A4A',
    
    // Shadow
    shadow: '#000000',
    
    // Elevation colors (for cards, etc.)
    elevation: {
      level0: '#121212',
      level1: '#1E1E1E',
      level2: '#252525',
      level3: '#2C2C2C',
      level4: '#333333',
      level5: '#3A3A3A',
    },
    
    // Inverse colors
    inverseSurface: '#E0E0E0',
    inverseOnSurface: '#121212',
    inversePrimary: '#667eea',
    
    // Surface tint
    surfaceTint: '#667eea',
  },
};

export default darkTheme;

