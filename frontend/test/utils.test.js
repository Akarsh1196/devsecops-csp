import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterIncidents,
  formatStatus,
  getInitials,
} from '../src/utils.js';

const incidents = [
  { title: 'Checkout API errors', description: 'Elevated 500 responses', assignee: 'Priya Shah', status: 'OPEN', priority: 'HIGH' },
  { title: 'Rotate staging secret', description: '', assignee: 'Nensi Ravaliya', status: 'IN_PROGRESS', priority: 'MEDIUM' },
  { title: 'Update runbook', description: 'Document the recovery path', assignee: '', status: 'RESOLVED', priority: 'LOW' },
];

test('filters incidents by text across title, description, and owner', () => {
  assert.deepEqual(filterIncidents(incidents, { query: 'recovery' }), [incidents[2]]);
  assert.deepEqual(filterIncidents(incidents, { query: 'PRIYA' }), [incidents[0]]);
});

test('combines status and priority filters and returns all incidents by default', () => {
  assert.equal(filterIncidents(incidents).length, 3);
  assert.deepEqual(filterIncidents(incidents, { status: 'OPEN', priority: 'HIGH' }), [incidents[0]]);
  assert.deepEqual(filterIncidents(incidents, { status: 'OPEN', priority: 'LOW' }), []);
});

test('formats display values for known and incomplete records', () => {
  assert.equal(formatStatus('IN_PROGRESS'), 'In progress');
  assert.equal(formatStatus('UNKNOWN_STATUS'), 'UNKNOWN STATUS');
  assert.equal(getInitials('Priya Shah'), 'PS');
  assert.equal(getInitials(''), '—');
  assert.equal(getInitials(undefined), '—');
});
