# 📱 ScrollKurai Mobile Setup Guide

This guide will help you run ScrollKurai as a native mobile app on iOS and Android.

## 🚀 Prerequisites

- **Node.js** (v18 or higher)
- **Git**
- **For iOS**: Mac with Xcode installed
- **For Android**: Android Studio installed

## 📋 Setup Steps

### 1. Export & Clone Project

1. Click the **"Export to Github"** button in Lovable
2. Clone your repository locally:
   ```bash
   git clone <your-repo-url>
   cd <your-repo-name>
   ```

### 2. Install Dependencies

```bash
npm install
```

### 3. Add Native Platforms

**For iOS:**
```bash
npx cap add ios
npx cap update ios
```

**For Android:**
```bash
npx cap add android
npx cap update android
```

### 4. Build the Web App

```bash
npm run build
```

### 5. Sync with Native Platforms

```bash
npx cap sync
```

**Important**: Run `npx cap sync` every time you pull new changes from Git!

### 6. Run on Device/Emulator

**For iOS:**
```bash
npx cap run ios
```
This will open Xcode. Select your device/simulator and click Run.

**For Android:**
```bash
npx cap run android
```
This will open Android Studio. Select your device/emulator and click Run.

## 🔔 Firebase Cloud Messaging Setup

To enable push notifications, you'll need to set up Firebase:

### iOS Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing
3. Add iOS app with bundle ID: `app.lovable.83c4d2fb460848c1a5d5216e5b0ac4e3`
4. Download `GoogleService-Info.plist`
5. Place it in `ios/App/App/` directory
6. Upload your APNs certificate to Firebase

### Android Setup

1. In Firebase Console, add Android app
2. Use package name: `app.lovable.83c4d2fb460848c1a5d5216e5b0ac4e3`
3. Download `google-services.json`
4. Place it in `android/app/` directory

## 🔧 Hot Reload During Development

The app is configured to hot reload from the Lovable sandbox:
- URL: `https://83c4d2fb-4608-48c1-a5d5-216e5b0ac4e3.lovableproject.com`
- This means you can edit in Lovable and see changes instantly on your mobile device!

To switch to local development:
1. Update `capacitor.config.ts`
2. Change `server.url` to `http://localhost:5173`
3. Run `npm run dev` locally
4. Run `npx cap sync`

## 📱 Testing Features

### Push Notifications
- Grant notification permissions when prompted
- Test daily quest reminders
- Test streak reminders
- Check notification settings in Profile tab

### Social Features
- Post anonymous reflections in Community tab
- Join friend challenges in Challenges tab
- Like and interact with community posts

### PWA Features
- Install prompt appears after a few visits
- Works offline with cached quests
- Add to home screen for native-like experience

## 🐛 Common Issues

### iOS Build Errors
- Make sure Xcode is up to date
- Run `pod install` in `ios/App/` directory
- Clean build folder in Xcode (Cmd+Shift+K)

### Android Build Errors
- Ensure Android Studio SDK is installed
- Check Java version (JDK 17 recommended)
- Sync Gradle files in Android Studio

### Push Notifications Not Working
- Verify Firebase setup is complete
- Check GoogleService files are in correct locations
- Ensure app has notification permissions
- Review device notification settings

## 📚 Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Lovable Mobile Guide](https://lovable.dev/blogs/TODO)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)

## 🎉 You're All Set!

Your ScrollKurai app should now be running on your mobile device. Start completing quests and transforming brain rot into true potential! 🚀
