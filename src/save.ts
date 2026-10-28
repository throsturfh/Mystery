import { cleanDetective, type DetectiveId } from './detectives';
import { cleanName, cleanTone, DEFAULT_PROFILE, type Tone } from './profile';

export const SAVE_KEY = 'hollowmere-dispatch-v1';

export type RoomId = 'office' | 'shop' | 'nook' | 'stock' | 'trophy';
export type ItemId = 'lantern' | 'matches' | 'key' | 'pencil' | 'ledger' | 'book';
export type Flag =
  | 'introDone'
  | 'lanternLit'
  | 'ledgerWritten'
  | 'ambroseAsked'
  | 'bookShelved'
  | 'ambroseBye'
  | 'seenEnding'
  | 'gotKey';
export type Speaker = 'detective' | 'edith' | 'june' | 'ambrose';

export type Cases = {
  bookshop: boolean;
  lantern: boolean;
};

export type Save = {
  version: 8;
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
  detective: DetectiveId;
  coat: string;
  hat: string;
  scarf: string;
  tone: Tone;
  hints: number;
  spirit: boolean;
  cases: Cases;
};

const ROOMS = new Set<RoomId>(['office', 'shop', 'nook', 'stock', 'trophy']);
const ITEMS = new Set<ItemId>(['lantern', 'matches', 'key', 'pencil', 'ledger', 'book']);

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
    version: 8,
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
    detective: 'crowe',
    coat: DEFAULT_PROFILE.coat,
    hat: DEFAULT_PROFILE.hat,
    scarf: DEFAULT_PROFILE.scarf,
    tone: DEFAULT_PROFILE.tone,
    hints: 0,
    spirit: false,
    cases: { bookshop: true, lantern: false },
  };
}

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return freshSave();
    const parsed = JSON.parse(raw) as Partial<Omit<Save, 'version' | 'cases'>> & {
      version?: number;
      pronouns?: unknown;
      moths?: unknown;
      cases?: Partial<Cases>;
    };
    if (!parsed || (parsed.version !== 5 && parsed.version !== 6 && parsed.version !== 7 && parsed.version !== 8)) return freshSave();
    if (!parsed.room || !ROOMS.has(parsed.room)) return freshSave();
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return freshSave();
    const flags = parsed.flags && typeof parsed.flags === 'object' ? parsed.flags : {};
    let items = Array.isArray(parsed.items) ? parsed.items.filter((id): id is ItemId => ITEMS.has(id as ItemId)) : [];
    // After the sale, the ledger is on the desk and the pencil is on the counter, even in an older save.
    if (flags.ledgerWritten) items = items.filter((id) => id !== 'pencil' && id !== 'ledger');
    const cases: Cases = {
      bookshop: true,
      lantern: parsed.cases?.lantern === true || flags.seenEnding === true,
    };
    return {
      version: 8,
      started: parsed.started === true,
      room: parsed.room,
      entry: typeof parsed.entry === 'string' ? parsed.entry : 'start',
      x: parsed.x,
      y: parsed.y,
      face: parsed.face === 1 ? 1 : -1,
      items,
      flags,
      learnedTap: parsed.learnedTap === true,
      name: cleanName(typeof parsed.name === 'string' ? parsed.name : DEFAULT_PROFILE.name),
      detective: cleanDetective((parsed as { detective?: unknown }).detective),
      coat: typeof parsed.coat === 'string' ? parsed.coat : DEFAULT_PROFILE.coat,
      hat: typeof parsed.hat === 'string' ? parsed.hat : DEFAULT_PROFILE.hat,
      scarf: typeof parsed.scarf === 'string' ? parsed.scarf : DEFAULT_PROFILE.scarf,
      tone: cleanTone(parsed.tone),
      hints: typeof parsed.hints === 'number' ? parsed.hints : 0,
      spirit: parsed.spirit === true,
      cases,
    };
  } catch {
    return freshSave();
  }
}

export function hasContinue(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { version?: number; started?: boolean };
    return (parsed.version === 5 || parsed.version === 6 || parsed.version === 7 || parsed.version === 8) && parsed.started === true;
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
  const who = save.name || 'Detective';
  if (save.flags.introDone) notes.push({ title: 'The brief', note: 'Edith sent the detective to the Bellweather Bookshop. The books climb home overnight. The doorbell rings for nobody.' });
  if (save.items.includes('key') || save.flags.lanternLit || save.flags.ledgerWritten) notes.push({ title: 'June', note: 'The ghost is Ambrose, her grandfather. She gave the detective the stockroom key.' });
  if (save.flags.lanternLit) notes.push({ title: 'The wick', note: 'Matches from the nook. The lantern is entirely too pleased with itself.' });
  if (save.flags.ledgerWritten) notes.push({ title: 'The last sale', note: 'One copy of The Lantern and the Lock, sold to A. Bellweather.' });
  if (save.flags.ambroseAsked || save.flags.bookShelved) notes.push({ title: 'What he wants', note: 'The green book belongs in the gap on the shop shelf, between the poets.' });
  if (save.flags.ambroseBye) notes.push({ title: 'Goodnight', note: 'Ambrose locked up. The doorbell was only him, checking June got home.' });
  if (save.flags.seenEnding) notes.push({ title: 'The envelope', note: `To be continued: No. 9 Lantern Lane. Filed under ${who}.` });
  if (notes.length === 0) notes.push({ title: 'A blank page', note: 'Nothing worth ink yet. Edith would disagree, on principle.' });
  return notes;
}

export function starsFor(hints: number): number {
  if (hints <= 0) return 3;
  if (hints <= 2) return 2;
  return 1;
}
