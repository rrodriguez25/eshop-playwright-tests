/**
 * Finds every `claims()` call in the specs by parsing their source with the TypeScript compiler, so
 * the check and the report know which tests claim which rows without running anything.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { repoRelative } from './paths';
import { LAYERS, type Layer, type Problem } from './types';

export interface Claim {
  /** Repo-relative, forward slashes: `tests/api/catalog.api.spec.ts`. */
  file: string;
  line: number;
  /** Describe titles and the test title joined with ` › `. */
  title: string;
  ids: string[];
  layer: Layer;
  /** The test is `test.fail`, or its body calls `test.fail(...)`: it documents a known eShop bug. */
  knownBug: boolean;
  /** `test.skip` or `test.fixme`: the test does not run. */
  skipped: boolean;
}

const LAYER_FOLDERS: Readonly<Record<Layer, string>> = { ui: 'tests/ui/', api: 'tests/api/' };
const TEST_VARIANTS = new Set(['fail', 'skip', 'fixme', 'only']);
const DESCRIBE_VARIANTS = new Set(['serial', 'parallel', 'only', 'skip', 'fixme']);

/** The layer a spec's folder proves: `tests/ui` → `ui`, `tests/api` → `api`, anything else → null. */
export function layerOfSpec(file: string): Layer | null {
  const normalised = file.replace(/\\/g, '/');
  return LAYERS.find((layer) => normalised.startsWith(LAYER_FOLDERS[layer])) ?? null;
}

function specFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return specFiles(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

const isTestIdentifier = (node: ts.Node) => ts.isIdentifier(node) && node.text === 'test';

/** `test(...)` → '', `test.fail(...)` → 'fail', and so on; null for anything that isn't a test call. */
function testVariant(call: ts.CallExpression): string | null {
  const callee = call.expression;
  if (isTestIdentifier(callee)) return '';
  if (ts.isPropertyAccessExpression(callee) && isTestIdentifier(callee.expression) && TEST_VARIANTS.has(callee.name.text)) {
    return callee.name.text;
  }
  return null;
}

function isDescribeCall(call: ts.CallExpression): boolean {
  let callee = call.expression;
  if (ts.isPropertyAccessExpression(callee) && DESCRIBE_VARIANTS.has(callee.name.text)) callee = callee.expression;
  return ts.isPropertyAccessExpression(callee) && isTestIdentifier(callee.expression) && callee.name.text === 'describe';
}

/** A title argument's text: a string's value, or a template's source between the backticks. */
function titleText(node: ts.Node | undefined, source: ts.SourceFile): string | null {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return node.getText(source).slice(1, -1);
  return null;
}

const isFunction = (node: ts.Node | undefined) =>
  node !== undefined && (ts.isArrowFunction(node) || ts.isFunctionExpression(node));

const isClaimsCall = (node: ts.Node): node is ts.CallExpression =>
  ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'claims';

const isStringish = (node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);

function literalIds(node: ts.Expression | undefined): string[] | null {
  if (!node) return null;
  if (isStringish(node)) return [node.text];
  if (ts.isArrayLiteralExpression(node) && node.elements.every(isStringish)) {
    return node.elements.map((element) => (isStringish(element) ? element.text : ''));
  }
  return null;
}

function callsTestFail(body: ts.Node): boolean {
  let found = false;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (ts.isCallExpression(node) && testVariant(node) === 'fail') found = true;
    else ts.forEachChild(node, visit);
  };
  visit(body);
  return found;
}

function scanFile(file: string, repoRoot: string, claims: Claim[], problems: Problem[]): void {
  const relativeFile = repoRelative(file, repoRoot);
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const folderLayer = layerOfSpec(relativeFile);
  const handled = new Set<ts.Node>();
  const lineOf = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const error = (node: ts.Node, message: string) =>
    problems.push({ level: 'error', where: `${relativeFile}:${lineOf(node)}`, message });

  const readClaim = (call: ts.CallExpression, testCall: ts.CallExpression, title: string, variant: string, body: ts.Node) => {
    handled.add(call);
    const [idsArgument, layerArgument] = call.arguments;
    const ids = literalIds(idsArgument);
    if (!ids || !layerArgument || !isStringish(layerArgument)) {
      error(call, 'claims() ids and layer must be string literals, so the check can read them');
      return;
    }
    const layer = LAYERS.find((l) => l === layerArgument.text);
    if (!layer) {
      error(call, `claims() layer '${layerArgument.text}' is not 'ui' or 'api'`);
      return;
    }
    if (!folderLayer) {
      error(call, 'claims() belongs in specs under tests/ui or tests/api, the layers a row can owe');
      return;
    }
    if (layer !== folderLayer) {
      error(call, `claims() layer '${layer}' in a spec under tests/${folderLayer}; use '${folderLayer}'`);
      return;
    }
    claims.push({
      file: relativeFile,
      line: lineOf(testCall),
      title,
      ids,
      layer,
      knownBug: variant === 'fail' || callsTestFail(body),
      skipped: variant === 'skip' || variant === 'fixme',
    });
  };

  const visit = (node: ts.Node, describes: string[]): void => {
    if (ts.isCallExpression(node)) {
      const title = titleText(node.arguments[0], source);
      const last = node.arguments[node.arguments.length - 1];
      if (isDescribeCall(node) && title !== null) {
        node.arguments.forEach((argument) => visit(argument, [...describes, title]));
        return;
      }
      const variant = testVariant(node);
      if (variant !== null && title !== null && last && isFunction(last)) {
        const fullTitle = [...describes, title].join(' › ');
        for (const argument of node.arguments.slice(1, -1)) {
          if (isClaimsCall(argument)) readClaim(argument, node, fullTitle, variant, last);
        }
      }
      if (isClaimsCall(node) && !handled.has(node)) {
        error(node, 'call claims() directly in a test call\'s arguments: test(title, claims([...], layer), fn)');
      }
    }
    ts.forEachChild(node, (child) => visit(child, describes));
  };
  visit(source, []);
}

/** Every `claims()` in the specs under `testsDir`, and every way one is written wrong. */
export function scanSpecs(testsDir: string, repoRoot: string): { claims: Claim[]; problems: Problem[] } {
  const claims: Claim[] = [];
  const problems: Problem[] = [];
  for (const file of specFiles(testsDir).sort()) scanFile(file, repoRoot, claims, problems);
  return { claims, problems };
}
