# Lotta v6 (female repaint, tík)
Canvas 860x520 RGBA WebP, baseline y=495, 12 fps. Faces right, side profile.
- frames/trot/<variant>/00-11.webp: 12-frame seamless 4-beat trot. Head is painted into every frame (whole animal; no head layer).
  variants: fwd (default), up_half, up_full, side_half, side_full, back_full. All variants share the exact same leg cycle,
  so to glance mid-trot keep the frame index running and switch variant per frame (trot.json -> trot_glances).
- frames/idle/00-23.webp: breathing loop.
- frames/glance-stand/{up,side,back}/00-13.webp: forward -> half -> full (hold) -> half -> forward, breathing continues.
- trot.json: stride 17.92 px/frame (215 px per 12-frame cycle) at canvas scale.
Recommended: glances occasional (e.g. one every 8-15 s), never back-to-back.
- frames/settle/fromKK_0-5.webp: 6-frame settle from any trot frame KK into idle frame 00; move sprite by trot.json settle.dx_px_per_frame.
- back glance is a real over-the-shoulder look: forward -> side_half -> side_full -> back_full.
