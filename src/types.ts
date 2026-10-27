export type CoatId = 'charcoal' | 'tweed' | 'navy';
export type HatId = 'fedora' | 'newsboy' | 'beret';
export type ToolId = 'emf';

export interface StepBase {
  id: string;
  edith: string;
}

export type TutorialStep =
  | (StepBase & { kind: 'name' })
  | (StepBase & { kind: 'outfit' })
  | (StepBase & { kind: 'briefing' })
  | (StepBase & { kind: 'collect'; need: number; clueIds: string[] })
  | (StepBase & { kind: 'unlock-room'; roomId: string })
  | (StepBase & { kind: 'receive-tool'; tool: ToolId })
  | (StepBase & { kind: 'cold-spot'; roomId: string; clueId: string })
  | (StepBase & { kind: 'upgrade-tool'; tool: ToolId; level: number })
  | (StepBase & { kind: 'place-tea' })
  | (StepBase & { kind: 'recap' })
  | (StepBase & { kind: 'explain'; target: 'fear' })
  | (StepBase & { kind: 'pin' })
  | (StepBase & { kind: 'link'; minLinks: number; opensRoom: string })
  | (StepBase & { kind: 'encounter'; clueId: string })
  | (StepBase & { kind: 'stamp' })
  | (StepBase & { kind: 'ending' });

export interface ClueDef {
  id: string;
  roomId: string;
  title: string;
  x: number;
  y: number;
  r: number;
}

export type Hotspot =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'poly'; points: [number, number][] };

/** A hidden object. Coordinates are normalised to the scene image, 0–1. */
export interface HiddenObject {
  id: string;
  roomId: string;
  name: string;
  spot: Hotspot;
  clueId?: string;
  /** Timed cold-spot tap once the EMF meter is in hand. */
  cold?: boolean;
}

export interface RoomDef {
  id: string;
  name: string;
  short: string;
  unlock: 'start' | 'evidence' | 'linked';
  cost?: number;
  painter: 'office' | 'shop' | 'nook' | 'stock';
  /** Extra anomaly taps, normalised 0–1. Not on the object list. */
  ambient: { x: number; y: number }[];
}

export interface Economy {
  ambientEvidence: number;
  clueEvidence: number;
  emfPerHour: { 1: number; 2: number };
  fearStart: number;
  fearMsPerPoint: number;
  fearLowMax: number;
  fearMidMax: number;
  teaFearRelief: number;
  offlineCapHours: number;
  offlineGapMs: number;
  coldWindowMs: number;
  coldIntervalMs: { 1: number; 2: number };
  firstEctoplasm: number;
  laterEctoplasm: number;
  upgradeCost: number;
  encounterEctoplasm: number;
  ambientCooldownMs: number;
  tutorialCooldownMs: number;
  storyStartMinutes: number;
}

export interface CaseDef {
  id: string;
  number: number;
  title: string;
  setting: string;
  client: string;
  mentor: { name: string; role: string; line: string };
  briefing: string[];
  folder: { x: number; y: number };
  rooms: RoomDef[];
  objects: HiddenObject[];
  clues: ClueDef[];
  thread: { title: string; clueIds: string[] };
  encounter: { ghost: string; beats: number; ectoplasm: number };
  steps: TutorialStep[];
  rewards: { evidenceByStars: { 1: number; 2: number; 3: number } };
  economy: Economy;
  nextHook: { label: string; title: string };
}

export interface AwayNotice {
  emf: number;
  hours: number;
  capped: boolean;
}

export interface SaveData {
  version: 2;
  caseId: string;
  detective: {
    name: string;
    coat: CoatId | '';
    hat: HatId | '';
    pin: boolean;
  };
  resources: {
    evidence: number;
    ectoplasm: number;
    emf: number;
    fear: number;
  };
  emfFraction: number;
  fearMs: number;
  tools: {
    emf: { owned: boolean; level: number; placedRoom: string };
    flashlight: { owned: boolean; tapLevel: number };
  };
  rooms: string[];
  cluesFound: string[];
  objectsFound: string[];
  cluesPinned: string[];
  links: [string, string][];
  tutorialIndex: number;
  caseStatus: 'create' | 'active' | 'report' | 'closed';
  fearStayedLow: boolean;
  encounterMisses: number;
  encounterDone: boolean;
  encounterRewarded: boolean;
  stars: number[];
  bankedEvidenceBonus: number;
  trophyBookmark: boolean;
  storyMinutes: number;
  lastTick: number;
  muted: boolean;
  teaTaken: boolean;
  lastTeaGain: number;
  seenEnvelope: boolean;
  place: string;
  awayNotice: AwayNotice | null;
}
