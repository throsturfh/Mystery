import type { CaseDef, SaveData } from './types';

export function linkKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function hasLink(links: [string, string][], a: string, b: string): boolean {
  const [x, y] = linkKey(a, b);
  return links.some(([p, q]) => p === x && q === y);
}

export function isConnected(ids: string[], links: [string, string][]): boolean {
  if (ids.length <= 1) return true;
  const set = new Set(ids);
  const adj = new Map<string, string[]>();
  for (const id of ids) adj.set(id, []);
  for (const [a, b] of links) {
    if (!set.has(a) || !set.has(b)) continue;
    adj.get(a)?.push(b);
    adj.get(b)?.push(a);
  }
  const seen = new Set<string>();
  const stack = [ids[0]];
  while (stack.length) {
    const n = stack.pop();
    if (n === undefined || seen.has(n)) continue;
    seen.add(n);
    for (const m of adj.get(n) ?? []) stack.push(m);
  }
  return seen.size === ids.length;
}

export function threadReady(save: SaveData, def: CaseDef): boolean {
  const ids = def.thread.clueIds;
  if (!ids.every((id) => save.cluesPinned.includes(id))) return false;
  return isConnected(ids, save.links);
}

export function boardComplete(save: SaveData, def: CaseDef): boolean {
  const ids = def.clues.map((c) => c.id);
  if (!ids.every((id) => save.cluesPinned.includes(id))) return false;
  return isConnected(ids, save.links);
}

export function linkQuotaMet(save: SaveData, def: CaseDef): boolean {
  const step = def.steps.find((s) => s.kind === 'link');
  const min = step && step.kind === 'link' ? step.minLinks : 1;
  return save.tools.emf.owned && save.cluesPinned.length >= 2 && save.links.length >= min;
}

export interface StarLine {
  star: number;
  earned: boolean;
  text: string;
}

export function starLines(save: SaveData, def: CaseDef): StarLine[] {
  const second = boardComplete(save, def);
  const taps = save.encounterMisses === 0;
  const calm = save.fearStayedLow;
  const third = save.encounterDone && taps && calm;
  let thirdText = 'No missed beats, and the fear stayed low.';
  if (!third) {
    if (!taps && !calm) thirdText = 'Hit every lamp beat, and keep fear in the low band.';
    else if (!taps) thirdText = 'Tap each lamp while it glows — missed beats cost a star.';
    else thirdText = 'Keep the fear meter in the low band. Tea settles a room.';
  }
  return [
    { star: 1, earned: true, text: 'You closed the case. That is the job.' },
    {
      star: 2,
      earned: second,
      text: second
        ? 'Every clue is pinned, and the string holds.'
        : 'Pin all five clues and tie them with red string.',
    },
    { star: 3, earned: third, text: thirdText },
  ];
}

export function earnedStars(save: SaveData, def: CaseDef): number[] {
  return starLines(save, def)
    .filter((l) => l.earned)
    .map((l) => l.star);
}
