import { Alert, Linking } from 'react-native';

export type NavigationLocation = {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
};

/**
 * Opens Google Maps navigation from the assigned vendor/store to the customer.
 * Google Maps URLs do not require a Google Maps API key.
 */
export async function navigateToCustomer(
  vendorLocation: NavigationLocation,
  customerLocation: NavigationLocation,
) {
  if (
    vendorLocation.latitude == null ||
    vendorLocation.longitude == null ||
    customerLocation.latitude == null ||
    customerLocation.longitude == null
  ) {
    Alert.alert(
      'Location Unavailable',
      'The vendor or customer location is not available for this order.',
    );
    return false;
  }

  const origin = `${vendorLocation.latitude},${vendorLocation.longitude}`;
  const destination = `${customerLocation.latitude},${customerLocation.longitude}`;
  const mapsUrl =
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}` +
    `&travelmode=two-wheeler` +
    `&dir_action=navigate`;

  try {
    const canOpen = await Linking.canOpenURL(mapsUrl);
    if (!canOpen) {
      Alert.alert(
        'Navigation Unavailable',
        'Unable to open Google Maps on this device.',
      );
      return false;
    }

    await Linking.openURL(mapsUrl);
    return true;
  } catch (error) {
    console.error('Error opening Google Maps navigation:', error);
    Alert.alert(
      'Navigation Error',
      'Unable to open Google Maps navigation.',
    );
    return false;
  }
}

// Branch test trigger: keep navigation helper behavior unchanged.
