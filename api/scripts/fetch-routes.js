#!/usr/bin/env node
/**
 * Fetches all active Metro bus routes from the Metro API and keeps
 * api/routes.js and api/nearby.js in sync.
 *
 * Dry run (preview only):
 *   node api/scripts/fetch-routes.js
 *
 * Write changes to both files:
 *   node api/scripts/fetch-routes.js --write
 *
 * Requires Node 18+.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const BASE    = 'https://api.metro.net/LACMTA';
const BATCH   = 25;
const TIMEOUT = 6000;

const ROOT       = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROUTES_JS  = resolve(ROOT, 'api', 'routes.js');
const NEARBY_JS  = resolve(ROOT, 'api', 'nearby.js');

// Probe all numeric codes in this range.
// Upper bound is generous — Metro tops out around 800 today.
const CANDIDATES = Array.from({ length: 800 }, (_, i) => String(i + 1));

async function probe(code) {
  try {
    const r = await fetch(`${BASE}/route_overview/${code}`, {
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) return null;
    const data = await r.json();
    if (!Array.isArray(data) || !data[0]) return null;
    const d = data[0];
    const name  = (d.description || d.route_long_name || '').trim();
    if (!name) return null;
    const short = (d.arterials || '').trim() || name;
    return { code, short, name };
  } catch {
    return null;
  }
}

async function main() {
  const write = process.argv.includes('--write');
  const found = [];

  console.log(`Probing ${CANDIDATES.length} candidate codes in batches of ${BATCH}…`);

  for (let i = 0; i < CANDIDATES.length; i += BATCH) {
    const batch   = CANDIDATES.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(probe));
    found.push(...results.filter(Boolean));
    process.stdout.write(
      `\r  ${String(Math.min(i + BATCH, CANDIDATES.length)).padStart(3)} / ${CANDIDATES.length}  —  ${found.length} active so far`
    );
  }
  process.stdout.write('\n\n');

  found.sort((a, b) => +a.code - +b.code);

  // ── Diff against current routes.js ─────────────────────────────────────────
  const currentSrc   = readFileSync(ROUTES_JS, 'utf8');
  const currentCodes = new Set([...currentSrc.matchAll(/code:'(\w+)'/g)].map(m => m[1]));
  const newCodes     = new Set(found.map(r => r.code));

  const added   = found.filter(r => !currentCodes.has(r.code));
  const removed = [...currentCodes].filter(c => !newCodes.has(c));

  if (added.length)   console.log(`  Added   (${added.length}): ${added.map(r => r.code).join(', ')}`);
  if (removed.length) console.log(`  Removed (${removed.length}): ${removed.join(', ')}`);
  if (!added.length && !removed.length) console.log('  No route changes detected.');
  console.log(`  Total: ${found.length} active routes\n`);

  if (!write) {
    console.log('Dry run — pass --write to update api/routes.js and api/nearby.js.');
    return;
  }

  // ── Build ROUTES array ──────────────────────────────────────────────────────
  const today  = new Date().toISOString().slice(0, 10);
  const codeW  = Math.max(...found.map(r => r.code.length)) + 3;  // e.g. '720', → 6
  const shortW = Math.max(...found.map(r => r.short.length)) + 3;  // pad to longest short

  const routeLines = found.map(r => {
    const codeStr  = `'${r.code}',`.padEnd(codeW);
    const shortStr = `'${r.short}',`.padEnd(shortW);
    return `  { code:${codeStr} short:${shortStr} name:'${r.name}' },`;
  });

  const newRoutesArray = `const ROUTES = [\n${routeLines.join('\n')}\n];`;
  const newBanner      = `// Validated against Metro's API ${today}. All bus routes share color #E16710.`;

  const updatedRoutes = currentSrc
    .replace(/\/\/ Validated against[^\n]*/, newBanner)
    .replace(/const ROUTES = \[[\s\S]*?\];/, newRoutesArray);

  writeFileSync(ROUTES_JS, updatedRoutes, 'utf8');
  console.log(`✓ Updated ${ROUTES_JS}`);

  // ── Update BUS_ROUTES in api/nearby.js ──────────────────────────────────────
  const nearbySrc = readFileSync(NEARBY_JS, 'utf8');
  const codeStrs  = found.map(r => `'${r.code}'`);
  const rows      = [];
  for (let i = 0; i < codeStrs.length; i += 18) {
    rows.push('  ' + codeStrs.slice(i, i + 18).join(','));
  }
  const newBusRoutes  = `const BUS_ROUTES = [\n${rows.join(',\n')},\n];`;
  const updatedNearby = nearbySrc.replace(/const BUS_ROUTES = \[[\s\S]*?\];/, newBusRoutes);

  writeFileSync(NEARBY_JS, updatedNearby, 'utf8');
  console.log(`✓ Updated ${NEARBY_JS}`);
}

main().catch(err => { console.error(err); process.exit(1); });
