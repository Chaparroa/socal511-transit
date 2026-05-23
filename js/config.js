// Agency and route configuration.
// Add a new agency here when its GTFS-RT feed is ready — no other files change.

export const AGENCIES = {
  metro: {
    id:        'metro',
    name:      'LA Metro',
    shortName: 'Metro',
    color:     '#0072CE',
    wsBase:    'wss://api.metro.net/ws/LACMTA/vehicle_positions',
    active:    true,
  },
  bbb: {
    id:        'bbb',
    name:      'Big Blue Bus',
    shortName: 'BBB',
    color:     '#2A5FA5',
    wsBase:    null,  // vehicle positions feed offline — revisit when BBB fixes feed
    active:    false,
  },
};

// Metro rail/busway lines with official colors and letter codes.
// available=true  → live real-time data via api.metro.net
// available=false → requires Swiftly API key (heavy rail not in current API)
export const METRO_RAIL = [
  { code: 'A', label: 'A Line', desc: 'Long Beach – Downtown LA',        color: '#0075C9', available: false },
  { code: 'B', label: 'B Line', desc: 'North Hollywood – Union Station', color: '#E3131B', available: false },
  { code: 'C', label: 'C Line', desc: 'Redondo Beach – Norwalk',          color: '#09A550', available: false },
  { code: 'D', label: 'D Line', desc: 'Koreatown – Union Station',         color: '#794B9E', available: false },
  { code: 'E', label: 'E Line', desc: 'Santa Monica – Downtown LA',       color: '#939597', available: false },
  { code: 'G', label: 'G Line', desc: 'Chatsworth – North Hollywood',     color: '#F68B1F', available: true  },
  { code: 'J', label: 'J Line', desc: 'El Monte – San Pedro',             color: '#A6A8AB', available: true  },
  { code: 'K', label: 'K Line', desc: 'Expo/Crenshaw – LAX',              color: '#E96BB0', available: false },
];

// Featured bus routes for the landing page picker
export const METRO_BUS_FEATURED = [
  { code: '2',   desc: 'Sunset Bl' },
  { code: '4',   desc: 'Santa Monica Bl' },
  { code: '10',  desc: 'Doheny/Pico' },
  { code: '14',  desc: 'Beverly Bl' },
  { code: '16',  desc: 'Venice Bl' },
  { code: '18',  desc: 'Wilshire Bl' },
  { code: '20',  desc: 'Wilshire Bl (limited)' },
  { code: '28',  desc: 'Olympic Bl' },
  { code: '33',  desc: 'Venice Bl' },
  { code: '40',  desc: 'Figueroa St' },
  { code: '45',  desc: 'Hill St / Broadway' },
  { code: '51',  desc: 'Vernon Ave' },
  { code: '60',  desc: 'Montebello' },
  { code: '66',  desc: 'Central Ave' },
  { code: '70',  desc: 'Figueroa Rapid' },
  { code: '76',  desc: 'Lankershim Bl' },
  { code: '81',  desc: 'Main St / La Brea' },
  { code: '105', desc: 'Imperial Hwy' },
  { code: '108', desc: 'Slauson Ave' },
  { code: '111', desc: 'Sepulveda Bl' },
  { code: '115', desc: 'Aviation Bl' },
  { code: '202', desc: 'Hoover St' },
  { code: '204', desc: 'Vermont Ave' },
  { code: '207', desc: 'Western Ave' },
  { code: '210', desc: 'Melrose Ave' },
  { code: '212', desc: 'Vermont/Harbor Rapid' },
  { code: '217', desc: 'Fairfax Ave' },
  { code: '218', desc: 'La Brea Ave' },
  { code: '222', desc: 'Ventura Bl' },
  { code: '232', desc: 'Artesia Bl' },
  { code: '240', desc: 'San Fernando Rd' },
  { code: '251', desc: 'Colorado Bl' },
  { code: '260', desc: 'Valley Bl' },
  { code: '344', desc: 'Limited — Cesar Chavez' },
  { code: '460', desc: 'Express — Whittier' },
  { code: '487', desc: 'Westwood/Downtown Express' },
  { code: '489', desc: 'Westwood/Downtown Express' },
  { code: '501', desc: 'Express — Claremont' },
  { code: '550', desc: 'Express — Chatsworth' },
  { code: '577', desc: 'Express — Sierra Madre' },
  { code: '720', desc: 'Wilshire Rapid' },
  { code: '754', desc: 'Vermont/Harbor Rapid' },
  { code: '761', desc: 'Vermont Rapid' },
];
