import { Container, Graphics } from "pixi.js";
import { GAME_WIDTH, GAME_HEIGHT, type Game, type GameContext } from "../core/types";
import { makeText, sampleCrashPoint, clamp } from "../core/utils";
import { DualBetPanel } from "../core/DualBetPanel";
import { makeBackButton } from "../core/Hud";
import { Dancer } from "./Dancer";

type Phase = "betting" | "rising" | "crashed" | "pause";

/** Seconds in the open betting window before a round auto-launches. */
const BET_WINDOW = 5;
/** Seconds to wait after a round ends before the next betting window opens. */
const PAUSE_AFTER = 5;

/**
 * Aviator-style multiplier game. Instead of a plane, a stylized dancer rises
 * along a curve as the multiplier climbs; her outfit stages shed with height.
 * She can "drop" (crash) at any random multiplier. Cash out before she falls.
 */
export class AviatorGame implements Game {
  readonly view = new Container();
  private ctx: GameContext;

  private spotlights = new Graphics();
  private stageGlow = new Graphics();
  private sparkles = new Graphics();
  private dancer = new Dancer();
  private dancerHolder = new Container();
  /** Drives the animated spotlights / glow pulse. */
  private sceneTime = 0;

  private multiText = makeText("1.00×", { fill: 0xffffff, fontSize: 96, fontWeight: "900" });
  private statusText = makeText("", { fill: 0xb14dff, fontSize: 28, fontWeight: "700" });
  private stageText = makeText("", { fill: 0xffd6f5, fontSize: 22, fontWeight: "600" });
  private panel: DualBetPanel;

  private phase: Phase = "betting";
  private multi = 1;
  private crashPoint = 2;
  /** Per-slot: has this bet already been resolved (cashed out or busted)? */
  private resolved = [true, true];
  /** Counts down the betting window; at 0 the round launches. */
  private betTimer = BET_WINDOW;
  private restartTimer = 0;
  /** Counts down the post-round pause before the next betting window. */
  private pauseTimer = 0;

  // The outfit reveal is paced logarithmically: she stays robed at low
  // multipliers and only reaches the final stage once the multiplier hits
  // REVEAL_MAX (500×). progress = log(multi) / log(REVEAL_MAX), so roughly
  // robe 1–10×, dress ~10–70×, bikini reached at 500×.
  private static readonly REVEAL_MAX = 500;

  /** Outfit-reveal progress 0..1 from the current multiplier, on a log scale. */
  private revealProgress(): number {
    return clamp(Math.log(this.multi) / Math.log(AviatorGame.REVEAL_MAX), 0, 1);
  }

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.panel = new DualBetPanel(0xb14dff, {
      onPlaceBet: (slot) => this.placeBet(slot),
      onCashOut: (slot) => this.cashOut(slot),
    });
    this.buildScene();
  }

  private buildScene() {
    // --- Backdrop: a vertical gradient from deep violet to near-black.
    const bg = new Graphics();
    const bands = 28;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const c = interpColor(0x241036, 0x0c0613, t);
      bg.rect(0, (GAME_HEIGHT * i) / bands, GAME_WIDTH, GAME_HEIGHT / bands + 1)
        .fill({ color: c });
    }
    this.view.addChild(bg);

    // --- Back wall shimmer panels (vertical neon strips behind the stage).
    const wall = new Graphics();
    for (let x = 60; x < GAME_WIDTH - 40; x += 96) {
      const hue = x % 192 === 60 ? 0xb14dff : 0x6a2fb0;
      wall.roundRect(x, 60, 8, 360, 4).fill({ color: hue, alpha: 0.12 });
    }
    this.view.addChild(wall);

    // --- Animated spotlight cones (redrawn each frame).
    this.view.addChild(this.spotlights);

    // --- Stage floor: an elliptical riser with a glowing rim.
    const floorY = GAME_HEIGHT - 130;
    const floor = new Graphics();
    floor.ellipse(GAME_WIDTH / 2, floorY + 60, 520, 120).fill({ color: 0x1a0e2a });
    floor.ellipse(GAME_WIDTH / 2, floorY + 50, 430, 96).fill({ color: 0x2a1542 });
    floor.ellipse(GAME_WIDTH / 2, floorY + 50, 430, 96).stroke({ color: 0xb14dff, width: 3, alpha: 0.5 });
    floor.ellipse(GAME_WIDTH / 2, floorY + 50, 300, 64).fill({ color: 0x3a1d5c, alpha: 0.6 });
    this.view.addChild(floor);

    // --- Pulsing glow behind the dancer (redrawn each frame).
    this.view.addChild(this.stageGlow);

    // Dancer figure stands on the stage.
    this.dancerHolder.addChild(this.dancer.view);
    this.dancerHolder.scale.set(1.2);
    this.view.addChild(this.dancerHolder);
    this.placeDancer();

    // --- Floating sparkles in front of the dancer (redrawn each frame).
    this.view.addChild(this.sparkles);

    // HUD
    this.multiText.anchor.set(0.5);
    this.multiText.position.set(GAME_WIDTH / 2, 110);
    this.view.addChild(this.multiText);

    this.statusText.anchor.set(0.5);
    this.statusText.position.set(GAME_WIDTH / 2, 182);
    this.view.addChild(this.statusText);

    this.stageText.anchor.set(0.5);
    this.stageText.position.set(GAME_WIDTH / 2, 218);
    this.view.addChild(this.stageText);

    this.view.addChild(this.panel.view);
    this.view.addChild(makeBackButton(this.ctx.exit));
  }

  /** Redraw the animated stage lighting for the given progress/intensity. */
  private drawStage(progress: number) {
    const t = this.sceneTime;
    const cx = GAME_WIDTH / 2;
    const floorY = GAME_HEIGHT - 80;

    // Two sweeping spotlight cones from the top corners onto the stage.
    const sl = this.spotlights;
    sl.clear();
    const sweep = Math.sin(t * 0.8) * 90;
    const beam = (originX: number, baseX: number, color: number) => {
      sl.moveTo(originX, 40)
        .lineTo(baseX - 90 + sweep, floorY)
        .lineTo(baseX + 90 + sweep, floorY)
        .closePath()
        .fill({ color, alpha: 0.06 });
    };
    beam(GAME_WIDTH * 0.3, cx - 40, 0xff6fd5);
    beam(GAME_WIDTH * 0.7, cx + 40, 0x7a9bff);

    // Glow disc behind her, pulsing and warming as the climb rises.
    const g = this.stageGlow;
    g.clear();
    const pulse = 1 + Math.sin(t * 2.4) * 0.06;
    const warm = interpColor(0xb14dff, 0xff5fa2, progress);
    const cy = this.centerPos().y - 20;
    g.ellipse(cx, cy, 220 * pulse, 300 * pulse).fill({ color: warm, alpha: 0.1 });
    g.ellipse(cx, cy, 140 * pulse, 220 * pulse).fill({ color: warm, alpha: 0.12 });

    // Sparkles drifting upward, more of them the higher she climbs.
    const sp = this.sparkles;
    sp.clear();
    const count = Math.round(10 + progress * 26);
    for (let i = 0; i < count; i++) {
      const seed = i * 12.9898;
      const fx = cx + (frac(Math.sin(seed) * 43758.5) - 0.5) * 460;
      const speed = 30 + frac(Math.sin(seed * 1.7) * 1000) * 60;
      const fy = floorY - ((t * speed + i * 90) % (floorY - 60));
      const r = 1.2 + frac(Math.sin(seed * 2.3) * 999) * 2.2;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 3 + i));
      sp.circle(fx, fy, r).fill({ color: 0xffe6fb, alpha: tw * (0.3 + progress * 0.5) });
    }
  }

  /** The figure stands on the stage — parked in the center, it does not fly. */
  private centerPos(): { x: number; y: number } {
    return { x: GAME_WIDTH / 2, y: 430 };
  }

  private placeDancer() {
    const p = this.centerPos();
    this.dancerHolder.position.set(p.x, p.y);
  }

  start(): void {
    this.openBetting();
  }

  /** Open a fresh betting window; bets are only accepted while it counts down. */
  private openBetting() {
    this.phase = "betting";
    this.betTimer = BET_WINDOW;
    this.multi = 1;
    this.dancerHolder.alpha = 1;
    this.dancer.reset();
    this.placeDancer();
    this.multiText.text = "1.00×";
    this.multiText.style.fill = 0xffffff;
    this.stageText.text = "";
    this.resolved = [true, true];
    this.panel.setStateAll("betting");
  }

  /** A bet was placed in a slot. Only allowed during the betting window. */
  private placeBet(slot: number): boolean {
    if (this.phase !== "betting") return false;
    this.resolved[slot] = false;
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
    // Animate the stage lighting every frame so the scene always feels alive.
    this.sceneTime += dt;
    const stageProgress = this.phase === "rising" ? this.revealProgress() : 0;
    this.drawStage(stageProgress);

    if (this.phase === "betting") {
      this.betTimer -= dt;
      const secs = Math.max(0, Math.ceil(this.betTimer));
      this.statusText.text = `Place your bets — round starts in ${secs}s`;
      this.statusText.style.fill = 0xffffff;
      // A just-placed bet shows its base potential (stake × 1.00).
      this.panel.setMultiplier(1);
      // Idle sway while she waits on the platform.
      this.dancer.animate(dt, 0.4);
      if (this.betTimer <= 0) this.beginRound();
    }

    if (this.phase === "rising") {
      this.multi += dt * (0.55 + this.multi * 0.3);

      const progress = this.revealProgress();
      this.dancer.setProgress(progress);
      // Centered figure: just an idle sway, no flight repositioning.
      this.dancer.animate(dt, 0.4 + progress);

      // Label the outfit stage she's currently in: robe → dress → lingerie.
      this.stageText.text = Dancer.STAGES[this.dancer.currentStage(progress)];

      // Update each live bet's button with its potential cash-out.
      this.panel.setMultiplier(this.multi);

      this.multiText.text = `${this.multi.toFixed(2)}×`;
      this.multiText.style.fill = interpColor(0xffffff, 0xb14dff, progress);

      if (this.multi >= this.crashPoint) this.triggerCrash();
    }

    if (this.phase === "crashed") {
      // She drops off-screen.
      this.dancerHolder.y += 600 * dt;
      this.dancerHolder.alpha = Math.max(0, this.dancerHolder.alpha - dt * 1.2);
      this.restartTimer -= dt;
      if (this.restartTimer <= 0) {
        this.phase = "pause";
        this.pauseTimer = PAUSE_AFTER;
      }
    }

    if (this.phase === "pause") {
      this.pauseTimer -= dt;
      const secs = Math.max(0, Math.ceil(this.pauseTimer));
      this.statusText.text = `Next round in ${secs}s`;
      this.statusText.style.fill = 0xffffff;
      if (this.pauseTimer <= 0) this.openBetting();
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

/** Fractional part of a number, for cheap deterministic pseudo-random layout. */
function frac(n: number): number {
  return n - Math.floor(n);
}
