import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGuardianSummary, periodBucket } from './release-guardian-core.ts';

test('guardian summary is healthy only when no check failed', () => {
  const summary = buildGuardianSummary({ app: { status: 'ok', latencyMs: 4 }, stripe: { status: 'ok', latencyMs: 9 } });
  assert.equal(summary.status, 'ok');
  assert.deepEqual(summary.failed, []);
});

test('guardian summary keeps operational warnings visible without blocking sales', () => {
  const summary = buildGuardianSummary({ redis: { status: 'error', latencyMs: 12, detail: 'redis_timeout' } });
  assert.equal(summary.status, 'ok');
  assert.deepEqual(summary.failed, [{ key: 'redis', detail: 'redis_timeout' }]);
  assert.deepEqual(summary.warnings, [{ key: 'redis', detail: 'redis_timeout' }]);
});

test('guardian deduplication bucket is deterministic', () => {
  const now = new Date('2026-07-22T10:07:31.000Z');
  assert.equal(periodBucket(now), '2026-07-22T10:00:00.000Z');
});
