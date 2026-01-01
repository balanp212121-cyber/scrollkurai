import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const initializePushNotifications = async () => {
  try {
    // Guard: only initialize on native platforms where the plugin exists
    const isWeb = Capacitor.getPlatform() === 'web';
    const hasPlugin = Capacitor.isPluginAvailable('PushNotifications');
    if (isWeb || !hasPlugin) {
      console.info('Push notifications not available on web; skipping initialization.');
      return;
    }

    // Request permission
    const permResult = await PushNotifications.requestPermissions();
    
    if (permResult.receive !== 'granted') {
      toast.error('Push notification permission denied');
      return;
    }

    // Register with FCM/APNs
    await PushNotifications.register();

    // Listen for registration success
    await PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration success, token: ' + token.value);
      
      // Save token to secure service-only table via edge function
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Call edge function to securely store push token
        const { error } = await supabase.functions.invoke('store-push-token', {
          body: { push_token: token.value }
        });
        
        if (error) {
          console.error('Failed to store push token:', error);
          toast.error('Failed to register push notifications');
        }
      }
    });

    // Listen for registration errors
    await PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Error on registration: ' + JSON.stringify(error));
      toast.error('Failed to register for push notifications');
    });

    // Handle push notifications received
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push notification received: ', notification);
      toast.success(notification.title || 'New notification', {
        description: notification.body,
        duration: 6000,
      });
    });

    // Handle push notifications clicked
    await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push notification action performed', notification);
    });

  } catch (error) {
    console.error('Error initializing push notifications:', error);
  }
};

export const updateNotificationPreferences = async (preferences: {
  daily_quest_reminder?: boolean;
  streak_reminder?: boolean;
  friend_challenge?: boolean;
  community_activity?: boolean;
}) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('notification_preferences')
    .upsert({
      user_id: user.id,
      ...preferences,
    });

  if (error) {
    toast.error('Failed to update notification preferences');
  } else {
    toast.success('Notification preferences updated');
  }
};
