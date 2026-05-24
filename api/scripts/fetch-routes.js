#!/usr/bin/env node
/**
 * Fetches all active Metro bus routes and their stop coordinates,
 * then updates api/routes.js, api/nearby.js, and api/stop-index.json.
 *
 * Dry run (preview diff only):
 *   node api/scripts/fetch-routes.js
 *
 * Write changes to all three files:
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

const ROOT            = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROUTES_JS       = resolve(ROOT, 'api', 'routes.js');
const NEARBY_JS       = resolve(ROOT, 'api', 'nearby.js');
const STOP_INDEX_JS   = resolve(ROOT, 'api', 'stop-index.js');

// Probe all numeric codes in this range.
// Upper bound is generous — Metro tops out around 800 today.
const CANDIDATES = Array.from({ length: 800 }, (_, i) => String(i + 1));

// ── PHASE 1: discover active routes via route_overview ────────────────────────

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
    const t1    = (d.terminal_1 || '').trim();
    const t2    = (d.terminal_2 || '').trim();
    return { code, short, t1, t2, name };
  } catch {
    return null;
  }
}

// ── PHASE 2: fetch stop coordinates for each active route ─────────────────────

async function fetchStops(code) {
  const apiCode = code === 'G' ? '901' : code === 'J' ? '910' : code;
  try {
    const r = await fetch(`${BASE}/route_stops/${apiCode}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const stops = await r.json();
    if (!Array.isArray(stops)) return [];

    // Deduplicate by 4-decimal-place precision (~11m) — sufficient for nearby calc
    const seen   = new Set();
    const coords = [];
    for (const stop of stops) {
      const lng = stop.geometry?.coordinates?.[0];
      const lat = stop.geometry?.coordinates?.[1];
      if (lat == null || lng == null) continue;
      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      coords.push([+lat.toFixed(4), +lng.toFixed(4)]);
    }
    return coords;
  } catch {
    return [];
  }
}

async function buildStopIndex(routes) {
  process.stdout.write(`\nFetching stop coordinates for ${routes.length} routes…\n`);
  const index      = {};
  const STOP_BATCH = 15;

  for (let i = 0; i < routes.length; i += STOP_BATCH) {
    const batch   = routes.slice(i, i + STOP_BATCH);
    const results = await Promise.all(
      batch.map(async r => ({ code: r.code, coords: await fetchStops(r.code) }))
    );
    for (const { code, coords } of results) {
      if (coords.length) index[code] = coords;
    }
    const total = Object.values(index).reduce((s, a) => s + a.length, 0);
    process.stdout.write(
      `\r  ${Math.min(i + STOP_BATCH, routes.length)} / ${routes.length} routes — ${total} unique stops`
    );
  }
  process.stdout.write('\n');
  return index;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

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
    console.log('Dry run — pass --write to update api/routes.js, api/nearby.js, and api/stop-index.json.');
    return;
  }

  // ── Write api/routes.js ─────────────────────────────────────────────────────
  const today  = new Date().toISOString().slice(0, 10);
  const codeW  = Math.max(...found.map(r => r.code.length)) + 3;
  const shortW = Math.max(...found.map(r => r.short.length)) + 3;

  const routeLines = found.map(r => {
    const codeStr  = `'${r.code}',`.padEnd(codeW);
    const shortStr = `'${r.short}',`.padEnd(shortW);
    return `  { code:${codeStr} short:${shortStr} t1:'${r.t1}', t2:'${r.t2}', name:'${r.name}' },`;
  });

  const newRoutesArray = `const ROUTES = [\n${routeLines.join('\n')}\n];`;
  const newBanner      = `// Validated against Metro's API ${today}. All bus routes share color #E16710.`;

  writeFileSync(
    ROUTES_JS,
    currentSrc
      .replace(/\/\/ Validated against[^\n]*/, newBanner)
      .replace(/const ROUTES = \[[\s\S]*?\];/, newRoutesArray),
    'utf8'
  );
  console.log(`✓ Updated ${ROUTES_JS}`);

  // ── Write BUS_ROUTES in api/nearby.js (fallback list) ───────────────────────
  const nearbySrc = readFileSync(NEARBY_JS, 'utf8');
  const codeStrs  = found.map(r => `'${r.code}'`);
  const rows      = [];
  for (let i = 0; i < codeStrs.length; i += 18) {
    rows.push('  ' + codeStrs.slice(i, i + 18).join(','));
  }
  const newBusRoutes = `const BUS_ROUTES = [\n${rows.join(',\n')},\n];`;
  writeFileSync(
    NEARBY_JS,
    nearbySrc.replace(/const BUS_ROUTES = \[[\s\S]*?\];/, newBusRoutes),
    'utf8'
  );
  console.log(`✓ Updated ${NEARBY_JS}`);

  // ── Write api/stop-index.json ────────────────────────────────────────────────
  const stopIndex  = await buildStopIndex(found);
  const stopCount  = Object.values(stopIndex).reduce((s, a) => s + a.length, 0);
  writeFileSync(STOP_INDEX_JS, `export default ${JSON.stringify(stopIndex)};\n`, 'utf8');
  console.log(`✓ Updated ${STOP_INDEX_JS} (${Object.keys(stopIndex).length} routes, ${stopCount} unique stops)`);
}

main().catch(err => { console.error(err); process.exit(1); });
