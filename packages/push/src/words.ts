// The words the app shows, in plain language for a person who does not know what a "push subscription" is. Every one is replaceable
// (createPush's `words`), so an app can say them its own way, in its own language.
export interface PushWords {
  /** The label of the button that turns notifications on. */
  turnOn: string;
  /** The label of the button that turns them off. */
  turnOff: string;
  /** What to say beside the button, before the phone asks its question. */
  ask: string;
  /** The status line while notifications are off but could be turned on. */
  off: string;
  /** The status line while they are on. */
  on: string;
  /** The one line to show when the phone has blocked notifications for this app. */
  denied: string;
  /** The one line to show when this phone or browser cannot receive them (on an iPhone: the app must be on the Home Screen). */
  unsupported: string;
  /** The error to show when the phone's push service would not make the subscription. */
  subscribeFailed: string;
  /** The error to show when the app's backend would not take the subscription. */
  backendFailed: string;
}

export const DEFAULT_WORDS: PushWords = {
  turnOn: 'Notify me',
  turnOff: 'Stop notifying me',
  ask: 'Get a notification on this phone when something needs you. The phone will ask you to allow it.',
  off: 'Notifications are off on this phone.',
  on: 'Notifications are on for this phone.',
  denied: 'Notifications are blocked for this app. Allow them in your phone’s settings for this app, then come back and try again.',
  unsupported:
    'This phone cannot show notifications here. On an iPhone, add the app to your Home Screen first (iOS 16.4 or later), then open it from there.',
  subscribeFailed: 'The phone could not set up notifications. Try again in a moment.',
  backendFailed: 'Notifications could not be set up with the server. Nothing was changed; try again in a moment.',
};
