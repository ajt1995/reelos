import assert from 'node:assert/strict';
import test from 'node:test';
import { TranscodeRelayService, detectHardwareTier } from './transcode-relay-service.mjs';

test('TranscodeRelayService stream-selection preemption', async () => {
  const service = new TranscodeRelayService({
    torBoxMesh: {
      async findCachedAlternative(infohash, res) {
        if (res === '1080p') return { infohash: 'altHash123' };
        return null;
      }
    }
  });

  const res = await service.evaluateTranscodeJob({ infohash: 'orig123', targetResolution: '1080p' });
  assert.equal(res.action, 'DIRECT_PLAY_ALTERNATIVE');
  assert.equal(res.infohash, 'altHash123');
});

test('TranscodeRelayService gaming yield', async () => {
  const service = new TranscodeRelayService({
    arbiter: { activeState: 'GAMING_YIELD' }
  });

  const res = await service.evaluateTranscodeJob({ infohash: 'orig123', targetResolution: '4k' });
  assert.equal(res.action, 'FORCE_DIRECT_PLAY');
  assert.equal(res.reason, 'Silent Gaming Yield');
  
  const caps = service.getCapabilities();
  assert.equal(caps.gamingYieldActive, true);
  assert.equal(caps.localTranscodeAllowed, false);
});
