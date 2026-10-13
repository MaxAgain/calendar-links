import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// The dashboard may only use the Solakon palette (sk-yellow, sk-blue, sk-gray, sk-black, sk-white) plus
// Tailwind green/amber/red for status. `--color-*: initial` in globals.css drops every other colour silently,
// so this guard catches them in source before they quietly render as "no colour".

const ROOT = join(import.meta.dirname, '..');
const SCAN_ROOTS = ['components', 'app/(admin)', 'hooks'];
const SKIP_DIRS = new Set([join('components', 'landing')]);
const EXTENSIONS = ['.ts', '.tsx', '.css'];

const ALLOWED_FAMILIES = new Set(['sk-yellow', 'sk-blue', 'sk-gray', 'green', 'amber', 'red']);

const PREFIX =
  '(?:bg|text|border(?:-[xytblrse])?|ring(?:-offset)?|inset-ring|outline|fill|stroke|from|via|to|decoration|divide|placeholder|caret|accent|shadow|inset-shadow|drop-shadow)';
const SHADE = '(?:50|100|200|300|400|500|600|700|800|900|950)';

/** `bg-red-500`, `dark:text-sk-gray-300/60`, ... — captures the colour family. */
const SCALE_UTILITY = new RegExp(`(?<![\\w-])${PREFIX}-((?:sk-)?[a-z]+)-${SHADE}(?![\\w-])`, 'g');
/** `bg-black`, `text-white/80` — but not `bg-sk-white` / `text-sk-black`. */
const PLAIN_BLACK_WHITE = new RegExp(`(?<![\\w-])${PREFIX}-(?:black|white)(?![\\w-])`, 'g');
/** `bg-[#fff]`, `text-[rgb(0,0,0)]`, `border-[oklch(...)]`. */
const ARBITRARY_COLOR = /-\[(?:#[0-9a-fA-F]{3,8}\]|(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|hwb|color)\()/g;
const HEX_LITERAL = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?\b/g;
/** Recharts selectors in chart.tsx match its default attribute values, e.g. `[stroke='#ccc']`. Not colours we use. */
const ATTRIBUTE_SELECTOR = /\[[a-z-]+=(['"])#[0-9a-fA-F]{3,8}\1\]/g;

function walk(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (SKIP_DIRS.has(relative(ROOT, path))) continue;
    if (statSync(path).isDirectory()) walk(path, files);
    else if (EXTENSIONS.some((ext) => name.endsWith(ext))) files.push(path);
  }
  return files;
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

function violationsIn(path: string): string[] {
  const text = readFileSync(path, 'utf8');
  const where = (index: number) => `${relative(ROOT, path).split(sep).join('/')}:${lineOf(text, index)}`;
  const found: string[] = [];

  for (const m of text.matchAll(SCALE_UTILITY)) {
    if (!ALLOWED_FAMILIES.has(m[1])) found.push(`${where(m.index)}  "${m[0]}" uses colour family "${m[1]}", which is not in the Solakon palette`);
  }
  for (const m of text.matchAll(PLAIN_BLACK_WHITE)) {
    found.push(`${where(m.index)}  "${m[0]}" is pure black/white; use sk-black/sk-white or a semantic token`);
  }
  for (const m of text.matchAll(ARBITRARY_COLOR)) {
    found.push(`${where(m.index)}  "${m[0]}…" is an arbitrary colour; use a palette or semantic token`);
  }
  if (path.endsWith('.tsx')) {
    const withoutSelectors = text.replace(ATTRIBUTE_SELECTOR, (match) => ' '.repeat(match.length));
    for (const m of withoutSelectors.matchAll(HEX_LITERAL)) {
      found.push(`${where(m.index)}  hex colour "${m[0]}" in a component; use a CSS variable or palette token`);
    }
  }
  return found;
}

describe('dashboard brand colours', () => {
  const files = SCAN_ROOTS.flatMap((dir) => walk(join(ROOT, dir)));

  it('scans the dashboard sources', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.endsWith('globals.css'))).toBe(true);
    expect(files.some((f) => f.includes(`${sep}landing${sep}`))).toBe(false);
  });

  it('uses only Solakon palette and status colours', () => {
    const violations = files.flatMap(violationsIn);
    expect(violations, `Off-palette colours found:\n${violations.join('\n')}\n`).toEqual([]);
  });

  it('detects off-palette colours (self-test)', () => {
    const sample = 'bg-red-500 text-slate-700 border-white bg-[#fff] text-[oklch(0.5 0 0)] bg-sk-gray-200 text-sk-white dark:text-green-300/60';
    const hits = [
      ...[...sample.matchAll(SCALE_UTILITY)].filter((m) => !ALLOWED_FAMILIES.has(m[1])).map((m) => m[0]),
      ...[...sample.matchAll(PLAIN_BLACK_WHITE)].map((m) => m[0]),
      ...[...sample.matchAll(ARBITRARY_COLOR)].map((m) => m[0]),
    ];
    expect(hits).toEqual(['text-slate-700', 'border-white', '-[#fff]', '-[oklch(']);
  });
});
