// Finds Metro bus routes with stops within walking distance of the given coords.
// Uses /route_stops/{code} in parallel — dead routes return no stops and are excluded.

const RADIUS_KM = 0.8;
const BASE = 'https://api.metro.net/LACMTA';
const ROUTE_ALIAS = { G: '901', J: '910' };

// Active bus routes — same validated set as api/routes.js CANDIDATE_ROUTES.
// Dead routes are excluded automatically (route_stops returns empty → no nearby match).
const BUS_ROUTES = [
  '2','4','10','14','16','18','20','28','30','33','37','38','40','45','48','51','53','55',
  '60','62','66','70','76','78','81','90','92','94','105','108','111','115','117','120',
  '125','128','152','154','155','158','161','162','164','165','166','167','169','177',
  '180','182','202','204','205','206','207','209','210','212','215','217','218','222',
  '224','230','232','233','234','236','240','242','243','244','246','251','256','258',
  '260','265','267','268','294','344','460','487','489','501','550','577','720','754','761',
];

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function minDistForRoute(code, lat, lng) {
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

  const results = await Promise.all(
    BUS_ROUTES.map(code =>
      minDistForRoute(code, lat, lng).then(distKm =>
        distKm !== null && distKm <= RADIUS_KM ? { code, distKm } : null
      )
    )
  );

  const routes = results
    .filter(Boolean)
    .sort((a, b) => a.distKm - b.distKm)
    .slice(0, 10)
    .map(({ code, distKm }) => ({ code, distanceM: Math.round(distKm * 1000) }));

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  res.json({ routes, fallback: false });
}
