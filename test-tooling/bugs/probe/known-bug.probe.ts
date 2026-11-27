// Playwright tests that exercise knownBug, run only by ../known-bug.toolingtest.ts through
// ./playwright.config.ts, which reads each test's final outcome. Uses Playwright's own `test` and a
// local bug list, so it needs neither the suite's fixtures nor its environment.
import { expect, test } from '@playwright/test';
import { createKnownBug } from '../known-bug';

const knownBug = createKnownBug<string>({
  'probe-open': { title: 'Open probe bug', priority: 'low', status: 'open' },
  'probe-fixed': { title: 'Fixed probe bug', priority: 'low', status: 'fixed' },
});

test('open bug that still fails', async () => {
  await knownBug('probe-open', async () => {
    throw new Error('still broken');
  });
});

test('open bug that passes', async () => {
  await knownBug('probe-open', async () => {});
});

test('fixed bug that fails again', async () => {
  await knownBug('probe-fixed', async () => {
    throw new Error('back again');
  });
});

test('fixed bug that passes', async () => {
  await knownBug('probe-fixed', async () => {});
});

test('a thrown non-Error', async () => {
  await knownBug('probe-fixed', async () => {
    throw 'plain string';
  });
});

test('an unknown bug id', async () => {
  await knownBug('no-such-bug', async () => {});
});

test('a soft failure before a present bug', async () => {
  expect.soft(1, 'unrelated regression').toBe(2);
  await knownBug('probe-open', async () => {
    throw new Error('still broken');
  });
});

test('a soft failure inside the callback', async () => {
  await knownBug('probe-open', async () => {
    expect.soft(1, 'the bug, as a soft assertion').toBe(2);
  });
});
