# Changelog: @pwa-kit/alive

Newest first. Breaking changes come first in a release, each with its migration in one sentence.

## 0.1.0 (2026-10-16)

- New: `useAlive()`: returns a stable `alive()` that is true while the component is mounted and false once it has
  unmounted, to guard a `setState` that runs after an await (mw-eo6dj9.1).
