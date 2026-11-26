import { isRecord, isStringList, readJson } from './json';
import { PREFIX_PATTERN, type ModuleEntry, type Problem } from './types';

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function toModuleEntry(raw: unknown, index: number, where: string, problems: Problem[]): ModuleEntry | null {
  if (!isRecord(raw)) {
    problems.push({ level: 'error', where, message: `module ${index} is not an object` });
    return null;
  }
  const { id, name, prefix, screenSources, endpointPrefixes } = raw;
  if (typeof id !== 'string' || typeof name !== 'string' || typeof prefix !== 'string'
    || !isStringList(screenSources) || !isStringList(endpointPrefixes)) {
    problems.push({
      level: 'error',
      where,
      message: `module ${index} needs id, name, prefix (strings), screenSources and endpointPrefixes (string lists)`,
    });
    return null;
  }
  return { id, name, prefix, screenSources, endpointPrefixes };
}

/** Reads `test-tooling/modules.json` (or a file shaped like it) and reports what is wrong with it. */
export function readModules(file: string): { modules: ModuleEntry[]; problems: Problem[] } {
  const read = readJson(file);
  if ('error' in read) {
    return { modules: [], problems: [{ level: 'error', where: file, message: `not valid JSON: ${read.error}` }] };
  }
  const list = isRecord(read.value) ? read.value.modules : undefined;
  if (!Array.isArray(list)) {
    return { modules: [], problems: [{ level: 'error', where: file, message: '"modules" is not a list' }] };
  }

  const problems: Problem[] = [];
  const modules: ModuleEntry[] = [];
  const ids = new Set<string>();
  const prefixes = new Set<string>();
  list.forEach((raw, index) => {
    const entry = toModuleEntry(raw, index, file, problems);
    if (!entry) return;
    if (!ID_PATTERN.test(entry.id)) {
      problems.push({ level: 'error', where: file, message: `module id "${entry.id}" is not kebab-case` });
    }
    if (!PREFIX_PATTERN.test(entry.prefix)) {
      problems.push({ level: 'error', where: file, message: `prefix "${entry.prefix}" of ${entry.id} is not 2 to 4 capital letters` });
    }
    if (ids.has(entry.id)) {
      problems.push({ level: 'error', where: file, message: `module id "${entry.id}" is listed twice` });
    }
    if (prefixes.has(entry.prefix)) {
      problems.push({ level: 'error', where: file, message: `prefix "${entry.prefix}" is used by two modules` });
    }
    ids.add(entry.id);
    prefixes.add(entry.prefix);
    modules.push(entry);
  });
  return { modules, problems };
}
