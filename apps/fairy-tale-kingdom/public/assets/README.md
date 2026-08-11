# Asset drop-in folder

Phase 1 draws textures in code (`src/game/art/generateTextures.ts`). To replace them later with hand-drawn (or exported) PNGs, add files here using these names and the frame layout in [`docs/STYLE_GUIDE.md`](../../docs/STYLE_GUIDE.md).

```
assets/
  tiles/
    terrain.png      → texture key `terrain` (16×16 tiles in a row)
  units/
    peasant.png      → texture key `peasant` (16×24 frames, see style guide)
    guard.png        → texture key `guard`
    archer.png       → texture key `archer`
  props/
    keep.png         → texture key `prop-keep`
    house.png        → texture key `prop-house`
    wall.png         → texture key `prop-wall`
```

Paths are resolved with `assetUrl()` from `src/config.ts` (respects Vite `BASE_URL` on GitHub Pages).

Until those files exist, BootScene always generates procedural textures with the same keys so scenes never change when you swap art.
