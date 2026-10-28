import type Phaser from 'phaser';

const TIP_KEY = 'hollowmere-ios-home-tip';

type Lockable = ScreenOrientation & { lock?: (orientation: 'landscape') => Promise<void> };

function isPortrait(): boolean {
  return window.innerHeight > window.innerWidth;
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!iOS || !/WebKit/.test(ua)) return false;
  return !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  );
}

function fullscreenElement(): Element | null {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function tipDismissed(): boolean {
  try {
    return localStorage.getItem(TIP_KEY) === '1';
  } catch {
    return true;
  }
}

function rememberTip(): void {
  try {
    localStorage.setItem(TIP_KEY, '1');
  } catch {
    /* private mode can refuse storage; the tip simply returns next visit */
  }
}

export function bindDisplay(game: Phaser.Game): void {
  const rotate = document.getElementById('rotate');
  const tip = document.getElementById('ios-tip');
  const dismiss = document.getElementById('ios-tip-dismiss');
  let dismissed = tipDismissed();
  let pending = false;

  const refit = () => {
    const parent = document.getElementById('game');
    const width = parent?.clientWidth ?? window.innerWidth;
    const height = parent?.clientHeight ?? window.innerHeight;
    if (width > 0 && height > 0) game.scale.setParentSize(width, height);
    game.scale.refresh();
  };

  const scheduleFit = () => {
    refit();
    window.setTimeout(refit, 80);
    window.setTimeout(refit, 320);
  };

  const syncChrome = () => {
    const portrait = isPortrait();
    rotate?.classList.toggle('show', portrait);
    rotate?.setAttribute('aria-hidden', portrait ? 'false' : 'true');
    const showTip = !portrait && isIosSafari() && !isStandalone() && !dismissed;
    tip?.classList.toggle('show', showTip);
    tip?.setAttribute('aria-hidden', showTip ? 'false' : 'true');
  };

  const enterFullscreen = async () => {
    if (isPortrait() || fullscreenElement() || pending) return;
    const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    const request = root.requestFullscreen?.bind(root) ?? root.webkitRequestFullscreen?.bind(root);
    if (!request) return;
    pending = true;
    try {
      await request({ navigationUI: 'hide' });
    } catch {
      /* a second tap can try again; some browsers refuse without a gesture */
    }
    try {
      await (screen.orientation as Lockable | undefined)?.lock?.('landscape');
    } catch {
      /* orientation lock is often refused outside a fullscreen Android browser */
    }
    pending = false;
    scheduleFit();
  };

  dismiss?.addEventListener('click', (event) => {
    event.stopPropagation();
    dismissed = true;
    rememberTip();
    syncChrome();
  });

  window.addEventListener('pointerdown', () => void enterFullscreen(), { capture: true });
  document.addEventListener('fullscreenchange', scheduleFit);
  document.addEventListener('webkitfullscreenchange', scheduleFit);
  window.addEventListener('resize', () => {
    syncChrome();
    scheduleFit();
  });
  window.addEventListener('orientationchange', () => {
    syncChrome();
    scheduleFit();
  });
  window.visualViewport?.addEventListener('resize', scheduleFit);
  syncChrome();
  scheduleFit();
}
