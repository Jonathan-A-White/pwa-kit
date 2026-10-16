// @pwa-kit/alive: useAlive(), a guard for a React setState that runs after an await.
import { useCallback, useEffect, useRef } from 'react';

/**
 * Returns `alive()`: true while the component is mounted, false once it has unmounted (the effect's cleanup sets it).
 * The function is the same on every render, so it can sit in an effect's dependencies. Call it after an await, before
 * a setState: `fetch(url).then((x) => { if (alive()) setX(x); })`.
 */
export function useAlive(): () => boolean {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true; // again after StrictMode's mount, cleanup, mount
    return () => {
      mounted.current = false;
    };
  }, []);
  return useCallback(() => mounted.current, []);
}
