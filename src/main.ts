import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import Phaser from 'phaser';
import { H, W } from './config';
import { bindDisplay } from './fullscreen';
import { scenes } from './scenes/BootScene';
import './style.css';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#140e0a',
  banner: false,
  // rAF, so a walk step lands on every paint. setTimeout was updating between frames and Edmund jumped.
  fps: { target: 60, forceSetTimeOut: false },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: true,
  },
  scene: scenes,
};

async function boot(): Promise<void> {
  const fonts = Promise.all([
    document.fonts.load('700 28px Cinzel'),
    document.fonts.load("500 22px 'Cormorant Garamond'"),
    document.fonts.ready,
  ]);
  await Promise.race([fonts, new Promise((resolve) => window.setTimeout(resolve, 2500))]);
  bindDisplay(new Phaser.Game(config));
}

void boot();

window.addEventListener('error', (event) => {
  const live = document.getElementById('live');
  if (live && !live.textContent) live.textContent = `ERROR ${event.message}`;
});
