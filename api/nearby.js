// Returns Metro route codes near the given coords, sorted by distance to nearest stop.
// Response: { routes: [{code, distanceM}], fallback: bool }

const RADIUS_KM = 0.8; // ~10-min walk

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default async function handler(req, res) {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }

  try {
    const r = await fetch('https://api.metro.net/LACMTA/stops');
    if (!r.ok) throw new Error(`Metro stops API returned ${r.status}`);
    const stops = await r.json();

    // Track minimum distance (km) per route code
    const routeMinDist = new Map();

    for (const stop of stops) {
      const sLat = stop.geometry?.coordinates?.[1] ?? stop.stop_lat ?? stop.lat;
      const sLng = stop.geometry?.coordinates?.[0] ?? stop.stop_lon ?? stop.lon;
      if (!sLat || !sLng) continue;

      const distKm = haversineKm(lat, lng, parseFloat(sLat), parseFloat(sLng));
      if (distKm > RADIUS_KM) continue;

      const rid = stop.route_id ?? stop.routes;
      const codes = Array.isArray(rid) ? rid.map(String) : (rid != null ? [String(rid)] : []);
      for (const code of codes) {
        const prev = routeMinDist.get(code);
        if (prev === undefined || distKm < prev) routeMinDist.set(code, distKm);
      }
    }

    const routes = [...routeMinDist.entries()]
      .sort(([, a], [, b]) => a - b)
      .slice(0, 10)
      .map(([code, distKm]) => ({ code, distanceM: Math.round(distKm * 1000) }));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.json({ routes, fallback: false });
  } catch (err) {
    res.json({ routes: [], fallback: true, reason: err.message });
  }
}
