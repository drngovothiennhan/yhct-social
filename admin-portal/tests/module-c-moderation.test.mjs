import test from 'node:test';
import assert from 'node:assert/strict';
import { assertModerationTransition, targetStatusForAction } from '../lib/moderation.ts';
import { buildAuditEvent } from '../lib/audit.ts';

test('resolved reports cannot be resolved again', () => {
  assert.throws(() => assertModerationTransition({ reportStatus: 'resolved', action: 'hide' }), /conflict/i);
});

test('moderation resolutions map to deterministic content state', () => {
  assert.equal(targetStatusForAction('keep'), null);
  assert.equal(targetStatusForAction('dismiss'), null);
  assert.equal(targetStatusForAction('hide'), 'hidden');
  assert.equal(targetStatusForAction('soft_delete'), 'deleted');
});

test('restore is a separate privileged state transition', () => {
  assert.doesNotThrow(() => assertModerationTransition({ reportStatus: 'resolved', action: 'restore', targetStatus: 'hidden', canRestore: true }));
  assert.throws(() => assertModerationTransition({ reportStatus: 'resolved', action: 'restore', targetStatus: 'hidden', canRestore: false }), /forbidden/i);
});

test('audit event preserves a deterministic operation id and minimal state', () => {
  const event = buildAuditEvent({ operationId: 'op1', actorUid: 'a1', actorRole: 'mod', action: 'moderation.hide', targetType: 'post', targetId: 'p1', reason: 'spam', before: { status: 'active' }, after: { status: 'hidden' } });
  assert.equal(event.operationId, 'op1');
  assert.equal(event.actorUid, 'a1');
  assert.deepEqual(event.before, { status: 'active' });
});
