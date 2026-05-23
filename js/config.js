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
