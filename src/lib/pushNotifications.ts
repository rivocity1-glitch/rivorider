import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications() {
  try {
    console.log('Starting rider push notification registration...');

    if (!Device.isDevice) {
      console.log('Push notifications require a physical device.');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#208AEF',
      });
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permission denied.');
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.log('Missing EAS Project ID.');
      return null;
    }

    const pushToken = (
      await Notifications.getExpoPushTokenAsync({
        projectId,
      })
    ).data;

    console.log('Expo Push Token:', pushToken);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.log('No authenticated rider.');
      return pushToken;
    }

    const { error } = await supabase
      .from('riders')
      .update({
        expo_push_token: pushToken,
      })
      .eq('auth_user_id', user.id);

    if (error) {
      console.log('Failed to save rider push token:', error.message);
    } else {
      console.log('Rider push token saved successfully.');
    }

    return pushToken;
  } catch (error) {
    console.error('Push registration failed:', error);
    return null;
  }
}

export async function clearPushToken() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase
      .from('riders')
      .update({
        expo_push_token: null,
      })
      .eq('auth_user_id', user.id);

    console.log('Rider push token cleared.');
  } catch (error) {
    console.error(error);
  }
}