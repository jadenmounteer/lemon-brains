# Knowledge Quest

A monorepo learning playground: configure a curriculum in **Knowledge Quest**, then play games like **Lemon Brains** or **Fairy Tale Kingdom**.

```
apps/
  knowledge-quest/       # Host: configure learning + pick a game
  lemon-brains/          # Arcade game that consumes shared settings
  fairy-tale-kingdom/    # React + Phaser kingdom (watch, learn, grow)
packages/
  learning/              # Framework-agnostic curricula + questions
  storage/               # StoragePort + LocalStorageAdapter (swap for a DB later)
```

## Local development

Install once from the repo root:

```bash
npm install
```

Run the host and games in separate terminals:

```bash
npm run start:host
npm run start:lemon-brains
npm run start:fairy-tale-kingdom
```

| App | URL |
|-----|-----|
| Knowledge Quest | http://localhost:4300/ |
| Lemon Brains | http://localhost:4200/ |
| Fairy Tale Kingdom | http://localhost:4400/ |

1. Open the host
2. Configure learning
3. Choose a game to play

## GitHub Pages

Push to `main` — GitHub Actions builds the apps into one static site and deploys:

| Path | App |
|------|-----|
| `/lemon-brains/` | Knowledge Quest |
| `/lemon-brains/games/lemon-brains/` | Lemon Brains |
| `/lemon-brains/games/fairy-tale-kingdom/` | Fairy Tale Kingdom |

Local assemble (same as CI):

```bash
npm run build:pages
```

Output lands in `dist/site/`.

## Packages

- `@knowledge-quest/learning` — curricula, question generation, speech helpers
- `@knowledge-quest/storage` — `StoragePort`, `LocalStorageAdapter`, `SettingsRepository`

New games (Angular, React, etc.) can depend on those packages without sharing a UI framework.
