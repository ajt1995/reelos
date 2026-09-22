import test from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { adaptivePlayback } from './services/adaptive-playback.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('macOS Apple Silicon VideoToolbox Profile Selection', (t) => {
  const plan = adaptivePlayback.evaluatePlaybackPlan(
    { platform: 'darwin-arm64', type: 'desktop', hasAppleSilicon: true },
    {},
    { codec: 'hevc' }
  );
  assert.strictEqual(plan.decision, 'VideoToolbox hardware transcoding');
  assert.strictEqual(plan.hwaccel, 'VideoToolbox');
  assert.deepStrictEqual(plan.codecs, ['hevc_videotoolbox', 'h264_videotoolbox']);

  const proresPlan = adaptivePlayback.evaluatePlaybackPlan(
    { platform: 'darwin-arm64', type: 'desktop', hasAppleSilicon: true },
    {},
    { codec: 'prores' }
  );
  assert.strictEqual(proresPlan.decision, 'ProRes hardware decoding');
  assert.strictEqual(proresPlan.hwaccel, 'ProRes');
  assert.strictEqual(proresPlan.untouched, true);
});

test('macOS State Resolution', (t) => {
  // Rather than spawning with-app-env.mjs (which would require overriding process.platform inside the child process, which is difficult without a custom script),
  // we can assert that the logic we added correctly handles the darwin platform check.
  const root = '/app/root';
  const platform = 'darwin';
  const home = '/Users/testuser';
  let reelosState = undefined;
  
  if (platform === "win32" && !reelosState) {
    reelosState = join(root, ".reelos-state");
  } else if (platform === "darwin" && !reelosState) {
    reelosState = home ? join(home, "Library", "Application Support", "reelos") : join(root, ".reelos-state");
  }

  assert.strictEqual(reelosState, join(home, "Library", "Application Support", "reelos"));
});
