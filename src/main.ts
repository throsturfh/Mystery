import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import Phaser from 'phaser';
import { H, W } from './config';
import { getCase } from './data/cases';
import { BootScene } from './scenes/BootScene';
import { CreateScene } from './scenes/CreateScene';
import { EndingScene } from './scenes/EndingScene';
import { FieldScene } from './scenes/FieldScene';
import { ReportScene } from './scenes/ReportScene';
import './style.css';
import { applyTime, getSave } from './state';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#140e0a',
  banner: false,
  fps: { target: 60, forceSetTimeOut: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: true,
  },
  scene: [BootScene, CreateScene, FieldScene, ReportScene, EndingScene],
};

async function boot(): Promise<void> {
  const fonts = Promise.all([
    document.fonts.load("700 28px Cinzel"),
    document.fonts.load("500 20px 'Cormorant Garamond'"),
    document.fonts.load("italic 500 20px 'Cormorant Garamond'"),
    document.fonts.ready,
  ]);
  await Promise.race([fonts, new Promise((resolve) => window.setTimeout(resolve, 2500))]);
  new Phaser.Game(config);
  const rotate = document.getElementById('rotate');
  const syncRotate = () => {
    if (!rotate) return;
    rotate.classList.toggle('show', window.innerHeight > window.innerWidth);
  };
  syncRotate();
  window.addEventListener('resize', syncRotate);
  window.addEventListener('pagehide', () => {
    const save = getSave();
    if (save.caseStatus !== 'active') return;
    applyTime(save, Date.now(), { fear: false, economy: getCase(save.caseId).economy });
  });
}

void boot();

window.addEventListener('error', (event) => {
  const live = document.getElementById('live');
  if (live) live.textContent = `ERROR ${event.message}`;
});
