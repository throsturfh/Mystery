import { cleanName, DEFAULT_PROFILE, type Pronouns } from './profile';

export const SAVE_KEY = 'hollowmere-dispatch-v1';

export type RoomId = 'office' | 'shop' | 'nook' | 'stock';
export type ItemId = 'lantern' | 'matches' | 'key' | 'pencil' | 'ledger' | 'book';
export type Flag =
  | 'introDone'
  | 'lanternLit'
  | 'ledgerWritten'
  | 'ambroseAsked'
  | 'bookShelved'
  | 'ambroseBye'
  | 'seenEnding';
export type Speaker = 'detective' | 'edith' | 'june' | 'ambrose';

export type Save = {
  version: 5;
  started: boolean;
  room: RoomId;
  entry: string;
  x: number;
  y: number;
  face: 1 | -1;
  items: ItemId[];
  flags: Partial<Record<Flag, boolean>>;
  learnedTap: boolean;
  name: string;
  pronouns: Pronouns;
  coat: string;
  hat: string;
  scarf: string;
  hints: number;
};

const ROOMS = new Set<RoomId>(['office', 'shop', 'nook', 'stock']);
const ITEMS = new Set<ItemId>(['lantern', 'matches', 'key', 'pencil', 'ledger', 'book']);
const PRONOUNS = new Set<Pronouns>(['they', 'he', 'she']);

export const ITEM_NAME: Record<ItemId, string> = {
  lantern: 'Lantern',
  matches: 'Matches',
  key: 'Stockroom key',
  pencil: 'Pencil',
  ledger: "Ambrose's ledger",
  book: 'The Lantern and the Lock',
};

export function freshSave(): Save {
  return {
    version: 5,
    started: false,
    room: 'office',
    entry: 'start',
    x: 480,
    y: 578,
    face: 1,
    items: [],
    flags: {},
    learnedTap: false,
    name: DEFAULT_PROFILE.name,
    pronouns: DEFAULT_PROFILE.pronouns,
    coat: DEFAULT_PROFILE.coat,
    hat: DEFAULT_PROFILE.hat,
    scarf: DEFAULT_PROFILE.scarf,
    hints: 0,
  };
}

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return freshSave();
    const parsed = JSON.parse(raw) as Partial<Save>;
    if (!parsed || parsed.version !== 5) return freshSave();
    if (!parsed.room || !ROOMS.has(parsed.room)) return freshSave();
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return freshSave();
    const pronouns = PRONOUNS.has(parsed.pronouns as Pronouns) ? (parsed.pronouns as Pronouns) : 'they';
    return {
      version: 5,
      started: parsed.started === true,
      room: parsed.room,
      entry: typeof parsed.entry === 'string' ? parsed.entry : 'start',
      x: parsed.x,
      y: parsed.y,
      face: parsed.face === 1 ? 1 : -1,
      items: Array.isArray(parsed.items) ? parsed.items.filter((id): id is ItemId => ITEMS.has(id as ItemId)) : [],
      flags: parsed.flags && typeof parsed.flags === 'object' ? parsed.flags : {},
      learnedTap: parsed.learnedTap === true,
      name: cleanName(typeof parsed.name === 'string' ? parsed.name : DEFAULT_PROFILE.name),
      pronouns,
      coat: typeof parsed.coat === 'string' ? parsed.coat : DEFAULT_PROFILE.coat,
      hat: typeof parsed.hat === 'string' ? parsed.hat : DEFAULT_PROFILE.hat,
      scarf: typeof parsed.scarf === 'string' ? parsed.scarf : DEFAULT_PROFILE.scarf,
      hints: typeof parsed.hints === 'number' ? parsed.hints : 0,
    };
  } catch {
    return freshSave();
  }
}

export function hasContinue(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Partial<Save>;
    return parsed.version === 5 && parsed.started === true;
  } catch {
    return false;
  }
}

export function writeSave(save: Save): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* private mode and full disks should not trap the player */
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function journalEntries(save: Save): { title: string; note: string }[] {
  const notes: { title: string; note: string }[] = [];
  if (save.flags.introDone) notes.push({ title: 'The brief', note: 'Edith sent you to the Bellweather Bookshop. The books climb home overnight. The doorbell rings for nobody.' });
  if (save.items.includes('key') || save.flags.lanternLit || save.flags.ledgerWritten) notes.push({ title: 'June', note: 'The ghost is Ambrose, her grandfather. She gave you the stockroom key.' });
  if (save.flags.lanternLit) notes.push({ title: 'The wick', note: 'Matches from the nook. The lantern is entirely too pleased with itself.' });
  if (save.flags.ledgerWritten) notes.push({ title: 'The last sale', note: 'One copy of The Lantern and the Lock, sold to A. Bellweather.' });
  if (save.flags.ambroseAsked || save.flags.bookShelved) notes.push({ title: 'What he wants', note: 'The green book belongs in the gap on the shop shelf, between the poets.' });
  if (save.flags.ambroseBye) notes.push({ title: 'Goodnight', note: 'Ambrose locked up. The doorbell was only him, checking June got home.' });
  if (save.flags.seenEnding) notes.push({ title: 'The envelope', note: 'To be continued: No. 9 Lantern Lane.' });
  if (notes.length === 0) notes.push({ title: 'A blank page', note: 'Nothing worth ink yet. Edith would disagree, on principle.' });
  return notes;
}

export function starsFor(hints: number): number {
  if (hints <= 0) return 3;
  if (hints <= 2) return 2;
  return 1;
}
