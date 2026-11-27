import path from 'node:path';

/**
 * Paths the suite reads and writes, anchored to the repository root rather than the folder a run
 * starts from, so `playwright test` behaves the same from any directory.
 */
export const REPO_ROOT = path.resolve(__dirname, '..');

/** The local environment file. Ignored by git. */
export const ENV_FILE = path.join(REPO_ROOT, '.env');

/** Where each worker saves its logged-in sessions. Ignored by git: the files hold login cookies. */
export const SESSION_DIR = path.join(REPO_ROOT, '.auth');