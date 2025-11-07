# JukeTogether Mobile App

A collaborative music listening app built with React Native and Expo, supporting iOS, Android, and Web.

## Features

- 🎵 Collaborative music listening rooms
- 🎧 SoundCloud and Spotify integration
- 📱 Cross-platform (iOS, Android, Web)
- 🔄 Real-time synchronization via WebSocket
- 👥 Multi-user support
- 🎛️ Playback controls

## Prerequisites

- Node.js 18+ 
- Expo CLI (`npm install -g expo-cli`)
- iOS: Xcode (for iOS builds)
- Android: Android Studio (for Android builds)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables (optional):
```bash
cp .env.example .env
# Edit .env with your API URLs
```

3. Start the development server:
```bash
npm start
```

## Running on Different Platforms

### Web
```bash
npm run web
# or
expo start --web
```

### iOS Simulator
```bash
npm run ios
# or
expo start --ios
```

### Android Emulator
```bash
npm run android
# or
expo start --android
```

## Building for Production

### Using EAS Build (Recommended for App Store)

1. Install EAS CLI:
```bash
npm install -g eas-cli
```

2. Login to Expo:
```bash
eas login
```

3. Configure your project:
```bash
eas build:configure
```

4. Build for iOS:
```bash
eas build --platform ios --profile production
```

5. Build for Android:
```bash
eas build --platform android --profile production
```

### Building Locally

#### iOS
```bash
eas build --platform ios --local
```

#### Android
```bash
eas build --platform android --local
```

## App Store Deployment

### iOS (App Store)

1. Build the app:
```bash
eas build --platform ios --profile production
```

2. Submit to App Store:
```bash
eas submit --platform ios
```

Or manually:
- Download the `.ipa` file from EAS
- Upload via App Store Connect or Transporter

### Android (Google Play Store)

1. Build the app:
```bash
eas build --platform android --profile production
```

2. Submit to Play Store:
```bash
eas submit --platform android
```

Or manually:
- Download the `.aab` file from EAS
- Upload via Google Play Console

## Configuration

### app.json

Update the following in `app.json`:
- `name`: App display name
- `slug`: URL-friendly name
- `ios.bundleIdentifier`: Your iOS bundle ID (e.g., `com.yourcompany.juketogether`)
- `android.package`: Your Android package name (e.g., `com.yourcompany.juketogether`)
- `ios.buildNumber`: Increment for each build
- `android.versionCode`: Increment for each build

### Environment Variables

Set these in `app.json` under `extra`:
```json
{
  "extra": {
    "apiUrl": "https://juketogether.vercel.app",
    "supabaseUrl": "https://your-project.supabase.co",
    "supabaseAnonKey": "your-anon-key"
  }
}
```

## Project Structure

```
src/
  ├── components/     # Reusable components
  ├── config/         # Configuration files
  ├── context/        # React Context providers
  ├── screens/        # Screen components
  ├── services/       # API and service integrations
  └── types/          # TypeScript type definitions
```

## Troubleshooting

### Web Build Issues
- Ensure `react-native-web` is installed
- Check Metro bundler configuration
- Clear cache: `expo start -c`

### iOS Build Issues
- Ensure Xcode is properly configured
- Check bundle identifier matches your Apple Developer account
- Verify certificates and provisioning profiles

### Android Build Issues
- Ensure Android SDK is installed
- Check package name matches Google Play Console
- Verify signing keys are configured

## Support

For issues and questions, please open an issue on GitHub.
