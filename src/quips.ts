import type { Tone } from './profile';
import type { ItemId } from './save';

const LOOKS: Record<string, string[]> = {
  phone: [
    'A rotary phone. It only rings when the news is inconvenient.',
    'Someone has wound the cord into a knot of professional dread.',
    'If it rings, do not answer on the first bell. Edith likes suspense.',
  ],
  lamp: [
    'A green lamp. It makes the paperwork look more important than it is.',
    'The shade is the colour of a secret that has agreed to be filed.',
    'It hums when the room is thinking.',
  ],
  edith: [
    'Edith Crane. Dispatch, tea, and a filing system that frightens the dead.',
    'She has already judged your coat. The coat is aware.',
    'Edith does not haunt. She supervises, which is worse and kinder.',
  ],
  board: [
    'The Bellweather file, pinned where it cannot sneak off.',
    'Red string. The universal language of people who have been awake too long.',
    'Every pin is a theory. Most theories are just tired.',
  ],
  cabinet: [
    'A filing cabinet. Something in the third drawer is humming, which is not a filing habit.',
    'The drawers are labelled. One label simply says "Later".',
    'It knows where the bodies are filed. Under B, presumably.',
  ],
  chair: [
    'A rocking chair. It moves when the room is being honest.',
    'No one is sitting in it. It rocks anyway, out of habit.',
    'Edith says the chair is only mostly haunted. The chair agrees, which is suspicious.',
  ],
  window: [
    'Rain on the glass. The city is minding its own business, for once.',
    'A fine night to be indoors, and a better night to be someone else.',
    'The rain has opinions. None of them are about you. Yet.',
  ],
  coat: [
    'Spare coats. None of them have given notice.',
    'One of these belongs to a detective who retired into the lining.',
    'They smell of wet wool and unfinished sentences.',
  ],
  'side-door': [
    'A dark doorway. It leads out, which is the polite thing for a doorway to do.',
    'The dark in there is professional. It clocks in.',
    'You could linger. The dark would charge overtime.',
  ],
  'office-door': [
    "The street door. Other people's problems live on the far side.",
    'Three streets of drizzle, then a bookshop with a grudge.',
    'The door has been opened by better detectives. It is polite about it.',
  ],
  pencil: [
    'A pencil, left on the counter. Someone was thinking, or fretting.',
    'Chewed at the end. A critic lives in this shop.',
    'It has written receipts, threats, and at least one apology.',
  ],
  doorbell: [
    'The doorbell. It rings for empty pavements, which is rude even for brass.',
    'June hates this bell. The bell, regrettably, loves June.',
    'If it rings for nobody, the nobody is usually Ambrose, checking she got home.',
  ],
  register: [
    'The till. It has opinions about being dead, and they are unfavourable.',
    'The last sale is still echoing. Quietly. Like a coin that refuses to land.',
    'No sale. The drawer knows. The drawer always knows.',
  ],
  daybook: [
    'The shop daybook, open on nothing in particular. The real ledger is sulking elsewhere.',
    'A quill sleeps in the gutter. Your pencil is the other one. Try not to mix your tools.',
    'Margins full of tiny sums. Ambrose added people the way other men add figures.',
  ],
  'shop-lamp': [
    'A green lamp. Under it, even a receipt looks like a confession.',
    'The bulb has been dying since 1974. It is taking the scenic route.',
    'Warm light. Cold shop. A classic arrangement.',
  ],
  shelf: [
    'A gap on the second shelf, the size of one slim green book.',
    'The poets are pretending not to notice the vacancy. Poets are terrible liars.',
    'Something used to stand here and was cross about it.',
  ],
  june: [
    'June Bellweather. Arms folded in a way that counts as a lock.',
    'She inherited a shop, a ghost, and a doorbell with no manners.',
    'June does not believe in you yet. That is fair. You are still dripping.',
  ],
  'door-out': [
    'The street door. Dispatch is three streets of drizzle away.',
    'You can leave. The books will rearrange themselves out of spite.',
    'The bell above it is innocent. The bell deeper in the shop is not.',
  ],
  'nook-arch': [
    'An arch to the reading nook. It smells of cold tea and patience.',
    'Through here: a chair, a moon, and a book that has wandered.',
    'The arch is wide enough for a detective and a bad idea.',
  ],
  matches: [
    'A matchbox on the side table. The table has stopped expecting company.',
    'Matches. For lanterns, not for literature. You have been warned by every novel ever.',
    'The striker is worn smooth. Someone in this house believed in second chances.',
  ],
  book: [
    'A slim green book. The Lantern and the Lock. It hates this shelf.',
    'The title is doing too much work. So is the book.',
    'It was sold to A. Bellweather, who was also the seller. Family discounts are a kind of haunting.',
  ],
  'nook-lamp': [
    'A wall lamp. It is trying very hard to be a ghost.',
    'The flame is painted. The warmth is not. Rude of it.',
    'It lights the chair and nothing else, which is how chairs get ideas.',
  ],
  'round-window': [
    'A round window. The rain has a favourite chair out there too.',
    'The moon is working tonight. It does not get the till.',
    'A porthole for people who are only slightly lost.',
  ],
  bookcase: [
    'A bookcase with no gaps worth trusting. The one that matters is back in the shop.',
    'Every spine faces out. Ambrose liked to be looked at, even in proxy.',
    'You could read for a year. The ghost would still be waiting at the gap.',
  ],
  'stock-door': [
    'The stockroom door. It has the look of a place that keeps old accounts.',
    'Locked, or lonely. With doors it is often both.',
    'June keeps the key. June keeps most things, including her temper.',
  ],
  'nook-exit': [
    'Back to the shop floor, where June is counting your mistakes.',
    'The arch returns you to commerce, which is a kind of ghost story.',
    'June will pretend she was not listening. The shelves will not bother.',
  ],
  ledger: [
    "Ambrose's ledger, open on a half-finished sale.",
    'The last line is only half a thought. Half thoughts are how people stay.',
    'Ink, dust, and a name that bought a book from itself.',
  ],
  moon: [
    'A little window, and a moon that has not been introduced.',
    'Cold light. It does not ask to be paid.',
    'The moon has seen the ledger. It is keeping its own accounts.',
  ],
  cobwebs: [
    'Shelves, cobwebs, and the feeling of being counted.',
    'The cobwebs are the only staff still on the rota.',
    'Books enough to build a smaller, worse shop.',
  ],
  crates: [
    'Crates. Something in them has already left, politely.',
    'Packed for a journey that got as far as the floor.',
    'If you shake one, it sighs. Do not shake it.',
  ],
  'stock-exit': [
    'The door back to the nook. Even the dark will lend it to you.',
    'June is probably listening on the far side. Doors are gossips.',
    'You may leave. The moon will not take it personally.',
  ],
  ambrose: [
    'Ambrose Bellweather. Pale as a receipt, and about as easy to file.',
    'He holds a book the way other men hold a grudge: gently, and for years.',
    'A bookseller who stayed for the shelving. There are worse reasons.',
  ],
  dark: [
    'Pitch dark. The lantern coughs and will not catch.',
    'You can hear your own coat. It is not a comforting narrator.',
    'The dark is not empty. It is merely unread.',
  ],
};

const FALLBACK = [
  'That does nothing. The nothing looks faintly embarrassed.',
  'You try it. The shop declines, politely and for good.',
  'A bold theory. The furniture withholds its peer review.',
  'No. And the no has a little dust on it.',
  'If that worked, Edith would have to rewrite the manual. She would not forgive you.',
  'The objects consider your proposal and return it unread.',
  'Somewhere a ghost sighs, professionally.',
  'That is not a verb this building recognises.',
  'You could insist. The century would still be unimpressed.',
  'Nice try. The try has been filed under No.',
  'The lantern watches this and decides to stay out of it.',
  'June would call that a customer habit. She would not mean it kindly.',
  'Two things touch. Neither of them enjoys the introduction.',
  'Ambrose would reshelve that idea under Fantasy.',
  'You have combined nothing with nothing. The result is philosophy.',
  'The house gives you the look usually reserved for dog-eared pages.',
  'Not even the cobwebs are buying it.',
  'A fascinating misuse. Please do not do it twice. You will.',
];

const PAIRS: [ItemId, ItemId, string][] = [
  ['matches', 'book', 'Books and matches are how shops become former shops.'],
  ['matches', 'key', 'The key does not smoke. It has principles, and a bit.'],
  ['matches', 'pencil', 'You could light the pencil. You do not. Growth.'],
  ['matches', 'ledger', 'Burning the accounts is a different genre of crime.'],
  ['pencil', 'book', 'It is already written. That is rather the trouble.'],
  ['pencil', 'key', 'You cannot sketch your way through a lock. Sadly. Art loses again.'],
  ['key', 'book', 'The book is not the stockroom. It has been very clear.'],
  ['key', 'ledger', 'A key is a poor pen, and a worse confession.'],
  ['key', 'lantern', 'The lantern is not locked. It is sulking, which is different and louder.'],
  ['book', 'ledger', 'Two books. One of them is a confession with better handwriting.'],
  ['book', 'lantern', 'Reading by lantern is for later. The shelf is for now.'],
  ['ledger', 'lantern', 'You can see the page. You still need the pencil. Light is not literacy.'],
  ['pencil', 'lantern', 'The lantern is not a sharpener. It has been asked.'],
];

const USES: Record<string, string> = {
  'key:june': 'She is not a lock. She has made that clear, with her eyebrows.',
  'book:june': 'June glances over. "Shelf. Not me. I am not circulation."',
  'lantern:june': 'She squints. "Point that at the back room, not at my patience."',
  'matches:june': 'She does not smoke, and she does not like the implication.',
  'pencil:june': 'June has a quill and a grudge. She does not need your pencil.',
  'ledger:june': 'She will not touch his handwriting. "That is how he wins."',
  'pencil:edith': 'Edith has pens. Several. One of them has seen things.',
  'book:edith': 'Edith does not shelve. She delegates, which is a kind of magic.',
  'key:edith': 'Edith already has every key. She keeps them in other people.',
  'lantern:edith': 'She nods at the flame. "Dramatic. I approved the model."',
  'matches:edith': 'Edith\'s tea does not take a light. It takes hostages.',
  'book:chair': 'It just left a chair. Chairs are how this started.',
  'matches:cat': 'There is no cat. The matches are still offended on principle.',
  'key:shelf': 'The shelf is not locked. It is particular, which is worse.',
  'matches:dark': 'The dark is not a candlestick. The matches want the lantern.',
  'book:ambrose': "He shakes his head, kindly. \"The shelf, dear. I can't hold it any more.\"",
  'pencil:ambrose': 'He looks at the pencil as if it were a small, sharp apology.',
  'lantern:ambrose': 'The flame goes through him and comes out embarrassed.',
  'key:door-out': 'The street is not locked. The weather is.',
  'book:shelf': 'That is the right instinct. The shelf almost applauds.',
  'matches:lamp': 'The lamp is already pretending to burn. Do not help it.',
  'pencil:daybook': 'The daybook has a quill. Your pencil is for a different confession.',
  'ledger:desk': 'It already lives there. Taking it was the interesting part.',
  'key:stock-door': 'Now you are speaking the door\'s language.',
  'lantern:dark': 'Wave it all you like. The wick wants a match, not a speech.',
};

const WARM: Record<string, string[]> = {
  edith: [
    'Edith Crane. She keeps the tea hot and the dead on a schedule.',
    'She has already made a file for you. It is kinder than it looks.',
    'Edith does not haunt. She looks after people, which is rarer.',
  ],
  june: [
    'June Bellweather. She is tired, and she is still here, which is a kind of courage.',
    'She inherited a shop and a grandfather who missed the door.',
    'June will come around. The rain already has.',
  ],
  ambrose: [
    'Ambrose Bellweather. He stayed to finish the shelving. Love looks like that, sometimes.',
    'He holds the book as if it were a letter he meant to send.',
    'A bookseller who wanted June to get home safe. That is the whole haunting.',
  ],
  shelf: [
    'A gap on the second shelf, just the size of one slim green book.',
    'The poets are keeping the place warm for whoever comes back.',
    'Something precious stood here. It can stand here again.',
  ],
  doorbell: [
    'The doorbell. It rings when Ambrose wants to know June is home.',
    'June flinches at the bell. She is right to. It means she is loved loudly.',
    'If it rings for nobody, the nobody is Ambrose, checking the lock.',
  ],
  phone: [
    'A rotary phone. Edith uses it when she is worried, which is often.',
    'The cord is tangled. Someone has been pacing.',
    'If it rings, Edith has already thought of you.',
  ],
};

const DRAMATIC: Record<string, string[]> = {
  edith: [
    'Edith Crane. Dispatch itself, poured into a woman and a teacup.',
    'She has judged empires. Your coat is merely the latest.',
    'Edith does not haunt. The night reports to her.',
  ],
  june: [
    'June Bellweather, last keeper of a shop the dead refuse to leave.',
    'She holds the keys the way a sentry holds a gate.',
    'June does not believe in you yet. The storm is still making its case.',
  ],
  ambrose: [
    'Ambrose Bellweather. A receipt that learned how to linger.',
    'He holds a book the way a king holds a surrendered city: gently.',
    'A bookseller who would not abandon the last page.',
  ],
  shelf: [
    'A wound in the second shelf, the exact shape of a slim green book.',
    'The poets look away. Even verse knows a grave when it sees one.',
    'Something was taken from this place, and the place remembers.',
  ],
  doorbell: [
    'The doorbell. It tolls for pavements that only look empty.',
    'June hates this bell. The bell is a heartbeat she cannot bury.',
    'If it rings for nobody, the nobody is Ambrose, keeping watch.',
  ],
  phone: [
    'A rotary phone. It rings like a verdict.',
    'The cord is a knot of every night Edith stayed late.',
    'Answer, if you dare. Edith already knows the ending.',
  ],
};

const WARM_FALLBACK = [
  'That does not help. The shop is patient about it.',
  'Not quite. There is a kinder way through.',
  'A good thought. The room needs a different one.',
  'Nothing happens. The nothing is gentle about it.',
  'Edith would call that a near miss, and mean it fondly.',
  'The objects decline, without any unkindness.',
  'Somewhere a ghost smiles, and waits.',
  'That is not the way. The way is still here.',
  'Try again. The house is on your side.',
  'Two things meet and decide to remain themselves.',
];

const DRAMATIC_FALLBACK = [
  'The house refuses. The refusal echoes.',
  'No. And the no has a weight to it.',
  'That path is shut. The dark says so.',
  'A bold stroke. The century does not flinch.',
  'If that worked, the dead would sit up. They do not.',
  'The objects consider your plea and return it sealed.',
  'Somewhere a ghost turns its face away.',
  'That is not a word this building will speak.',
  'You could insist. The night would still win.',
  'The lantern watches, and keeps its counsel.',
];

let fallbackCursor = 0;

export function lookLine(id: string, fallback: string, times: number, tone: Tone = 'sarcastic'): string {
  const voiced = tone === 'warm' ? WARM[id] : tone === 'dramatic' ? DRAMATIC[id] : undefined;
  const lines = voiced && voiced.length > 0 ? voiced : LOOKS[id];
  if (!lines || lines.length === 0) return fallback;
  return lines[times % lines.length] ?? fallback;
}

export function pairLine(a: ItemId, b: ItemId, tone: Tone = 'sarcastic'): string {
  if (tone !== 'sarcastic') return nextFallback(tone);
  const pair = new Set([a, b]);
  const found = PAIRS.find(([x, y]) => pair.has(x) && pair.has(y));
  return found ? found[2] : nextFallback(tone);
}

export function useLine(item: ItemId, spotId: string, tone: Tone = 'sarcastic'): string {
  return USES[`${item}:${spotId}`] ?? nextFallback(tone);
}

export function nextFallback(tone: Tone = 'sarcastic'): string {
  const pool = tone === 'warm' ? WARM_FALLBACK : tone === 'dramatic' ? DRAMATIC_FALLBACK : FALLBACK;
  const line = pool[fallbackCursor % pool.length] ?? pool[0]!;
  fallbackCursor += 1;
  return line;
}
