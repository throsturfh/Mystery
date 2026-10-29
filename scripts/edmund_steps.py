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


# --- poses: a 12-frame walk, two steps, keyed to a classic cycle ----------
# Feet are in pixels, +x forward, y up from the sole.
# Foot angle: positive lifts the toe (heel strike), negative lifts the heel.

# left foot front on frame 0. Six keys, then the legs swap.
_HALF = [
    # contact
    (168, 8, 24, -158, 34, -36, 2, 16),
    # into the down
    (118, 0, 8, -118, 18, -18, -12, 14),
    # down: front knee bent, body lowest
    (62, 0, 0, -72, 14, -8, -30, 12),
    # rising, free foot leaving
    (12, 0, 0, -8, 78, 8, -4, 10),
    # passing: support straight, free knee up
    (-18, 0, -6, 48, 132, 16, 12, 8),
    # up: support on the toe, free foot reaching
    (-48, 28, -30, 132, 86, 26, 22, 8),
]


def _mirror(row):
    lx, ly, la, rx, ry, ra, bob, lean = row
    return (rx, ry, ra, lx, ly, la, bob, lean)


_CYCLE = _HALF + [_mirror(row) for row in _HALF]


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



def step_pose(frame: int, per_step: int, reach: float = 0.0) -> dict:
    if per_step <= 1:
        row = _CYCLE[0]
    else:
        # 6 frames per step. 12-frame cycle uses per_step 6. 8-frame uses 4,
        # so sample the 12-key cycle at even spacing.
        slots = 12
        if per_step == 6:
            index = frame % 12
        else:
            index = int(round((frame % (per_step * 2)) / (per_step * 2) * slots)) % slots
        row = _CYCLE[index]
    lx, ly, la, rx, ry, ra, bob, lean = row
    # Arms oppose the legs. The lantern is in the right hand.
    arm_r = max(-0.9, min(0.9, (lx - rx) / 300))
    arm_l = -arm_r
    # Coat and scarf trail the back foot.
    back_x = lx if lx < rx else rx
    hem = back_x * 0.16
    scarf = hem * 0.85 + arm_r * 10
    if reach:
        arm_l = arm_l * (1 - reach) + 1.05 * reach
        bob = bob * (1 - reach) - 16 * reach
        lean = lean * (1 - reach) + 22 * reach
    return {
        "lx": lx, "ly": ly, "la": la,
        "rx": rx, "ry": ry, "ra": ra,
        "bob": bob,
        "lean": lean,
        "arm_l": arm_l,
        "arm_r": arm_r,
        "hem": hem,
        "scarf": scarf,
        "reach": reach,
        "grasp": False,
    }


def idle_pose(i: int, n: int = 8) -> dict:
    t = i / n
    breath = math.sin(t * math.pi * 2)
    p = step_pose(0, 12)
    p["lx"], p["ly"], p["la"] = -18, 0, 0
    p["rx"], p["ry"], p["ra"] = 34, 0, 2
    p["bob"] = breath * 7
    p["lean"] = 8
    p["arm_r"] = 0.28 + breath * 0.04
    p["arm_l"] = -0.08
    p["hem"] = breath * 6
    p["scarf"] = breath * 8
    p["reach"] = 0.0
    return p


def take_pose(i: int, n: int = 10) -> dict:
    keys = [(0.0, 0.0), (0.12, -0.05), (0.45, 1.0), (0.58, 1.0), (0.85, 0.12), (1.0, 0.0)]
    k = max(0.0, interp(i / (n - 1), keys))
    k = smooth(k)
    p = idle_pose(2)
    p["reach"] = k
    p["arm_l"] = -0.08 * (1 - k) + 1.15 * k
    p["bob"] = p["bob"] * (1 - k) - 18 * k
    p["lean"] = 8 + 16 * k
    p["grasp"] = i >= 5
    # A small knee bend as he leans to the item, not a squash.
    p["ly"] = 8 * k
    p["ry"] = 0
    return p


def _screen(x: float, y_up: float) -> tuple[float, float]:
    return (PIVOT_X + x, PIVOT_Y - y_up)


def _knee(hip, ankle, thigh=236, shin=228):
    dx = ankle[0] - hip[0]
    dy = ankle[1] - hip[1]
    dist = math.hypot(dx, dy)
    dist = max(40.0, min(dist, thigh + shin - 6))
    ux, uy = dx / dist, dy / dist
    px, py = -uy, ux
    cos_a = max(-1.0, min(1.0, (thigh * thigh + dist * dist - shin * shin) / (2 * thigh * dist)))
    sin_a = math.sqrt(max(0.0, 1 - cos_a * cos_a))
    base = (hip[0] + ux * thigh * cos_a, hip[1] + uy * thigh * cos_a)
    k1 = (base[0] + px * thigh * sin_a, base[1] + py * thigh * sin_a)
    k2 = (base[0] - px * thigh * sin_a, base[1] - py * thigh * sin_a)
    # The knee leads, toward the direction he faces.
    return k1 if k1[0] >= k2[0] else k2


def _body(pose, view: str) -> dict:
    """Joint positions in y-up pixels. Front/back squash the stride sideways."""
    compress = 1.0 if view == "three" else 0.42
    sign = -1 if view == "back" else 1
    def fx(x):
        return sign * x * compress
    bob = pose["bob"]
    # Stand over the foot that is on the ground.
    support_x = pose["lx"] if pose["ly"] <= pose["ry"] else pose["rx"]
    hip_x = fx(support_x) * 0.12 + pose["lean"] * 0.4
    hip_y = 488 + bob
    left_forward = pose["lx"] > pose["rx"]
    # Shoulders twist against the hips.
    twist = 22 if left_forward else -22
    if view == "back":
        twist = -twist
    chest_x = hip_x + pose["lean"]
    chest_y = hip_y + 196
    return {
        "hip": (hip_x, hip_y),
        "chest": (chest_x, chest_y),
        "neck": (chest_x + 6, chest_y + 78),
        "sh_l": (chest_x - 78 - twist * 0.3, chest_y + 18),
        "sh_r": (chest_x + 62 + twist * 0.45, chest_y + 10),
        "l_foot": (fx(pose["lx"]), pose["ly"], pose["la"]),
        "r_foot": (fx(pose["rx"]), pose["ry"], pose["ra"]),
        "view": view,
    }


def _ribbon(a, b, samples):
    """samples: list of (t, half_width, bulge). Bulge adds to the back edge."""
    ax, ay = a
    bx, by = b
    ang = math.atan2(by - ay, bx - ax)
    px, py = -math.sin(ang), math.cos(ang)
    # Back edge is the perpendicular that points more to screen-left.
    back = 1 if px < 0 else -1
    left, right = [], []
    for t, w, bulge in samples:
        x = ax + (bx - ax) * t
        y = ay + (by - ay) * t
        extra = bulge * math.sin(t * math.pi)
        left.append((x + px * (w + (extra if back > 0 else 0)), y + py * (w + (extra if back > 0 else 0))))
        right.append((x - px * (w + (extra if back < 0 else 0)), y - py * (w + (extra if back < 0 else 0))))
    return left + right[::-1]


def _shade_poly(fr: Frame, pts, mid, light, dark, mat=1):
    if len(pts) < 3:
        return
    fr.poly(pts, mid, mat, width=3)
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    hi = [((p[0] - cx) * 0.5 + cx - 5, (p[1] - cy) * 0.45 + cy - 6) for p in pts]
    fr.poly(hi, light, mat, outline=False)
    lo = [((p[0] - cx) * 0.55 + cx + 4, (p[1] - cy) * 0.5 + cy + 5) for p in pts]
    # Only the lower portion reads as shadow; a full second poly muddies it, so a thin dark edge.
    fr.draw.line(pts + [pts[0]], fill=dark, width=2)
    fr.draw.line(pts + [pts[0]], fill=INK, width=3)


def _draw_leg(fr: Frame, hip, ankle, foot_angle: float, parts, which: str):
    knee = _knee(hip, ankle)
    hs, ks, ans = _screen(*hip), _screen(*knee), _screen(*ankle)
    thigh = _ribbon(hs, ks, [(0, 48, 4), (0.45, 44, 8), (1, 30, 0)])
    # Calf is full in the back, narrow at the ankle.
    calf = _ribbon(ks, ans, [(0, 22, 0), (0.35, 36, 18), (0.7, 26, 8), (1, 15, 0)])
    _shade_poly(fr, thigh, (96, 80, 70, 255), (132, 114, 100, 255), (48, 38, 34, 255))
    _shade_poly(fr, calf, (84, 70, 62, 255), (120, 102, 90, 255), (42, 34, 30, 255))
    # Knee cap.
    # Knee sits inside the two forms; a separate cap read as a stick-figure joint.
    key = "shoe_r" if which == "r" else "shoe_l"
    spr, anc = parts[key]
    # Positive angle lifts the toe.
    fr.paste(spr, anc, (ans[0], ans[1] + 4), 1, angle=foot_angle, scale=0.92)


def _arm(shoulder, swing: float, reach: float):
    """swing > 0 reaches forward. Returns elbow and hand in y-up space."""
    ux = math.sin(swing) * 148
    uy = -math.cos(min(1.1, abs(swing)) * 0.35) * 36 - 132
    elbow = (shoulder[0] + ux, shoulder[1] + uy)
    if reach > 0.05 and swing > 0.4:
        # Reaching hand: forward and down, eased, not a straight rod.
        tx = shoulder[0] + 150
        ty = shoulder[1] - 210
        hand = (
            elbow[0] * (1 - reach) + tx * reach,
            elbow[1] * (1 - reach) + ty * reach,
        )
        elbow = (
            (shoulder[0] + hand[0]) / 2 + 16,
            (shoulder[1] + hand[1]) / 2 + 10,
        )
    else:
        bend = 0.55
        hand = (
            elbow[0] + math.sin(swing * bend) * 120 + 10,
            elbow[1] - 118,
        )
    return elbow, hand


def _draw_arm(fr: Frame, shoulder, elbow, hand, front: bool):
    ss, es, hs = _screen(*shoulder), _screen(*elbow), _screen(*hand)
    upper = _ribbon(ss, es, [(0, 24, 2), (0.5, 22, 4), (1, 16, 0)])
    fore = _ribbon(es, hs, [(0, 16, 0), (0.45, 15, 3), (1, 11, 0)])
    mid = (186, 140, 86, 255) if front else (150, 108, 64, 255)
    light = (220, 176, 120, 255) if front else (186, 142, 92, 255)
    dark = (96, 64, 36, 255)
    _shade_poly(fr, upper, mid, light, dark, mat=2)
    _shade_poly(fr, fore, mid, light, dark, mat=2)
    fr.draw.ellipse((es[0] - 14, es[1] - 12, es[0] + 14, es[1] + 12), fill=mid, outline=INK)
    fr.draw.ellipse((hs[0] - 13, hs[1] - 10, hs[0] + 14, hs[1] + 12), fill=SKIN, outline=INK)
    fr.draw.ellipse((hs[0] + 6, hs[1] - 4, hs[0] + 16, hs[1] + 8), fill=SKIN_D, outline=INK)
    return hs


def _coat(fr: Frame, pose, body):
    hip = body["hip"]
    chest = body["chest"]
    hem = pose["hem"]
    view = body["view"]
    if view == "three":
        pts = [
            _screen(body["sh_l"][0] - 10, body["sh_l"][1] + 10),
            _screen(chest[0] - 10, chest[1] + 70),
            _screen(body["sh_r"][0] + 16, body["sh_r"][1] + 6),
            _screen(chest[0] + 78, chest[1] - 20),
            _screen(hip[0] + 86, hip[1] - 10),
            _screen(hip[0] + 70 + hem * 0.35, 168),
            _screen(hip[0] + 10 + hem * 0.5, 132),
            _screen(hip[0] - 80 + hem, 150),
            _screen(hip[0] - 96, hip[1] + 10),
        ]
    elif view == "front":
        cx = PIVOT_X + pose["lean"] * 0.3
        top = _screen(0, chest[1] + 40)[1]
        bot = _screen(0, 150 + pose["bob"])[1]
        sway = pose["hem"] * 0.25
        pts = [
            (cx - 150, top), (cx + 150, top),
            (cx + 160 + sway, bot), (cx + 28, bot + 24),
            (cx - 28, bot + 18), (cx - 160 + sway, bot),
        ]
    else:
        cx = PIVOT_X
        top = _screen(0, chest[1] + 30)[1]
        bot = _screen(0, 160 + pose["bob"])[1]
        sway = -pose["hem"] * 0.25
        pts = [
            (cx - 146, top), (cx + 146, top),
            (cx + 154 + sway, bot), (cx - 154 + sway, bot),
        ]
    _shade_poly(fr, pts, (176, 132, 78, 255), (214, 172, 116, 255), (92, 62, 36, 255), mat=2)
    # Back panel and a chest fold, so the coat has a front and a side.
    if view == "three" and len(pts) >= 8:
        back = [pts[0], pts[8], pts[7], (pts[7][0] + 36, pts[7][1] - 30), (pts[0][0] + 28, pts[0][1] + 40)]
        fr.poly(back, (132, 94, 56, 255), 2, outline=False)
        fr.draw.line([pts[2], pts[4], pts[5]], fill=(110, 74, 44, 255), width=4)
        # Ragged hem.
        for p in (pts[5], pts[6], pts[7]):
            fr.draw.polygon([p, (p[0] + 12, p[1] + 18), (p[0] - 10, p[1] + 12)], fill=(120, 84, 48, 255), outline=INK)
    elif view != "three":
        # Centre opening.
        top = pts[0]
        bot = pts[3] if view == "front" else pts[2]
        fr.draw.line([(PIVOT_X, top[1] + 20), (PIVOT_X + pose["hem"] * 0.2, bot[1])], fill=(110, 74, 44, 255), width=6)
    fr.draw.line(pts + [pts[0]], fill=INK, width=4)


def _simple_head(fr: Frame, pose, view: str, body):
    cx, top = _screen(*body["neck"])
    crown = top - 150
    if view == "front":
        fr.draw.polygon(
            [(cx - 54, crown + 36), (cx + 54, crown + 36), (cx + 36, crown - 8), (cx - 36, crown - 8)],
            fill=(132, 92, 52, 255), outline=INK,
        )
        fr.draw.polygon(
            [(cx - 108, crown + 34), (cx + 108, crown + 34), (cx + 108, crown + 52), (cx - 108, crown + 52)],
            fill=(78, 52, 32, 255), outline=INK,
        )
        fr.draw.ellipse((cx - 52, crown + 28, cx + 52, crown + 130), fill=SKIN, outline=INK)
        fr.draw.ellipse((cx - 46, crown + 18, cx + 46, crown + 70), fill=(48, 32, 26, 255))
        for dx in (-22, 22):
            fr.draw.ellipse((cx + dx - 16, crown + 62, cx + dx + 16, crown + 92), fill=(252, 248, 240, 255), outline=INK)
            fr.draw.ellipse((cx + dx - 6, crown + 70, cx + dx + 7, crown + 86), fill=(36, 24, 20, 255))
        fr.draw.polygon([(cx, crown + 78), (cx - 12, crown + 108), (cx + 12, crown + 108)], fill=SKIN_D, outline=INK)
        fr.draw.arc((cx - 20, crown + 108, cx + 22, crown + 132), 15, 165, fill=INK, width=3)
    else:
        fr.draw.ellipse((cx - 58, crown + 8, cx + 58, crown + 78), fill=(122, 84, 48, 255), outline=INK)
        fr.draw.polygon(
            [(cx - 100, crown + 58), (cx + 100, crown + 58), (cx + 100, crown + 76), (cx - 100, crown + 76)],
            fill=(62, 42, 28, 255), outline=INK,
        )
        fr.draw.ellipse((cx - 40, crown + 24, cx + 40, crown + 100), fill=(42, 28, 22, 255))
        # Scarf tail down the back.
        fr.draw.polygon(
            [(cx - 16, crown + 90), (cx + 16, crown + 90), (cx + 8 + pose["scarf"] * 0.2, crown + 210), (cx - 10, crown + 200)],
            fill=(120, 36, 40, 255), outline=INK,
        )


def paint(pose, view: str, parts) -> Frame:
    fr = Frame()
    body = _body(pose, view)
    hip = body["hip"]
    # Far leg first (the one further back, smaller x in a right-facing 3/4).
    legs = [("l", body["l_foot"]), ("r", body["r_foot"])]
    legs.sort(key=lambda item: item[1][0])
    back_name, back_foot = legs[0]
    front_name, front_foot = legs[1]
    _draw_leg(fr, hip, (back_foot[0], back_foot[1]), back_foot[2], parts, back_name)
    # Back arm, then the coat, then the near leg so the stride reads in front.
    back_arm = "l" if back_name == "l" else "r"
    sh = body["sh_l"] if back_arm == "l" else body["sh_r"]
    swing = pose["arm_l"] if back_arm == "l" else pose["arm_r"]
    reach = pose["reach"] if back_arm == "l" else 0.0
    elbow, hand = _arm(sh, swing, reach)
    _draw_arm(fr, sh, elbow, hand, front=False)
    _coat(fr, pose, body)
    _draw_leg(fr, hip, (front_foot[0], front_foot[1]), front_foot[2], parts, front_name)
    # Real scarf, plus a short trailing tail.
    if view == "three":
        scarf_im, scarf_anc = parts["scarf"]
        fr.paste(
            scarf_im, scarf_anc,
            _screen(body["chest"][0] - 6 + pose["scarf"] * 0.15, body["chest"][1] - 20),
            4, angle=pose["scarf"] * 0.2, scale=0.92,
        )
        bag, bag_anc = parts["bag"]
        fr.paste(bag, bag_anc, _screen(hip[0] - 78 + pose["hem"] * 0.12, hip[1] - 30), 5, angle=pose["hem"] * 0.12, scale=0.9)
        head, chin = parts["head"]
        fr.paste(head, chin, _screen(body["neck"][0] + 8, body["neck"][1] - 8), 3, scale=1.0)
    else:
        _simple_head(fr, pose, view, body)
        bag, bag_anc = parts["bag"]
        side = -1 if view == "front" else 1
        fr.paste(bag, bag_anc, _screen(side * 120, hip[1] - 10), 5, scale=0.78)
    front_arm = "r" if back_arm == "l" else "l"
    # Lantern arm is always the character's right, drawn in front on the side view.
    if view == "three":
        sh = body["sh_r"]
        elbow, hand = _arm(sh, pose["arm_r"], 0.0)
        hand_s = _draw_arm(fr, sh, elbow, hand, front=True)
        lantern, lanc = parts["lantern"]
        fr.paste(lantern, lanc, hand_s, 6, angle=-pose["arm_r"] * 10, scale=0.8)
        if pose.get("grasp"):
            sh = body["sh_l"]
            _, hand = _arm(sh, pose["arm_l"], pose["reach"])
            hs = _screen(*hand)
            fr.draw.ellipse((hs[0] - 6, hs[1] + 8, hs[0] + 18, hs[1] + 26), fill=(196, 154, 64, 255), outline=INK)
    else:
        for which, front in (("l", view == "front"), ("r", True)):
            sh = body["sh_l"] if which == "l" else body["sh_r"]
            elbow, hand = _arm(sh, pose["arm_l"] if which == "l" else pose["arm_r"], 0.0)
            hs = _draw_arm(fr, sh, elbow, hand, front=front)
            if which == "r":
                lantern, lanc = parts["lantern"]
                fr.paste(lantern, lanc, hs, 6, scale=0.72)
    _contour(fr)
    return fr



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
    # Only pinholes. A gap between the arm and the coat is supposed to stay clear.
    n, labels, stats, _ = cv2.connectedComponentsWithStats((flood > 0).astype(np.uint8), 8)
    hole = np.zeros(flood.shape, bool)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] <= 48:
            hole |= labels == i
    if hole.any():
        rgb = arr[:, :, :3]
        for _ in range(6):
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
