import { detectiveById, type DetectiveId } from './detectives';
import type { Tone } from './profile';

const LINES: Record<string, Record<DetectiveId, Record<Tone, string>>> = {
  edith: {
    crowe: {
      sarcastic: 'Edith, if the chair is only mostly haunted, I will stand. My knees have a union.',
      warm: 'Edith. You sent for me, so it matters. I am listening.',
      dramatic: 'Edith Crane. The rain announced me. You may begin.',
    },
    sara: {
      sarcastic: '{dog} sat down the moment we came in. That is either a good sign or a very polite ghost.',
      warm: 'Edith. We came as soon as the bell made a fuss. {dog} is already working.',
      dramatic: 'The dog knows. He lay down. Tell me what the house is afraid of.',
    },
    barty: {
      sarcastic: 'Edith. I retired. The dead, rudely, did not. What is it this time?',
      warm: 'Niece. You only call when the filing cabinet hums. I am here.',
      dramatic: 'I have buried better mysteries than this. Impress me. Quietly.',
    },
    pip: {
      sarcastic: 'The scanner beeped at your lamp, your tea, and the concept of lateness. So. A real ghost?',
      warm: 'Miss Crane! I brought the scanner. It is mostly honest. I am entirely ready.',
      dramatic: 'Dispatch! I came as fast as the bus and my sense of destiny allowed.',
    },
    ondine: {
      sarcastic: 'The veil twitched in your doorway. Either a draught, or someone who misses being offered a chair.',
      warm: 'Edith, darling. The room is full of unfinished sentences. Shall we tidy one?',
      dramatic: 'I have already said good evening to whoever is rocking that chair. They were polite.',
    },
  },
  june: {
    crowe: {
      sarcastic: 'June Bellweather. I come from Edith, which is almost a reference.',
      warm: 'June. I am not here to laugh at the doorbell. I am here because it frightened you.',
      dramatic: 'The shop knows my name already. That is either hospitality or a haunting.',
    },
    sara: {
      sarcastic: 'He will not jump up. {dog} saves his drama for things the living cannot see.',
      warm: 'June, this is {dog}. He is kinder than he looks, and he is very good at lost things.',
      dramatic: 'If a ghost is keeping shop, the dog will tell us before the till does.',
    },
    barty: {
      sarcastic: 'I have been retired longer than this doorbell has been rude. We can still fix it.',
      warm: 'Miss Bellweather. Your grandfather and I argued about poetry. I let him win. Once.',
      dramatic: 'A shop that reshelves itself is not a crisis. It is a man who cannot leave a job unfinished.',
    },
    pip: {
      sarcastic: 'If your ghost is real, my scanner will beep. If my scanner beeps, it might still be the radiator.',
      warm: 'I am Pip. I believe you. The scanner is just here so I look like I have a plan.',
      dramatic: 'A haunted bookshop! I have prepared a speech. I can also not give it.',
    },
    ondine: {
      sarcastic: 'Your grandfather is not gone, dear. He is merely bad at clocking out.',
      warm: 'June. He loves you in the only way a bookseller knows. He keeps the shelves honest.',
      dramatic: 'I can hear him in the fiction. He is embarrassed, which is a kind of love.',
    },
  },
  ambrose: {
    crowe: {
      sarcastic: 'Ambrose Bellweather, I presume. You have excellent taste and terrible office hours.',
      warm: 'Mr Bellweather. June is worried. I would like to help you lock up.',
      dramatic: 'A ghost with a ledger. At last, a haunting with paperwork.',
    },
    sara: {
      sarcastic: '{dog} sat. He only does that for people. You still count.',
      warm: 'He is not afraid of you. That is {dog}\'s version of a handshake.',
      dramatic: 'The dog found you before I did. Dogs are rude like that, and usually right.',
    },
    barty: {
      sarcastic: 'Bellweather. Still alphabetising the afterlife. Some men never do learn to rest.',
      warm: 'Ambrose. It has been too long, and you are still too thin. Let us finish the line.',
      dramatic: 'I knew you would keep the shop open. You always hated an unfinished sale.',
    },
    pip: {
      sarcastic: 'The scanner is screaming, which means you are either a ghost or a very committed radiator.',
      warm: 'Hello! I am Pip. Please do not be scary. I am here to put the book back.',
      dramatic: 'A real ghost! I should have brought a better speech. And maybe a grown-up.',
    },
    ondine: {
      sarcastic: 'Ambrose, darling, death is not an excuse for a messy fiction section.',
      warm: 'There you are. June misses you in ordinary ways. The doorbell is not one of them.',
      dramatic: 'We have met, you and I, in the pause before a bell. Shall we make it a goodbye?',
    },
  },
  secret: {
    crowe: {
      sarcastic: 'Between us, Edith: I used to file the good cases under other people\'s names. The jokes I keep.',
      warm: 'I came because you asked. I do not do that for the filing cabinet, whatever it thinks.',
      dramatic: 'I have a name I do not put on reports. Tonight you may use the one on the door.',
    },
    sara: {
      sarcastic: 'By day I teach dogs to sit. By night the ghosts are worse pupils, and they do not get treats.',
      warm: '{dog} failed as a sheepdog. He is excellent at people who are not entirely here. I kept him.',
      dramatic: 'I talk to dogs more honestly than I talk to the living. The dog has never once filed a complaint.',
    },
    barty: {
      sarcastic: 'They told me the dead were finished with me. The dead, as usual, were not consulted.',
      warm: 'I let Ambrose win an argument about poetry in 1978. I have not had a quiet year since.',
      dramatic: 'I did not retire. I was dismissed by a century. It has sent a sequel.',
    },
    pip: {
      sarcastic: 'The scanner is a radio my mother said was broken. It works when I am nervous, which is always.',
      warm: 'I am fourteen. I brought a scanner and a speech. Please do not send me home before the ghost.',
      dramatic: 'If this beeps at the wrong thing, that is the machine. If I do, that is also the machine. We are a team.',
    },
    ondine: {
      sarcastic: 'The veil is so the living do not make eye contact. The dead are less trouble at parties.',
      warm: 'I am kinder to ghosts than to clients. Clients interrupt. Ghosts only linger, which is a form of manners.',
      dramatic: 'I knew Ambrose when he was only late, not dead. Late was practice.',
    },
  },
  dog: {
    crowe: { sarcastic: '', warm: '', dramatic: '' },
    sara: {
      sarcastic: '{dog} sneezes at the skirting. Professional opinion: something is here, and it is dusty.',
      warm: 'He leans on your knee. When he does that, he is asking to be useful.',
      dramatic: 'The dog has opinions. They are mostly "fetch" and "that corner is lying".',
    },
    barty: { sarcastic: '', warm: '', dramatic: '' },
    pip: { sarcastic: '', warm: '', dramatic: '' },
    ondine: { sarcastic: '', warm: '', dramatic: '' },
  },
};

export function aside(id: DetectiveId, moment: 'edith' | 'june' | 'ambrose' | 'dog' | 'secret', tone: Tone): string {
  const dog = detectiveById('sara').dog ?? 'Skuggi';
  return (LINES[moment]?.[id]?.[tone] ?? '').replaceAll('{dog}', dog);
}
