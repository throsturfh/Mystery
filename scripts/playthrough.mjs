/**
 * Headless landscape playthrough of Case 0.
 * Requires the dev server on http://127.0.0.1:8734.
 * Screenshots land in /tmp/hollowmere.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const URL = process.env.GAME_URL ?? 'http://127.0.0.1:8734';
const OUT = process.env.SHOT_DIR ?? '/tmp/hollowmere';
const VIEW_W = Number(process.env.VIEW_W ?? 844);
const VIEW_H = Number(process.env.VIEW_H ?? 390);
mkdirSync(OUT, { recursive: true });

function field(text, key) {
  const part = text.split('|').find((item) => item.startsWith(`${key}:`));
  return part ? part.slice(key.length + 1) : '';
}

function hasClue(text, id) {
  return field(text, 'found').split('.').filter(Boolean).includes(id);
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function textOf(page) {
  return page.locator('#debug-step').innerText();
}

async function waitFor(page, pred, timeout = 12000) {
  const start = Date.now();
  let last = '';
  while (Date.now() - start < timeout) {
    last = await textOf(page).catch(() => '');
    if (last && pred(last)) return last;
    await page.waitForTimeout(40);
  }
  throw new Error(`timed out; last="${last}"`);
}

async function pointOf(page, id) {
  return page.evaluate((regionId) => {
    const api = window.__hollowmere;
    const rect = api?.regions?.[regionId];
    const canvas = document.querySelector('#game canvas');
    if (!rect || !(canvas instanceof HTMLCanvasElement) || !api) return null;
    const box = canvas.getBoundingClientRect();
    return {
      x: box.left + ((rect.x + rect.w / 2) / api.width) * box.width,
      y: box.top + ((rect.y + rect.h / 2) / api.height) * box.height,
    };
  }, id);
}

async function clickId(page, id) {
  const point = await pointOf(page, id);
  if (!point) throw new Error(`missing region ${id}; line=${await textOf(page)}`);
  await page.mouse.click(point.x, point.y);
}

async function shot(page, name) {
  if (!name) return;
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
}

async function gather(page) {
  const extras = ['obj-register', 'obj-globe', 'obj-shop-cup', 'obj-shop-glass', 'obj-umbrella'];
  let extra = 0;
  for (let i = 0; i < 16; i += 1) {
    const text = await textOf(page);
    if (field(text, 'step') === 'nook') return;
    if (!hasClue(text, 'shelves')) {
      await clickId(page, 'obj-novels');
      continue;
    }
    if (!hasClue(text, 'doorbell')) {
      await clickId(page, 'obj-doorbell');
      continue;
    }
    const id = extras[extra] ?? extras[extras.length - 1];
    extra += 1;
    const before = field(text, 'ev');
    await clickId(page, id);
    await waitFor(page, (line) => field(line, 'ev') !== before || field(line, 'step') === 'nook', 2500).catch(() => undefined);
  }
  throw new Error(`stuck gathering; line=${await textOf(page)}`);
}

async function pinAll(page) {
  for (let i = 0; i < 8; i += 1) {
    const id = await page.evaluate(() =>
      Object.keys(window.__hollowmere?.regions ?? {}).find((key) => key.startsWith('tray-')),
    );
    if (!id) return;
    await clickId(page, id);
    await clickId(page, 'board-surface');
    await page.waitForTimeout(40);
  }
}

async function linkChain(page) {
  const ids = await page.evaluate(() =>
    Object.keys(window.__hollowmere?.regions ?? {})
      .filter((key) => key.startsWith('pin-'))
      .map((key) => key.slice(4)),
  );
  for (let i = 0; i < ids.length - 1; i += 1) {
    const line = await textOf(page);
    const links = Number(field(line, 'links'));
    await clickId(page, `pin-${ids[i]}`);
    await clickId(page, `pin-${ids[i + 1]}`);
    await waitFor(page, (next) => Number(field(next, 'links')) > links, 2000).catch(() => undefined);
  }
}

async function calmLamps(page) {
  for (let beat = 0; beat < 4; beat += 1) {
    await waitFor(page, (line) => line.includes('phase:rhythm-open'), 5000);
    await clickId(page, 'beat-active');
    await waitFor(page, (line) => !line.includes('phase:rhythm-open'), 2500);
  }
}

const shots = process.env.SKIP_SHOTS !== '1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: VIEW_W, height: VIEW_H },
  deviceScaleFactor: 1,
  hasTouch: true,
});
page.on('pageerror', (error) => console.error('PAGE', error.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.error('CONSOLE', msg.text());
});

try {
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitFor(page, (line) => line.startsWith('step:name'), 15000);

  await page.locator('#detective-name').fill('Rowan Hale');
  await page.locator('#name-confirm').click();
  await waitFor(page, (line) => line.startsWith('step:outfit'));
  await clickId(page, 'coat-tweed');
  await clickId(page, 'hat-fedora');
  if (shots) await shot(page, 'wardrobe');
  await clickId(page, 'duty');
  await waitFor(page, (line) => line.startsWith('step:briefing'));

  await clickId(page, 'obj-folder');
  if (shots) await shot(page, 'office');
  await clickId(page, 'enter-shop');
  await waitFor(page, (line) => field(line, 'step') === 'evidence' && field(line, 'place') === 'shop');
  if (shots) await shot(page, 'shop_floor');
  await clickId(page, 'menu');
  await waitFor(page, (line) => field(line, 'mode') === 'menu');
  if (shots) await shot(page, 'field_menu');
  await clickId(page, 'close-menu');
  await waitFor(page, (line) => field(line, 'mode') === 'play');

  await gather(page);
  await clickId(page, 'tab-nook');
  await waitFor(page, (line) => field(line, 'step') === 'emf' && field(line, 'place') === 'nook');
  if (shots) await shot(page, 'reading_nook');
  await clickId(page, 'tool-emf');
  await waitFor(page, (line) => field(line, 'step') === 'cold');

  let coldDone = false;
  for (let i = 0; i < 6 && !coldDone; i += 1) {
    await waitFor(page, (line) => field(line, 'cold') === '1' || field(line, 'step') === 'upgrade', 7000);
    if (field(await textOf(page), 'step') === 'upgrade') {
      coldDone = true;
      break;
    }
    await clickId(page, 'cold');
    await page.waitForTimeout(200);
    coldDone = field(await textOf(page), 'step') === 'upgrade';
  }
  assert(coldDone, `cold spot missed; line=${await textOf(page)}`);

  if (!hasClue(await textOf(page), 'novel')) await clickId(page, 'obj-book');
  await waitFor(page, (line) => hasClue(line, 'novel'));

  await clickId(page, 'tool-emf');
  await waitFor(page, (line) => field(line, 'mode') === 'upgrade');
  if (shots) await shot(page, 'emf_upgrade');
  await clickId(page, 'tune');
  await waitFor(page, (line) => field(line, 'step') === 'tea' && field(line, 'lv') === '2');
  await clickId(page, 'tool-emf');
  await waitFor(page, (line) => field(line, 'placed') !== '-');
  await clickId(page, 'tool-tea');
  await waitFor(page, (line) => field(line, 'step') === 'idle');
  if (shots) await shot(page, 'tea_recap');
  await clickId(page, 'recap-ok');
  await waitFor(page, (line) => field(line, 'step') === 'fear');
  await clickId(page, 'continue');
  await waitFor(page, (line) => field(line, 'step') === 'pin');

  const beforeAway = await textOf(page);
  const emfBefore = Number(field(beforeAway, 'emf'));
  const fearBefore = Number(field(beforeAway, 'fear'));
  await page.evaluate(() => window.__hollowmere?.debugSetLastTick(Date.now() - 2 * 60 * 60 * 1000));
  await page.reload();
  const away = await waitFor(page, (line) => field(line, 'mode') === 'away', 15000);
  if (shots) await shot(page, 'while_away');
  assert(Number(field(away, 'emf')) >= emfBefore + 20, `offline EMF ${emfBefore} -> ${field(away, 'emf')}`);
  assert(Number(field(away, 'fear')) === fearBefore, `fear changed offline ${fearBefore} -> ${field(away, 'fear')}`);
  await clickId(page, 'away-ok');
  await waitFor(page, (line) => field(line, 'mode') === 'play');

  await clickId(page, 'case');
  await waitFor(page, (line) => field(line, 'mode') === 'board');
  await pinAll(page);
  await linkChain(page);
  if (shots) await shot(page, 'case_board');
  await clickId(page, 'close-board');
  await waitFor(page, (line) => field(line, 'step') === 'ghost');

  await clickId(page, 'tab-stock');
  await waitFor(page, (line) => field(line, 'place') === 'stock');
  if (shots) await shot(page, 'stockroom');
  await clickId(page, 'obj-drawer');
  await calmLamps(page);
  await waitFor(page, (line) => line.includes('phase:offer'), 5000);
  await clickId(page, 'drag-pages');
  await clickId(page, 'drop-ambrose');
  await waitFor(page, (line) => line.includes('phase:read'), 5000);
  if (shots) await shot(page, 'ambrose_reading');
  await waitFor(page, (line) => field(line, 'step') === 'stamp', 8000);

  await clickId(page, 'case');
  await waitFor(page, (line) => field(line, 'mode') === 'board');
  await pinAll(page);
  await linkChain(page);
  await clickId(page, 'close-board');
  await waitFor(page, (line) => field(line, 'mode') === 'play' && field(line, 'step') === 'stamp');
  await clickId(page, 'stamp');

  const report = await waitFor(page, (line) => line.startsWith('step:report') && line.includes('mode:report'), 8000);
  const save = await page.evaluate(() => window.__hollowmere?.getSave());
  assert(report.includes('stars:1.2.3'), report);
  assert(field(report, 'miss') === '0', report);
  assert(field(report, 'low') === '1', report);
  assert(field(report, 'light') === '1', report);
  assert(field(report, 'pinwear') === '1', report);
  assert(field(report, 'trophy') === '1', report);
  assert(field(report, 'bonus') === '70', report);
  assert(save?.detective?.name === 'Rowan Hale', JSON.stringify(save?.detective));
  assert(save?.tools?.emf?.level >= 2, 'emf level');
  assert(save?.tools?.flashlight?.owned === true, 'flashlight');
  if (shots) await shot(page, 'report_card');

  await clickId(page, 'report-next');
  await waitFor(page, (line) => line.includes('phase:card') && line.startsWith('step:envelope'), 8000);
  if (shots) await shot(page, 'case_1_coming_soon');

  await clickId(page, 'ending-reset');
  await waitFor(page, (line) => line.includes('mode:confirm'));
  await clickId(page, 'reset-yes');
  await waitFor(page, (line) => line.startsWith('step:name'), 15000);
  console.log('PLAYTHROUGH_OK', VIEW_W, VIEW_H);
} finally {
  await browser.close();
}
