export const W = 1280;
export const H = 720;
export const BAR = { x: 0, y: 568, w: 1280, h: 152 };

export const SHOW_SPOTS =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('spots');

export const FONT = {
  display: "'Cinzel', Georgia, serif",
  body: "'Cormorant Garamond', Georgia, serif",
};

export const CSS = {
  ink: '#1c140e',
  cream: '#f6edd6',
  paper: '#f3e6c8',
  muted: '#cbb892',
  brass: '#e6c98a',
  night: '#d7deea',
  good: '#d7f0df',
  warn: '#f0d2a4',
  bad: '#e7b4ae',
  ecto: '#d9f6e4',
  dim: '#a89880',
};

export const HEX = {
  night: 0x140e0a,
  nightDeep: 0x0c0907,
  panel: 0x24180f,
  panelEdge: 0x6e5428,
  brass: 0xc6a15a,
  brassDeep: 0x8a6430,
  paper: 0xf3e6c8,
  paperEdge: 0xcbb892,
  ink: 0x1c140e,
  lamp: 0xffc56e,
  ecto: 0xc6f0d4,
  cold: 0x9ad7ff,
  clue: 0xf0c56e,
  ambient: 0x7ec8ff,
  string: 0x9a2c2c,
  fearLow: 0x7ea2e0,
  fearMid: 0xe0a15a,
  fearHigh: 0xd4655d,
  cork: 0x6b4632,
  good: 0x214e3c,
  wax: 0x7a2e2a,
  wood: 0x3a2618,
  woodDark: 0x1a120c,
};
