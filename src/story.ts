import type { Pt } from './geom';
import type { Flag, ItemId, RoomId, Save, Speaker } from './save';

export type Verb =
  | 'look'
  | 'dark'
  | 'edith'
  | 'june'
  | 'ambrose'
  | 'pencil'
  | 'matches'
  | 'book'
  | 'ledger'
  | 'stock'
  | 'shelf'
  | 'exit';

export type Spot = {
  id: string;
  name: string;
  x: number;
  y: number;
  rx: number;
  ry: number;
  walkX: number;
  walkY: number;
  face: 1 | -1;
  look: string;
  verb: Verb;
  to?: RoomId;
  entry?: string;
};

export type Spawn = { x: number; y: number; face: 1 | -1 };

export interface Ctx {
  say(who: Speaker, text: string): Promise<void>;
  ask(who: Speaker, text: string, options: string[]): Promise<number>;
  has(item: ItemId): boolean;
  add(item: ItemId): void;
  remove(item: ItemId): void;
  flag(name: Flag): boolean;
  setFlag(name: Flag, value: boolean): void;
  room(): RoomId;
  go(room: RoomId, entry: string): Promise<void>;
  pose(kind: 'look' | 'pick'): void;
  refresh(): void;
  showGhost(on: boolean): void;
  revealRoom(): void;
  wait(ms: number): Promise<void>;
}

export const WALK: Pt[] = [
  { x: 150, y: 508 },
  { x: 1130, y: 508 },
  { x: 1180, y: 602 },
  { x: 100, y: 602 },
];

export const ENTRY: Record<RoomId, Record<string, Spawn>> = {
  office: {
    start: { x: 940, y: 568, face: -1 },
    door: { x: 980, y: 568, face: -1 },
  },
  shop: {
    door: { x: 260, y: 568, face: 1 },
    nook: { x: 1020, y: 560, face: -1 },
    stock: { x: 520, y: 560, face: -1 },
  },
  nook: {
    shop: { x: 240, y: 568, face: 1 },
  },
  stock: {
    shop: { x: 260, y: 568, face: 1 },
  },
};

const spot = (
  id: string,
  name: string,
  x: number,
  y: number,
  rx: number,
  ry: number,
  walkX: number,
  walkY: number,
  face: 1 | -1,
  look: string,
  verb: Verb,
  extra?: Pick<Spot, 'to' | 'entry'>,
): Spot => ({ id, name, x, y, rx, ry, walkX, walkY, face, look, verb, ...extra });

export function spotsFor(save: Save, room: RoomId): Spot[] {
  const f = save.flags;
  if (room === 'office') {
    return [
      spot('thermos', 'the thermos', 400, 500, 32, 36, 460, 568, -1, "Edith's thermos. The tea is a crime scene of its own.", 'look'),
      spot('folder', 'the case folder', 640, 490, 90, 40, 640, 575, -1, f.seenEnding ? 'Stamped shut. Edith will pretend not to be pleased.' : 'The Bellweather file. A shop, a key, and a man who will not stay shelved.', 'look'),
      spot('phone', 'the phone', 880, 480, 50, 40, 800, 568, 1, 'A rotary phone. It only rings when the news is inconvenient.', 'look'),
      spot('coat', 'the coat rack', 100, 500, 48, 90, 220, 568, -1, 'Spare coats. None of them have given notice.', 'look'),
      spot('edith', 'Edith', 200, 250, 110, 150, 380, 560, -1, "Edith Crane. Dispatch, tea, and a filing system that frightens the dead.", 'edith'),
      spot('office-door', 'the street', 1180, 380, 80, 140, 1040, 568, 1, 'The door to the street, and to other people\'s problems.', 'exit', { to: 'shop', entry: 'door' }),
    ];
  }
  if (room === 'shop') {
    return [
      spot('pencil', 'the pencil', 470, 500, 32, 24, 500, 575, -1, f.ledgerWritten ? 'The pencil already suffered for literature.' : 'A pencil with bite marks. Someone was thinking, or fretting.', 'pencil'),
      spot('doorbell', 'the doorbell', 175, 175, 36, 28, 250, 545, -1, 'The doorbell. It rings for empty pavements, which is rude even for brass.', 'look'),
      spot('globe', 'the globe', 800, 485, 40, 36, 760, 568, 1, 'A globe. Every country on it is closed at this hour.', 'look'),
      spot('typewriter', 'the typewriter', 980, 495, 55, 34, 900, 560, 1, 'A typewriter. The ribbon is the colour of old apologies.', 'look'),
      spot('umbrella', 'the umbrella stand', 360, 530, 40, 50, 400, 575, -1, 'The umbrella stand. Fully occupied. No spare hauntings.', 'look'),
      spot('ladder', 'the ladder', 70, 520, 36, 90, 180, 575, -1, 'A ladder. For people who trust both gravity and fiction.', 'look'),
      spot('shelf', 'the shelf', 640, 110, 160, 48, 640, 530, -1, f.bookShelved ? 'The poets have their neighbour back. The gap looks disappointed.' : 'A gap between the poets, the size of one slim green book.', 'shelf'),
      spot('june', 'June', 620, 410, 80, 55, 620, 568, -1, 'June Bellweather. Arms folded in a way that counts as a lock.', 'june'),
      spot('stock-door', 'the stockroom door', 1060, 390, 50, 100, 960, 560, 1, 'A narrow door beside the arch, painted the same brown as a secret.', 'stock'),
      spot('door-out', 'dispatch', 165, 400, 70, 120, 280, 568, -1, 'The street door. Dispatch is three streets of drizzle away.', 'exit', { to: 'office', entry: 'door' }),
      spot('nook-arch', 'the nook', 1220, 420, 55, 130, 1080, 555, 1, 'An arch to the reading nook. It smells of cold tea and patience.', 'exit', { to: 'nook', entry: 'shop' }),
    ];
  }
  if (room === 'nook') {
    return [
      spot('matches', 'the matches', 180, 480, 40, 28, 280, 560, -1, f.lanternLit ? 'The saucer remembers a matchbox. The matchbox has moved on.' : 'A matchbox beside a teacup that has given up.', 'matches'),
      spot('book', 'the green book', 700, 545, 50, 28, 680, 580, 1, f.bookShelved ? 'The chair has lost its argument with the book.' : 'A slim green book. The Lantern and the Lock. It hates this chair.', 'book'),
      spot('lamp', 'the lamp', 260, 420, 36, 100, 340, 560, -1, 'A floor lamp with a fringed shade. It is trying very hard to be a ghost.', 'look'),
      spot('chair', 'the chair', 620, 500, 120, 85, 600, 575, 1, 'The wingback. Ambrose\'s shape is still in it, like a dent in the air.', 'look'),
      spot('clock', 'the clock', 640, 90, 40, 32, 640, 530, -1, 'A clock. It keeps shop hours, including the ones after death.', 'look'),
      spot('cat', 'the cat', 1120, 200, 36, 36, 1000, 548, 1, 'A ceramic cat. It has judged every customer since 1952, including you.', 'look'),
      spot('nook-exit', 'the shop', 70, 420, 60, 140, 200, 568, -1, 'Back to the shop floor, where June is counting your mistakes.', 'exit', { to: 'shop', entry: 'nook' }),
    ];
  }
  if (!save.flags.lanternLit) {
    return [
      spot('stock-exit', 'the shop', 130, 420, 80, 140, 260, 568, -1, 'The way back. Even the dark will lend you the door.', 'exit', { to: 'shop', entry: 'stock' }),
      spot('dark', 'the dark', 640, 380, 520, 240, 640, 560, 1, 'Pitch dark. The lantern coughs and will not catch.', 'dark'),
    ];
  }
  return [
    spot('ledger', 'the ledger', 640, 500, 110, 40, 640, 575, -1, f.ledgerWritten ? 'The ledger is closed. The last line has stopped fidgeting.' : "Ambrose's ledger, open on a half-finished sale.", 'ledger'),
    spot('horse', 'the rocking horse', 1020, 555, 80, 46, 900, 585, 1, 'A rocking horse. It knows a secret and will only tell the floor.', 'look'),
    spot('hat', 'the hat', 230, 240, 40, 32, 300, 545, -1, 'A felt hat on a peg. It has outlived the head that chose it.', 'look'),
    spot('mirror', 'the mirror', 400, 220, 48, 56, 430, 545, -1, 'A mirror. It is considering whether you count as company.', 'look'),
    spot('cardigan', 'the cardigan', 200, 500, 50, 80, 300, 568, -1, 'A cardigan, folded as if someone meant to come back for the evening.', 'look'),
    spot('spare-lantern', 'the spare lantern', 900, 260, 36, 48, 820, 548, 1, 'A spare lantern. Yours is the jealous kind.', 'look'),
    spot('cage', 'the birdcage', 1140, 280, 48, 60, 980, 548, 1, 'An empty birdcage. Something left, and was polite about the door.', 'look'),
    spot('stock-exit', 'the shop', 130, 420, 80, 140, 260, 568, -1, 'The door to the shop. June is probably listening.', 'exit', { to: 'shop', entry: 'stock' }),
    ...(save.flags.ledgerWritten && !save.flags.ambroseBye
      ? [spot('ambrose', 'Ambrose', 900, 430, 70, 130, 760, 568, 1, 'Ambrose Bellweather. Pale as a receipt, and about as easy to file.', 'ambrose')]
      : []),
  ];
}

export function ghostShouldShow(save: Save): boolean {
  if (save.flags.ambroseBye || !save.flags.ledgerWritten) return false;
  return save.room === 'stock' && save.flags.lanternLit === true;
}

export function hintFor(save: Save): string {
  const f = save.flags;
  const has = (id: ItemId) => save.items.includes(id);
  if (!f.introDone) return 'Let Edith finish. She notices everything, including the door.';
  if (f.seenEnding) return 'That is the case. The envelope keeps. So does Edith.';
  if (f.ambroseBye) return 'Back to dispatch. Edith has an envelope and a professional frown.';
  if (f.ledgerWritten && !f.ambroseAsked) return 'Ambrose is in the stockroom. Talk to him. He does not charge by the hour.';
  if (f.ambroseAsked && !has('book') && !f.bookShelved) return 'The slim green book is on the chair in the nook. Chairs cannot be trusted with literature.';
  if (f.ambroseAsked && has('book')) return 'Use the book on the gap in the shop shelf, between the poets.';
  if (has('ledger') && has('pencil')) return 'Put the pencil to the ledger. The last line wants to be a sale.';
  if (!has('pencil') && !f.ledgerWritten && has('key')) return "There is a chewed pencil on June's counter. Take it before the back room eats you.";
  if (f.lanternLit && !has('ledger') && !f.ledgerWritten) return "The stockroom desk is keeping Ambrose's ledger, now that you can see.";
  if (!f.lanternLit && has('matches') && has('lantern')) return 'Combine the matches with your lantern. Even a ghost can do that sum.';
  if (!f.lanternLit && !has('matches')) return 'The reading nook keeps matches beside the cold teacup.';
  if (!has('key')) return "Talk to June. She wants Ambrose's name, not a sales pitch.";
  if (!has('pencil') && !f.ledgerWritten) return "There's a chewed pencil on June's counter. It has already suffered enough.";
  return 'Walk the rooms. Long-press a thing, or tap Look, if you only want the joke.';
}

export async function onEnter(ctx: Ctx): Promise<void> {
  const room = ctx.room();
  if (room === 'office' && !ctx.flag('introDone')) {
    await ctx.wait(400);
    await talkEdith(ctx);
    return;
  }
  if (room === 'office' && ctx.flag('ambroseBye') && !ctx.flag('seenEnding')) {
    await ctx.wait(400);
    await ending(ctx);
    return;
  }
  if (room === 'stock' && ctx.flag('lanternLit') && ctx.flag('ledgerWritten') && !ctx.flag('ambroseAsked')) {
    await ctx.wait(300);
    await ambroseTree(ctx);
  }
}

export async function perform(spot: Spot, ctx: Ctx): Promise<void> {
  switch (spot.verb) {
    case 'look':
    case 'dark':
      ctx.pose('look');
      await ctx.say('detective', spot.look);
      return;
    case 'edith':
      await talkEdith(ctx);
      return;
    case 'june':
      await talkJune(ctx);
      return;
    case 'ambrose':
      await talkAmbrose(ctx);
      return;
    case 'pencil':
      await pick(ctx, 'pencil', 'A pencil with bite marks. Someone was thinking, or fretting.', 'The pencil already did its job.');
      return;
    case 'matches':
      await pick(ctx, 'matches', 'Matches, beside a teacup that has given up.', 'The matches have done their one brave thing.');
      return;
    case 'book':
      await pick(ctx, 'book', 'The Lantern and the Lock. It was sulking on the chair.', 'The book is on its shelf, looking smug.');
      return;
    case 'ledger':
      await pick(ctx, 'ledger', "Ambrose's ledger. The last line is only half a thought.", 'The ledger is finished. The desk can rest.');
      return;
    case 'stock':
      await openStock(ctx);
      return;
    case 'shelf':
      await shelve(ctx);
      return;
    case 'exit':
      await leave(ctx, spot);
      return;
    default:
      return;
  }
}

async function pick(ctx: Ctx, item: ItemId, line: string, gone: string): Promise<void> {
  if (ctx.has(item)) {
    await ctx.say('detective', 'Already in a pocket. The pocket is very proud.');
    return;
  }
  const spent =
    (item === 'pencil' && ctx.flag('ledgerWritten')) ||
    (item === 'matches' && ctx.flag('lanternLit')) ||
    (item === 'book' && ctx.flag('bookShelved')) ||
    (item === 'ledger' && ctx.flag('ledgerWritten'));
  if (spent) {
    await ctx.say('detective', gone);
    return;
  }
  ctx.add(item);
  ctx.pose('pick');
  ctx.refresh();
  await ctx.say('detective', line);
}

async function leave(ctx: Ctx, spot: Spot): Promise<void> {
  if (spot.id === 'office-door' && !ctx.flag('introDone')) {
    await ctx.say('edith', 'I am not finished. I am rarely finished, but I am especially not finished.');
    return;
  }
  if (!spot.to || !spot.entry) return;
  await ctx.go(spot.to, spot.entry);
}

async function openStock(ctx: Ctx): Promise<void> {
  if (!ctx.has('key')) {
    await ctx.say('detective', 'Locked. June has the key, and the eyebrows to match.');
    return;
  }
  await ctx.go('stock', 'shop');
}

export async function talkEdith(ctx: Ctx): Promise<void> {
  if (!ctx.flag('introDone')) {
    await intro(ctx);
    return;
  }
  if (ctx.flag('ambroseBye') && !ctx.flag('seenEnding')) {
    await ending(ctx);
    return;
  }
  if (ctx.flag('seenEnding')) {
    await ctx.say('edith', 'No. 9 Lantern Lane. Still sealed. Envelopes outlive us all.');
    return;
  }
  await ctx.say('edith', 'June is at the shop. The furniture can wait its turn.');
}

async function intro(ctx: Ctx): Promise<void> {
  await ctx.say('edith', 'Detective. The chair is only mostly haunted. Sit, or don\'t.');
  await ctx.say('edith', 'Case zero. The Bellweather Bookshop. June inherited it from her grandfather, Ambrose.');
  const choice = await ctx.ask(
    'edith',
    'The novels climb back onto the shelves overnight. At closing, the doorbell rings for an empty street.',
    [
      'A ghost with a catalogue. My favourite.',
      'Could we simply ask him to stop?',
      'What if he\'s a quiet customer?',
      'I\'m in. Point me at the door.',
    ],
  );
  const replies = [
    'Good. The dull ones file complaints.',
    'June tried. He reshelved her request under Fiction.',
    'Customers rarely ring the bell and vanish. He does.',
    'That\'s the spirit. Unfortunate phrasing.',
  ];
  await ctx.say('edith', replies[choice] ?? replies[0]!);
  await ctx.say('edith', 'Take the lantern. It has a dramatic streak. The wick does not.');
  ctx.add('lantern');
  ctx.setFlag('introDone', true);
  ctx.refresh();
  await ctx.say('edith', 'Three streets, then the shop. Talk to June before you interview the furniture.');
}

async function ending(ctx: Ctx): Promise<void> {
  ctx.setFlag('seenEnding', true);
  ctx.refresh();
  await ctx.say('edith', 'You shelved a ghost properly. I hate that look. It means paperwork.');
  await ctx.say('edith', 'This came for you. No. 9 Lantern Lane.');
  await ctx.say('edith', 'Don\'t open it on the tram. The tram has opinions.');
  await ctx.say('detective', 'Case closed. The envelope can wait.');
}

async function talkJune(ctx: Ctx): Promise<void> {
  if (ctx.has('key')) {
    if (ctx.flag('bookShelved')) {
      await ctx.say('june', 'The shelf looks right. Don\'t tell me he was pleasant about it.');
      await ctx.say('detective', 'He was. Annoyingly.');
      return;
    }
    await ctx.say('june', 'The key still works. He still doesn\'t. Tell him the till can wait.');
    return;
  }
  for (;;) {
    const choice = await ctx.ask(
      'june',
      'We\'re closed to ghost stories. If the incense is in your bag, the door is behind you.',
      [
        'Edith sent me about the doorbell.',
        'My body is in the umbrella stand.',
        'Your grandfather still clocks in.',
        'Lovely globe. I\'ll be going.',
      ],
    );
    if (choice === 1) {
      await ctx.say('june', 'The umbrella stand is full. Try a different haunting.');
      continue;
    }
    if (choice === 3) {
      await ctx.say('june', 'It\'s a globe. It has been.');
      return;
    }
    break;
  }
  for (;;) {
    const choice = await ctx.ask('june', 'Edith. She still drinks that terrible tea. Fine. Who is doing this?', [
      'Ambrose. He reshelves, and signs nothing.',
      'A demon with library opinions.',
      'No idea. That\'s why I need the key.',
    ]);
    if (choice === 1) {
      await ctx.say('june', 'Less carnival. Try again.');
      continue;
    }
    if (choice === 2) {
      await ctx.say('june', 'Come back when you know whose ghost.');
      return;
    }
    break;
  }
  await ctx.say('june', 'That\'s him. He hates a messy fiction section more than he hates being dead.');
  await ctx.say('june', 'Stockroom key. Don\'t rearrange him. He hates that more.');
  ctx.add('key');
  ctx.pose('pick');
  ctx.refresh();
}

export async function talkAmbrose(ctx: Ctx): Promise<void> {
  if (!ctx.flag('ledgerWritten')) {
    await ctx.say('detective', 'The air is polite, and empty.');
    return;
  }
  await ambroseTree(ctx);
}

export async function ambroseTree(ctx: Ctx): Promise<void> {
  if (ctx.flag('ambroseAsked')) {
    ctx.showGhost(true);
    await ctx.say('ambrose', 'The gap on the shop shelf, between the poets. I can wait. I have practice.');
    return;
  }
  ctx.showGhost(true);
  await ctx.say('ambrose', 'Oh. A customer. I was just closing the account.');
  const choice = await ctx.ask('ambrose', 'One copy, sold to A. Bellweather. I have always been my best patron.', [
    'A receipt for staying. Bold.',
    'June says the till can wait.',
    'Boo.',
    'What would let you lock up?',
  ]);
  const replies = [
    'A fair receipt. I never shorted the till. Except morally.',
    'June. Tell her the doorbell is only me, checking she got home.',
    'Yes, hello. Boo to you too. We can be civil.',
    'A very sensible question. I respect it, which is unusual for me.',
  ];
  await ctx.say('ambrose', replies[choice] ?? replies[0]!);
  await ctx.say('ambrose', 'There is a slim green book. The Lantern and the Lock. I left it on the nook chair, like a fool.');
  await ctx.say('ambrose', 'It belongs in the gap on the shop shelf, between the poets. Put it back, and I can lock up.');
  if (ctx.has('book')) await ctx.say('ambrose', 'You have it on you. Heavier than it looks. The shelf knows the way.');
  else await ctx.say('ambrose', 'The chair in the nook is minding it. Chairs are terrible minders.');
  ctx.setFlag('ambroseAsked', true);
}

export async function writeLedger(ctx: Ctx): Promise<void> {
  if (ctx.flag('ledgerWritten')) {
    await ctx.say('detective', 'The line is already written. The ink is still rude about it.');
    return;
  }
  if (!ctx.has('pencil') || !ctx.has('ledger')) {
    await ctx.say('detective', 'A last line needs both a pencil and the ledger.');
    return;
  }
  ctx.pose('pick');
  await ctx.say('detective', 'You fill the last line. One copy of The Lantern and the Lock, sold to A. Bellweather.');
  ctx.remove('pencil');
  ctx.remove('ledger');
  ctx.setFlag('ledgerWritten', true);
  ctx.refresh();
  if (ctx.room() === 'stock') await ambroseTree(ctx);
  else await ctx.say('detective', 'Somewhere behind the shop, a throat clears. Pleased.');
}

export async function lightLantern(ctx: Ctx): Promise<void> {
  if (ctx.flag('lanternLit')) {
    await ctx.say('detective', 'It is already showing off.');
    return;
  }
  if (!ctx.has('matches') || !ctx.has('lantern')) {
    await ctx.say('detective', 'The wick wants a match, not a speech.');
    return;
  }
  ctx.remove('matches');
  ctx.setFlag('lanternLit', true);
  ctx.pose('pick');
  ctx.revealRoom();
  ctx.refresh();
  await ctx.say('detective', 'The wick catches. The flame looks entirely too pleased with itself.');
}

export async function shelve(ctx: Ctx): Promise<void> {
  if (!ctx.has('book')) {
    await ctx.say(
      'detective',
      ctx.flag('bookShelved')
        ? 'The book is home. It looks smug about it.'
        : 'A gap between the poets, the size of a slim green book.',
    );
    return;
  }
  if (!ctx.flag('ledgerWritten')) {
    await ctx.say('detective', 'The gap stays cold. Something else wants finishing first.');
    return;
  }
  ctx.pose('pick');
  ctx.remove('book');
  ctx.setFlag('bookShelved', true);
  ctx.setFlag('ambroseAsked', true);
  ctx.setFlag('ambroseBye', true);
  ctx.showGhost(true);
  ctx.refresh();
  await ctx.say('ambrose', 'There. See? It was never lost. I was.');
  await ctx.say('ambrose', 'Tell June I am sorry about the doorbell. It was only me, checking she got home.');
  await ctx.say('ambrose', "Goodnight, detective. Don't read the last page first. It spoils the haunting.");
  ctx.showGhost(false);
}

const PAIR_LINES: [ItemId, ItemId, string][] = [
  ['matches', 'book', 'Books and matches are how shops become former shops.'],
  ['matches', 'key', 'The key does not smoke.'],
  ['matches', 'pencil', 'You could light the pencil. You do not.'],
  ['matches', 'ledger', 'Burning the accounts is a different genre of crime.'],
  ['pencil', 'book', 'It is already written. That is rather the trouble.'],
  ['pencil', 'key', 'You cannot sketch your way through a lock. Sadly.'],
  ['key', 'book', 'The book is not the stockroom. It has been very clear.'],
  ['key', 'ledger', 'A key is a poor pen.'],
  ['key', 'lantern', 'The lantern is not locked. It is sulking.'],
  ['book', 'ledger', 'Two books. One of them is a confession.'],
  ['book', 'lantern', 'Reading by lantern is for later. The shelf is for now.'],
  ['ledger', 'lantern', 'You can see the page. You still need the pencil.'],
  ['pencil', 'lantern', 'The lantern is not a sharpener.'],
];

export async function combine(a: ItemId, b: ItemId, ctx: Ctx): Promise<void> {
  const pair = new Set([a, b]);
  if (pair.has('matches') && pair.has('lantern')) {
    await lightLantern(ctx);
    return;
  }
  if (pair.has('pencil') && pair.has('ledger')) {
    await writeLedger(ctx);
    return;
  }
  const line = PAIR_LINES.find(([x, y]) => pair.has(x) && pair.has(y));
  await ctx.say('detective', line ? line[2] : 'That does nothing. The nothing looks faintly embarrassed.');
}

const USE_LINES: Record<string, string> = {
  'key:june': 'She is not a lock. She has made that clear.',
  'book:june': 'June glances over. "Shelf. Not me."',
  'lantern:june': 'She squints. "Point that at the back room, not at my patience."',
  'matches:june': 'She does not smoke, and she does not like the implication.',
  'pencil:edith': 'Edith has pens. Several. She is not the problem.',
  'book:chair': 'It just left a chair. Chairs are how this started.',
  'matches:cat': 'The cat is ceramic. It is also offended.',
  'key:shelf': 'The shelf is not locked. It is particular.',
  'matches:dark': 'The dark is not a candlestick. The matches want the lantern.',
  'book:ambrose': 'He shakes his head, kindly. "The shelf, dear. I can\'t hold it any more."',
  };

export async function useItemOn(item: ItemId, spot: Spot, ctx: Ctx): Promise<void> {
  if ((spot.id === 'ledger' || spot.id === 'desk') && item === 'pencil') {
    if (!ctx.has('ledger')) ctx.add('ledger');
    await writeLedger(ctx);
    return;
  }
  if (spot.id === 'shelf' && item === 'book') {
    await shelve(ctx);
    return;
  }
  if (spot.id === 'stock-door' && item === 'key') {
    await openStock(ctx);
    return;
  }
  if (spot.id === 'dark' && item === 'lantern') {
    if (ctx.flag('lanternLit')) await ctx.say('detective', 'It is lit. The room should take the hint.');
    else await ctx.say('detective', 'The wick refuses. It wants a match, not encouragement.');
    return;
  }
  if (spot.verb === 'exit' && item === 'key' && spot.id === 'stock-door') {
    await openStock(ctx);
    return;
  }
  const scripted = USE_LINES[`${item}:${spot.id}`];
  if (scripted === '') return;
  await ctx.say('detective', scripted ?? 'You try it. The shop declines, politely and for good.');
}
