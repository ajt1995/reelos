import test from 'node:test';
import assert from 'node:assert';
import { audioIntelligence } from './services/audio-intelligence.mjs';
import { handleAndroidClientRoute } from './services/android-client-service.mjs';
import fs from 'node:fs';

test('TV D-pad spatial navigation event handlers', () => {
    const code = fs.readFileSync('src/components/tv-view.tsx', 'utf8');
    // We check if it handles ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Enter, Escape, Backspace
    assert.ok(code.includes('e.key === "ArrowUp"'), 'Handles ArrowUp');
    assert.ok(code.includes('e.key === "ArrowDown"'), 'Handles ArrowDown');
    assert.ok(code.includes('e.key === "ArrowLeft"'), 'Handles ArrowLeft');
    assert.ok(code.includes('e.key === "ArrowRight"'), 'Handles ArrowRight');
    assert.ok(code.includes('e.key === "Enter"'), 'Handles Enter');
    assert.ok(code.includes('e.key === "Escape" || e.key === "Backspace"'), 'Handles Escape/Backspace');
});

test('Night Mode dynamics compression settings', () => {
    const profile = audioIntelligence.getSmartNightModeProfile();
    assert.strictEqual(profile.compressionProfile, 'heavy', 'Uses heavy compression');
    assert.strictEqual(profile.vocalBoostDb, 5, 'Boosts vocals by 5dB');
    assert.strictEqual(profile.lfeClampDb, -10, 'Clamps LFE by -10dB');
});

test('Android client route responses', async () => {
    const mockRes = {
        statusCode: 0,
        headers: {},
        body: '',
        writeHead(code, headers) {
            this.statusCode = code;
            this.headers = headers;
        },
        end(data) {
            this.body = data;
        }
    };
    
    // Scan
    const req1 = { method: 'GET', url: '/api/apps/android/scan' };
    await handleAndroidClientRoute(req1, mockRes, new URL('http://127.0.0.1/api/apps/android/scan'));
    assert.strictEqual(mockRes.statusCode, 200, 'Scan should return 200');
    assert.ok(mockRes.body.includes('192.168.1.95'), 'Should list the target living room TV');

    // Sideload Push
    const req2 = { 
        method: 'POST', 
        url: '/api/apps/android/sideload-push',
        [Symbol.asyncIterator]: async function* () {
            yield Buffer.from(JSON.stringify({ ip: '192.168.1.95', port: 5555 }));
        }
    };
    await handleAndroidClientRoute(req2, mockRes, new URL('http://127.0.0.1/api/apps/android/sideload-push'));
    assert.notStrictEqual(mockRes.statusCode, 200, 'An unverified sideload must not return success');
    // Returns valid status object indicating outcome
    const resBody = JSON.parse(mockRes.body);
    assert.strictEqual(resBody.ok, false, 'ADB push must stay failed until a real install is verified');
});
