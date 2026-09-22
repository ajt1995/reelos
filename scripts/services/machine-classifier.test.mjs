import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { 
  classifyMachine, 
  isDedicatedMachine, 
  setDedicatedOverride,
  getForeignProcesses
} from './machine-classifier.mjs';

test('Machine Classifier Tests', async (t) => {

  await t.test('override dedicated flag works', () => {
    setDedicatedOverride(true);
    assert.strictEqual(classifyMachine(), 'DEDICATED_APPLIANCE');
    assert.strictEqual(isDedicatedMachine(), true);
    
    setDedicatedOverride(false);
    assert.strictEqual(classifyMachine(), 'SHARED_WORKSTATION');
    assert.strictEqual(isDedicatedMachine(), false);
    
    setDedicatedOverride(null); // reset
  });

  await t.test('environment variable REELOS_DEDICATED takes precedence', () => {
    process.env.REELOS_DEDICATED = '1';
    assert.strictEqual(classifyMachine(), 'DEDICATED_APPLIANCE');
    
    process.env.REELOS_DEDICATED = '0';
    assert.strictEqual(classifyMachine(), 'SHARED_WORKSTATION');
    
    delete process.env.REELOS_DEDICATED;
  });

  await t.test('system-config.json overrides', () => {
    const testDir = '.reelos-state';
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);
    const configPath = path.join(testDir, 'system-config.json');
    
    fs.writeFileSync(configPath, JSON.stringify({ forceDedicated: true }));
    assert.strictEqual(classifyMachine(), 'DEDICATED_APPLIANCE');

    fs.writeFileSync(configPath, JSON.stringify({ forceShared: true }));
    assert.strictEqual(classifyMachine(), 'SHARED_WORKSTATION');

    fs.unlinkSync(configPath);
  });
  
  await t.test('getForeignProcesses returns an array', () => {
    const procs = getForeignProcesses();
    assert.ok(Array.isArray(procs));
  });

});
