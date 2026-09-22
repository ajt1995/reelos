import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONSOLE_OUIS,
  ConsoleSentinel,
  evaluateBufferbloat,
  identifyConsoleVendor,
  parseArpTable,
} from './console-sentinel.mjs';

test('identifyConsoleVendor identifies PlayStation, Xbox, and Switch', () => {
  assert.equal(identifyConsoleVendor('00:04:1F:11:22:33'), 'playstation');
  assert.equal(identifyConsoleVendor('F8-46-1C-AA-BB-CC'), 'playstation');
  assert.equal(identifyConsoleVendor('00:50:F2:44:55:66'), 'xbox');
  assert.equal(identifyConsoleVendor('98:B6:E9:77:88:99'), 'switch');
  assert.equal(identifyConsoleVendor('AA:BB:CC:DD:EE:FF'), null);
});

test('parseArpTable extracts console devices', () => {
  const sampleArp = `
Interface: 192.168.1.100 --- 0x12
  Internet Address      Physical Address      Type
  192.168.1.1           00-11-22-33-44-55     dynamic
  192.168.1.50          00-04-1f-ab-cd-ef     dynamic
  192.168.1.60          98-b6-e9-12-34-56     dynamic
  192.168.1.200         aa-bb-cc-dd-ee-ff     dynamic
  `;
  const devices = parseArpTable(sampleArp);
  assert.equal(devices.length, 4);
  const consoles = devices.filter((d) => d.isConsole);
  assert.equal(consoles.length, 2);
  assert.equal(consoles[0].vendor, 'playstation');
  assert.equal(consoles[1].vendor, 'switch');
});

test('evaluateBufferbloat detects latency spikes', () => {
  const normal = evaluateBufferbloat(20, 28, 15);
  assert.equal(normal.spikeDetected, false);
  assert.equal(normal.delta, 8);

  const spiked = evaluateBufferbloat(20, 42, 15);
  assert.equal(spiked.spikeDetected, true);
  assert.equal(spiked.delta, 22);
});

test('ConsoleSentinel dispatches CONSOLES_GAMING_YIELD on ping spike when console is active', () => {
  const sentinel = new ConsoleSentinel({ thresholdMs: 15, baselineRtt: 20, cooldownMs: 100 });
  let yieldFired = false;
  sentinel.on('CONSOLES_GAMING_YIELD', () => {
    yieldFired = true;
  });

  sentinel.registerConsole('192.168.1.50', 'playstation');
  assert.equal(sentinel.getStatus().consolesCount, 1);

  // Normal ping
  sentinel.evaluatePing(25);
  assert.equal(yieldFired, false);
  assert.equal(sentinel.getStatus().yieldActive, false);

  // Spiked ping > 15ms
  sentinel.evaluatePing(45);
  assert.equal(yieldFired, true);
  assert.equal(sentinel.getStatus().yieldActive, true);
});

test('parseArpTable handles Linux /proc/net/arp with intermediate flag columns', () => {
  const linuxArp = `
IP address       HW type     Flags       HW address            Mask     Device
192.168.1.1      0x1         0x2         00:11:22:33:44:55     *        eth0
192.168.1.75     0x1         0x2         70:9e:29:12:34:56     *        wlan0
192.168.1.90     0x1         0x2         00:50:f2:99:88:77     *        eth0
`;
  const devices = parseArpTable(linuxArp);
  assert.equal(devices.length, 3);
  const ps = devices.find((d) => d.ip === '192.168.1.75');
  assert.ok(ps);
  assert.equal(ps.isConsole, true);
  assert.equal(ps.vendor, 'playstation');

  const xb = devices.find((d) => d.ip === '192.168.1.90');
  assert.ok(xb);
  assert.equal(xb.isConsole, true);
  assert.equal(xb.vendor, 'xbox');
});

test('ConsoleSentinel autonomous ping loop and simulateConsoleYield', async () => {
  const sentinel = new ConsoleSentinel({ thresholdMs: 15, baselineRtt: 18, cooldownMs: 50 });
  let yielded = false;
  let resumed = false;
  sentinel.on('CONSOLES_GAMING_YIELD', () => { yielded = true; });
  sentinel.on('CONSOLES_GAMING_RESUME', () => { resumed = true; });

  // Simulate console yield
  sentinel.simulateConsoleYield(50, 'playstation');
  assert.equal(yielded, true);
  assert.equal(sentinel.getStatus().yieldActive, true);

  // Simulate console resume
  sentinel.simulateConsoleResume(18);
  assert.equal(resumed, true);
  assert.equal(sentinel.getStatus().yieldActive, false);

  // Ping loop start & stop
  let pings = 0;
  sentinel.startPingLoop(20, async () => {
    pings++;
    return 18;
  });
  assert.equal(sentinel.getStatus().pingLoopActive, true);

  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.ok(pings >= 1);
  sentinel.stopPingLoop();
  assert.equal(sentinel.getStatus().pingLoopActive, false);
});
