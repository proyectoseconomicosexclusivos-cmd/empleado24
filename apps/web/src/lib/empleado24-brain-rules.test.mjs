import assert from 'node:assert/strict';
import test from 'node:test';
import { automationForBrainEvent } from './empleado24-brain-rules.ts';

test('Brain asigna un lead al Closer', () => {
  assert.deepEqual(automationForBrainEvent('LeadCreated'), { employeeType: 'closer', taskType: 'follow_up', title: 'Revisar nuevo cliente interesado' });
});

test('Brain no inventa automatizaciones para eventos desconocidos', () => {
  assert.equal(automationForBrainEvent('Unknown'), null);
});
