// Run only by known-bug-outcomes.suite.spec.ts through probe.config.ts, which reads each test's
// final outcome. Imports Playwright's own `test`: these probes must not load the suite's fixtures
// (and their environment settings).
import { expect, test } from '@playwright/test';
import { createKnownBug } from '../../../fixtures/known-bug';

const knownBug = createKnownBug<string>({ 'probe-open': { title: 'Probe bug', priority: 'low', status: 'open' } });

test('present bug alone', async () => {
  await knownBug('probe-open', async () => {
    throw new Error('still broken');
  });
});

test('soft failure before a present bug', async () => {
  expect.soft(1, 'unrelated regression').toBe(2);
  await knownBug('probe-open', async () => {
    throw new Error('still broken');
  });
});

test('soft failure inside the callback', async () => {
  await knownBug('probe-open', async () => {
    expect.soft(1, 'the bug, as a soft assertion').toBe(2);
  });
});
