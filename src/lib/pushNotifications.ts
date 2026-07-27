// src/lib/pushNotifications.ts
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export async function registerForPushNotifications() {
  // Guard against running push notifications inside Expo Go
  if (Constants.appOwnership === 'expo') {
    console.warn('Push notifications are not supported in Expo Go. Skipping registration.');
    return null;
  }

  // Safely require expo-notifications at runtime only when NOT in Expo Go
  const Notifications = require('expo-notifications');

  let token = null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2ECC71',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Failed to get push token for push notification!');
    return null;
  }

  try {
    const pushTokenData = await Notifications.getExpoPushTokenAsync();
    token = pushTokenData.data;
  } catch (error) {
    console.warn('Error getting push token:', error);
  }

  return token;
}