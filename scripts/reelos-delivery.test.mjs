import test from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { scanForDevices, sideloadPush, generateManifest } from './services/android-client-service.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('Windows installer command test - Mode A', (t) => {
    const output = execSync('powershell -ExecutionPolicy Bypass -File .\\build-windows-installer.ps1', { encoding: 'utf8', cwd: __dirname });
    assert.match(output, /Mode A: Native Windows Services/);
    assert.match(output, /Zero-VM overhead/);
});

test('Windows installer command test - Mode B', (t) => {
    const output = execSync('powershell -ExecutionPolicy Bypass -File .\\build-windows-installer.ps1 -ModeB', { encoding: 'utf8', cwd: __dirname });
    assert.match(output, /Mode B: Bare-Metal Debian 12 USB Flasher/);
});

test('ADB discovery payload and manifest', async (t) => {
    const devices = await scanForDevices({ timeoutMs: 100 });
    assert.ok(Array.isArray(devices));
    
    const pushResult = await sideloadPush('192.168.1.100');
    assert.ok(typeof pushResult === 'object');
    assert.strictEqual(typeof pushResult.success, 'boolean');
    
    const manifest = generateManifest();
    assert.strictEqual(manifest['uses-feature'][0].name, 'android.software.leanback');
});
