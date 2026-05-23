// Proxies Metro REST calls server-side to bypass browser CORS restrictions.
// Returns combined route metadata + stops in a single request.

// G and J are BRT busways — Metro API uses numeric codes, not letter names
const ROUTE_ALIAS = {
  'G': '901',
  'J': '910',
};

// Heavy rail lines are not available in this API (requires Swiftly partnership key)
const UNAVAILABLE_RAIL = new Set(['A', 'B', 'C', 'D', 'E', 'K']);

export default async function handler(req, res) {
  const { route, agency } = req.query;

  if (!route) {
    return res.status(400).json({ error: 'Missing route parameter' });
  }

  // Only Metro supported for now; BBB added when their feed is fixed
  if (agency && agency !== 'metro') {
    return res.status(400).json({ error: `Agency '${agency}' not yet supported` });
  }

  const upper = route.toUpperCase();

  if (UNAVAILABLE_RAIL.has(upper)) {
    return res.status(503).json({
      error: `Metro ${upper} Line real-time data is not yet available. Heavy rail (A, B, C, D, E, K lines) requires an API upgrade — coming soon.`,
      unavailable: true,
    });
  }

  const apiCode = ROUTE_ALIAS[upper] || route;
  const base    = 'https://api.metro.net/LACMTA';

  try {
    const [overviewRes, stopsRes] = await Promise.all([
      fetch(`${base}/route_overview/${apiCode}`, { signal: AbortSignal.timeout(8000) }),
      fetch(`${base}/route_stops/${apiCode}`,    { signal: AbortSignal.timeout(8000) }),
    ]);

    if (!overviewRes.ok) throw new Error(`route_overview HTTP ${overviewRes.status}`);
    if (!stopsRes.ok)    throw new Error(`route_stops HTTP ${stopsRes.status}`);

    const [overviewData, stopsData] = await Promise.all([
      overviewRes.json(),
      stopsRes.json(),
    ]);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.json({
      route:    overviewData[0] ?? null,
      stops:    stopsData,
      agency:   'metro',
      fetchedAt: Date.now(),
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
