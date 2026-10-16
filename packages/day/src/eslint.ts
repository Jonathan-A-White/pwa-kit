// pwa-kit/day/eslint: an ESLint 9 flat-config plugin with one rule, no-utc-day, and a config object an app puts in its
// eslint.config.js. It imports only ESLint's types, so ESLint is an optional peer of the package.
import type { Rule } from 'eslint';

type Node = Rule.Node;

const SLICERS = new Set(['slice', 'substring', 'substr']);
const BARE_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The name of the method a call's callee reaches, for `x.name(...)` and `x['name'](...)`. */
function methodName(node: Node): string | null {
  if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') return null;
  const { property, computed } = node.callee;
  if (!computed && property.type === 'Identifier') return property.name;
  if (computed && property.type === 'Literal' && typeof property.value === 'string') return property.value;
  return null;
}

/** `x.toISOString()`, the UTC text of a moment. */
function isIsoCall(node: unknown): boolean {
  const n = node as Node;
  return n.type === 'CallExpression' && n.arguments.length === 0 && methodName(n) === 'toISOString';
}

function receiverIsIso(call: Node): boolean {
  return call.type === 'CallExpression' && call.callee.type === 'MemberExpression' && isIsoCall(call.callee.object);
}

/** A string literal's text, for 'x', "x" and a template with no expression; otherwise undefined. */
function textOf(node: unknown): string | undefined {
  const n = node as Node | undefined;
  if (!n) return undefined;
  if (n.type === 'Literal' && typeof n.value === 'string') return n.value;
  if (n.type === 'TemplateLiteral' && n.expressions.length === 0 && n.quasis.length === 1) return n.quasis[0].value.cooked ?? undefined;
  return undefined;
}

const isNumber = (node: unknown, value: number): boolean => {
  const n = node as Node | undefined;
  return n?.type === 'Literal' && n.value === value;
};

const noUtcDay: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: "Disallow the UTC day as a person's day: a day key cut from toISOString(), or a Date made from a bare 'YYYY-MM-DD'.",
    },
    schema: [],
    messages: {
      utcDayKey:
        "A day key cut from toISOString() is the UTC day, which is tomorrow's date for a few hours every evening west of UTC. Use localDay() from 'pwa-kit/day'; for a real UTC key (a server's) keep it with an eslint-disable line that gives the reason.",
      utcDayParse:
        "new Date('YYYY-MM-DD') is UTC midnight, which reads a day early west of UTC. Use dayStart() from 'pwa-kit/day' for local midnight; for a real UTC instant keep it with an eslint-disable line that gives the reason.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const name = methodName(node);
        if (!name || !receiverIsIso(node)) return;
        // toISOString().split('T') (then [0], .at(0), a destructuring: the key is cut either way)
        const bareSplit = name === 'split' && textOf(node.arguments[0]) === 'T';
        // toISOString().slice(0, 10), .substring(0, 10), .substr(0, 10)
        const bareSlice = SLICERS.has(name) && node.arguments.length === 2 && isNumber(node.arguments[0], 0) && isNumber(node.arguments[1], 10);
        if (bareSplit || bareSlice) context.report({ node, messageId: 'utcDayKey' });
      },
      NewExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== 'Date' || node.arguments.length !== 1) return;
        const text = textOf(node.arguments[0]);
        if (text !== undefined && BARE_DAY.test(text)) context.report({ node, messageId: 'utcDayParse' });
      },
    };
  },
};

/** The plugin, as flat config registers it under the name 'pwa-kit-day'. */
export const plugin = { meta: { name: 'pwa-kit-day' }, rules: { 'no-utc-day': noUtcDay } } as const;

/** A flat-config object: an app brings it in from pwa-kit/day/eslint (as the default export) and puts it in the eslint.config.js array. */
export const config = {
  plugins: { 'pwa-kit-day': plugin },
  rules: { 'pwa-kit-day/no-utc-day': 'error' },
} as const;

export default config;
