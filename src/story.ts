import type { Pt } from './geom';
import type { Profile, Tone } from './profile';
import { pairLine, useLine } from './quips';
import type { Flag, ItemId, RoomId, Save, Speaker } from './save';
import { aside } from './voices';

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
  | 'exit'
  | 'map';

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
  pose(kind: 'look' | 'pick' | 'give' | 'receive' | 'write' | 'shelf' | 'talk'): void;
  refresh(): void;
  showGhost(on: boolean): void;
  revealRoom(): void;
  wait(ms: number): Promise<void>;
  profile(): Profile;
  tone(): Tone;
  quip(id: string, fallback: string): string;
  sfx(name: string, pan?: number): void;
  face(who: 'edith' | 'june' | 'ambrose'): Promise<void>;
  handoff(): Promise<void>;
  openMap(): Promise<void>;
  card(): Promise<void>;
  settleBook(): Promise<void>;
}

function byTone(tone: Tone, lines: Record<Tone, string>): string {
  return lines[tone];
}

/** Open floor in front of the furniture. Back edge is the far boards, front edge sits just above the inventory. */
export const WALKS: Record<RoomId, Pt[]> = {
  office: [
    { x: 300, y: 500 },
    { x: 1100, y: 500 },
    { x: 1160, y: 608 },
    { x: 300, y: 608 },
  ],
  shop: [
    { x: 180, y: 535 },
    { x: 1100, y: 535 },
    { x: 1180, y: 602 },
    { x: 100, y: 602 },
  ],
  nook: [
    { x: 160, y: 548 },
    { x: 1080, y: 548 },
    { x: 1160, y: 602 },
    { x: 100, y: 602 },
  ],
  stock: [
    { x: 140, y: 575 },
    { x: 760, y: 575 },
    { x: 820, y: 612 },
    { x: 1180, y: 616 },
    { x: 90, y: 616 },
  ],
  trophy: [
    { x: 180, y: 540 },
    { x: 1100, y: 540 },
    { x: 1180, y: 610 },
    { x: 100, y: 610 },
  ],
};

export function walkFor(room: RoomId): Pt[] {
  return WALKS[room];
}

export const ENTRY: Record<RoomId, Record<string, Spawn>> = {
  office: {
    start: { x: 480, y: 560, face: 1 },
    door: { x: 360, y: 545, face: 1 },
  },
  shop: {
    door: { x: 280, y: 575, face: 1 },
    nook: { x: 980, y: 572, face: -1 },
  },
  nook: {
    shop: { x: 260, y: 575, face: 1 },
    stock: { x: 960, y: 572, face: -1 },
  },
  stock: {
    shop: { x: 280, y: 575, face: 1 },
  },
  trophy: {
    office: { x: 240, y: 580, face: 1 },
  },
};

/** Top-left of a cut-out that sits exactly over the painted object. */
export const PROP_AT = {
  book: { x: 380, y: 304 },
  matches: { x: 162, y: 442 },
  ledger: { x: 924, y: 400 },
  pencil: { x: 900, y: 346 },
  shelfBook: { x: 470, y: 188 },
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
  const spots = baseSpots(save, room);
  if (!save.spirit) return spots;
  const ghost: Partial<Record<RoomId, Spot>> = {
    office: spot('spirit-office', 'faint writing', 520, 210, 70, 22, 520, 568, 1, 'Only the spirit lantern holds it: the chair remembers who sat.', 'look'),
    shop: spot('spirit-shop', 'faint writing', 520, 240, 70, 20, 520, 568, -1, 'On the plaster, barely: between the poets.', 'look'),
    nook: spot('spirit-nook', 'a breath on the glass', 470, 250, 50, 18, 470, 568, -1, 'The round window says he only wanted the door locked behind June.', 'look'),
    stock: spot('spirit-stock', 'a name in the dust', 720, 280, 60, 18, 680, 570, 1, 'Dust on the shelf: A. Bellweather, still counting.', 'look'),
    trophy: spot('spirit-trophy', 'a dustless square', 1040, 250, 40, 18, 960, 575, 1, 'A space kept clean for a case that has not happened yet.', 'look'),
  };
  const extra = ghost[room];
  return extra ? spots.concat(extra) : spots;
}

function baseSpots(save: Save, room: RoomId): Spot[] {
  const f = save.flags;
  if (room === 'office') {
    return [
      spot('phone', 'the phone', 1020, 368, 36, 22, 980, 530, 1, 'A rotary phone. It only rings when the news is inconvenient.', 'look'),
      spot('lamp', 'the lamp', 1062, 330, 40, 36, 980, 530, 1, 'A green lamp. It makes the paperwork look more important than it is.', 'look'),
      spot('edith', 'Edith', 1040, 430, 70, 48, 960, 545, 1, "Edith Crane. Dispatch, tea, and a filing system that frightens the dead.", 'edith'),
      spot('board', 'the case board', 660, 245, 160, 90, 660, 520, 1, f.seenEnding ? 'The board can rest. Edith will pretend not to be pleased.' : 'The Bellweather file, pinned where it cannot sneak off.', 'look'),
      spot('cabinet', 'the filing cabinet', 920, 380, 60, 80, 900, 530, 1, 'A filing cabinet. Something in the third drawer is humming, which is not a filing habit.', 'look'),
      spot('chair', 'the rocking chair', 745, 410, 70, 70, 745, 545, -1, 'A rocking chair. It moves when the room is being honest.', 'look'),
      spot('window', 'the window', 360, 280, 110, 110, 400, 520, -1, 'Rain on the glass. The city is minding its own business, for once.', 'look'),
      spot('coat', 'the coat rack', 210, 360, 40, 100, 340, 530, -1, 'Spare coats. None of them have given notice.', 'look'),
      spot('paperweight', 'the paperweight', 210, 456, 28, 18, 360, 560, -1, 'A brass paperweight. It has kept one letter still, and considers that a career.', 'look'),
      spot('side-door', 'the collection room', 1173, 310, 55, 150, 1040, 530, 1, 'The collection room. Solved cases leave something on the shelves.', 'exit', { to: 'trophy', entry: 'office' }),
      spot('office-door', 'the street', 107, 310, 60, 155, 360, 520, -1, 'The street door. Candle Street is on the far side, being wet.', 'map'),
    ];
  }
  if (room === 'shop') {
    return [
      spot('pencil', 'the pencil', 972, 368, 40, 16, 900, 578, 1, f.ledgerWritten ? 'The pencil already suffered for literature.' : 'A chewed pencil lying on the daybook. Someone was thinking, or fretting.', 'pencil'),
      spot('doorbell', 'the doorbell', 130, 150, 28, 24, 250, 562, -1, 'The doorbell. It rings for empty pavements, which is rude even for brass.', 'look'),
      spot('register', 'the cash register', 820, 300, 70, 46, 780, 568, 1, 'The till. It has opinions about being dead, and they are unfavourable.', 'look'),
      spot('daybook', 'the daybook', 960, 338, 55, 22, 920, 568, 1, 'The shop daybook, open on nothing in particular. The real ledger is sulking elsewhere.', 'look'),
      spot('shop-lamp', 'the lamp', 1045, 310, 44, 40, 980, 568, 1, 'A green lamp. Under it, even a receipt looks like a confession.', 'look'),
      spot('shelf', 'the shelf', 470, 200, 90, 46, 470, 558, -1, f.bookShelved ? 'The poets have their neighbour back. The gap looks disappointed.' : 'A gap on the second shelf, the size of one slim green book.', 'shelf'),
      spot('june', 'June', 640, 400, 80, 130, 640, 578, 1, 'June Bellweather. Arms folded in a way that counts as a lock.', 'june'),
      spot('door-out', 'dispatch', 110, 280, 75, 180, 260, 575, -1, 'The street door. Dispatch is three streets of drizzle away.', 'exit', { to: 'office', entry: 'door' }),
      spot('nook-arch', 'the nook', 1185, 320, 70, 155, 1020, 572, 1, 'An arch to the reading nook. It smells of cold tea and patience.', 'exit', { to: 'nook', entry: 'shop' }),
    ];
  }
  if (room === 'nook') {
    return [
      spot('matches', 'the matches', 186, 442, 28, 16, 250, 578, -1, f.lanternLit ? 'The side table remembers a matchbox. The matchbox has moved on.' : 'A matchbox on the side table. The table has stopped expecting company.', 'matches'),
      spot('book', 'the green book', 430, 318, 40, 22, 460, 575, -1, f.bookShelved ? 'The low shelf has lost its argument with the book.' : 'A slim green book. The Lantern and the Lock. It hates this shelf.', 'book'),
      spot('nook-lamp', 'the lamp', 185, 200, 28, 44, 250, 568, -1, 'A wall lamp. It is trying very hard to be a ghost.', 'look'),
      spot('chair', 'the chair', 340, 400, 100, 90, 460, 580, -1, 'The armchair. Ambrose\'s shape is still in it, like a dent in the air.', 'look'),
      spot('round-window', 'the round window', 470, 200, 55, 50, 470, 565, -1, 'A round window. The rain has a favourite chair out there too.', 'look'),
      spot('bookcase', 'the bookcase', 820, 280, 180, 140, 720, 568, 1, 'A bookcase with no gaps worth trusting. The one that matters is back in the shop.', 'look'),
      spot('stock-door', 'the stockroom door', 1165, 310, 65, 155, 1000, 572, 1, 'The stockroom door. It has the look of a place that keeps old accounts.', 'stock'),
      spot('nook-exit', 'the shop', 90, 280, 70, 175, 240, 575, -1, 'Back to the shop floor, where June is counting your mistakes.', 'exit', { to: 'shop', entry: 'nook' }),
    ];
  }
  if (room === 'trophy') {
    const tone = save.tone;
    const memory = (id: string, name: string, x: number, y: number, lines: Record<Tone, string>, show: boolean) =>
      show
        ? [spot(id, name, x, y, 36, 28, x, 575, 1, lines[tone], 'look')]
        : [spot(id, `an empty ${name}`, x, y, 36, 28, x, 575, 1, 'A bare stand. The next case has not earned a place here.', 'look')];
    return [
      spot('trophy-door', 'dispatch', 150, 300, 70, 160, 280, 575, -1, 'Back to Edith, who will pretend she does not dust these shelves.', 'exit', { to: 'office', entry: 'start' }),
      ...memory('mem-key', 'June\'s key', 512, 348, {
        sarcastic: 'June\'s spare. She trusted a stranger with the back room. That is either faith or exhaustion.',
        warm: 'June put this in your hand. She was frightened, and she was precise. Both were brave.',
        dramatic: 'The key that opened a grandfather\'s last account. It still smells of cold tea.',
      }, f.gotKey === true),
      ...memory('mem-book', 'the green book', 778, 390, {
        sarcastic: 'The Lantern and the Lock, home at last, looking unbearably pleased with itself.',
        warm: 'Ambrose left this on the wrong shelf. Putting it back was the whole apology.',
        dramatic: 'One slim book. A ghost kept a shop open for the sake of its gap.',
      }, f.bookShelved === true),
      ...memory('mem-box', 'the blue box', 824, 330, {
        sarcastic: 'Edith\'s blue box. She will not say what is in it. The not-saying is the point.',
        warm: 'A small blue box from dispatch. Some thanks arrive shut, and that is allowed.',
        dramatic: 'Sealed. Like No. 9 Lantern Lane. Like every good ending.',
      }, f.seenEnding === true),
      spot('mem-wait', 'the waiting shelf', 1040, 400, 50, 36, 980, 575, 1, 'Room for the next house, whenever it decides to misbehave.', 'look'),
    ];
  }
  if (!save.flags.lanternLit) {
    return [
      spot('stock-exit', 'the nook', 100, 270, 80, 175, 260, 575, -1, 'The way back. Even the dark will lend you the door.', 'exit', { to: 'nook', entry: 'stock' }),
      spot('dark', 'the dark', 700, 360, 480, 220, 640, 570, 1, 'Pitch dark. The lantern coughs and will not catch.', 'dark'),
    ];
  }
  return [
    spot('ledger', 'the ledger', 1048, 448, 64, 20, 900, 600, 1, f.ledgerWritten ? 'The ledger lies open on the desk. The last line is the sale: one copy of The Lantern and the Lock, to A. Bellweather.' : "Ambrose's ledger, open on a half-finished sale.", 'ledger'),
    spot('moon', 'the window', 470, 110, 40, 36, 470, 558, -1, 'A little window, and a moon that has not been introduced.', 'look'),
    spot('cobwebs', 'the shelves', 560, 280, 140, 120, 520, 568, 1, 'Shelves, cobwebs, and the feeling of being counted.', 'look'),
    spot('crates', 'the crates', 480, 450, 70, 40, 480, 578, -1, 'Crates. Something in them has already left, politely.', 'look'),
    spot('stock-exit', 'the nook', 100, 270, 80, 175, 260, 575, -1, 'The door to the nook. June is probably listening.', 'exit', { to: 'nook', entry: 'stock' }),
    ...(save.flags.ledgerWritten && !save.flags.ambroseBye
      ? [spot('ambrose', 'Ambrose', 780, 400, 80, 140, 700, 575, 1, 'Ambrose Bellweather. Pale as a receipt, and about as easy to file.', 'ambrose')]
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
  if (f.ambroseAsked && !has('book') && !f.bookShelved) return 'The slim green book is on the low shelf in the nook, beside the chair.';
  if (f.ambroseAsked && has('book')) return 'Use the book on the gap in the shop shelf, between the poets.';
  if (has('ledger') && has('pencil')) return 'Put the pencil to the ledger. The last line wants to be a sale.';
  if (!has('pencil') && !f.ledgerWritten && has('key')) return "There is a chewed pencil on June's counter. Take it before the back room eats you.";
  if (f.lanternLit && !has('ledger') && !f.ledgerWritten) return 'The stockroom is the far door in the nook. The desk is keeping Ambrose\'s ledger, now that you can see.';
  if (!f.lanternLit && has('matches') && has('lantern')) return 'Combine the matches with your lantern. Even a ghost can do that sum.';
  if (!f.lanternLit && !has('matches')) return 'The reading nook keeps a matchbox on the side table.';
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
      if (spot.id === 'doorbell') ctx.sfx('bell');
      if (ctx.profile().detective === 'pip' && ['lamp', 'phone', 'register', 'shop-lamp', 'nook-lamp', 'doorbell', 'cabinet'].includes(spot.id)) {
        ctx.sfx('blip');
      }
      await ctx.say('detective', ctx.quip(spot.id, spot.look));
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
      await pick(ctx, 'book', 'The Lantern and the Lock. It was sulking on the low shelf.', 'The book is on its shelf, looking smug.');
      return;
    case 'ledger':
      await pick(ctx, 'ledger', "Ambrose's ledger. The last line is only half a thought.", 'It belongs on the desk. The sale is already written.');
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
    case 'map':
      if (!ctx.flag('introDone')) {
        await ctx.say('edith', 'I am not finished. I am rarely finished, but I am especially not finished.');
        return;
      }
      await ctx.openMap();
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
  ctx.sfx('pickup');
  ctx.refresh();
  await ctx.say('detective', line);
}

async function leave(ctx: Ctx, spot: Spot): Promise<void> {
  if ((spot.id === 'office-door' || spot.id === 'side-door') && !ctx.flag('introDone')) {
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
  await ctx.face('edith');
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
  const name = ctx.profile().name;
  const tone = ctx.tone();
  await ctx.face('edith');
  const hello = aside(ctx.profile().detective, 'edith', tone);
  if (hello) await ctx.say('detective', hello);
  const secret = aside(ctx.profile().detective, 'secret', tone);
  if (secret) await ctx.say('detective', secret);
  await ctx.say('edith', byTone(tone, {
    sarcastic: `${name}. The chair is only mostly haunted. Sit, or don't.`,
    warm: `${name}. Come in. The chair is mostly harmless, and the tea is hot.`,
    dramatic: `${name}. The chair has been waiting. So have I.`,
  }));
  await ctx.say('edith', 'Case zero. The Bellweather Bookshop. June inherited it from her grandfather, Ambrose.');
  let choice = 0;
  for (;;) {
    choice = await ctx.ask(
      'edith',
      'The novels climb back onto the shelves overnight. At closing, the doorbell rings for an empty street.',
      [
        'A ghost with a catalogue. My favourite.',
        'May I taste the tea first?',
        'What if he\'s a quiet customer?',
        'I\'m in. Point me at the door.',
      ],
    );
    if (choice === 1) {
      await ctx.say('edith', `You may not. The tea has unionised. I file ${name} under a private heading of bad ideas.`);
      continue;
    }
    break;
  }
  const replies = [
    'Good. The dull ones file complaints.',
    'The tea has unionised.',
    'Customers rarely ring the bell and vanish. He does.',
    'That\'s the spirit. Unfortunate phrasing.',
  ];
  await ctx.say('edith', replies[choice] ?? replies[0]!);
  await ctx.say('edith', 'Take the lantern. It has a dramatic streak. The wick does not.');
  ctx.pose('receive');
  ctx.add('lantern');
  ctx.setFlag('introDone', true);
  ctx.refresh();
  await ctx.say('edith', byTone(tone, {
    sarcastic: 'Three streets, then the shop. Talk to June before the furniture gets interviewed.',
    warm: 'Three streets, then the shop. June is frightened. Be gentle, and be specific.',
    dramatic: 'Three streets of rain. Then June. Do not let the furniture speak first.',
  }));
}

async function ending(ctx: Ctx): Promise<void> {
  ctx.setFlag('seenEnding', true);
  ctx.refresh();
  await ctx.say('edith', 'You shelved a ghost properly. I hate that look. It means paperwork.');
  await ctx.say('edith', 'This came for you. No. 9 Lantern Lane.');
  await ctx.say('edith', 'Don\'t open it on the tram. The tram has opinions.');
  await ctx.say('detective', `${ctx.profile().name} closes the book. The envelope can wait.`);
  ctx.sfx('closed');
  await ctx.card();
}

async function talkJune(ctx: Ctx): Promise<void> {
  await ctx.face('june');
  const tone = ctx.tone();
  const hello = aside(ctx.profile().detective, 'june', tone);
  if (hello && !ctx.has('key')) await ctx.say('detective', hello);
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
      byTone(tone, {
        sarcastic: 'We\'re closed to ghost stories. If the incense is in your bag, the door is behind you.',
        warm: 'We\'re closed. If you are here about the bell, say so plainly. I am tired.',
        dramatic: 'The shop is shut to ghost stories. Speak, or the door will have you.',
      }),
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
      'Could he be the tea?',
    ]);
    if (choice === 3) {
      await ctx.say('june', 'The tea is Edith\'s. It is already a haunting. Try again.');
      continue;
    }
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
  await ctx.handoff();
}

export async function talkAmbrose(ctx: Ctx): Promise<void> {
  if (!ctx.flag('ledgerWritten')) {
    await ctx.face('ambrose');
    await ctx.say('detective', 'The air is polite, and empty.');
    return;
  }
  await ambroseTree(ctx);
}

export async function ambroseTree(ctx: Ctx): Promise<void> {
  const tone = ctx.tone();
  if (ctx.flag('ambroseAsked')) {
    ctx.showGhost(true);
    await ctx.face('ambrose');
    await ctx.say('ambrose', 'The gap on the shop shelf, between the poets. I can wait. I have practice.');
    return;
  }
  ctx.showGhost(true);
  await ctx.face('ambrose');
  const hello = aside(ctx.profile().detective, 'ambrose', tone);
  if (hello) await ctx.say('detective', hello);
  await ctx.say('ambrose', byTone(tone, {
    sarcastic: 'Oh. A customer. I was just closing the account.',
    warm: 'Oh. You found me. I was only finishing the last line.',
    dramatic: 'A living customer. I had begun to think the dark was my only patron.',
  }));
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
  await ctx.say('ambrose', 'There is a slim green book. The Lantern and the Lock. I left it on the low shelf in the nook, like a fool.');
  ctx.pose('give');
  await ctx.say('ambrose', 'It belongs in the gap on the shop shelf, between the poets. Put it back, and I can lock up.');
  if (ctx.has('book')) await ctx.say('ambrose', 'You have it on you. Heavier than it looks. The shelf knows the way.');
  else await ctx.say('ambrose', 'The low shelf in the nook is minding it. Shelves are terrible minders.');
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
  ctx.pose('write');
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
  ctx.sfx('lantern');
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
  ctx.pose('shelf');
  ctx.remove('book');
  await ctx.settleBook();
  ctx.setFlag('bookShelved', true);
  ctx.setFlag('ambroseAsked', true);
  ctx.setFlag('ambroseBye', true);
  ctx.showGhost(true);
  ctx.refresh();
  await ctx.face('ambrose');
  await ctx.say('ambrose', 'There. See? It was never lost. I was.');
  await ctx.say('ambrose', 'Tell June I am sorry about the doorbell. It was only me, checking she got home.');
  await ctx.say('ambrose', "Goodnight, detective. Don't read the last page first. It spoils the haunting.");
  ctx.showGhost(false);
}

export async function combine(a: ItemId, b: ItemId, ctx: Ctx): Promise<void> {
  const pair = new Set([a, b]);
  if (pair.has('matches') && pair.has('lantern')) {
    ctx.sfx('ok');
    await lightLantern(ctx);
    return;
  }
  if (pair.has('pencil') && pair.has('ledger')) {
    ctx.sfx('ok');
    await writeLedger(ctx);
    return;
  }
  ctx.sfx('fail');
  await ctx.say('detective', pairLine(a, b, ctx.tone()));
}

export async function useItemOn(item: ItemId, spot: Spot, ctx: Ctx): Promise<void> {
  if ((spot.id === 'ledger' || spot.id === 'desk') && item === 'pencil') {
    if (!ctx.has('ledger')) ctx.add('ledger');
    ctx.sfx('ok');
    await writeLedger(ctx);
    return;
  }
  if (spot.id === 'shelf' && item === 'book') {
    ctx.sfx('ok');
    await shelve(ctx);
    return;
  }
  if (spot.id === 'stock-door' && item === 'key') {
    ctx.sfx('ok');
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
  ctx.sfx('fail');
  await ctx.say('detective', useLine(item, spot.id, ctx.tone()));
}
