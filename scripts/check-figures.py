#!/usr/bin/env python3
"""Fail if a walk frame would draw a different height from the idle pose.

The game scales by opaque pixel height (see src/figure.ts). This check applies
that same rule to every detective frame.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FIGURE = (ROOT / 'src' / 'figure.ts').read_text()
front = int(re.search(r'frontPx:\s*(\d+)', FIGURE).group(1))
back = int(re.search(r'backPx:\s*(\d+)', FIGURE).group(1))
scene = (ROOT / 'src' / 'scenes' / 'AdventureScene.ts').read_text()
if 'opaqueHeight(' not in scene or 'figurePixels(' not in scene:
    print('FAIL AdventureScene is not scaling by opaque height')
    sys.exit(1)


def pixels(y: float) -> float:
    t = max(0.0, min(1.0, (y - 535) / (602 - 535)))
    return back + t * (front - back)


def opaque_height(path: Path) -> int:
    alpha = np.array(Image.open(path).convert('RGBA'))[:, :, 3] > 24
    ys = np.where(alpha)[0]
    if len(ys) == 0:
        return 1
    return int(ys.max() - ys.min())


def shown(path: Path, y: float = 590) -> float:
    height = opaque_height(path)
    return pixels(y) / height * height


def main() -> int:
    target = shown(ROOT / 'public/assets/layers/detective-base.png')
    failed = False
    pairs = [('crowe', ROOT / 'public/assets/layers', 6)]
    for who, count in (('sara', 6), ('barty', 10), ('pip', 10), ('ondine', 10)):
        pairs.append((who, ROOT / 'public/assets/cast' / who, count))
    for who, folder, count in pairs:
        idle = shown(folder / 'detective-base.png')
        if abs(idle - target) > 1:
            # Different paintings are normalised to the same target, so idle
            # displayed height must match the reference target exactly.
            print(f'FAIL {who} idle displays at {idle:.1f}, expected {target:.1f}')
            failed = True
        for index in range(count):
            walk = shown(folder / f'walk-{index}-base.png')
            if abs(walk - idle) > 1.5:
                print(f'FAIL {who} walk-{index} displays at {walk:.1f}, idle {idle:.1f}')
                failed = True
    if failed:
        return 1
    print(f'ok figure height {target:.0f}px at the front for every detective frame')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
