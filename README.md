# Hollowmere Dispatch

A landscape hidden-object mystery. You play a paranormal detective on **Case 0: The Bellweather Bookshop** (late autumn, 1979). Edith Crane runs dispatch. Later cases are data, not new screens.

The scenes are original paintings. The interface is dark wood, aged brass, and parchment, in the manner of a classic hidden-object adventure. Portrait phones are asked to turn sideways.

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

## Publish

Pushes to `main` run `.github/workflows/pages.yml`, which builds with Vite and deploys `dist/` to GitHub Pages: [https://throsturfh.github.io/Mystery/](https://throsturfh.github.io/Mystery/).

In the repository, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.

## How to play

The bottom bar lists what the room is hiding. Tap that object in the painting. A found object sparkles and is crossed off the list. **Hint** shimmers one remaining object, then recharges. **Menu** holds sound and **Reset progress**.

1. Engrave a name and choose a coat and hat in the dispatch office.
2. Tap the case folder, then find the oddities on the shop floor. Finds grant **Evidence**. The matched novels and the doorbell are clues.
3. Spend 15 Evidence to open the reading nook.
4. Take the EMF meter from the right-hand tools. When it hums, tap the cold spot on the wingback chair before the ring fades. That grants **Ectoplasm**. Tune the meter to level 2.
5. Set the meter down and take the one tea break. That skips one in-game hour. The same meter keeps earning EMF while the app is closed, up to 8 hours. Fear does not rise while you are away.
6. **Fear** climbs slowly as you search. More fear, more pale anomalies to tap. The third star needs Fear kept in the low band.
7. Open **Case**, pin the notes, and tie them with red string. Two linked clues open the stockroom.
8. Find the desk drawer. Calm the lamps, then give Ambrose the missing pages. There is no fail state.
9. Stamp the case. An envelope arrives for No. 9 Lantern Lane. Case 1 is not in this build.

## Stars and what carries forward

Closing the case always earns the first star.

| Star | Requirement |
| --- | --- |
| 1 | Stamp the case |
| 2 | All five clues pinned and joined by red string |
| 3 | Every lamp tapped while it glowed, and Fear kept in the low band |

Edith's report names any star you missed. Persisted for the next case: your detective and board, the EMF meter at level 2, a flashlight with its first tap-value upgrade, Ambrose's bookmark, the brass bookworm pin, and an Evidence bonus of 20 / 45 / 70 for 1 / 2 / 3 stars.

## Save

`localStorage` key `hollowmere-dispatch-v1` (save version 2).

## Adding a case

Add another `CaseDef` beside `src/data/case0.ts` and register it in `src/data/cases.ts`. A case is rooms, hidden objects (normalised ellipses or polygons on that room's painting), clues, an economy, rewards, and an ordered `steps` array. Point `RoomDef.painter` at a preloaded image key (`office`, `shop`, `nook`, `stock`, or a new texture loaded in `BootScene`).
