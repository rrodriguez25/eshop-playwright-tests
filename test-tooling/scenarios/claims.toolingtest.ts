import assert from 'node:assert/strict';
import { test } from 'node:test';
import { claims } from './claims';

test('adds a tag and an annotation per id', () => {
  assert.deepEqual(claims(['CAT-READ-A', 'CAT-READ-B'], 'api'), {
    tag: ['@CAT-READ-A', '@CAT-READ-B'],
    annotation: [
      { type: 'scenario', description: 'CAT-READ-A api' },
      { type: 'scenario', description: 'CAT-READ-B api' },
    ],
  });
});

test('keeps existing tag and annotation', () => {
  const details = claims('CAT-READ-A', 'ui', {
    tag: '@smoke',
    annotation: { type: 'issue', description: 'x' },
  });

  assert.deepEqual(details, {
    tag: ['@smoke', '@CAT-READ-A'],
    annotation: [{ type: 'issue', description: 'x' }, { type: 'scenario', description: 'CAT-READ-A ui' }],
  });
});

test('accepts a single id string', () => {
  assert.deepEqual(claims('CAT-READ-A', 'ui').tag, ['@CAT-READ-A']);
});

test('does not duplicate a tag already present', () => {
  assert.deepEqual(claims(['CAT-READ-A'], 'api', { tag: ['@CAT-READ-A'] }).tag, ['@CAT-READ-A']);
});
