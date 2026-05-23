// Returns all Metro bus routes.
// Static list is the guaranteed baseline — same routes used by api/nearby.js.
// Tries Metro's /routes endpoint first to get names + colors; merges with static.

const RAIL_CODES = new Set(['801','802','803','804','805','806','807','808','901','910']);

function isBus(code) {
  if (!code) return false;
  if (RAIL_CODES.has(String(code))) return false;
  if (/^[A-K]$/.test(String(code))) return false;
  return true;
}

// Static list — matches BUS_ROUTES in api/nearby.js
const STATIC_ROUTES = [
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

// Named descriptions for the most common routes (from config.js)
const KNOWN_NAMES = {
  '2':'Sunset Bl', '4':'Santa Monica Bl', '10':'Doheny/Pico', '14':'Beverly Bl',
  '16':'Venice Bl', '18':'Wilshire Bl', '20':'Wilshire Bl (limited)', '28':'Olympic Bl',
  '33':'Venice Bl', '40':'Figueroa St', '45':'Hill St / Broadway', '51':'Vernon Ave',
  '60':'Montebello', '66':'Central Ave', '70':'Figueroa Rapid', '76':'Lankershim Bl',
  '81':'Main St / La Brea', '105':'Imperial Hwy', '108':'Slauson Ave',
  '111':'Sepulveda Bl', '115':'Aviation Bl', '202':'Hoover St', '204':'Vermont Ave',
  '207':'Western Ave', '210':'Melrose Ave', '212':'Vermont/Harbor Rapid',
  '217':'Fairfax Ave', '218':'La Brea Ave', '222':'Ventura Bl', '232':'Artesia Bl',
  '240':'San Fernando Rd', '251':'Colorado Bl', '260':'Valley Bl',
  '344':'Limited — Cesar Chavez', '460':'Express — Whittier',
  '487':'Westwood/Downtown Express', '501':'Express — Claremont',
  '550':'Express — Chatsworth', '577':'Express — Sierra Madre',
  '720':'Wilshire Rapid', '754':'Vermont/Harbor Rapid', '761':'Vermont Rapid',
};

export default async function handler(req, res) {
  // Try Metro's routes endpoint — accept any shape it returns
  let liveMap = new Map(); // code -> {name, color}
  try {
    const r = await fetch('https://api.metro.net/LACMTA/routes', { signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const raw  = await r.json();
      const data = Array.isArray(raw) ? raw
                 : Array.isArray(raw.routes) ? raw.routes
                 : Array.isArray(raw.data)   ? raw.data
                 : [];

      for (const route of data) {
        const code = String(route.route_short_name ?? route.route_id ?? '');
        if (!isBus(code)) continue;
        liveMap.set(code, {
          name:  route.route_long_name || route.route_desc || '',
          color: route.route_color ? `#${route.route_color.replace(/^#/, '')}` : '#0072CE',
        });
      }
    }
  } catch (_) {}

  // Merge: live data enriches the static list, and adds any extra routes from live
  const codeSet = new Set([...STATIC_ROUTES, ...liveMap.keys()].filter(isBus));

  const routes = [...codeSet]
    .sort((a, b) => {
      const na = parseInt(a), nb = parseInt(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    })
    .map(code => {
      const live = liveMap.get(code) || {};
      return {
        code,
        name:  live.name  || KNOWN_NAMES[code] || '',
        color: live.color || '#0072CE',
      };
    });

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.json({ routes });
}
