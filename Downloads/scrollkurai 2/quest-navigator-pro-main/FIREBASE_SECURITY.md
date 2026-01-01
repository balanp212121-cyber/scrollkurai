# Firebase API Key Security Guide

## Current Status

This project uses Firebase Cloud Messaging (FCM) for push notifications. The Firebase configuration files containing API keys are intentionally committed to the repository:

- **Android**: `android/app/google-services.json`
- **iOS**: `ios/App/App/GoogleService-Info.plist`

## Security Considerations

These are **client-side API keys** designed to be bundled with mobile applications. However, they should be properly restricted in the Firebase Console to prevent abuse.

## Required Actions

### 1. Restrict API Keys in Google Cloud Console

Visit [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)

For **Android API Key** (`AIzaSyDgf8LS-gDog_WFTP3Jk2nsGJ1_EHw5m4w`):
- Click on the API key
- Under "Application restrictions":
  - Select "Android apps"
  - Add package name: `com.lovable.scrollkurai`
  - Add SHA-1 fingerprint from your Android app signing certificate
- Under "API restrictions":
  - Select "Restrict key"
  - Enable only: **Firebase Cloud Messaging API**
- Save changes

For **iOS API Key** (`AIzaSyBjYwISHcXVcMoVzIzbtOJgFjDqykmJe8s`):
- Click on the API key
- Under "Application restrictions":
  - Select "iOS apps"
  - Add bundle identifier: `com.lovable.scrollkurai`
- Under "API restrictions":
  - Select "Restrict key"
  - Enable only: **Firebase Cloud Messaging API**
- Save changes

### 2. Monitor Usage

Visit [Firebase Console](https://console.firebase.google.com/):
- Navigate to your project: **scrollkurai**
- Check the Cloud Messaging section for unusual activity
- Review quotas and usage patterns regularly

### 3. Additional Security Measures

#### Rate Limiting in Edge Function

The `store-push-token` edge function should have rate limiting. Current implementation allows unlimited token registrations.

Recommended improvement:
```typescript
// Add to store-push-token/index.ts
const MAX_TOKENS_PER_USER = 5; // Limit devices per user

// Before inserting, check existing token count
const { count } = await supabase
  .from('push_notification_tokens')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', user.id);

if (count && count >= MAX_TOKENS_PER_USER) {
  // Delete oldest token or return error
}
```

#### Notification Validation

Ensure all notification sending logic:
- Validates user identity server-side
- Checks user permissions before sending
- Uses the FCM server key (stored in Supabase secrets) rather than client keys
- Implements exponential backoff for failed deliveries

## Key Rotation Plan

If you suspect the keys have been compromised:

1. Create new Firebase apps in the Firebase Console
2. Download new `google-services.json` and `GoogleService-Info.plist`
3. Update your repository
4. Release new app versions
5. Delete old Firebase apps after migration

## Why These Keys Are Committed

Unlike backend API keys or database credentials, Firebase client configuration files are **designed to be public**:
- They're bundled in distributed mobile apps (visible via decompilation)
- Security comes from Firebase's application restrictions, not key secrecy
- The keys only work when properly restricted to your app's package/bundle ID

This is standard practice for mobile app development.

## Checklist

- [ ] Restrict Android API key to package name `com.lovable.scrollkurai`
- [ ] Restrict iOS API key to bundle ID `com.lovable.scrollkurai`
- [ ] Enable API restrictions (FCM only) for both keys
- [ ] Add rate limiting to push token registration
- [ ] Monitor Firebase usage dashboard monthly
- [ ] Document key rotation procedure for your team
