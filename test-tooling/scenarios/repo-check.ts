import { REPO_ROOT } from '../../config/paths';
import { runCheck, type CheckResult } from './check';
import { ENDPOINTS_FILE, MODULES_FILE, SCENARIOS_DIR, SCHEMA_FILE, SCREENS_FILE, TESTS_DIR } from '../paths';

/** `runCheck` on this repository's own files: what `check:scenarios` and `scenarios:report` read. */
export function checkRepository(): CheckResult {
  return runCheck({
    modulesFile: MODULES_FILE,
    scenariosDir: SCENARIOS_DIR,
    schemaFile: SCHEMA_FILE,
    screensFile: SCREENS_FILE,
    endpointsFile: ENDPOINTS_FILE,
    testsDir: TESTS_DIR,
    repoRoot: REPO_ROOT,
  });
}
