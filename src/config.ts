export const W = 1280;
export const H = 720;
export const HUD_TOP = 624;

export const SHOW_SPOTS =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('spots');

export const SPEAKER_COLOR = {
  detective: '#f6edd6',
  edith: '#e6c98a',
  june: '#d5e4f2',
  ambrose: '#d9f6e4',
} as const;

export const SPEAKER_NAME = {
  detective: 'You',
  edith: 'Edith',
  june: 'June',
  ambrose: 'Ambrose',
} as const;
