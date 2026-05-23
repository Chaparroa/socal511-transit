// Returns all Metro bus routes from the live API, filtered to route_type 3 (bus only).
// Caches aggressively — route lists change infrequently.

const RAIL_IDS = new Set(['801', '802', '803', '804', '805', '806', '807', '808', '901', '910']);

export default async function handler(req, res) {
  try {
    const r = await fetch('https://api.metro.net/LACMTA/routes');
    if (!r.ok) throw new Error(`Metro routes API returned ${r.status}`);
    const data = await r.json();

    const bus = data
      .filter(route => {
        if (route.route_type !== undefined) return route.route_type === 3;
        const code = String(route.route_short_name ?? route.route_id ?? '');
        if (RAIL_IDS.has(code)) return false;
        if (/^[A-K]$/.test(code)) return false;
        return true;
      })
      .map(route => ({
        code:  String(route.route_short_name ?? route.route_id),
        name:  route.route_long_name || route.route_desc || '',
        color: route.route_color ? `#${route.route_color}` : '#0072CE',
      }))
      .sort((a, b) => {
        const na = parseInt(a.code), nb = parseInt(b.code);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.code.localeCompare(b.code);
      });

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.json({ routes: bus });
  } catch (err) {
    res.status(502).json({ error: err.message, routes: [] });
  }
}
