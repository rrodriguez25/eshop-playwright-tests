import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Credentials, IdentityClient } from './identity-client';

/**
 * One logged-in session per user per worker. The first test in a worker that needs a user logs
 * them in and saves the session to `<dir>/<key>-<workerIndex>.json`; later tests in that worker
 * reuse the file. Each worker logs in fresh, so a session never outlives the run that made it.
 */
export class SessionStore {
  private readonly files = new Map<string, Promise<string>>();

  constructor(
    private readonly identity: IdentityClient,
    private readonly dir: string,
    private readonly workerIndex: number,
  ) {}

  /** Path of the user's session file, logging them in on first use in this worker. */
  sessionFile(key: string, credentials: Credentials): Promise<string> {
    let file = this.files.get(key);
    if (file === undefined) {
      file = this.logIn(key, credentials);
      this.files.set(key, file);
      // A failed login isn't cached, so the next test tries again and reports its own error.
      file.catch(() => this.files.delete(key));
    }
    return file;
  }

  private async logIn(key: string, credentials: Credentials): Promise<string> {
    const state = await this.identity.logIn(credentials);
    const file = path.join(this.dir, `${key}-${this.workerIndex}.json`);
    await mkdir(this.dir, { recursive: true });
    await writeFile(file, JSON.stringify(state, null, 2));
    return file;
  }
}
