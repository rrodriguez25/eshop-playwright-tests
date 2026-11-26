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
  /** The test is `test.fail`, or its body calls `test.fail(...)` or `knownBug(...)`: it documents a known eShop bug. */
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

/** `test.describe(...)` → '', `test.describe.skip(...)` → 'skip', and so on; null for anything else. */
function describeVariant(call: ts.CallExpression): string | null {
  let callee = call.expression;
  let variant = '';
  if (ts.isPropertyAccessExpression(callee) && DESCRIBE_VARIANTS.has(callee.name.text)) {
    variant = callee.name.text;
    callee = callee.expression;
  }
  const isDescribe = ts.isPropertyAccessExpression(callee) && isTestIdentifier(callee.expression) && callee.name.text === 'describe';
  return isDescribe ? variant : null;
}

/**
 * A title argument's text: a string's value, a template's source between the backticks, or the
 * source of any other expression (a variable's name), so a claim's test can still be named.
 */
function titleText(node: ts.Node | undefined, source: ts.SourceFile): string | null {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return node.getText(source).slice(1, -1);
  return node.getText(source);
}

const isFunction = (node: ts.Node | undefined): node is ts.ArrowFunction | ts.FunctionExpression =>
  node !== undefined && (ts.isArrowFunction(node) || ts.isFunctionExpression(node));

/** What a test inherits from the describes around it. */
interface Context {
  describes: string[];
  skipped: boolean;
  knownBug: boolean;
}

/** A `test.skip(...)`, `test.fixme(...)` or `test.fail(...)` that marks a scope, not declares a test. */
function markerVariant(node: ts.Node): string | null {
  if (!ts.isCallExpression(node)) return null;
  const variant = testVariant(node);
  if (variant !== 'skip' && variant !== 'fixme' && variant !== 'fail') return null;
  return isFunction(node.arguments[node.arguments.length - 1]) ? null : variant;
}

function marks(variants: Iterable<string>): { skipped: boolean; knownBug: boolean } {
  const all = [...variants];
  return { skipped: all.includes('skip') || all.includes('fixme'), knownBug: all.includes('fail') };
}

/** Markers called directly in a describe's callback, which apply to every test after them. */
function describeMarks(callback: ts.Node | undefined): { skipped: boolean; knownBug: boolean } {
  if (!isFunction(callback) || !ts.isBlock(callback.body)) return { skipped: false, knownBug: false };
  return marks(callback.body.statements.flatMap((statement) =>
    ts.isExpressionStatement(statement) ? [markerVariant(statement.expression)].filter((v) => v !== null) : []));
}

/** `knownBug('<bug id>', async () => { ... })`, the wrapper from `fixtures/known-bug.ts`. */
const isKnownBugCall = (node: ts.Node): boolean =>
  ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'knownBug';

/** Markers called anywhere in a test's body. A `knownBug(...)` call counts as `test.fail`. */
function bodyMarks(body: ts.Node): { skipped: boolean; knownBug: boolean } {
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    const variant = markerVariant(node);
    if (variant) found.push(variant);
    if (isKnownBugCall(node)) found.push('fail');
    ts.forEachChild(node, visit);
  };
  visit(body);
  return marks(found);
}

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

function scanFile(file: string, repoRoot: string, claims: Claim[], problems: Problem[]): void {
  const relativeFile = repoRelative(file, repoRoot);
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const folderLayer = layerOfSpec(relativeFile);
  const handled = new Set<ts.Node>();
  const lineOf = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const error = (node: ts.Node, message: string) =>
    problems.push({ level: 'error', where: `${relativeFile}:${lineOf(node)}`, message });

  const readClaim = (call: ts.CallExpression, testCall: ts.CallExpression, title: string, variant: string, body: ts.Node, context: Context) => {
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
    const inBody = bodyMarks(body);
    claims.push({
      file: relativeFile,
      line: lineOf(testCall),
      title,
      ids,
      layer,
      knownBug: context.knownBug || variant === 'fail' || inBody.knownBug,
      skipped: context.skipped || variant === 'skip' || variant === 'fixme' || inBody.skipped,
    });
  };

  const visit = (node: ts.Node, context: Context): void => {
    if (ts.isCallExpression(node)) {
      const title = titleText(node.arguments[0], source);
      const last = node.arguments[node.arguments.length - 1];
      const describe = describeVariant(node);
      if (describe !== null && title !== null) {
        const inside = describeMarks(last);
        const inner: Context = {
          describes: [...context.describes, title],
          skipped: context.skipped || describe === 'skip' || describe === 'fixme' || inside.skipped,
          knownBug: context.knownBug || inside.knownBug,
        };
        node.arguments.forEach((argument) => visit(argument, inner));
        return;
      }
      const variant = testVariant(node);
      if (variant !== null && title !== null && isFunction(last)) {
        const fullTitle = [...context.describes, title].join(' › ');
        for (const argument of node.arguments.slice(1, -1)) {
          if (isClaimsCall(argument)) readClaim(argument, node, fullTitle, variant, last, context);
        }
      }
      if (isClaimsCall(node) && !handled.has(node)) {
        error(node, 'call claims() directly in a test call\'s arguments: test(title, claims([...], layer), fn)');
      }
    }
    ts.forEachChild(node, (child) => visit(child, context));
  };
  visit(source, { describes: [], skipped: false, knownBug: false });
}

/** Every `claims()` in the specs under `testsDir`, and every way one is written wrong. */
export function scanSpecs(testsDir: string, repoRoot: string): { claims: Claim[]; problems: Problem[] } {
  const claims: Claim[] = [];
  const problems: Problem[] = [];
  for (const file of specFiles(testsDir).sort()) scanFile(file, repoRoot, claims, problems);
  return { claims, problems };
}
