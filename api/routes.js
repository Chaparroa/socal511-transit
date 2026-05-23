// Returns active Metro bus routes.
// Validates each candidate against route_overview — routes returning empty data are excluded.
// Result is cached 24h at the CDN edge (stale-while-revalidate 7d), so cold hits are rare.

// Candidate routes — validated against Metro's API as of 2026-05-23.
// Dead routes are pruned at runtime; add new routes here when Metro activates them.
const CANDIDATE_ROUTES = [
  '2','4','10','14','16','18','20','28','30','33','37','38','40','45','48','51','53','55',
  '60','62','66','70','76','78','81','90','92','94','105','108','111','115','117','120',
  '125','128','152','154','155','158','161','162','164','165','166','167','169','177',
  '180','182','202','204','205','206','207','209','210','212','215','217','218','222',
  '224','230','232','233','234','236','240','242','243','244','246','251','256','258',
  '260','265','267','268','294','344','460','487','489','501','550','577','720','754','761',
];

async function fetchRouteInfo(code) {
  const fallback = { code, name: '', color: '#0072CE' };
  try {
    const r = await fetch(`https://api.metro.net/LACMTA/route_overview/${code}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return fallback;
    const data = await r.json();
    // Empty array means Metro confirms this route has no active data — exclude it.
    // Any other failure (timeout, network error) keeps the route with default styling.
    const route = Array.isArray(data) && data.length ? data[0] : null;
    if (!route) return null;
    return {
      code,
      name:  route.description || route.route_long_name || route.route_desc || '',
      color: route.route_color ? `#${route.route_color.replace(/^#/, '')}` : '#0072CE',
    };
  } catch {
    return fallback;
  }
}

export default async function handler(req, res) {
  const results = await Promise.all(CANDIDATE_ROUTES.map(fetchRouteInfo));

  const routes = results
    .filter(Boolean)
    .sort((a, b) => {
      const na = parseInt(a.code), nb = parseInt(b.code);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.code.localeCompare(b.code);
    });

  // Long cache — 24h at CDN edge, serve stale for up to 7d while revalidating
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  res.json({ routes });
}
