// Finds nearby Metro bus routes using a pre-built stop coordinate index.
// Zero live API calls when stop-index.json is populated — all geo math is local.
//
// To populate or refresh the index:
//   node api/scripts/fetch-routes.js --write
//
// Falls back to live Metro API calls if the index is empty (before first sync).

import { createRequire } from 'module';

const require   = createRequire(import.meta.url);
const stopIndex = require('./stop-index.json');
const INDEX_READY = Object.keys(stopIndex).length > 0;

const RADIUS_KM   = 0.8;
const BASE        = 'https://api.metro.net/LACMTA';
const ROUTE_ALIAS = { G: '901', J: '910' };

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── FAST PATH — local geo lookup, no network ──────────────────────────────────
function nearbyFromIndex(lat, lng) {
  const hits = [];
  for (const [code, stops] of Object.entries(stopIndex)) {
    let min = Infinity;
    for (const [sLat, sLng] of stops) {
      const d = haversineKm(lat, lng, sLat, sLng);
      if (d < min) min = d;
    }
    if (min <= RADIUS_KM) hits.push({ code, distKm: min });
  }
  return hits
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, 10)
    .map(({ code, distKm }) => ({ code, distanceM: Math.round(distKm * 1000) }));
}

// ── SLOW PATH — live Metro API calls (used only before first sync) ────────────
// Keep in sync with api/routes.js until stop-index.json is populated.
const BUS_ROUTES = [
  '2','4','10','14','16','18','20','28','30','33','35','37','38','40','45','48','51','53',
  '55','60','62','66','70','74','76','78','81','90','92','93','94','102','105','106','108','110',
  '111','115','117','120','125','127','128','134','150','152','154','155','158','161','162','164','165','166',
  '167','169','177','179','180','182','202','204','205','206','207','209','210','211','212','215','217','218',
  '222','224','230','232','233','234','236','237','240','242','243','244','246','251','256','258','260','265',
  '266','267','268','287','294','296','344','460','487','489','501','550','577','601','602','603','605','611',
  '617','660','662','665','686','690','699','720','754','761',
];

async function minDistFromAPI(code, lat, lng) {
  const apiCode = ROUTE_ALIAS[code] || code;
  try {
    const r = await fetch(`${BASE}/route_stops/${apiCode}`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) return null;
    const stops = await r.json();
    let min = Infinity;
    for (const stop of stops) {
      const sLat = stop.geometry?.coordinates?.[1];
      const sLng = stop.geometry?.coordinates?.[0];
      if (!sLat || !sLng) continue;
      const d = haversineKm(lat, lng, sLat, sLng);
      if (d < min) min = d;
    }
    return min === Infinity ? null : min;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  if (INDEX_READY) {
    return res.json({ routes: nearbyFromIndex(lat, lng), fallback: false });
  }

  // Index not yet populated — fall back to live API calls
  const results = await Promise.all(
    BUS_ROUTES.map(code =>
      minDistFromAPI(code, lat, lng).then(distKm =>
        distKm !== null && distKm <= RADIUS_KM ? { code, distKm } : null
      )
    )
  );
  const routes = results
    .filter(Boolean)
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, 10)
    .map(({ code, distKm }) => ({ code, distanceM: Math.round(distKm * 1000) }));

  res.json({ routes, fallback: false });
}
