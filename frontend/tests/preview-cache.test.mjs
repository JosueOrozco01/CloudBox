import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { invalidateReadCache } from '../src/services/readCache.js';

test('preview bytes reuse requires the same account and version and follows mutation invalidation', async () => {
  let token = 'account-one', downloads = 0;
  const original = { fetch: globalThis.fetch, storage: globalThis.localStorage };
  globalThis.localStorage = { getItem: () => token };
  const source = (await readFile(new URL('../src/services/previewBodyCache.js', import.meta.url), 'utf8'))
    .replace("'../utils/filePreview'", JSON.stringify(new URL('../src/utils/filePreview.js', import.meta.url).href))
    .replace("'./readCache'", JSON.stringify(new URL('../src/services/readCache.js', import.meta.url).href));
  const { getPreviewBody } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  globalThis.fetch = async () => { downloads++; return new Response('content'); };
  const item = { rawId: 7, name: 'file.txt' };
  const version = { modifiedAt: '2026-11-09T12:00:00', size: 7, url: 'https://storage.test/file?token=new' };
  try {
    assert.equal(await (await getPreviewBody(item, version, 100)).text(), 'content');
    await getPreviewBody(item, { ...version, url: 'https://storage.test/file?token=different' }, 100);
    assert.equal(downloads, 1);
    await getPreviewBody(item, { ...version, modifiedAt: '2026-11-09T12:01:00' }, 100);
    assert.equal(downloads, 2);
    token = 'account-two';
    await getPreviewBody(item, version, 100);
    assert.equal(downloads, 3);
    invalidateReadCache();
    await getPreviewBody(item, version, 100);
    assert.equal(downloads, 4);
    await getPreviewBody(item, { url: version.url }, 100);
    await getPreviewBody(item, { url: version.url }, 100);
    assert.equal(downloads, 6, 'an unversioned response must not be cached');
  } finally {
    globalThis.fetch = original.fetch;
    globalThis.localStorage = original.storage;
  }
});
