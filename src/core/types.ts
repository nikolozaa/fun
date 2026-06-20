import type { Application, Container } from "pixi.js";

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export interface GameContext {
  app: Application;
  /** Return to the main menu. */
  exit: () => void;
}

/**
 * A self-contained mini-game. Each game builds its own scene graph into
 * `view`, runs off the shared ticker, and cleans up in `destroy()`.
 */
export interface Game {
  readonly view: Container;
  /** Called once after the view is added to the stage. */
  start(): void;
  /** Per-frame update. `dt` is in seconds. */
  update(dt: number): void;
  /** Tear down listeners, tickers, textures. */
  destroy(): void;
}

export interface GameDescriptor {
  id: string;
  title: string;
  subtitle: string;
  accent: number;
  create(ctx: GameContext): Game;
}
