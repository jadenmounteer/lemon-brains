# Fairy Tale Kingdom — Pixel Style Guide

Stable conventions for Phase 1 procedural art and future hand-drawn PNG drop-ins.

## Canvas feel

| Element | Size |
| ------- | ---- |
| Terrain tiles | **16×16** |
| Characters | **16×24** (taller silhouette for readability) |
| Props (keep, house, wall) | Multiples of 16 (see manifest) |

- Scale with **integer zoom only** (kingdom camera uses zoom `2`).
- Phaser `pixelArt: true` — nearest-neighbor, no smoothing.
- Outline characters with a dark ink edge so they read on grass.

## Palette

Named constants live in `src/game/art/palette.ts`:

| Name | Hex | Use |
| ---- | --- | --- |
| `ink` | `#1c241c` | Outlines, shadows |
| `grass` | `#3d7a4a` | Base terrain |
| `grassLight` | `#4a8f5c` | Grass highlight |
| `grassDark` | `#2d5a3d` | Grass shadow / clear color |
| `dirt` | `#8b6b45` | Paths |
| `dirtDark` | `#6b5234` | Path shadow |
| `stone` | `#8a8f84` | Keep / walls |
| `stoneDark` | `#5c6158` | Stone shadow |
| `wood` | `#6b5b45` | Houses, roofs |
| `woodDark` | `#3e3428` | Wood outline |
| `roof` | `#a04545` | House roofs |
| `skin` | `#e0b090` | Faces / hands |
| `clothPeasant` | `#c4a35a` | Peasant tunic |
| `clothGuard` | `#4a6fa5` | Guard tunic |
| `clothArcher` | `#5a8f4a` | Archer tunic |
| `metal` | `#c0c4c8` | Helms / blades |
| `cream` | `#f4efe4` | UI accents |

## Sprite sheet conventions

Texture keys and anim names are defined in `src/game/art/assetManifest.ts`.

### Terrain (`terrain`)

Single row of 16×16 tiles, indices:

0. grass  
1. grass variant  
2. dirt / path  
3. dirt edge  

### Units (`peasant`, `guard`, `archer`)

Each sheet is a horizontal strip of **16×24** frames:

| Index | Content |
| ----- | ------- |
| 0 | Idle (facing down) |
| 1–4 | Walk down (4 frames) |
| 5–8 | Walk left |
| 9–12 | Walk right |
| 13–16 | Walk up |

Animation keys (example for peasant):

- `peasant-idle`
- `peasant-walk-down` / `-left` / `-right` / `-up`

### Props

Static single textures: `prop-keep`, `prop-house`, `prop-wall`.

## Drop-in PNG path

See [`../public/assets/README.md`](../public/assets/README.md). When PNGs exist under those paths, Boot can load them with the **same texture keys** instead of running generators.
