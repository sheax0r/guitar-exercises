// Fails when the entry chunk (Home + Learn menu) grows past the budget. Exercise sessions
// and Ideate are lazy chunks; if this trips, lazy-load the new heavy import instead of
// raising the number. Run after `vite build` (npm run build:check).
import { readFileSync, statSync } from 'node:fs';

const BUDGET_KB = 150; // entry was 133 kB raw when SessionScreen went lazy (2026-10-31)
const html = readFileSync('dist/index.html', 'utf8');
const src = html.match(/<script[^>]+src="\/?([^"]+\.js)"/)?.[1];
if (!src) throw new Error('entry script not found in dist/index.html');
const kb = statSync(`dist/${src}`).size / 1000;
console.log(`entry chunk ${src}: ${kb.toFixed(1)} kB (budget ${BUDGET_KB} kB)`);
if (kb > BUDGET_KB) process.exit(1);
