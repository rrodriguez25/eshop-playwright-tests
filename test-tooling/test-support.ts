import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** A fresh empty directory under the OS temp folder, for one self-test. */
export function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'scenario-tooling-'));
}

/**
 * Writes `content` to `relativePath` under `dir` (a new temp dir when omitted), creating folders on
 * the way. Objects are written as JSON; strings as they are. Returns the file's full path.
 */
export function writeTempFile(relativePath: string, content: unknown, dir: string = makeTempDir()): string {
  const file = join(dir, relativePath);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`);
  return file;
}
