import type { Problem } from './types';

/** Prints errors, then warnings, one per line: `ERROR  <where>: <message>`. */
export function printProblems(problems: Problem[]): void {
  for (const level of ['error', 'warning'] as const) {
    for (const problem of problems.filter((p) => p.level === level)) {
      const line = `${level === 'error' ? 'ERROR' : 'WARN '}  ${problem.where}: ${problem.message}`;
      if (level === 'error') console.error(line);
      else console.warn(line);
    }
  }
}
