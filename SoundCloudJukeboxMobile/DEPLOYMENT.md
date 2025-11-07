# App Store Deployment Guide

This guide will help you deploy JukeTogether to the iOS App Store and Google Play Store.

## Prerequisites

1. **Apple Developer Account** ($99/year)
   - Sign up at: https://developer.apple.com
   - Enroll in Apple Developer Program

2. **Google Play Developer Account** ($25 one-time)
   - Sign up at: https://play.google.com/console

3. **EAS (Expo Application Services) Account**
   - Free tier available
   - Sign up at: https://expo.dev

## Step 1: Install EAS CLI

```bash
npm install -g eas-cli
```

## Step 2: Login to Expo

```bash
eas login
```

## Step 3: Configure Your Project

1. Initialize EAS in your project:
```bash
cd SoundCloudJukeboxMobile
eas build:configure
```

2. This will create/update `eas.json` with build profiles.

3. Update `app.json`:
   - Set your `bundleIdentifier` (iOS): `com.luminawater.juketogether`
   - Set your `package` (Android): `com.luminawater.juketogether`
   - Update version numbers

## Step 4: Build for iOS

### Option A: Cloud Build (Recommended)

```bash
eas build --platform ios --profile production
```

This will:
- Build your app in the cloud
- Generate an `.ipa` file
- Take about 15-30 minutes

### Option B: Local Build

```bash
eas build --platform ios --local
```

Requires:
- macOS with Xcode installed
- Apple Developer account configured

## Step 5: Submit to App Store

### Option A: EAS Submit (Easiest)

```bash
eas submit --platform ios
```

This will:
- Automatically upload to App Store Connect
- Handle all the submission process

### Option B: Manual Submission

1. Download the `.ipa` from EAS dashboard
2. Use **Transporter** app (macOS) or **App Store Connect** website
3. Upload the `.ipa` file
4. Complete app information in App Store Connect:
   - App description
   - Screenshots (required for different device sizes)
   - Privacy policy URL
   - App category
   - Age rating
   - Pricing

## Step 6: Build for Android

```bash
eas build --platform android --profile production
```

This generates an `.aab` (Android App Bundle) file.

## Step 7: Submit to Google Play

### Option A: EAS Submit

```bash
eas submit --platform android
```

### Option B: Manual Submission

1. Download the `.aab` from EAS dashboard
2. Go to Google Play Console
3. Create a new app
4. Upload the `.aab` file
5. Complete store listing:
   - App description
   - Screenshots
   - Feature graphic
   - Privacy policy
   - Content rating questionnaire

## App Store Requirements

### iOS App Store

**Required:**
- App icon (1024x1024px)
- Screenshots for:
  - iPhone 6.7" (1290 x 2796)
  - iPhone 6.5" (1284 x 2778)
  - iPhone 5.5" (1242 x 2208)
  - iPad Pro 12.9" (2048 x 2732)
- Privacy policy URL
- App description
- Keywords
- Support URL
- Marketing URL (optional)

**Review Guidelines:**
- App must function as described
- No crashes or bugs
- Proper handling of user data
- Compliance with App Store guidelines

### Google Play Store

**Required:**
- App icon (512x512px)
- Feature graphic (1024x500px)
- Screenshots (at least 2, up to 8)
- App description (4000 chars max)
- Privacy policy URL
- Content rating

**Review Process:**
- Usually faster than iOS (1-3 days)
- Automated and manual review

## Updating Your App

1. Update version numbers in `app.json`:
   - `version`: User-facing version (e.g., "1.0.1")
   - `ios.buildNumber`: Increment for each iOS build
   - `android.versionCode`: Increment for each Android build

2. Build new version:
```bash
eas build --platform ios --profile production
eas build --platform android --profile production
```

3. Submit updates:
```bash
eas submit --platform ios
eas submit --platform android
```

## Troubleshooting

### iOS Build Issues

**"No provisioning profile found"**
- Ensure your Apple Developer account is linked
- Run: `eas credentials` to configure certificates

**"Bundle identifier already in use"**
- Change `bundleIdentifier` in `app.json` to something unique
- Format: `com.yourcompany.appname`

### Android Build Issues

**"Package name already exists"**
- Change `package` in `app.json` to something unique
- Format: `com.yourcompany.appname`

**"Keystore not found"**
- EAS will generate one automatically
- Or configure manually: `eas credentials`

## Cost Estimates

- **Apple Developer Program**: $99/year
- **Google Play**: $25 one-time
- **EAS Build**: 
  - Free tier: Limited builds
  - Paid: $29/month for unlimited builds

## Timeline

- **iOS Review**: 1-7 days (usually 24-48 hours)
- **Android Review**: 1-3 days (usually same day)
- **First submission**: Longer due to setup
- **Updates**: Faster (usually same day)

## Tips for Faster Approval

1. **Test thoroughly** before submission
2. **Follow guidelines** exactly
3. **Provide clear descriptions** of app functionality
4. **Include demo account** if app requires login
5. **Respond quickly** to reviewer questions
6. **Keep privacy policy** up to date

## Resources

- [Expo EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Policies](https://play.google.com/about/developer-content-policy/)
- [EAS Submit Docs](https://docs.expo.dev/submit/introduction/)

