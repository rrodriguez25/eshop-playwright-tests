import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Credentials, IdentityClient } from './identity-client';

export type SessionStoreOptions = {
  /** How long a session is reused before the user is logged in again. */
  maxAgeMs: number;
  /** The clock, in milliseconds. Defaults to `Date.now`. */
  now?: () => number;
};

type CachedSession = { file: Promise<string>; loggedInAt: number };

/**
 * One logged-in session per user per worker. The first test in a worker that needs a user logs
 * them in and saves the session to `<dir>/<key>-<workerIndex>.json`; later tests in that worker
 * reuse the file until it is `maxAgeMs` old, then the user is logged in again. Each worker logs in
 * fresh, so a session never outlives the run that made it.
 */
export class SessionStore {
  private readonly sessions = new Map<string, CachedSession>();
  private readonly maxAgeMs: number;
  private readonly now: () => number;

  constructor(
    private readonly identity: IdentityClient,
    private readonly dir: string,
    private readonly workerIndex: number,
    options: SessionStoreOptions,
  ) {
    this.maxAgeMs = options.maxAgeMs;
    this.now = options.now ?? Date.now;
  }

  /** Path of the user's session file, logging them in on first use or once the session is too old. */
  sessionFile(key: string, credentials: Credentials): Promise<string> {
    const cached = this.sessions.get(key);
    if (cached !== undefined && this.now() - cached.loggedInAt <= this.maxAgeMs) {
      return cached.file;
    }
    const session: CachedSession = { file: this.logIn(key, credentials), loggedInAt: this.now() };
    this.sessions.set(key, session);
    // A failed login isn't cached, so the next test tries again and reports its own error.
    session.file.catch(() => {
      if (this.sessions.get(key) === session) this.sessions.delete(key);
    });
    return session.file;
  }

  private async logIn(key: string, credentials: Credentials): Promise<string> {
    const state = await this.identity.logIn(credentials);
    const file = path.join(this.dir, `${key}-${this.workerIndex}.json`);
    await mkdir(this.dir, { recursive: true });
    await writeFile(file, JSON.stringify(state, null, 2));
    return file;
  }
}
