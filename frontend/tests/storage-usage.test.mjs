import test from 'node:test';
import assert from 'node:assert/strict';
import { storagePercentage, formatStorageBytes, formatStoragePercent } from '../src/utils/storageUsage.js';

test('89 KB retains its real fraction of a 1 GB quota when the API rounded it to zero', () => {
  const percent = storagePercentage(89 * 1024, 1024 ** 3, 0);
  assert.ok(percent > 0 && percent < 0.01);
  assert.equal(formatStorageBytes(89 * 1024), '89 KB');
  assert.equal(formatStoragePercent(percent), '<0.1 %');
});
test('empty, half-full and over-quota storage retain their actual meaning', () => {
  assert.equal(storagePercentage(0, 1024 ** 3, 50), 0);
  assert.equal(formatStoragePercent(0), '0 %');
  assert.equal(formatStorageBytes(0), '0 B');
  assert.equal(storagePercentage(512, 1024), 50);
  assert.equal(storagePercentage(2048, 1024), 200);
});
test('missing and invalid storage values do not fabricate sizes or infinite percentages', () => {
  assert.equal(formatStorageBytes(null), '—');
  assert.equal(formatStorageBytes(-1), '—');
  assert.equal(formatStorageBytes(Infinity), '—');
  assert.equal(storagePercentage(1, 0), 0);
  assert.equal(storagePercentage(undefined, undefined, 12.5), 12.5);
  assert.equal(storagePercentage(1, 0, Infinity), 0);
});
test('rounded available capacity uses the next unit instead of displaying 1024 MB', () => {
  assert.equal(formatStorageBytes(1024 ** 3 - 914), '1 GB');
  assert.equal(formatStorageBytes(1024 ** 2 - 1), '1 MB');
  assert.equal(formatStorageBytes(1024 ** 3 - 1024 * 1024), '1,023 MB');
});
