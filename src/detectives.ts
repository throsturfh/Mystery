export type DetectiveId = 'crowe' | 'sara' | 'barty' | 'pip' | 'ondine';

export type DetectiveDef = {
  id: DetectiveId;
  label: string;
  defaultName: string;
  blurb: string;
  dog?: string;
  coat: string;
  hat: string;
  scarf: string;
  coats: { id: string; label: string }[];
  hats: { id: string; label: string }[];
  scarves: { id: string; label: string }[];
};

export const DETECTIVES: DetectiveDef[] = [
  {
    id: 'crowe',
    label: 'Edmund Crowe',
    defaultName: 'Edmund',
    blurb: 'Dispatch regular. Coat, lantern, and a joke he pretends not to enjoy.',
    coat: 'Coat',
    hat: 'Hat',
    scarf: 'Scarf',
    coats: [
      { id: 'tan', label: 'Tan' },
      { id: 'olive', label: 'Olive' },
      { id: 'charcoal', label: 'Charcoal' },
      { id: 'wine', label: 'Wine' },
    ],
    hats: [
      { id: 'brown', label: 'Brown' },
      { id: 'black', label: 'Black' },
      { id: 'moss', label: 'Moss' },
      { id: 'plum', label: 'Plum' },
    ],
    scarves: [
      { id: 'plaid', label: 'Plaid' },
      { id: 'pine', label: 'Pine' },
      { id: 'gold', label: 'Gold' },
      { id: 'ink', label: 'Ink' },
    ],
  },
  {
    id: 'sara',
    label: 'Sara Lind',
    defaultName: 'Sara Lind',
    blurb: 'Dog trainer by day. Ghost detective when the bell rings after hours.',
    dog: 'Skuggi',
    coat: 'Jacket',
    hat: 'Cap',
    scarf: 'Scarf',
    coats: [
      { id: 'tan', label: 'Red' },
      { id: 'olive', label: 'Olive' },
      { id: 'charcoal', label: 'Navy' },
      { id: 'wine', label: 'Wine' },
    ],
    hats: [
      { id: 'brown', label: 'Brown' },
      { id: 'black', label: 'Black' },
      { id: 'moss', label: 'Moss' },
      { id: 'plum', label: 'Plum' },
    ],
    scarves: [
      { id: 'plaid', label: 'Rust' },
      { id: 'pine', label: 'Pine' },
      { id: 'gold', label: 'Gold' },
      { id: 'ink', label: 'Ink' },
    ],
  },
  {
    id: 'barty',
    label: 'Barty Crane',
    defaultName: 'Barty',
    blurb: "Edith's uncle. He has seen it all, and he is annoyed that it is still happening.",
    coat: 'Coat',
    hat: 'Hat',
    scarf: 'Scarf',
    coats: [
      { id: 'tan', label: 'Charcoal' },
      { id: 'olive', label: 'Olive' },
      { id: 'charcoal', label: 'Navy' },
      { id: 'wine', label: 'Wine' },
    ],
    hats: [
      { id: 'brown', label: 'Black' },
      { id: 'black', label: 'Ink' },
      { id: 'moss', label: 'Moss' },
      { id: 'plum', label: 'Plum' },
    ],
    scarves: [
      { id: 'plaid', label: 'Red' },
      { id: 'pine', label: 'Pine' },
      { id: 'gold', label: 'Gold' },
      { id: 'ink', label: 'Ink' },
    ],
  },
  {
    id: 'pip',
    label: 'Pip Okonkwo',
    defaultName: 'Pip',
    blurb: 'Fourteen, over-eager, and the owner of a scanner that beeps at radiators.',
    coat: 'Jumper',
    hat: 'Cap',
    scarf: 'Scarf',
    coats: [
      { id: 'tan', label: 'Green' },
      { id: 'olive', label: 'Olive' },
      { id: 'charcoal', label: 'Navy' },
      { id: 'wine', label: 'Wine' },
    ],
    hats: [
      { id: 'brown', label: 'Yellow' },
      { id: 'black', label: 'Black' },
      { id: 'moss', label: 'Moss' },
      { id: 'plum', label: 'Plum' },
    ],
    scarves: [
      { id: 'plaid', label: 'Stripe' },
      { id: 'pine', label: 'Pine' },
      { id: 'gold', label: 'Gold' },
      { id: 'ink', label: 'Ink' },
    ],
  },
  {
    id: 'ondine',
    label: 'Ondine Vasquez',
    defaultName: 'Ondine',
    blurb: 'A medium who treats ghosts like neighbours who have overstayed their tea.',
    coat: 'Coat',
    hat: 'Veil',
    scarf: 'Shawl',
    coats: [
      { id: 'tan', label: 'Plum' },
      { id: 'olive', label: 'Olive' },
      { id: 'charcoal', label: 'Navy' },
      { id: 'wine', label: 'Wine' },
    ],
    hats: [
      { id: 'brown', label: 'Black' },
      { id: 'black', label: 'Ink' },
      { id: 'moss', label: 'Moss' },
      { id: 'plum', label: 'Plum' },
    ],
    scarves: [
      { id: 'plaid', label: 'Gold' },
      { id: 'pine', label: 'Pine' },
      { id: 'gold', label: 'Sand' },
      { id: 'ink', label: 'Ink' },
    ],
  },
];

const IDS = new Set(DETECTIVES.map((row) => row.id));

export function detectiveById(id: string | undefined): DetectiveDef {
  return DETECTIVES.find((row) => row.id === id) ?? DETECTIVES[0]!;
}

export function cleanDetective(raw: unknown): DetectiveId {
  return IDS.has(raw as DetectiveId) ? (raw as DetectiveId) : 'crowe';
}
