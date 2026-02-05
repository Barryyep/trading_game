# trading_game

A small, clean-room **market making practice game** inspired by common "Make me a market" interview prompts.

## What it is

- You get a fact / guesstimate prompt.
- You enter an estimate and quote **bid / ask**.
- A simulated customer may trade.
- You manage inventory and try to earn spread.

This is a toy for interview practice. Not financial advice.

## Live (GitHub Pages)

After you enable Pages (see below), your site will be at:

- https://barryyep.github.io/trading_game/

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Build

```bash
npm run build
npm run preview
```

## Enable GitHub Pages (one-time)

1. Go to repo settings: https://github.com/Barryyep/trading_game/settings/pages
2. Under **Build and deployment**:
   - Source: **GitHub Actions**

After that, every push to `main` will auto-deploy.

## Notes

- Scenario values are approximate and used only to score the game.
- The implementation is original (clean-room), not copied from any third-party code.
