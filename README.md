# Crash Arcade — 2D Casino Games (front-end only)

Two PixiJS + TypeScript mini-games for fun. **No backend, play-money only.**
All graphics are drawn with PixiJS vector primitives (placeholder art you can
swap for your own sprites).

## Games

### 1. Crash Race
A lead car races down the strip with the player's chaser behind it. The
multiplier climbs while racing. At a random crash point the lead car wrecks,
and ~0.6s later the chaser pile-ups into it. **Cash out before the pile-up.**

### 2. Rise (Aviator-style)
An Aviator-style multiplier game. Instead of a plane, a stylized dancer
silhouette rises along a curve as the multiplier climbs, shedding outfit
"stages" (robe → dress → finale) as she goes. She can drop at any random
multiplier. **Cash out at the peak.**

> The character is an abstract vector silhouette — nothing explicit is
> rendered. Replace `src/games/Dancer.ts` with your own sprite frames to
> customize the art.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
```

## Structure

```
src/
  main.ts            # app bootstrap, menu/game routing, ticker
  core/
    types.ts         # Game interface, constants
    utils.ts         # crash-point sampling, button/text helpers, wallet
    BetPanel.ts      # shared betting bar (bet stepper, place/cash-out)
    Menu.ts          # game-select landing screen
    Hud.ts           # back-to-menu button
  games/
    Car.ts           # vector race car
    CrashRace.ts     # Game 1
    Dancer.ts        # vector dancer with outfit-stage layers
    Aviator.ts       # Game 2
```

## How the crash math works
`sampleCrashPoint()` in `core/utils.ts` draws from a heavy-tailed distribution
(`0.99 / (1 - r)`) with a ~3% instant-bust chance — the same shape real crash
games use. Tweak it to change volatility.
