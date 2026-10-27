/** Screenshot debug hotspots for each room. Dev server on :8734. */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const URL = process.env.GAME_URL ?? 'http://127.0.0.1:8734/?spots=1';
const OUT = '/tmp/hollowmere-spots';
mkdirSync(OUT, { recursive: true });

function save(place) {
  return {
    version: 2,
    caseId: 'bellweather',
    detective: { name: 'Rowan Hale', coat: 'tweed', hat: 'fedora', pin: false },
    resources: { evidence: 0, ectoplasm: 0, emf: 0, fear: 4 },
    emfFraction: 0,
    fearMs: 0,
    tools: { emf: { owned: false, level: 0, placedRoom: '' }, flashlight: { owned: false, tapLevel: 0 } },
    rooms: ['office', 'shop'],
    cluesFound: [],
    objectsFound: [],
    cluesPinned: [],
    links: [],
    tutorialIndex: 3,
    caseStatus: 'active',
    fearStayedLow: true,
    encounterMisses: 0,
    encounterDone: false,
    encounterRewarded: false,
    stars: [],
    bankedEvidenceBonus: 0,
    trophyBookmark: false,
    storyMinutes: 1120,
    lastTick: Date.now(),
    muted: true,
    teaTaken: false,
    lastTeaGain: 0,
    seenEnvelope: false,
    place,
    awayNotice: null,
  };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto(URL);
for (const room of ['shop', 'nook', 'stock', 'office']) {
  await page.evaluate((data) => localStorage.setItem('hollowmere-dispatch-v1', JSON.stringify(data)), save(room));
  await page.reload();
  await page.waitForFunction(
    (roomId) => (document.getElementById('debug-step')?.textContent ?? '').includes(`place:${roomId}`),
    room,
    { timeout: 15000 },
  );
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${room}.png` });
  console.log('shot', room);
}
await browser.close();
