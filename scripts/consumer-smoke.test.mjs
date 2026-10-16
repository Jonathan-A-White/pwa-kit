// The consumer smoke test (scripts/consumer-smoke.mjs): installs pwa-kit from a fresh clone into a scratch
// directory, as an app does, and from there keeps a tip's dismissal and renders What's new with the app's React. It
// needs the network or a warm npm cache, because the install runs the build with devDependencies; set
// PWA_KIT_SKIP_SMOKE=1 to leave it out offline.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('./consumer-smoke.mjs', import.meta.url));

describe.skipIf(process.env.PWA_KIT_SKIP_SMOKE === '1')('a consumer install of pwa-kit', () => {
  it('installs from git, keeps a tip dismissed, renders What\'s new and runs test-preset, alive, tap, day and launch-gate', () => {
    let output = '';
    try {
      output = execFileSync('node', [script], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 540_000 });
    } catch (err) {
      const e = /** @type {{ stdout?: string, stderr?: string }} */ (err);
      throw new Error(`consumer smoke test failed:\n${e.stdout ?? ''}\n${e.stderr ?? ''}`);
    }
    expect(output).toContain('the exports map names the eleven entry points');
    expect(output).toContain('pwa-kit/tips imports');
    expect(output).toContain('pwa-kit/test-preset imports');
    expect(output).toContain('pwa-kit/whats-new renders');
    expect(output).toContain('pwa-kit/alive imports');
    expect(output).toContain('pwa-kit/tap imports');
    expect(output).toContain('pwa-kit/day imports');
    expect(output).toContain('pwa-kit/launch-gate imports');
    expect(output).toContain('consumer smoke test passed');
  }, 600_000);
});
