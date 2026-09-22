import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import { test } from 'node:test';
import { streamLocalFile } from './neural-stream-server.mjs';
import { hasPreparationBlockingPlayback, subscribePreparationBlockingPlayback } from './preparation-activity.mjs';

const keys = ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs'];
function receipt(file) {
  const stat = fs.statSync(file, { bigint: true });
  return Object.fromEntries(keys.map((key) => [key, String(stat[key])]));
}
function fixture(t, bytes = Buffer.from('verified original output bytes')) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'verified-prepared-'));
  const file = path.join(directory, 'output.mp4');
  fs.writeFileSync(file, bytes);
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { file, bytes, expectedFingerprint: receipt(file) };
}
function exchange(method = 'GET', range) {
  const req = Object.assign(new EventEmitter(), { method, headers: range ? { range } : {} });
  const chunks = [], headers = {};
  const res = new Writable({ write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); res.headersSent = true; done(); } });
  Object.assign(res, { headersSent: false, statusCode: 200,
    setHeader(key, value) { headers[key.toLowerCase()] = String(value); },
    removeHeader(key) { delete headers[key.toLowerCase()]; } });
  res.on('error', () => {});
  const closed = new Promise((resolve) => res.once('close', resolve));
  return { req, res, headers, closed, body: () => Buffer.concat(chunks) };
}
async function idle() {
  if (!hasPreparationBlockingPlayback()) return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { unsubscribe(); reject(new Error('Read descriptor activity leaked')); }, 2000);
    const unsubscribe = subscribePreparationBlockingPlayback((blocking) => {
      if (!blocking) { clearTimeout(timer); unsubscribe(); resolve(); }
    });
  });
}
function trackDescriptors(t, file) {
  const opened = [];
  const open = fs.openSync;
  t.mock.method(fs, 'openSync', (target, ...args) => {
    const fd = open(target, ...args);
    if (target === file) opened.push(fd);
    return fd;
  });
  return () => {
    assert(opened.length > 0);
    for (const fd of opened) assert.throws(() => fs.fstatSync(fd), { code: 'EBADF' }, 'Owned descriptor must be closed');
  };
}

test('guarded full/range/HEAD/416 use verified descriptor and leave no activity or handles', async (t) => {
  const value = fixture(t);
  const closedDescriptors = trackDescriptors(t, value.file);
  for (const [method, range, status, expected] of [
    ['GET', undefined, 200, value.bytes], ['GET', 'bytes=2-8', 206, value.bytes.subarray(2, 9)],
    ['HEAD', undefined, 200, Buffer.alloc(0)], ['HEAD', 'bytes=2-8', 206, Buffer.alloc(0)],
    ['GET', 'bytes=999999-', 416, Buffer.alloc(0)],
  ]) {
    const x = exchange(method, range);
    streamLocalFile(x.req, x.res, value.file, 'video/mp4', { expectedFingerprint: value.expectedFingerprint });
    assert.equal(hasPreparationBlockingPlayback(), method === 'GET' && status !== 416);
    await x.closed; await idle();
    assert.equal(x.res.statusCode, status);
    assert.deepEqual(x.body(), expected);
    assert.equal(x.headers['cache-control'], 'private, no-store');
    if (status === 206) assert.equal(x.headers['content-range'], `bytes 2-8/${value.bytes.length}`);
    closedDescriptors();
  }
});

test('replacement before open is denied without bytes or filesystem paths', async (t) => {
  const value = fixture(t), x = exchange();
  fs.renameSync(value.file, `${value.file}.old`);
  fs.writeFileSync(value.file, 'unverified replacement');
  const closedDescriptors = trackDescriptors(t, value.file);
  streamLocalFile(x.req, x.res, value.file, 'video/mp4', { expectedFingerprint: value.expectedFingerprint });
  await x.closed;
  assert.equal(x.res.statusCode, 409);
  assert.equal(JSON.parse(x.body()).code, 'prepared_file_changed');
  assert.equal(x.body().includes(Buffer.from(value.file)), false);
  assert.equal(x.body().includes(Buffer.from('unverified replacement')), false);
  closedDescriptors();
  assert.equal(hasPreparationBlockingPlayback(), false);
});

test('pathname replaced after descriptor verification never supplies replacement bytes', async (t) => {
  const value = fixture(t), x = exchange();
  const closedDescriptors = trackDescriptors(t, value.file);
  const create = fs.createReadStream;
  t.mock.method(fs, 'createReadStream', (file, options) => {
    assert.equal(typeof options.fd, 'number');
    assert.equal(options.autoClose, true);
    fs.renameSync(file, `${file}.old`);
    fs.writeFileSync(file, 'unverified replacement');
    return create(file, options);
  });
  streamLocalFile(x.req, x.res, value.file, 'video/mp4', { expectedFingerprint: value.expectedFingerprint });
  await x.closed; await idle();
  assert.equal(x.res.statusCode, 200);
  assert.deepEqual(x.body(), value.bytes);
  assert.equal(fs.readFileSync(value.file, 'utf8'), 'unverified replacement');
  closedDescriptors();
});

test('missing/malformed guarded receipts never fall back to legacy pathname streaming', async (t) => {
  const value = fixture(t);
  for (const guard of [undefined, null, {}, { expectedFingerprint: null }, { expectedFingerprint: {} },
    { expectedFingerprint: { ...value.expectedFingerprint, size: Number(value.expectedFingerprint.size) } },
    { expectedFingerprint: { ...value.expectedFingerprint, extra: 'unexpected' } }]) {
    const x = exchange();
    streamLocalFile(x.req, x.res, value.file, 'video/mp4', guard);
    await x.closed;
    assert.equal(x.res.statusCode, 409);
    assert.equal(hasPreparationBlockingPlayback(), false);
    assert.equal(x.body().includes(value.bytes), false);
  }
});

test('symbolic links and multiply linked files are rejected even with matching metadata', async (t) => {
  const value = fixture(t);
  const lstat = fs.lstatSync;
  t.mock.method(fs, 'lstatSync', (...args) => {
    const stat = lstat(...args);
    if (args[0] === value.file) stat.isSymbolicLink = () => true;
    return stat;
  });
  let x = exchange();
  streamLocalFile(x.req, x.res, value.file, null, { expectedFingerprint: value.expectedFingerprint });
  await x.closed;
  assert.equal(x.res.statusCode, 409);
  t.mock.restoreAll();
  const closedDescriptors = trackDescriptors(t, value.file);
  const fstat = fs.fstatSync;
  t.mock.method(fs, 'fstatSync', (...args) => { const stat = fstat(...args); stat.nlink = 2n; return stat; });
  x = exchange();
  streamLocalFile(x.req, x.res, value.file, null, { expectedFingerprint: value.expectedFingerprint });
  await x.closed;
  assert.equal(x.res.statusCode, 409);
  closedDescriptors();
  assert.equal(hasPreparationBlockingPlayback(), false);
});

test('abort, response error, read error and synchronous setup failure close descriptors and leases', async (t) => {
  const value = fixture(t, Buffer.alloc(1024 * 1024, 42));
  for (const kind of ['abort', 'already-aborted', 'response-error', 'read-error', 'setup-error']) {
    const closedDescriptors = trackDescriptors(t, value.file);
    const x = exchange(), create = fs.createReadStream;
    if (kind === 'read-error') t.mock.method(fs, 'createReadStream', (...args) => {
      const stream = create(...args);
      queueMicrotask(() => stream.destroy(new Error('isolated read failure')));
      return stream;
    });
    if (kind === 'setup-error') t.mock.method(fs, 'createReadStream', () => { throw new Error('isolated setup failure'); });
    if (kind === 'already-aborted') x.req.aborted = true;
    streamLocalFile(x.req, x.res, value.file, null, { expectedFingerprint: value.expectedFingerprint });
    if (kind === 'abort') x.req.emit('aborted');
    if (kind === 'response-error') x.res.destroy(new Error('isolated response failure'));
    await idle();
    x.res.destroy(); await x.closed;
    closedDescriptors();
    assert.equal(hasPreparationBlockingPlayback(), false, kind);
    if (kind.endsWith('error') && kind !== 'response-error') assert.equal(x.res.statusCode, 503);
    t.mock.restoreAll();
  }
});
