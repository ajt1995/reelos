import test from 'node:test';
import assert from 'node:assert';
import { audioIntelligence } from './services/audio-intelligence.mjs';

test('Rating Trigger Threshold', (t) => {
    const shouldTriggerRating = (currentTime, duration) => {
        return duration > 0 && (currentTime / duration) > 0.9;
    };

    assert.strictEqual(shouldTriggerRating(45, 100), false, 'Should not trigger at 45%');
    assert.strictEqual(shouldTriggerRating(89, 100), false, 'Should not trigger at 89%');
    assert.strictEqual(shouldTriggerRating(91, 100), true, 'Should trigger at 91%');
    assert.strictEqual(shouldTriggerRating(99, 100), true, 'Should trigger at 99%');
    assert.strictEqual(shouldTriggerRating(100, 100), true, 'Should trigger at 100%');
});

test('Night Mode compressor node config (AudioIntelligence)', (t) => {
    const profile = audioIntelligence.getSmartNightModeProfile();
    
    assert.strictEqual(profile.name, 'Smart Night Mode DSP');
    assert.strictEqual(profile.compressionProfile, 'heavy');
    assert.strictEqual(profile.vocalBoostDb, 5);
    assert.strictEqual(profile.lfeClampDb, -10);
});
