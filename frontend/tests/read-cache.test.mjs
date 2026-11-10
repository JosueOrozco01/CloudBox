import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadCache } from '../src/services/readCache.js';

const options = token => ({ headers: { Authorization: `Bearer ${token}` } });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('parallel readers share one request and can consume independent response bodies', async () => {
  let requests = 0;
  const cache = createReadCache();
  const gate = deferred();
  const fetcher = async () => { requests++; await gate.promise; return Response.json({ value: 42 }); };
  const first = cache.fetch('/api/files', options('one'), fetcher);
  const second = cache.fetch('/api/files', options('one'), fetcher);
  gate.resolve();
  assert.deepEqual(await Promise.all([first, second].map(async response => (await response).json())), [{ value: 42 }, { value: 42 }]);
  assert.equal(requests, 1);
});

test('cached reads expire, stay separate between accounts, and can be forced fresh', async () => {
  let time = 0, requests = 0;
  const cache = createReadCache({ now: () => time, ttl: 100 });
  const fetcher = async () => Response.json({ request: ++requests });
  await cache.fetch('/api/files', options('one'), fetcher);
  await cache.fetch('/api/files', options('one'), fetcher);
  assert.equal(requests, 1);
  await cache.fetch('/api/files', options('two'), fetcher);
  assert.equal(requests, 2);
  time = 101;
  await cache.fetch('/api/files', options('one'), fetcher);
  assert.equal(requests, 3);
  await cache.fetch('/api/files', { ...options('one'), cache: 'no-store' }, fetcher);
  assert.equal(requests, 4);
});

test('mutations prevent an older in-flight read from repopulating the cache', async () => {
  const cache = createReadCache();
  const gate = deferred();
  let requests = 0;
  const old = cache.fetch('/api/files', options('one'), async () => { await gate.promise; return Response.json({ old: true }); });
  await cache.fetch('/api/files/1', { method: 'PATCH' }, async () => Response.json({ success: true }));
  gate.resolve(); await old;
  const fresh = await cache.fetch('/api/files', options('one'), async () => { requests++; return Response.json({ old: false }); });
  assert.deepEqual(await fresh.json(), { old: false });
  assert.equal(requests, 1);
});

test('signed URLs, live inboxes, failed responses and abortable reads are never reused', async () => {
  const cache = createReadCache();
  let requests = 0;
  const fetcher = async () => { requests++; return Response.json({ success: true }); };
  for (const path of ['/api/files/1/download-url', '/api/shares/files/1/download-url', '/api/notifications', '/api/admin/audit-logs', '/api/auth/session']) {
    const before = requests;
    await cache.fetch(path, options('one'), fetcher);
    await cache.fetch(path, options('one'), fetcher);
    assert.equal(requests - before, 2, path);
  }
  const before = requests;
  for (let i = 0; i < 2; i++) await cache.fetch('/api/fail', options('one'), async () => { requests++; return Response.json({}, { status: 500 }); });
  assert.equal(requests - before, 2);
  const controller = new AbortController();
  const abortable = { ...options('one'), signal: controller.signal };
  const start = requests;
  await cache.fetch('/api/files', abortable, fetcher);
  await cache.fetch('/api/files', abortable, fetcher);
  assert.equal(requests - start, 2);
});

test('cache eviction bounds the number of retained responses', async () => {
  const cache = createReadCache({ maxEntries: 2 });
  let requests = 0;
  const fetcher = async () => { requests++; return Response.json({}); };
  for (const path of ['/api/a', '/api/b', '/api/c', '/api/a']) await cache.fetch(path, options('one'), fetcher);
  assert.equal(requests, 4);
});
