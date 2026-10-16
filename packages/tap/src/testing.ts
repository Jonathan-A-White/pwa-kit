// @pwa-kit/tap/testing: a double tap for a test. It imports nothing: jsdom's DOM is used as it stands, and a Playwright
// page and locator are typed by the little each needs, so pwa-kit depends on neither.

export interface TwoTapsOptions {
  /** Time between the two taps. The Tester's double taps were about 120 ms apart. Default 120. */
  gapMs?: number;
  /** How to wait gapMs. Default a real `setTimeout`; a test on `vi.useFakeTimers()` passes `vi.advanceTimersByTimeAsync`. */
  wait?: (ms: number) => Promise<unknown>;
}

const sleep = (ms: number): Promise<void> =>
  // a real wait between two taps: the default for a test on real timers
  new Promise((done) => setTimeout(done, ms));

function tap(el: Element): void {
  const init = { bubbles: true, cancelable: true, composed: true, button: 0, pointerId: 1, pointerType: 'touch', isPrimary: true };
  // jsdom may lack PointerEvent; a MouseEvent of the same type reaches the same listeners
  const make = (type: string): Event => (typeof PointerEvent === 'function' ? new PointerEvent(type, init) : new MouseEvent(type, init));
  el.dispatchEvent(make('pointerdown'));
  el.dispatchEvent(make('pointerup'));
  el.dispatchEvent(new MouseEvent('click', init));
}

/**
 * For jsdom: taps `first` (pointerdown, pointerup, click), waits `gapMs`, then calls `under()` for what now sits under
 * the thumb and taps that. jsdom has no `elementFromPoint`, so the test names it. Returns `{ second }`: the element
 * tapped, or null when `under()` found none (nothing was tapped).
 */
export async function twoTaps(
  first: Element,
  under: () => Element | null,
  { gapMs = 120, wait = sleep }: TwoTapsOptions = {},
): Promise<{ second: Element | null }> {
  tap(first);
  await wait(gapMs);
  const second = under();
  if (second) tap(second);
  return { second };
}

/** What `twoTapsAt` needs of a Playwright `Page`. */
export interface TapPage {
  mouse: { click(x: number, y: number): Promise<void> };
}

/** What `twoTapsAt` needs of a Playwright `Locator`. */
export interface TapLocator {
  boundingBox(): Promise<{ x: number; y: number; width: number; height: number } | null>;
}

/**
 * For Playwright: two `page.mouse` clicks at the locator's centre, `gapMs` apart, so the second lands where the view
 * has moved to. Throws when the locator has no bounding box (it is not on the page).
 */
export async function twoTapsAt(
  page: TapPage,
  locator: TapLocator,
  { gapMs = 120 }: Pick<TwoTapsOptions, 'gapMs'> = {},
): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('twoTapsAt: the locator has no bounding box (it is not on the page)');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  await sleep(gapMs);
  await page.mouse.click(x, y);
}
