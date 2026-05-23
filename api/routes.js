// Returns all Metro bus routes.
// Primary: /LACMTA/routes endpoint (with permissive shape handling).
// Fallback: extract unique route codes from the stops feed (guaranteed to work).

const RAIL_CODES = new Set(['801', '802', '803', '804', '805', '806', '807', '808', '901', '910']);

function isBus(code) {
  if (!code) return false;
  if (RAIL_CODES.has(String(code))) return false;
  if (/^[A-K]$/.test(String(code))) return false; // single letter = rail line
  return true;
}

export default async function handler(req, res) {
  // ── PRIMARY: routes list endpoint ──
  try {
    const r = await fetch('https://api.metro.net/LACMTA/routes');
    if (r.ok) {
      const raw  = await r.json();
      // API may return an array directly or wrap it: {routes:[...]} / {data:[...]}
      const data = Array.isArray(raw) ? raw : (Array.isArray(raw.routes) ? raw.routes : Array.isArray(raw.data) ? raw.data : []);

      const bus = data
        .filter(route => {
          const code = String(route.route_short_name ?? route.route_id ?? '');
          if (!isBus(code)) return false;
          // Only apply route_type filter when the field is present and not bus
          if (route.route_type !== undefined && route.route_type !== null && route.route_type !== 3) return false;
          return true;
        })
        .map(route => ({
          code:  String(route.route_short_name ?? route.route_id),
          name:  route.route_long_name || route.route_desc || '',
          color: route.route_color ? `#${route.route_color.replace('#', '')}` : '#0072CE',
        }))
        .sort((a, b) => {
          const na = parseInt(a.code), nb = parseInt(b.code);
          if (!isNaN(na) && !isNaN(nb)) return na - nb;
          return a.code.localeCompare(b.code);
        });

      if (bus.length > 0) {
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
        return res.json({ routes: bus, source: 'routes-api' });
      }
    }
  } catch (_) {
    // fall through to stops-based fallback
  }

  // ── FALLBACK: extract unique route codes from the stops feed ──
  // This is guaranteed to work — nearby.js already uses this endpoint successfully.
  try {
    const r = await fetch('https://api.metro.net/LACMTA/stops');
    if (!r.ok) throw new Error(`Metro stops API returned ${r.status}`);
    const stops = await r.json();

    const seen = new Set();
    for (const stop of stops) {
      const rid   = stop.route_id ?? stop.routes;
      const codes = Array.isArray(rid) ? rid.map(String) : (rid != null ? [String(rid)] : []);
      codes.forEach(c => { if (isBus(c)) seen.add(c); });
    }

    const routes = [...seen]
      .sort((a, b) => {
        const na = parseInt(a), nb = parseInt(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b);
      })
      .map(code => ({ code, name: '', color: '#0072CE' }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    return res.json({ routes, source: 'stops-fallback' });
  } catch (err) {
    return res.status(502).json({ error: err.message, routes: [] });
  }
}
