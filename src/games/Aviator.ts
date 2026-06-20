import { Container, Graphics } from "pixi.js";
import { GAME_WIDTH, GAME_HEIGHT, type Game, type GameContext } from "../core/types";
import { makeText, sampleCrashPoint, clamp } from "../core/utils";
import { DualBetPanel } from "../core/DualBetPanel";
import { makeBackButton } from "../core/Hud";
import { Dancer } from "./Dancer";

type Phase = "idle" | "rising" | "crashed";

/**
 * Aviator-style multiplier game. Instead of a plane, a stylized dancer rises
 * along a curve as the multiplier climbs; her outfit stages shed with height.
 * She can "drop" (crash) at any random multiplier. Cash out before she falls.
 */
export class AviatorGame implements Game {
  readonly view = new Container();
  private ctx: GameContext;

  private grid = new Graphics();
  private dancer = new Dancer();
  private dancerHolder = new Container();

  private multiText = makeText("1.00×", { fill: 0xffffff, fontSize: 96, fontWeight: "900" });
  private statusText = makeText("", { fill: 0xb14dff, fontSize: 28, fontWeight: "700" });
  private stageText = makeText("", { fill: 0xffd6f5, fontSize: 22, fontWeight: "600" });
  private panel: DualBetPanel;

  private phase: Phase = "idle";
  private multi = 1;
  private crashPoint = 2;
  /** Per-slot: has this bet already been resolved (cashed out or busted)? */
  private resolved = [true, true];
  private restartTimer = 0;

  // climb maps multiplier 1..MAX_VIS onto the visible flight area
  private static readonly MAX_VIS = 12;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.panel = new DualBetPanel(0xb14dff, {
      onPlaceBet: (slot) => this.placeBet(slot),
      onCashOut: (slot) => this.cashOut(slot),
    });
    this.buildScene();
  }

  private buildScene() {
    const bg = new Graphics();
    bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0x140a1f });
    bg.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill({ color: 0x2a0f3a, alpha: 0.5 });
    this.view.addChild(bg);

    // Stage glow
    const glow = new Graphics();
    glow.ellipse(GAME_WIDTH / 2, GAME_HEIGHT, 700, 420).fill({ color: 0xb14dff, alpha: 0.12 });
    this.view.addChild(glow);

    this.view.addChild(this.grid);
    this.drawGrid();

    // Dancer figure sits centered in the scene.
    this.dancerHolder.addChild(this.dancer.view);
    this.dancerHolder.scale.set(1.4);
    this.view.addChild(this.dancerHolder);
    this.placeDancer();

    // HUD
    this.multiText.anchor.set(0.5);
    this.multiText.position.set(GAME_WIDTH / 2, 120);
    this.view.addChild(this.multiText);

    this.statusText.anchor.set(0.5);
    this.statusText.position.set(GAME_WIDTH / 2, 196);
    this.view.addChild(this.statusText);

    this.stageText.anchor.set(0.5);
    this.stageText.position.set(GAME_WIDTH / 2, 232);
    this.view.addChild(this.stageText);

    this.view.addChild(this.panel.view);
    this.view.addChild(makeBackButton(this.ctx.exit));
  }

  private drawGrid() {
    this.grid.clear();
    for (let x = 0; x <= GAME_WIDTH; x += 80) {
      this.grid.moveTo(x, 0).lineTo(x, GAME_HEIGHT).stroke({ color: 0xffffff, width: 1, alpha: 0.04 });
    }
    for (let y = 0; y <= GAME_HEIGHT; y += 80) {
      this.grid.moveTo(0, y).lineTo(GAME_WIDTH, y).stroke({ color: 0xffffff, width: 1, alpha: 0.04 });
    }
  }

  /** The figure stays parked in the center of the screen — it does not fly. */
  private centerPos(): { x: number; y: number } {
    return { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 + 40 };
  }

  private placeDancer() {
    const p = this.centerPos();
    this.dancerHolder.position.set(p.x, p.y);
  }

  start(): void {
    this.statusText.text = "Place up to two bets — cash out before she drops";
  }

  /** A bet was placed in a slot. Starts the round if it isn't running yet. */
  private placeBet(slot: number): boolean {
    if (this.phase === "crashed") return false;
    this.resolved[slot] = false;
    if (this.phase === "idle") this.beginRound();
    return true;
  }

  private beginRound() {
    this.phase = "rising";
    this.multi = 1;
    this.crashPoint = sampleCrashPoint();
    this.dancer.reset();
    this.statusText.text = "RISING — cash out at the peak!";
    this.statusText.style.fill = 0x4ade80;
  }

  private cashOut(slot: number) {
    if (this.phase !== "rising" || this.resolved[slot]) return;
    this.resolved[slot] = true;
    const win = this.panel.currentBet(slot) * this.multi;
    this.panel.payout(slot, win);
    this.panel.setState(slot, "crashed");
    this.statusText.text = `Bet ${slot + 1} cashed @ ${this.multi.toFixed(2)}×  +$${win.toFixed(2)}`;
    this.statusText.style.fill = 0xf2b705;
  }

  update(dt: number): void {
    if (this.phase === "rising") {
      this.multi += dt * (0.55 + this.multi * 0.3);

      const progress = clamp((this.multi - 1) / (AviatorGame.MAX_VIS - 1), 0, 1);
      this.dancer.setProgress(progress);
      // Centered figure: just an idle sway, no flight repositioning.
      this.dancer.animate(dt, 0.4 + progress);

      // Label the outfit stage she's currently in: robe → dress → lingerie.
      this.stageText.text = Dancer.STAGES[this.dancer.currentStage(progress)];

      this.multiText.text = `${this.multi.toFixed(2)}×`;
      this.multiText.style.fill = interpColor(0xffffff, 0xb14dff, progress);

      if (this.multi >= this.crashPoint) this.triggerCrash();
    }

    if (this.phase === "crashed") {
      // She drops off-screen.
      this.dancerHolder.y += 600 * dt;
      this.dancerHolder.alpha = Math.max(0, this.dancerHolder.alpha - dt * 1.2);
      this.restartTimer -= dt;
      if (this.restartTimer <= 0) this.resetForNext();
    }
  }

  private triggerCrash() {
    this.phase = "crashed";
    this.dancer.fall();
    this.restartTimer = 2.6;
    // Any still-live bet busts; already-cashed slots keep their winnings.
    let busted = false;
    this.panel.forEach((slot) => {
      if (!this.resolved[slot] && this.panel.isRunning(slot)) {
        this.resolved[slot] = true;
        this.panel.setState(slot, "crashed");
        busted = true;
      }
    });
    if (busted) {
      this.statusText.text = `SHE DROPPED @ ${this.crashPoint.toFixed(2)}× — busted`;
      this.statusText.style.fill = 0xff4d6d;
    } else {
      this.statusText.text += `   (she dropped @ ${this.crashPoint.toFixed(2)}×)`;
    }
  }

  private resetForNext() {
    this.phase = "idle";
    this.multi = 1;
    this.dancerHolder.alpha = 1;
    this.dancer.reset();
    this.placeDancer();
    this.multiText.text = "1.00×";
    this.multiText.style.fill = 0xffffff;
    this.stageText.text = "";
    this.statusText.text = "Place up to two bets — cash out before she drops";
    this.statusText.style.fill = 0xb14dff;
    this.resolved = [true, true];
    this.panel.setStateAll("betting");
  }

  destroy(): void {
    this.view.removeChildren();
  }
}

function interpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
