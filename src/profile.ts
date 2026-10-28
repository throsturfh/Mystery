export type Tone = 'sarcastic' | 'warm' | 'dramatic';

export type Profile = {
  name: string;
  coat: string;
  hat: string;
  scarf: string;
  tone: Tone;
};

export const COATS = [
  { id: 'tan', label: 'Tan', color: '#8d7348' },
  { id: 'olive', label: 'Olive', color: '#5c6840' },
  { id: 'charcoal', label: 'Charcoal', color: '#4a4642' },
  { id: 'wine', label: 'Wine', color: '#7a3a48' },
] as const;

export const HATS = [
  { id: 'brown', label: 'Brown', color: '#5a4030' },
  { id: 'black', label: 'Black', color: '#2c2824' },
  { id: 'moss', label: 'Moss', color: '#3e4a32' },
  { id: 'plum', label: 'Plum', color: '#4a2838' },
] as const;

export const SCARVES = [
  { id: 'plaid', label: 'Plaid', color: '#8a3030' },
  { id: 'pine', label: 'Pine', color: '#2f5a40' },
  { id: 'gold', label: 'Gold', color: '#a07830' },
  { id: 'ink', label: 'Ink', color: '#2a4068' },
] as const;

export const TONES: { id: Tone; label: string }[] = [
  { id: 'sarcastic', label: 'Sarcastic' },
  { id: 'warm', label: 'Warm' },
  { id: 'dramatic', label: 'Dramatic' },
];

export const DEFAULT_PROFILE: Profile = {
  name: 'Detective',
  coat: 'tan',
  hat: 'brown',
  scarf: 'plaid',
  tone: 'sarcastic',
};

const TONE_SET = new Set<Tone>(['sarcastic', 'warm', 'dramatic']);

export function cleanName(raw: string): string {
  const trimmed = raw.replace(/\s+/g, ' ').trim().slice(0, 16);
  return trimmed || DEFAULT_PROFILE.name;
}

export function cleanTone(raw: unknown): Tone {
  return TONE_SET.has(raw as Tone) ? (raw as Tone) : 'sarcastic';
}

export function isDefaultLook(profile: Profile): boolean {
  return profile.coat === 'tan' && profile.hat === 'brown' && profile.scarf === 'plaid';
}
