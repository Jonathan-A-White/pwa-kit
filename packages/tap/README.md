# @pwa-kit/tap

A shared tap guard for a touch screen, and a two-tap helper to test it. React 18 or later is an optional peer dependency
(the core, `createTapGuard`, needs none).

The bug it fixes: a tap that opens a sheet, closes one or moves the view puts a different control under the thumb, and
the second tap of a double tap (about 120 ms later) lands on it: the sheet opens and its backdrop closes it again, or the
next card's option takes the tap that was meant for Next. A deliberate tap is never that quick.

## Install

From GitHub, by pinned commit (there is no registry; `prepare` builds the libraries on install). The repo's
[README](../../README.md#install) has the full SHA to pin and the npm 11 `allowScripts` note.

```bash
npm install github:Jonathan-A-White/pwa-kit#<full commit SHA>
```

## Use

`pwa-kit/tap`: wrap every control that opens, closes or moves the view in one guard per screen.

```tsx
import { useState } from 'react';
import { useSettled, useTapGuard } from 'pwa-kit/tap';

function Screen() {
  const guard = useTapGuard(); // one guard per mounted screen
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={guard(() => setOpen(true))}>Open</button>
      {open && (
        <div className="backdrop" onClick={guard(() => setOpen(false))}>
          <Sheet />
        </div>
      )}
    </>
  );
}

// A control that is drawn where another one sat ignores taps while it is new.
function Card({ question, onNext }: { question: string; onNext: () => void }) {
  const settled = useSettled(question); // the clock restarts when the question changes
  return <button onClick={() => settled() && onNext()}>Next</button>;
}
```

- `createTapGuard({ settleMs })` returns `guard(handler)`: a wrapped handler that runs at most once within `settleMs`
  (default 300) of the last call the guard accepted. One guard shared by every view-changing control swallows the second
  tap of a double tap wherever it lands. No React needed.
- `useTapGuard(options)` is one guard for a mounted screen: the same on every render.
- `useSettled(key)` returns `settled()`: false until the control has been up for 300 ms; the clock restarts when `key`
  changes. The function is the same on every render.
- `tapSettings.ms` is the one seam: a test or an e2e run may set it (0 = no settle, so a step may tap the instant a
  control is drawn); it defaults to 300. In a browser it starts from `localStorage['pwa-kit:tapSettleMs']` when that holds
  a number of 0 or more, so a Playwright spec can start at 0 with `page.addInitScript`. A test of the guard itself sets
  it back to `TAP_SETTLE_MS`.

The clock is `performance.now()`, never the wall clock: a clock that steps back must not stretch or end the moment.

## Test it

`pwa-kit/tap/testing` imports nothing, so it adds no Playwright or testing-library dependency.

```tsx
import { twoTaps } from 'pwa-kit/tap/testing';

it('keeps the sheet open on a double tap', async () => {
  render(<Screen />);
  await twoTaps(screen.getByText('Open'), () => screen.queryByTestId('backdrop')); // what now sits under the thumb
  expect(screen.getByTestId('backdrop')).toBeTruthy();
});
```

```ts
import { twoTapsAt } from 'pwa-kit/tap/testing';

test('keeps the sheet open on a double tap', async ({ page }) => {
  await twoTapsAt(page, page.getByRole('button', { name: 'Open' })); // two page.mouse clicks at its centre, 120 ms apart
  await expect(page.getByTestId('backdrop')).toBeVisible();
});
```

- `twoTaps(first, under, { gapMs = 120, wait })` (jsdom): dispatches pointerdown, pointerup and click on `first`, waits
  `gapMs`, calls `under()` for what now sits under the thumb (jsdom has no `elementFromPoint`, so the test names it) and
  taps that. Returns `{ second }`: the element tapped, or null. On `vi.useFakeTimers()` pass
  `wait: vi.advanceTimersByTimeAsync`.
- `twoTapsAt(page, locator, { gapMs = 120 })` (Playwright): two `page.mouse` clicks at the locator's centre, `gapMs`
  apart. `page` and `locator` are typed by the little each needs.

Run the test without the guard to see the bug (the sheet closes), then with it.
