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
  version: 4;
  room: RoomId;
  entry: string;
  x: number;
  y: number;
  face: 1 | -1;
  items: ItemId[];
  flags: Partial<Record<Flag, boolean>>;
  learnedTap: boolean;
};

const ROOMS = new Set<RoomId>(['office', 'shop', 'nook', 'stock']);
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
    version: 4,
    room: 'office',
    entry: 'start',
    x: 480,
    y: 578,
    face: 1,
    items: [],
    flags: {},
    learnedTap: false,
  };
}

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return freshSave();
    const parsed = JSON.parse(raw) as Partial<Save>;
    if (!parsed || parsed.version !== 4) return freshSave();
    if (!parsed.room || !ROOMS.has(parsed.room)) return freshSave();
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return freshSave();
    return {
      version: 4,
      room: parsed.room,
      entry: typeof parsed.entry === 'string' ? parsed.entry : 'start',
      x: parsed.x,
      y: parsed.y,
      face: parsed.face === 1 ? 1 : -1,
      items: Array.isArray(parsed.items) ? parsed.items.filter((id): id is ItemId => ITEMS.has(id as ItemId)) : [],
      flags: parsed.flags && typeof parsed.flags === 'object' ? parsed.flags : {},
      learnedTap: parsed.learnedTap === true,
    };
  } catch {
    return freshSave();
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
