import { getCase } from './data/cases';
import { earnedStars, hasLink, linkKey, linkQuotaMet } from './stars';
import type { CaseDef, CoatId, Economy, HatId, SaveData, TutorialStep } from './types';

export const SAVE_KEY = 'hollowmere-dispatch-v1';

let memory: SaveData | null = null;

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function createInitial(def: CaseDef): SaveData {
  return {
    version: 2,
    caseId: def.id,
    detective: { name: '', coat: '', hat: '', pin: false },
    resources: {
      evidence: 0,
      ectoplasm: 0,
      emf: 0,
      fear: def.economy.fearStart,
    },
    emfFraction: 0,
    fearMs: 0,
    tools: {
      emf: { owned: false, level: 0, placedRoom: '' },
      flashlight: { owned: false, tapLevel: 0 },
    },
    rooms: def.rooms.filter((r) => r.unlock === 'start').map((r) => r.id),
    cluesFound: [],
    objectsFound: [],
    cluesPinned: [],
    links: [],
    tutorialIndex: 0,
    caseStatus: 'create',
    fearStayedLow: true,
    encounterMisses: 0,
    encounterDone: false,
    encounterRewarded: false,
    stars: [],
    bankedEvidenceBonus: 0,
    trophyBookmark: false,
    storyMinutes: def.economy.storyStartMinutes,
    lastTick: Date.now(),
    muted: false,
    teaTaken: false,
    lastTeaGain: 0,
    seenEnvelope: false,
    place: 'office',
    awayNotice: null,
  };
}

function read(): SaveData | null {
  const raw = storage()?.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SaveData;
    if (!parsed || parsed.version !== 2) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getSave(): SaveData {
  if (memory) return memory;
  memory = read() ?? createInitial(getCase('bellweather'));
  return memory;
}

export function persist(save: SaveData = getSave()): void {
  memory = save;
  try {
    storage()?.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* private mode: keep the in-memory file */
  }
}

export function resetSave(): void {
  memory = null;
  try {
    storage()?.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function currentStep(save: SaveData, def: CaseDef): TutorialStep {
  const i = Math.max(0, Math.min(save.tutorialIndex, def.steps.length - 1));
  return def.steps[i];
}

export function stepIndex(def: CaseDef, id: string): number {
  return def.steps.findIndex((s) => s.id === id);
}

export function advance(save: SaveData, def: CaseDef): void {
  if (save.tutorialIndex < def.steps.length - 1) save.tutorialIndex += 1;
  persist(save);
}

export function formatClock(minutes: number): string {
  const day = 24 * 60;
  const m = ((minutes % day) + day) % day;
  let h = Math.floor(m / 60);
  const min = m % 60;
  const suffix = h >= 12 ? 'p.m.' : 'a.m.';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${min.toString().padStart(2, '0')} ${suffix}`;
}

export function formatAway(hours: number): string {
  if (hours < 1) {
    const m = Math.max(1, Math.round(hours * 60));
    return m === 1 ? '1 minute' : `${m} minutes`;
  }
  const rounded = Math.round(hours * 10) / 10;
  return rounded === 1 ? '1 hour' : `${rounded} hours`;
}

export function fearBand(fear: number, economy: Economy): 'low' | 'mid' | 'high' {
  if (fear > economy.fearMidMax) return 'high';
  if (fear > economy.fearLowMax) return 'mid';
  return 'low';
}

export function ambientCap(fear: number, economy: Economy): number {
  const band = fearBand(fear, economy);
  if (band === 'high') return 5;
  if (band === 'mid') return 3;
  return 2;
}

/**
 * Apply elapsed real time.
 * EMF accrues only while a meter is placed and the case is active.
 * Gaps longer than offlineGapMs are treated as rest: EMF is capped, fear does not rise.
 * Returns EMF gained during this call.
 */
export function applyTime(save: SaveData, now: number, opts: { fear: boolean; economy: Economy }): number {
  const economy = opts.economy;
  let dt = Math.max(0, now - save.lastTick);
  const offline = dt > economy.offlineGapMs;
  const capMs = economy.offlineCapHours * 3_600_000;
  const capped = offline && dt > capMs;
  const emfDt = offline ? Math.min(dt, capMs) : dt;
  const fearDt = opts.fear && !offline ? dt : 0;
  let gained = 0;
  const tool = save.tools.emf;
  if (save.caseStatus === 'active' && tool.owned && tool.placedRoom && tool.level > 0) {
    const perHour = tool.level >= 2 ? economy.emfPerHour[2] : economy.emfPerHour[1];
    save.emfFraction += emfDt * (perHour / 3_600_000);
    gained = Math.floor(save.emfFraction);
    save.emfFraction -= gained;
    if (gained > 0) save.resources.emf += gained;
  }
  if (fearDt > 0 && save.caseStatus === 'active') {
    save.fearMs += fearDt;
    while (save.fearMs >= economy.fearMsPerPoint && save.resources.fear < 100) {
      save.fearMs -= economy.fearMsPerPoint;
      save.resources.fear += 1;
      if (save.resources.fear > economy.fearLowMax) save.fearStayedLow = false;
    }
  }
  save.lastTick = now;
  if (offline && gained >= 1 && save.caseStatus === 'active') {
    save.awayNotice = {
      emf: gained,
      hours: Math.min(economy.offlineCapHours, dt / 3_600_000),
      capped,
    };
  }
  persist(save);
  return gained;
}

export function dismissAway(save: SaveData): void {
  save.awayNotice = null;
  persist(save);
}

export function markFound(save: SaveData, id: string): boolean {
  if (save.objectsFound.includes(id)) return false;
  save.objectsFound.push(id);
  persist(save);
  return true;
}

export function noteClue(save: SaveData, def: CaseDef, id: string): boolean {
  if (save.cluesFound.includes(id)) return false;
  if (!def.clues.some((c) => c.id === id)) return false;
  save.cluesFound.push(id);
  save.resources.evidence += def.economy.clueEvidence;
  persist(save);
  return true;
}

export function addEvidence(save: SaveData, amount: number): void {
  save.resources.evidence += amount;
  persist(save);
}

export function unlockEvidenceRoom(save: SaveData, def: CaseDef, roomId: string): boolean {
  if (save.rooms.includes(roomId)) return true;
  const room = def.rooms.find((r) => r.id === roomId);
  if (!room || room.unlock !== 'evidence') return false;
  const cost = room.cost ?? 0;
  if (save.resources.evidence < cost) return false;
  save.resources.evidence -= cost;
  save.rooms.push(roomId);
  persist(save);
  return true;
}

export function giveEmf(save: SaveData): void {
  if (!save.tools.emf.owned) {
    save.tools.emf.owned = true;
    save.tools.emf.level = 1;
  }
  persist(save);
}

export function upgradeEmf(save: SaveData, def: CaseDef): boolean {
  const tool = save.tools.emf;
  if (!tool.owned || tool.level >= 2) return false;
  if (save.resources.ectoplasm < def.economy.upgradeCost) return false;
  save.resources.ectoplasm -= def.economy.upgradeCost;
  tool.level = 2;
  persist(save);
  return true;
}

export function placeEmf(save: SaveData, roomId: string): void {
  save.tools.emf.placedRoom = roomId;
  persist(save);
}

export function takeTea(save: SaveData, def: CaseDef): number {
  const gain = save.tools.emf.level >= 2 ? def.economy.emfPerHour[2] : def.economy.emfPerHour[1];
  save.resources.emf += gain;
  save.resources.fear = Math.max(0, save.resources.fear - def.economy.teaFearRelief);
  save.storyMinutes += 60;
  save.teaTaken = true;
  save.lastTeaGain = gain;
  persist(save);
  return gain;
}

export function grantEctoplasm(save: SaveData, amount: number): void {
  save.resources.ectoplasm += amount;
  persist(save);
}

export function pinClue(save: SaveData, id: string): boolean {
  if (!save.cluesFound.includes(id)) return false;
  if (save.cluesPinned.includes(id)) return false;
  save.cluesPinned.push(id);
  persist(save);
  return true;
}

export function linkClues(save: SaveData, a: string, b: string): boolean {
  if (a === b) return false;
  if (!save.cluesPinned.includes(a) || !save.cluesPinned.includes(b)) return false;
  if (hasLink(save.links, a, b)) return false;
  save.links.push(linkKey(a, b));
  persist(save);
  return true;
}

export function isRoomOpen(save: SaveData, def: CaseDef, roomId: string): boolean {
  const room = def.rooms.find((r) => r.id === roomId);
  if (!room) return false;
  if (room.unlock === 'start') return true;
  if (room.unlock === 'evidence') return save.rooms.includes(roomId);
  if (room.unlock === 'linked') return linkQuotaMet(save, def);
  return false;
}

export function completeEncounter(save: SaveData, def: CaseDef, misses: number): void {
  save.encounterMisses = misses;
  save.encounterDone = true;
  if (!save.encounterRewarded) {
    save.resources.ectoplasm += def.encounter.ectoplasm;
    save.encounterRewarded = true;
  }
  persist(save);
}

export function closeCase(save: SaveData, def: CaseDef): number[] {
  if (save.caseStatus !== 'active') return save.stars;
  const stars = earnedStars(save, def);
  const count = (stars.length === 3 ? 3 : stars.length === 2 ? 2 : 1) as 1 | 2 | 3;
  const bonus = def.rewards.evidenceByStars[count];
  save.resources.evidence += bonus;
  save.bankedEvidenceBonus = bonus;
  save.stars = stars;
  save.tools.emf.level = Math.max(2, save.tools.emf.level);
  save.tools.flashlight.owned = true;
  save.tools.flashlight.tapLevel = Math.max(1, save.tools.flashlight.tapLevel);
  save.trophyBookmark = true;
  save.detective.pin = true;
  save.caseStatus = 'report';
  persist(save);
  return stars;
}

export function fileReport(save: SaveData, def: CaseDef): void {
  save.caseStatus = 'closed';
  const ending = stepIndex(def, 'envelope');
  if (ending >= 0) save.tutorialIndex = ending;
  persist(save);
}

export function setDetectiveName(save: SaveData, name: string): void {
  save.detective.name = name;
  save.tutorialIndex = Math.max(save.tutorialIndex, 1);
  persist(save);
}

export function setOutfit(save: SaveData, coat: CoatId, hat: HatId): void {
  save.detective.coat = coat;
  save.detective.hat = hat;
  persist(save);
}

export function beginCase(save: SaveData, def: CaseDef): void {
  save.caseStatus = 'active';
  save.tutorialIndex = Math.max(save.tutorialIndex, stepIndex(def, 'briefing'));
  save.lastTick = Date.now();
  save.place = 'office';
  persist(save);
}

export function toggleMute(save: SaveData): boolean {
  save.muted = !save.muted;
  persist(save);
  return save.muted;
}

export function emfRate(save: SaveData, def: CaseDef): number {
  if (!save.tools.emf.owned) return 0;
  return save.tools.emf.level >= 2 ? def.economy.emfPerHour[2] : def.economy.emfPerHour[1];
}
