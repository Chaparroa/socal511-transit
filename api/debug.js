// Temporary diagnostic endpoint — remove after debugging
// Visit /api/debug to see raw Metro API response shapes

export default async function handler(req, res) {
  const results = {};

  // Sample from /stops
  try {
    const r     = await fetch('https://api.metro.net/LACMTA/stops');
    const stops = await r.json();
    results.stops_status = r.status;
    results.stops_count  = Array.isArray(stops) ? stops.length : typeof stops;
    results.stops_sample = Array.isArray(stops) ? stops.slice(0, 2) : stops;
  } catch (e) {
    results.stops_error = e.message;
  }

  // Sample from /routes
  try {
    const r      = await fetch('https://api.metro.net/LACMTA/routes');
    const routes = await r.json();
    results.routes_status = r.status;
    results.routes_count  = Array.isArray(routes) ? routes.length : typeof routes;
    results.routes_sample = Array.isArray(routes) ? routes.slice(0, 2) : routes;
  } catch (e) {
    results.routes_error = e.message;
  }

  // Sample from /route_overview/720 (known working route)
  try {
    const r    = await fetch('https://api.metro.net/LACMTA/route_overview/720');
    const data = await r.json();
    results.route_overview_status = r.status;
    results.route_overview_sample = data;
  } catch (e) {
    results.route_overview_error = e.message;
  }

  res.setHeader('Cache-Control', 'no-store');
  res.json(results);
}
