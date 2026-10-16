# @pwa-kit/alive

`useAlive()`: a guard for a React `setState` that runs after an await, when the component may have unmounted. One small
hook; no wrapper around `setState`. React 18 or later is an optional peer dependency.

## Install

From GitHub, by pinned commit (there is no registry; `prepare` builds the libraries on install). The repo's
[README](../../README.md#install) has the full SHA to pin and the npm 11 `allowScripts` note.

```bash
npm install github:Jonathan-A-White/pwa-kit#<full commit SHA>
```

## Use

```tsx
import { useEffect, useState } from 'react';
import { useAlive } from 'pwa-kit/alive';

function Profile({ url }: { url: string }) {
  const alive = useAlive();
  const [x, setX] = useState<string | null>(null);
  useEffect(() => {
    fetch(url)
      .then((r) => r.text())
      .then((x) => {
        if (alive()) setX(x); // dropped when the screen has closed
      });
  }, [url, alive]);
  return <p>{x}</p>;
}
```

`useAlive()` returns `alive(): boolean`: true while the component is mounted, false once it has unmounted (the effect's
cleanup sets it). The function is the same on every render, so it can sit in an effect's dependencies. It guards the
unmount, not a change of `url`: for that, ignore the stale answer in the effect's own cleanup.

Why it matters in tests: a promise that settles after vitest has removed jsdom's `window` throws `window is not defined`
from React's `setState` as an unhandled rejection. Pair it with `settleAfterTeardown` from `pwa-kit/test-preset`
to check a screen drops what answers after it has closed.
