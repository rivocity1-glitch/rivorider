import { Alert, Linking } from 'react-native';

export type NavigationLocation = {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
};

async function openGoogleMapsNavigation(
  origin: NavigationLocation | null,
  destination: NavigationLocation,
) {
  if (
    destination.latitude == null ||
    destination.longitude == null ||
    (origin && (origin.latitude == null || origin.longitude == null))
  ) {
    Alert.alert(
      'Location Unavailable',
      'The required vendor or customer location is not available for this order.',
    );
    return false;
  }

  const destinationValue = `${destination.latitude},${destination.longitude}`;
  const mapsUrl =
    'https://www.google.com/maps/dir/?api=1' +
    (origin
      ? `&origin=${encodeURIComponent(`${origin.latitude},${origin.longitude}`)}`
      : '') +
    `&destination=${encodeURIComponent(destinationValue)}` +
    '&travelmode=two-wheeler' +
    '&dir_action=navigate';

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

/**
 * Pickup: rider's current GPS location -> assigned vendor/store.
 * Origin is intentionally omitted so Google Maps uses the rider's live location.
 */
export async function navigateToVendor(
  vendorLocation: NavigationLocation,
) {
  return openGoogleMapsNavigation(null, vendorLocation);
}

/**
 * Delivery: assigned vendor/store -> customer.
 * The vendor coordinates are the explicit origin for this stage.
 */
export async function navigateToCustomer(
  vendorLocation: NavigationLocation,
  customerLocation: NavigationLocation,
) {
  return openGoogleMapsNavigation(vendorLocation, customerLocation);
}

/**
 * Return: customer -> the same assigned vendor/store.
 * The customer coordinates are the explicit origin for this stage.
 */
export async function navigateToVendorFromCustomer(
  customerLocation: NavigationLocation,
  vendorLocation: NavigationLocation,
) {
  return openGoogleMapsNavigation(customerLocation, vendorLocation);
}
