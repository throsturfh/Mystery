export type Settings = {
  music: number;
  sfx: number;
  mute: boolean;
};

const KEY = 'hollowmere-dispatch-settings';

export const DEFAULT_SETTINGS: Settings = { music: 0.7, sfx: 0.8, mute: false };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      music: clamp(parsed.music, DEFAULT_SETTINGS.music),
      sfx: clamp(parsed.sfx, DEFAULT_SETTINGS.sfx),
      mute: parsed.mute === true,
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

function clamp(value: unknown, fallback: number): number {
  return typeof value === 'number' && value >= 0 && value <= 1 ? value : fallback;
}
