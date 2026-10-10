import { Alert, Linking } from 'react-native';

export type NavigationLocation = {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
};

async function openGoogleMapsNavigation(
  origin: NavigationLocation | null,
  destination: NavigationLocation,
  startNavigation = true,
) {
  if (
    destination.latitude == null ||
    destination.longitude == null ||
    (origin && (origin.latitude == null || origin.longitude == null))
  ) {
    Alert.alert(
      'Location Unavailable',
      'The required start or destination location is not available for this order.',
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
    '&travelmode=driving' +
    (startNavigation ? '&dir_action=navigate' : '');

  try {
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
 * Omitting an explicit origin lets Google Maps use the rider's live location.
 * Open route preview first so the rider can compare available routes before starting.
 */
export async function navigateToVendor(
  vendorLocation: NavigationLocation,
) {
  return openGoogleMapsNavigation(null, vendorLocation, false);
}

/**
 * Delivery navigation: rider's current location -> customer.
 * Do not use the vendor as origin because the rider may be somewhere else.
 * Show the route overview so the rider can choose an appropriate route.
 */
export async function navigateFromRiderToCustomer(
  customerLocation: NavigationLocation,
) {
  return openGoogleMapsNavigation(null, customerLocation, false);
}

/**
 * Route preview: vendor/store -> customer, shown as a route overview rather than
 * pretending the rider is starting at the vendor.
 */
export async function previewVendorToCustomer(
  vendorLocation: NavigationLocation,
  customerLocation: NavigationLocation,
) {
  return openGoogleMapsNavigation(vendorLocation, customerLocation, false);
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
