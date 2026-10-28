# Hollowmere Dispatch

A landscape point-and-click mystery, version 0.12. You play a paranormal detective on **Case 0: The Bellweather Bookshop**. Edith Crane runs dispatch. June Bellweather keeps the shop. Ambrose, her grandfather, has not quite left.

The detective is addressed by name. Coat, hat and scarf recolour from painted masks. A spirit lantern in the corner shows footprints, writing and shy moths, and is never required to finish the case. Ghosts flicker the lamps unless Reduce effects is on. Vibration uses the browser's vibrate API when the device allows it.

The rooms are side-view stages. Speech sits over the speaker's head. Portrait phones are asked to turn sideways.

## Run

```bash
npm install
npm run dev
```

The dev server listens on port **8734** at [http://localhost:8734/Mystery/](http://localhost:8734/Mystery/). The same path is used in production: [https://throsturfh.github.io/Mystery/](https://throsturfh.github.io/Mystery/).

```bash
npm run build
npm run preview
```

`preview` serves `dist/` on port **8735** at [http://localhost:8735/Mystery/](http://localhost:8735/Mystery/).

## How to play

Tap the floor and the detective walks there. Tap a person or a thing and he walks over, then does the obvious thing: look, talk, pick up, open, or use.

Long-press something, or tap **Look**, to hear a line without using it. The bar along the bottom is the inventory. Tap an item and then a target, or drag one item onto another.

**Hint** is Edith, over the phone. **Reset**, then **Again?**, starts the case over.

There is no fail state. Old hidden-object saves are ignored.

## Publish

Pushes to `main` run `.github/workflows/pages.yml`, which builds with Vite and deploys `dist/` to GitHub Pages: [https://throsturfh.github.io/Mystery/](https://throsturfh.github.io/Mystery/).

In the repository, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.
