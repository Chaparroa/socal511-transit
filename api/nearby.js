// Finds Metro bus routes with stops within walking distance of the given coords.
// Uses /route_stops/{code} in parallel — guaranteed to work since route.js uses it.

const RADIUS_KM = 0.8;
const BASE = 'https://api.metro.net/LACMTA';
const ROUTE_ALIAS = { G: '901', J: '910' };

// Bus routes to check — broad coverage across Metro's network
const BUS_ROUTES = [
  '1','2','3','4','10','14','16','18','20','22','26','28','30','33','37','38',
  '40','42','45','48','51','52','53','55','60','62','66','68','70','71','76',
  '78','79','81','83','84','85','86','87','88','90','91','92','94','96',
  '105','108','111','112','115','117','120','125','128','130',
  '152','153','154','155','156','157','158','160','161','162','163','164','165',
  '166','167','168','169','170','175','176','177','178','180','181','182','183',
  '190','194',
  '200','201','202','204','205','206','207','209','210','212','213','215',
  '217','218','220','222','224','226','228','230','232','233','234','236',
  '240','242','243','244','245','246','247','248','249','251','252','253',
  '254','256','257','258','260','261','262','264','265','267','268','270',
  '271','275','277','280','290','291','292','294','295','296',
  '302','344','378','460','487','489','501','550','577',
  '720','728','730','733','734','740','744','745','750','754','757','761','770',
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
