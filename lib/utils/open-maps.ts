import { Linking, Platform } from 'react-native';

const GOOGLE_MAPS_SEARCH = 'https://www.google.com/maps/search/?api=1&query=';

/**
 * Open Google Maps with the given location string (place name or address).
 * On native: opens Maps app if available, else browser.
 * On web: opens in new tab.
 */
export function openLocationInMaps(location: string): void {
  const trimmed = location?.trim();
  if (!trimmed) return;
  const url = `${GOOGLE_MAPS_SEARCH}${encodeURIComponent(trimmed)}`;
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    Linking.openURL(url).catch(() => {});
  }
}
