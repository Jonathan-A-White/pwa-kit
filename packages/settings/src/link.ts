// A link to any setting: the in-app route that opens Settings at that setting's row. The app's Settings screen reads the key back (settingKeyOf), scrolls to
// the row, marks it and shows it though a search or the switch it depends on would hide it (rowsAt). The kit owns the form of the address, not the router.

/** The route the Settings screen is mounted at, unless the app says another. */
export const SETTINGS_ROUTE = '#/settings';

/** The address that opens Settings at the row `key` ('#/settings?setting=ynab'), for a link in text, a button or an assistant's reply. Throws for an empty key. */
export function link(key: string, route: string = SETTINGS_ROUTE): string {
  if (key.trim() === '') throw new Error('a link needs a setting key');
  return `${route}?setting=${encodeURIComponent(key)}`;
}

/** The row an address asks for ('#/settings?setting=ynab' is 'ynab'), or null when it is not an address of `route` or names no row. */
export function settingKeyOf(address: string, route: string = SETTINGS_ROUTE): string | null {
  const q = address.indexOf('?');
  if ((q < 0 ? address : address.slice(0, q)) !== route) return null;
  const key = new URLSearchParams(address.slice(q + 1)).get('setting');
  return key === null || key === '' ? null : key;
}
