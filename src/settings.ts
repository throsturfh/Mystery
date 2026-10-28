import { cleanTone, type Tone } from './profile';

export type Settings = {
  music: number;
  sfx: number;
  mute: boolean;
  vibration: boolean;
  reduceEffects: boolean;
  tone: Tone;
};

const KEY = 'hollowmere-dispatch-settings';

export const DEFAULT_SETTINGS: Settings = {
  music: 0.7,
  sfx: 0.8,
  mute: false,
  vibration: true,
  reduceEffects: false,
  tone: 'sarcastic',
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      music: clamp(parsed.music, DEFAULT_SETTINGS.music),
      sfx: clamp(parsed.sfx, DEFAULT_SETTINGS.sfx),
      mute: parsed.mute === true,
      vibration: parsed.vibration !== false,
      reduceEffects: parsed.reduceEffects === true,
      tone: cleanTone(parsed.tone),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* private mode should not trap the player */
  }
}

export function buzz(pattern: number | number[]): void {
  const settings = loadSettings();
  if (!settings.vibration) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* iOS and desktop ignore this on purpose */
  }
}

function clamp(value: unknown, fallback: number): number {
  return typeof value === 'number' && value >= 0 && value <= 1 ? value : fallback;
}
