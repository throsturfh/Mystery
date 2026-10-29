#!/usr/bin/env python3
"""Frame-by-frame Edmund, matching the painted detective already in the game.

The face, hat, lantern, satchel and shoes are the existing paintings, placed
as rigid pieces. Coat, scarf, arms and legs are drawn new on every frame
(contact, down, passing, up). Nothing here bends one sprite.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
LAYERS = ROOT / "public" / "assets" / "layers"
OUT = ROOT / "public" / "assets" / "edmund"

CELL_W, CELL_H = 640, 1080
PIVOT_X, PIVOT_Y = 300, 1020
SS = 1

INK = (62, 36, 28, 255)
COAT = (176, 132, 78, 255)
COAT_D = (120, 84, 48, 255)
COAT_L = (214, 170, 112, 255)
TROUSER = (78, 64, 58, 255)
TROUSER_D = (52, 42, 40, 255)
SKIN = (214, 164, 120, 255)
SKIN_D = (176, 122, 86, 255)


def smooth(u: float) -> float:
    u = max(0.0, min(1.0, u))
    return u * u * (3 - 2 * u)


def interp(u: float, keys: list[tuple[float, float]]) -> float:
    u = max(0.0, min(1.0, u))
    if u <= keys[0][0]:
        return keys[0][1]
    for (a, av), (b, bv) in zip(keys, keys[1:]):
        if u <= b:
            t = (u - a) / max(1e-6, b - a)
            return av + (bv - av) * t
    return keys[-1][1]


# --- pieces cut from the live painting -------------------------------------

def composite() -> Image.Image:
    img = Image.open(LAYERS / "detective-base.png").convert("RGBA")
    for name in ("detective-coat-tan.png", "detective-scarf-plaid.png", "detective-hat-brown.png"):
        img.alpha_composite(Image.open(LAYERS / name).convert("RGBA"))
    return img


def cut_head() -> tuple[Image.Image, tuple[int, int]]:
    """Hat and face only. Anchor is the chin, so the head can sit on a new neck."""
    base = np.array(Image.open(LAYERS / "detective-base.png").convert("RGBA"))
    hat = np.array(Image.open(LAYERS / "detective-hat-brown.png").convert("RGBA"))
    h, w = base.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    # Face oval under the brim, plus every hat pixel. Shoulders stay out.
    face = ((xx - 312) / 108) ** 2 + ((yy - 210) / 125) ** 2 <= 1
    face &= yy < 330
    keep = ((hat[:, :, 3] > 20) & (yy < 160)) | (face & (base[:, :, 3] > 20))
    # Drop the lantern hand if the oval caught it.
    keep &= xx < 430
    out = np.zeros_like(base)
    src = base.copy()
    src[hat[:, :, 3] > 20] = hat[hat[:, :, 3] > 20]
    out[keep] = src[keep]
    ys, xs = np.where(keep)
    pad = 2
    box = (max(0, xs.min() - pad), max(0, ys.min() - pad), xs.max() + pad + 1, ys.max() + pad + 1)
    crop = Image.fromarray(out).crop(box)
    # Chin is the lowest face pixel, used as the neck anchor.
    sub = np.array(crop)
    face_local = sub[:, :, 3] > 20
    # Prefer the bottom-centre of the lower half as the chin.
    ys, xs = np.where(face_local)
    chin_y = int(ys.max())
    band = ys > (ys.min() + ys.max()) * 0.72
    chin_x = int(np.median(xs[band])) if band.any() else int(np.median(xs))
    return crop, (chin_x, chin_y)


def cut_mask(mask: np.ndarray, src: np.ndarray, pad: int = 2) -> tuple[Image.Image, tuple[int, int]]:
    ys, xs = np.where(mask)
    box = (max(0, int(xs.min()) - pad), max(0, int(ys.min()) - pad), int(xs.max()) + pad + 1, int(ys.max()) + pad + 1)
    out = np.zeros_like(src)
    out[mask] = src[mask]
    crop = Image.fromarray(out).crop(box)
    arr = np.array(crop)
    a = arr[:, :, 3] > 20
    ys, xs = np.where(a)
    anchor = (int(np.median(xs)), int(ys.max()))
    return crop, anchor


def load_props():
    base = np.array(Image.open(LAYERS / "detective-base.png").convert("RGBA"))
    full = np.array(composite())
    h, w = base.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    r, g, b, a = full[:, :, 0], full[:, :, 1], full[:, :, 2], full[:, :, 3]
    # Lantern plus the hand on its handle. Rigid prop.
    lantern = (a > 20) & (xx > 400) & (yy > 340) & (yy < 600) & (xx < 530)
    lantern = _largest(lantern)
    # Satchel, not the coat behind it.
    bag = (a > 20) & (xx < 200) & (yy > 430) & (yy < 760) & (r > 90) & (r < 200) & (g > 45) & (g < 140) & (b < 100)
    bag = _largest(bag)
    shoe = (a > 20) & (yy > 860) & (r > 50) & (g > 25) & (b < 110)
    import cv2
    shoe = cv2.dilate(shoe.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
    shoe &= a > 20
    shoe_l = _largest(shoe & (xx < 250))
    shoe_r = _largest(shoe & (xx > 280))
    return {
        "lantern": cut_mask(lantern, full, 1),
        "bag": cut_mask(bag, full, 1),
        "shoe_l": cut_mask(shoe_l, full, 1),
        "shoe_r": cut_mask(shoe_r, full, 1),
    }


def _largest(mask: np.ndarray) -> np.ndarray:
    import cv2
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    if n <= 1:
        return mask
    # Skip background label 0.
    areas = stats[1:, cv2.CC_STAT_AREA]
    keep = 1 + int(np.argmax(areas))
    return labels == keep


# --- poses ------------------------------------------------------------------

BOB = [(0.0, 0.0), (0.22, -0.55), (0.33, -1.0), (0.5, 0.15), (0.72, 0.65), (0.86, 1.0), (1.0, 0.0)]
LIFT = [(0.0, 0.0), (0.28, 0.04), (0.5, 0.12), (0.78, 0.55), (0.9, 0.2), (1.0, 0.0)]


def step_pose(frame: int, per_step: int, reach: float = 0.0) -> dict:
    """Screen-space pose. +x is forward (character faces right). y grows down."""
    u = 0.0 if per_step <= 1 else (frame % per_step) / per_step
    step = 0 if per_step <= 1 else frame // per_step
    right_supports = step % 2 == 1
    bob = interp(u, BOB) * 18
    stride = 170
    # Support foot plants and travels back under the body. Swing foot lifts through.
    sup_x = stride * (1 - 2 * u)
    sup_y = 0.0
    e = smooth(u)
    sw_x = -stride + 2 * stride * e
    sw_lift = interp(u, LIFT) * 200
    if right_supports:
        rx, ry, lx, ly = sup_x, sup_y, sw_x, sw_lift
        arm_r = -math.cos(u * math.pi) * 0.7
        arm_l = math.cos(u * math.pi) * 0.7
    else:
        rx, ry, lx, ly = sw_x, sw_lift, sup_x, sup_y
        arm_r = math.cos(u * math.pi) * 0.7
        arm_l = -math.cos(u * math.pi) * 0.7
    if reach:
        arm_l = arm_l * (1 - reach) + 1.15 * reach
        bob += 10 * reach
    return {
        "u": u,
        "bob": bob,
        "reach": reach,
        "hip": (0.0, bob),
        "rx": rx,
        "ry": ry,
        "lx": lx,
        "ly": ly,
        "arm_r": arm_r,
        "arm_l": arm_l,
        "hem": -math.sin((u - 0.28) * math.pi * 2) * 16,
        "scarf": -math.sin((u - 0.35) * math.pi * 2) * 14,
    }


def idle_pose(i: int, n: int = 8) -> dict:
    t = i / n
    breath = math.sin(t * math.pi * 2) * 6
    p = step_pose(0, 2)
    p["bob"] = -breath
    p["rx"], p["ry"] = 36, 0
    p["lx"], p["ly"] = -28, 0
    p["arm_r"] = 0.35
    p["arm_l"] = 0.05
    p["hem"] = math.sin(t * math.pi * 2 + 0.4) * 4
    p["scarf"] = math.sin(t * math.pi * 2) * 5
    p["reach"] = 0.0
    return p


def take_pose(i: int, n: int = 10) -> dict:
    keys = [(0.0, 0.0), (0.12, -0.08), (0.42, 1.0), (0.55, 1.0), (0.82, 0.15), (1.0, 0.0)]
    k = max(0.0, interp(i / (n - 1), keys))
    k = smooth(k)
    p = idle_pose(0)
    p["reach"] = k
    p["arm_l"] = 0.05 * (1 - k) + 1.2 * k
    p["bob"] = 8 * k
    p["grasp"] = i >= 5
    return p


# --- drawing ----------------------------------------------------------------

def _pt(pose, dx, above, view: str) -> tuple[float, float]:
    """dx is forward (screen right). `above` is pixels above the sole."""
    y = PIVOT_Y - above + pose["bob"]
    x = PIVOT_X + dx
    return x, y


class Frame:
    def __init__(self):
        self.im = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
        self.draw = ImageDraw.Draw(self.im)
        self.mat = np.zeros((CELL_H, CELL_W), np.uint8)

    def paste(self, sprite: Image.Image, anchor: tuple[int, int], at: tuple[float, float], mat: int, angle: float = 0.0, scale: float = 1.0):
        spr = sprite
        anc = anchor
        if scale != 1.0:
            spr = spr.resize((max(1, int(spr.width * scale)), max(1, int(spr.height * scale))), Image.Resampling.LANCZOS)
            anc = (int(anchor[0] * scale), int(anchor[1] * scale))
        if abs(angle) > 0.4:
            spr, anc = _spin(spr, anc, angle)
        x = int(at[0] - anc[0])
        y = int(at[1] - anc[1])
        self.im.alpha_composite(spr, (x, y))
        arr = np.array(spr)
        a = arr[:, :, 3] > 20
        ys, xs = np.where(a)
        for yy, xx in zip(ys[::3], xs[::3]):
            cy, cx = y + int(yy), x + int(xx)
            if 0 <= cy < CELL_H and 0 <= cx < CELL_W:
                self.mat[cy, cx] = mat

    def poly(self, pts, fill, mat, outline=True, width=4):
        if len(pts) < 3:
            return
        self.draw.polygon(pts, fill=fill)
        if outline:
            self.draw.line(pts + [pts[0]], fill=INK, width=width)
        self._mark(pts, mat)

    def _mark(self, pts, mat):
        m = Image.new("L", (CELL_W, CELL_H), 0)
        ImageDraw.Draw(m).polygon(pts, fill=255)
        hit = np.array(m) > 0
        self.mat[hit] = mat


def _spin(sprite: Image.Image, anchor: tuple[int, int], angle: float) -> tuple[Image.Image, tuple[int, int]]:
    """Rotate around `anchor`. Returns the new image and the anchor's new pixel."""
    # Pad so the anchor stays the rotation centre.
    w, h = sprite.size
    cx, cy = anchor
    side = int(math.hypot(w, h)) + 8
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox, oy = side // 2 - cx, side // 2 - cy
    canvas.alpha_composite(sprite, (ox, oy))
    turned = canvas.rotate(angle, resample=Image.Resampling.BICUBIC, center=(side // 2, side // 2))
    arr = np.array(turned)
    ys, xs = np.where(arr[:, :, 3] > 16)
    if len(xs) == 0:
        return sprite, anchor
    box = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    crop = turned.crop(box)
    new_anchor = (side // 2 - box[0], side // 2 - box[1])
    return crop, new_anchor


def _rotated_anchor(anchor, size, angle):
    return anchor


def coat_polygon(pose, view: str) -> list[tuple[float, float]]:
    hem = pose["hem"]
    # Shoulder near the chin, ragged hem a little above the shoes.
    if view == "three":
        return [
            _pt(pose, -80, 700, view),
            _pt(pose, 20, 740, view),
            _pt(pose, 100, 690, view),
            _pt(pose, 120, 420, view),
            _pt(pose, 90 + hem, 250, view),
            _pt(pose, 10 + hem * 0.5, 220, view),
            _pt(pose, -110 + hem * 0.25, 260, view),
            _pt(pose, -100, 430, view),
        ]
    if view == "front":
        top = _pt(pose, 0, 700, view)[1]
        bot = _pt(pose, 0, 300, view)[1]
        cx = PIVOT_X
        return [
            (cx - 130, top), (cx + 130, top),
            (cx + 145, bot + 30), (cx + 36, bot),
            (cx - 36, bot), (cx - 145, bot + 20),
        ]
    top = _pt(pose, 0, 700, view)[1]
    bot = _pt(pose, 0, 310, view)[1]
    cx = PIVOT_X
    return [(cx - 130, top), (cx + 130, top), (cx + 140, bot), (cx - 140, bot)]


def leg(pose, which: str, view: str) -> tuple[list, list]:
    """Thigh and shin polygons, plus the shoe anchor and angle."""
    if which == "r":
        fx, fy = pose["rx"], pose["ry"]
        hip_x = 36
    else:
        fx, fy = pose["lx"], pose["ly"]
        hip_x = -36
    if view == "front":
        hip_x = 48 if which == "r" else -48
        # In front view the stride is toward the camera: x separation stays, lift is y.
        foot = (PIVOT_X + hip_x * 0.9 + fx * 0.55, PIVOT_Y - fy + pose["bob"])
        hip = (PIVOT_X + hip_x, _pt(pose, 0, 500, view)[1])
    elif view == "back":
        hip_x = 46 if which == "r" else -46
        foot = (PIVOT_X + hip_x * 0.9 - fx * 0.55, PIVOT_Y - fy + pose["bob"])
        hip = (PIVOT_X + hip_x, _pt(pose, 0, 500, view)[1])
    else:
        foot = _pt(pose, fx + hip_x * 0.15, fy, view)
        # _pt treats the second value as "above the sole", and fy is already a lift.
        foot = (PIVOT_X + fx + hip_x * 0.15, PIVOT_Y - fy + pose["bob"])
        hip = _pt(pose, hip_x * 0.4, 500, view)
    # Knee bends forward (screen-right in 3/4) when the foot is up or behind.
    if fy > 36:
        kx = hip[0] + (55 if view == "three" else 10)
        ky = hip[1] + 70 + min(40, fy * 0.15)
    else:
        kx = (hip[0] + foot[0]) / 2 + 6
        ky = (hip[1] + foot[1]) / 2 - 4
    knee = (kx, ky)
    def tube(a, b, r0, r1):
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        px, py = -math.sin(ang), math.cos(ang)
        return [
            (a[0] + px * r0, a[1] + py * r0),
            (b[0] + px * r1, b[1] + py * r1),
            (b[0] - px * r1, b[1] - py * r1),
            (a[0] - px * r0, a[1] - py * r0),
        ]
    thigh = tube(hip, knee, 36, 28)
    shin = tube(knee, foot, 26, 18)
    angle = math.degrees(math.atan2(foot[1] - knee[1], foot[0] - knee[0])) - 90
    return [thigh, shin], (foot, angle)


def scarf_ribbon(pose, view: str) -> list[tuple[float, float]]:
    lag = pose["scarf"]
    if view == "three":
        a = _pt(pose, 18, 690, view)
        b = _pt(pose, 28 + lag * 0.3, 520, view)
        c = _pt(pose, 10 + lag, 360, view)
        d = _pt(pose, 22 + lag * 1.2, 240, view)
    else:
        a = (PIVOT_X, _pt(pose, 0, 690, view)[1])
        b = (PIVOT_X + lag * 0.2, _pt(pose, 0, 520, view)[1])
        c = (PIVOT_X - 8 + lag, _pt(pose, 0, 360, view)[1])
        d = (PIVOT_X + 6 + lag, _pt(pose, 0, 250, view)[1])
    return [a, b, c, d]


def arm_joints(pose, which: str, view: str):
    swing = pose["arm_r"] if which == "r" else pose["arm_l"]
    if view == "three":
        sx = 78 if which == "r" else -55
        shoulder = _pt(pose, sx, 680, view)
        reach = pose["reach"] if which == "l" else 0
        length = 230
        # swing > 0 reaches forward (screen right). 0 hangs down.
        hand = (
            shoulder[0] + math.sin(swing) * length + reach * 40,
            shoulder[1] + math.cos(swing) * length * 0.92 + reach * 30,
        )
        elbow = (
            (shoulder[0] + hand[0]) / 2 + 10,
            (shoulder[1] + hand[1]) / 2 - 8,
        )
        return shoulder, elbow, hand
    side = 1 if which == "r" else -1
    if view == "back":
        side = -side
    shoulder = (PIVOT_X + side * 120, _pt(pose, 0, 680, view)[1])
    hand = (
        shoulder[0] + side * math.sin(swing) * 40 + (70 if which == "r" else -20),
        shoulder[1] + 200 - abs(swing) * 30,
    )
    elbow = ((shoulder[0] + hand[0]) / 2, (shoulder[1] + hand[1]) / 2)
    return shoulder, elbow, hand


def draw_arm(fr: Frame, a, b, fill):
    ang = math.atan2(b[1] - a[1], b[0] - a[0])
    px, py = -math.sin(ang), math.cos(ang)
    r0, r1 = 18, 12
    pts = [
        (a[0] + px * r0, a[1] + py * r0),
        (b[0] + px * r1, b[1] + py * r1),
        (b[0] - px * r1, b[1] - py * r1),
        (a[0] - px * r0, a[1] - py * r0),
    ]
    fr.poly(pts, fill, 2, width=3)


def paint(pose, view: str, parts) -> Frame:
    fr = Frame()
    head, chin = parts["head"]
    # Far limbs first.
    order = ("l", "r") if view != "back" else ("r", "l")
    shoes = []
    for which in order:
        tubes, (foot, angle) = leg(pose, which, view)
        for tube in tubes:
            fr.poly(tube, TROUSER if which == "r" else TROUSER_D, 1, width=3)
        shoes.append((which, foot, angle))
    coat = coat_polygon(pose, view)
    fr.poly(coat, COAT, 2, width=5)
    # A lighter lapel so the coat is not a flat board.
    if view == "three" and len(coat) >= 4:
        lapel = [coat[2], coat[3], (coat[3][0] - 18, coat[3][1] - 10), (coat[2][0] - 8, coat[2][1] + 20)]
        fr.poly(lapel, COAT_L, 2, outline=False)
    # Ragged nicks along the hem.
    if view == "three":
        hem_pts = coat[4:7]
        for i, p in enumerate(hem_pts):
            fr.draw.polygon([
                p,
                (p[0] + 10, p[1] + 16),
                (p[0] - 8, p[1] + 10),
            ], fill=COAT_D)
    # The real plaid scarf, swung as a piece. A short drawn tail follows a beat later.
    ribbon = scarf_ribbon(pose, view)
    fr.draw.line(ribbon, fill=(110, 32, 36, 255), width=22)
    fr.draw.line(ribbon[1:], fill=(28, 18, 18, 255), width=6)
    fr.draw.line(ribbon, fill=INK, width=2)
    if view == "three":
        scarf_im, scarf_anc = parts["scarf"]
        fr.paste(scarf_im, scarf_anc, _pt(pose, 8 + pose["scarf"] * 0.15, 560, view), 4, angle=pose["scarf"] * 0.25, scale=0.95)
    # Bag on the left shoulder, rigid painting, swung by the scarf lag.
    bag, bag_anchor = parts["bag"]
    if view == "three":
        bag_at = _pt(pose, -70 + pose["scarf"] * 0.2, 460, view)
        fr.paste(bag, bag_anchor, bag_at, 5, angle=pose["scarf"] * 0.15, scale=0.92)
    elif view == "front":
        fr.paste(bag, bag_anchor, (PIVOT_X - 150, _pt(pose, 0, 460, view)[1]), 5, scale=0.8)
    else:
        fr.paste(bag, bag_anchor, (PIVOT_X + 130, _pt(pose, 0, 470, view)[1]), 5, scale=0.8)
    # Shoes, rigid, planted on the new ankles.
    for which, foot, angle in shoes:
        key = "shoe_r" if which == "r" else "shoe_l"
        spr, anc = parts[key]
        # The cut shoe's anchor is its sole. Sit that on the foot point.
        fr.paste(spr, anc, (foot[0], foot[1] + 8), 1, angle=max(-28, min(28, angle * 0.35)), scale=0.85)
    # Arms. Lantern arm is the right one.
    for which in order:
        sh, el, hand = arm_joints(pose, which, view)
        draw_arm(fr, sh, el, COAT_D if which == "l" else COAT)
        draw_arm(fr, el, hand, COAT)
        if which == "l":
            fr.draw.ellipse((hand[0] - 11, hand[1] - 8, hand[0] + 11, hand[1] + 12), fill=SKIN, outline=INK)
            if pose.get("grasp"):
                fr.draw.ellipse((hand[0] - 4, hand[1] + 6, hand[0] + 16, hand[1] + 22), fill=(196, 154, 64, 255), outline=INK)
    # Head. The 3/4 painting on the side cycle; a matching hat-and-face for front.
    if view == "three":
        neck = _pt(pose, 30, 640, view)
        fr.paste(head, chin, (neck[0], neck[1] + 36), 3, scale=1.0)
    else:
        _simple_head(fr, pose, view)
    sh, el, hand = arm_joints(pose, "r", view)
    lantern, lanc = parts["lantern"]
    fr.paste(lantern, lanc, hand, 6, angle=pose["arm_r"] * -8, scale=0.78)
    _contour(fr)
    return fr


_COAT_TEX = None


def _coat_tex() -> np.ndarray:
    global _COAT_TEX
    if _COAT_TEX is None:
        coat = np.array(Image.open(LAYERS / "detective-coat-tan.png").convert("RGBA"))
        # A patch of the real painted cloth, used inside each new coat shape.
        _COAT_TEX = coat[280:820, 40:360]
    return _COAT_TEX


def _paint_coat(fr: Frame, pts):
    """Put the original coat's paint inside this frame's new silhouette."""
    if len(pts) < 3:
        return
    mask = Image.new("L", (CELL_W, CELL_H), 0)
    ImageDraw.Draw(mask).polygon(pts, fill=255)
    m = np.array(mask) > 0
    tex = _coat_tex()
    th, tw = tex.shape[:2]
    ys, xs = np.where(m)
    if len(xs) == 0:
        return
    # Stable cloth coordinates so the brushwork does not swim, while the outline is new.
    # One placement of the real cloth, clipped by this frame's outline. No tiled shear.
    tx = xs - (PIVOT_X - 160)
    ty = ys - 220
    inside = (tx >= 0) & (tx < tw) & (ty >= 0) & (ty < th)
    tx = np.clip(tx, 0, tw - 1)
    ty = np.clip(ty, 0, th - 1)
    sample = tex[ty, tx]
    use = inside & (sample[:, 3] > 40)
    arr = np.array(fr.im)
    sel_y, sel_x = ys[use], xs[use]
    arr[sel_y, sel_x] = sample[use]
    fr.im = Image.fromarray(arr)
    fr.draw = ImageDraw.Draw(fr.im)
    fr.draw.line(pts + [pts[0]], fill=INK, width=5)


def _simple_head(fr: Frame, pose, view: str):
    cx = PIVOT_X
    top = _pt(pose, 0, 980, view)[1]
    if view == "front":
        # Fedora and the same big eyes, drawn for this view rather than bent from the side painting.
        fr.draw.polygon([(cx - 70, top + 70), (cx + 70, top + 70), (cx + 48, top + 10), (cx - 48, top + 10)], fill=(122, 84, 48, 255), outline=INK)
        fr.draw.polygon([(cx - 120, top + 78), (cx + 120, top + 78), (cx + 120, top + 96), (cx - 120, top + 96)], fill=(92, 62, 36, 255), outline=INK)
        fr.draw.ellipse((cx - 58, top + 64, cx + 58, top + 170), fill=SKIN, outline=INK)
        for dx in (-26, 26):
            fr.draw.ellipse((cx + dx - 14, top + 100, cx + dx + 14, top + 128), fill=(250, 246, 236, 255), outline=INK)
            fr.draw.ellipse((cx + dx - 5, top + 108, cx + dx + 6, top + 122), fill=(40, 28, 24, 255))
        fr.draw.polygon([(cx, top + 112), (cx - 10, top + 140), (cx + 10, top + 140)], fill=SKIN_D, outline=INK)
        fr.draw.arc((cx - 18, top + 142, cx + 18, top + 162), 10, 170, fill=INK, width=3)
    else:
        fr.draw.ellipse((cx - 70, top + 20, cx + 70, top + 90), fill=(122, 84, 48, 255), outline=INK)
        fr.draw.polygon([(cx - 110, top + 70), (cx + 110, top + 70), (cx + 110, top + 88), (cx - 110, top + 88)], fill=(70, 48, 30, 255), outline=INK)
        fr.draw.ellipse((cx - 46, top + 40, cx + 46, top + 120), fill=(48, 32, 26, 255))


def _contour(fr: Frame):
    arr = np.array(fr.im)
    a = arr[:, :, 3] > 20
    edge = np.zeros_like(a)
    edge[1:-1, 1:-1] = a[1:-1, 1:-1] & (~a[:-2, 1:-1] | ~a[2:, 1:-1] | ~a[1:-1, :-2] | ~a[1:-1, 2:])
    arr[edge, 0] = 58
    arr[edge, 1] = 34
    arr[edge, 2] = 26
    arr[edge, 3] = 255
    fr.im = Image.fromarray(arr)
    fr.mat[edge] = np.maximum(fr.mat[edge], 1)


def seal(im: Image.Image) -> Image.Image:
    import cv2
    arr = np.array(im)
    a = arr[:, :, 3]
    empty = np.where(a == 0, np.uint8(255), np.uint8(0))
    flood = empty.copy()
    cv2.floodFill(flood, np.zeros((arr.shape[0] + 2, arr.shape[1] + 2), np.uint8), (0, 0), 0)
    hole = flood > 0
    if hole.any():
        rgb = arr[:, :, :3]
        for _ in range(8):
            grown = cv2.dilate(rgb, np.ones((3, 3), np.uint8))
            ga = cv2.dilate(a, np.ones((3, 3), np.uint8))
            take = hole & (a == 0) & (ga > 0)
            if not take.any():
                break
            rgb[take] = grown[take]
            a[take] = 255
        arr[:, :, :3] = rgb
        arr[:, :, 3] = a
        arr[hole, 3] = 255
    return Image.fromarray(arr)


def build():
    print("cutting pieces", flush=True)
    head = cut_head()
    props = load_props()
    scarf_src = np.array(Image.open(LAYERS / "detective-scarf-plaid.png").convert("RGBA"))
    sa = scarf_src[:, :, 3] > 20
    parts = {"head": head, "scarf": cut_mask(sa, scarf_src, 1), **props}
    print(" head", head[0].size, "chin", head[1])
    for k, (im, anc) in props.items():
        print(f" {k}", im.size, anc)
    clips = (
        [("side", i, step_pose(i, 6), "three") for i in range(12)]
        + [("front", i, step_pose(i, 4), "front") for i in range(8)]
        + [("back", i, step_pose(i, 4), "back") for i in range(8)]
        + [("idle", i, idle_pose(i), "three") for i in range(8)]
        + [("take", i, take_pose(i), "three") for i in range(10)]
    )
    cols = 8
    rows = math.ceil(len(clips) / cols)
    sheet = Image.new("RGBA", (cols * CELL_W, rows * CELL_H), (0, 0, 0, 0))
    OUT.mkdir(parents=True, exist_ok=True)
    for n, (name, index, pose, view) in enumerate(clips):
        fr = paint(pose, view, parts)
        fr.im = seal(fr.im)
        r, c = divmod(n, cols)
        sheet.alpha_composite(fr.im, (c * CELL_W, r * CELL_H))
        print(f"  {name} {index}", flush=True)
    sheet.save(OUT / "figure.png", optimize=True)
    meta = {
        "cellW": CELL_W,
        "cellH": CELL_H,
        "cols": cols,
        "pivotX": PIVOT_X,
        "pivotY": PIVOT_Y,
        "side": {"start": 0, "count": 12, "perStep": 6, "fps": 12},
        "front": {"start": 12, "count": 8, "perStep": 4, "fps": 10},
        "back": {"start": 20, "count": 8, "perStep": 4, "fps": 10},
        "idle": {"start": 28, "count": 8, "fps": 8},
        "take": {"start": 36, "count": 10, "fps": 12, "grasp": 5},
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=2))
    # Contact sheet of the side cycle, for the eye.
    row = []
    for i in range(12):
        x = (i % cols) * CELL_W
        y = (i // cols) * CELL_H
        row.append(sheet.crop((x, y, x + CELL_W, y + CELL_H)))
    preview = Image.new("RGBA", (CELL_W * 12, CELL_H), (0, 0, 0, 0))
    for i, cell in enumerate(row):
        preview.alpha_composite(cell, (i * CELL_W, 0))
    bg = Image.new("RGB", preview.size, (32, 24, 22))
    bg.paste(preview, mask=preview.split()[-1])
    bg.resize((bg.width // 3, bg.height // 3), Image.Resampling.LANCZOS).save("/tmp/edmund-steps-preview.jpg", quality=85)
    print("preview /tmp/edmund-steps-preview.jpg", flush=True)


if __name__ == "__main__":
    build()
