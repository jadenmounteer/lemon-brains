# Knowledge Quest

A monorepo learning playground: configure a curriculum in **Knowledge Quest**, then play games like **Lemon Brains**.

```
apps/
  knowledge-quest/   # Host: configure learning + pick a game
  lemon-brains/      # Arcade game that consumes shared settings
packages/
  learning/          # Framework-agnostic curricula + questions
  storage/           # StoragePort + LocalStorageAdapter (swap for a DB later)
```

## Local development

Install once from the repo root:

```bash
npm install
```

Run the host (port 4300) and game (port 4200) in two terminals:

```bash
npm run start:host
npm run start:lemon-brains
```

1. Open http://localhost:4300/
2. Configure learning
3. Choose **Lemon Brains** to play

## GitHub Pages

Push to `main` — GitHub Actions builds both apps into one static site and deploys:

| Path | App |
|------|-----|
| `/lemon-brains/` | Knowledge Quest |
| `/lemon-brains/games/lemon-brains/` | Lemon Brains |

Local assemble (same as CI):

```bash
npm run build:pages
```

Output lands in `dist/site/`.

## Packages

- `@knowledge-quest/learning` — curricula, question generation, speech helpers
- `@knowledge-quest/storage` — `StoragePort`, `LocalStorageAdapter`, `SettingsRepository`

New games (Angular, React, etc.) can depend on those packages without sharing a UI framework.
