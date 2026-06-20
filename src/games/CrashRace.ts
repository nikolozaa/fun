import { Container, Graphics } from "pixi.js";
import { GAME_WIDTH, GAME_HEIGHT, type Game, type GameContext } from "../core/types";
import { makeText } from "../core/utils";
import { DualBetPanel } from "../core/DualBetPanel";
import { makeBackButton } from "../core/Hud";
import { rand, sampleCrashPoint } from "../core/utils";
import { Car } from "./Car";

type Phase = "idle" | "racing" | "leadCrashed" | "pileup" | "done";

/**
 * Crash Race: a lead car drives ahead while the player's chaser follows.
 * The multiplier climbs while racing. At a random crash point the lead car
 * wrecks; ~0.6s later the chaser slams into it. Cash out before the pile-up.
 */
export class CrashRaceGame implements Game {
  readonly view = new Container();
  private ctx: GameContext;

  private world = new Container();
  private road = new Graphics();
  private dashLayer = new Graphics();
  private speedLines = new Graphics();
  private leadCar = new Car(0x3aa0ff, 0x1b5fa8);
  private chaseCar = new Car(0xff4d6d, 0xa8203b);
  private explosion = new Graphics();

  /** Normalized depths (0=horizon, 1=foreground) of the scrolling lane dashes. */
  private dashD: number[] = [];
  /** Phase offset for the diagonal speed-line streaks. */
  private speedPhase = 0;
  /** Current depth of each car along the track (0=far horizon, 1=foreground). */
  private leadDepth = CrashRaceGame.LEAD_DEPTH;
  private chaseDepth = CrashRaceGame.CHASE_DEPTH;

  private multiText = makeText("1.00×", { fill: 0xffffff, fontSize: 84, fontWeight: "900" });
  private statusText = makeText("", { fill: 0xff4d6d, fontSize: 30, fontWeight: "700" });
  private panel: DualBetPanel;

  private phase: Phase = "idle";
  private multi = 1;
  private crashPoint = 2;
  /** Per-slot: has this bet already been resolved (cashed out or busted)? */
  private resolved = [true, true];
  private scrollSpeed = 0;
  private pileupTimer = 0;
  private restartTimer = 0;

  // --- Perspective arcade track ---------------------------------------------
  // The road is drawn as a trapezoid converging to a vanishing point at the
  // horizon. A "depth" of 0 sits at the horizon (far away, small) and 1 sits
  // at the bottom of the screen (close, large). Cars race in two lanes; the
  // lead car runs slightly further down the track than the chaser.
  private static readonly HORIZON_Y = 196;
  private static readonly ROAD_TOP_W = 70; // road width at the horizon
  private static readonly ROAD_BOT_W = 680; // road width in the foreground
  /** Both cars run down the single center lane; the chaser sits behind. */
  private static readonly LEAD_LANE = 0;
  private static readonly CHASE_LANE = 0;
  // The lead car is AHEAD in the race — further down the road, nearer the
  // viewer (larger depth). The chaser trails behind it, closer to the horizon
  // (smaller depth). Both sit in the mid-track band so they stay clear of the
  // bottom betting panel.
  private static readonly LEAD_DEPTH = 0.54;
  private static readonly CHASE_DEPTH = 0.3;
  /** Depth gap the chaser closes to when it slams into the wrecked lead car. */
  private static readonly PILEUP_GAP = 0.12;

  /** Screen Y for a given track depth (0=horizon .. 1=foreground). */
  private depthToY(d: number): number {
    return CrashRaceGame.HORIZON_Y + d * (GAME_HEIGHT - CrashRaceGame.HORIZON_Y);
  }
  /** Half-width of the road at a given depth (perspective taper). */
  private halfWidthAt(d: number): number {
    const { ROAD_TOP_W, ROAD_BOT_W } = CrashRaceGame;
    return (ROAD_TOP_W + (ROAD_BOT_W - ROAD_TOP_W) * d) / 2;
  }
  /** Screen X for a lane (-1..+1) at a given depth. */
  private laneX(lane: number, d: number): number {
    return GAME_WIDTH / 2 + lane * this.halfWidthAt(d);
  }
  /** Perspective scale of an object at a given depth. */
  private depthScale(d: number): number {
    return 0.5 + d * 0.85;
  }

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.panel = new DualBetPanel(0xff4d6d, {
      onPlaceBet: (slot) => this.placeBet(slot),
      onCashOut: (slot) => this.cashOut(slot),
    });
    this.buildScene();
  }

  private buildScene() {
    const horizon = CrashRaceGame.HORIZON_Y;

    // --- Sky: vertical gradient from deep night down to a warm horizon haze.
    const sky = new Graphics();
    const bands = 24;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const c = interpColor(0x0a0a18, 0x2a1840, t);
      sky.rect(0, (horizon * i) / bands, GAME_WIDTH, horizon / bands + 1)
        .fill({ color: c });
    }
    // Horizon glow.
    sky.ellipse(GAME_WIDTH / 2, horizon, 520, 120).fill({ color: 0xff7b3a, alpha: 0.22 });
    sky.ellipse(GAME_WIDTH / 2, horizon, 300, 70).fill({ color: 0xffd06b, alpha: 0.25 });
    this.view.addChild(sky);

    // --- City skyline sitting on the horizon line, fading into the haze.
    const city = new Graphics();
    for (let x = 0; x < GAME_WIDTH; x += 46) {
      const bh = rand(40, 150);
      city.rect(x, horizon - bh, 38, bh).fill({ color: 0x130f24 });
      // a few lit windows
      for (let wy = horizon - bh + 10; wy < horizon - 8; wy += 18) {
        if (rand(0, 1) > 0.55)
          city.rect(x + 8, wy, 6, 7).fill({ color: 0xffd06b, alpha: 0.5 });
      }
    }
    this.view.addChild(city);

    // --- Ground plane beneath the road (grass/verge).
    const ground = new Graphics();
    ground.rect(0, horizon, GAME_WIDTH, GAME_HEIGHT - horizon).fill({ color: 0x101622 });
    this.view.addChild(ground);

    this.view.addChild(this.world);

    // --- Perspective road (trapezoid) with rumble strips + lane edges.
    this.drawRoad();
    this.world.addChild(this.road);

    // Dashed lane markers scroll toward the viewer; seed evenly through depth.
    const DASH_COUNT = 14;
    for (let i = 0; i < DASH_COUNT; i++) this.dashD.push((i + 1) / DASH_COUNT);
    this.world.addChild(this.dashLayer);

    // Speed-line streaks overlaid for a sense of velocity (drawn each frame).
    this.world.addChild(this.speedLines);

    // Cars: lead in the left lane (ahead, nearer the viewer), chaser in the
    // right lane trailing behind. Chaser is added first so the nearer lead car
    // draws on top of it. Positions/scales are driven by depth each frame.
    this.world.addChild(this.chaseCar.view, this.leadCar.view);
    this.placeCars();

    // Explosion (hidden until crash)
    this.explosion.visible = false;
    this.world.addChild(this.explosion);

    // HUD — multiplier floats large in the sky, status just beneath it.
    this.multiText.anchor.set(0.5);
    this.multiText.position.set(GAME_WIDTH / 2, 86);
    this.view.addChild(this.multiText);

    this.statusText.anchor.set(0.5);
    this.statusText.position.set(GAME_WIDTH / 2, 150);
    this.view.addChild(this.statusText);

    this.view.addChild(this.panel.view);
    this.view.addChild(makeBackButton(this.ctx.exit));
  }

  /** Draw the static perspective road: asphalt trapezoid, rumble strips, edges. */
  private drawRoad() {
    const g = this.road;
    g.clear();
    const yTop = CrashRaceGame.HORIZON_Y;
    const yBot = GAME_HEIGHT;
    const cx = GAME_WIDTH / 2;
    const hwTop = this.halfWidthAt(0);
    const hwBot = this.halfWidthAt(1);

    // Verge / shoulder slightly wider than the asphalt.
    g.poly([
      cx - hwTop - 14, yTop, cx + hwTop + 14, yTop,
      cx + hwBot + 60, yBot, cx - hwBot - 60, yBot,
    ]).fill({ color: 0x1c2433 });

    // Asphalt.
    g.poly([
      cx - hwTop, yTop, cx + hwTop, yTop,
      cx + hwBot, yBot, cx - hwBot, yBot,
    ]).fill({ color: 0x2a2c38 });

    // Striped rumble edges (red/white) down both sides.
    const stripes = 26;
    for (let i = 0; i < stripes; i++) {
      const d0 = i / stripes, d1 = (i + 1) / stripes;
      const y0 = this.depthToY(d0), y1 = this.depthToY(d1);
      const hw0 = this.halfWidthAt(d0), hw1 = this.halfWidthAt(d1);
      const col = i % 2 === 0 ? 0xff4d6d : 0xf2f2f2;
      const w0 = 4 + d0 * 12, w1 = 4 + d1 * 12;
      // left
      g.poly([cx - hw0, y0, cx - hw0 + w0, y0, cx - hw1 + w1, y1, cx - hw1, y1])
        .fill({ color: col });
      // right
      g.poly([cx + hw0 - w0, y0, cx + hw0, y0, cx + hw1, y1, cx + hw1 - w1, y1])
        .fill({ color: col });
    }

    // Solid white lane edge just inside the rumble strips.
    g.poly([
      cx - hwTop + 8, yTop, cx - hwTop + 12, yTop,
      cx - hwBot + 22, yBot, cx - hwBot + 16, yBot,
    ]).fill({ color: 0xffffff, alpha: 0.5 });
    g.poly([
      cx + hwTop - 12, yTop, cx + hwTop - 8, yTop,
      cx + hwBot - 16, yBot, cx + hwBot - 22, yBot,
    ]).fill({ color: 0xffffff, alpha: 0.5 });
  }

  /**
   * Redraw the scrolling lane dashes with proper perspective. The cars run
   * down the center, so the dashes form two dashed lane lines flanking the
   * lane. Each dash is a trapezoid that tapers toward the horizon and tracks
   * the converging lane-line so it sits flat on the road.
   */
  private drawDashes() {
    const g = this.dashLayer;
    g.clear();
    // Lane lines sit at this fraction of the road half-width from center.
    const laneFrac = 0.46;
    const lineX = (side: number, d: number) =>
      GAME_WIDTH / 2 + side * this.halfWidthAt(d) * laneFrac;

    for (const d of this.dashD) {
      // Each dash spans a short depth segment; clamp near the horizon.
      const dLen = 0.05 + d * 0.04;
      const dNear = Math.min(1, d);
      const dFar = Math.max(0, d - dLen);
      const yN = this.depthToY(dNear), yF = this.depthToY(dFar);
      const wN = 4 * this.depthScale(dNear), wF = 4 * this.depthScale(dFar);

      for (const side of [-1, 1]) {
        const xnC = lineX(side, dNear), xfC = lineX(side, dFar);
        g.poly([
          xnC - wN, yN, xnC + wN, yN, xfC + wF, yF, xfC - wF, yF,
        ]).fill({ color: 0xffd34d, alpha: 0.9 });
      }
    }
  }

  /** Diagonal motion streaks along the verges to sell the speed. */
  private drawSpeedLines(intensity: number) {
    const g = this.speedLines;
    g.clear();
    if (intensity <= 0.01) return;
    const cx = GAME_WIDTH / 2;
    for (let i = 0; i < 10; i++) {
      const d = ((i / 10 + this.speedPhase) % 1);
      const y = this.depthToY(d);
      const s = this.depthScale(d);
      const hw = this.halfWidthAt(d);
      const len = 40 * s;
      const a = 0.12 * intensity * d;
      // left and right outboard of the road
      g.rect(cx - hw - 30 * s, y, 6 * s, len).fill({ color: 0xaecbff, alpha: a });
      g.rect(cx + hw + 24 * s, y, 6 * s, len).fill({ color: 0xaecbff, alpha: a });
    }
  }

  /** Position and scale both cars from their current track depth + lane. */
  private placeCars() {
    const ld = this.leadDepth, cd = this.chaseDepth;
    this.leadCar.view.position.set(this.laneX(CrashRaceGame.LEAD_LANE, ld), this.depthToY(ld));
    this.leadCar.view.scale.set(this.depthScale(ld));
    this.chaseCar.view.position.set(this.laneX(CrashRaceGame.CHASE_LANE, cd), this.depthToY(cd));
    this.chaseCar.view.scale.set(this.depthScale(cd));
  }

  start(): void {
    this.statusText.text = "Place up to two bets to start the race";
  }

  /** A bet was placed in a slot. Starts the race if it isn't running yet. */
  private placeBet(slot: number): boolean {
    // Bets only open during the idle/racing window, before the lead wrecks.
    if (this.phase !== "idle" && this.phase !== "racing") return false;
    this.resolved[slot] = false;
    if (this.phase === "idle") this.beginRound();
    return true;
  }

  private beginRound() {
    this.phase = "racing";
    this.multi = 1;
    this.crashPoint = sampleCrashPoint();
    this.scrollSpeed = 0;
    this.explosion.visible = false;
    this.statusText.text = "RACING — cash out before the crash!";
    this.statusText.style.fill = 0x4ade80;
    // reset poses + track depths
    this.leadCar.reset();
    this.chaseCar.reset();
    this.leadDepth = CrashRaceGame.LEAD_DEPTH;
    this.chaseDepth = CrashRaceGame.CHASE_DEPTH;
    this.placeCars();
  }

  private cashOut(slot: number) {
    if (this.phase !== "racing" || this.resolved[slot]) return;
    this.resolved[slot] = true;
    const win = this.panel.currentBet(slot) * this.multi;
    this.panel.payout(slot, win);
    this.panel.setState(slot, "crashed");
    this.statusText.text = `Bet ${slot + 1} cashed @ ${this.multi.toFixed(2)}×  +$${win.toFixed(2)}`;
    this.statusText.style.fill = 0xf2b705;
  }

  update(dt: number): void {
    const moving = this.phase === "racing" || this.phase === "leadCrashed";

    // Scroll dashes toward the viewer (depth 0→1) and animate speed lines.
    if (moving) {
      this.scrollSpeed = 0.9; // depth units / sec
      for (let i = 0; i < this.dashD.length; i++) {
        this.dashD[i] += this.scrollSpeed * dt;
        if (this.dashD[i] > 1) this.dashD[i] -= 1;
      }
      this.speedPhase = (this.speedPhase + dt * 1.6) % 1;
      this.leadCar.drive(dt, 12);
      this.chaseCar.drive(dt, 12);
    }
    this.drawDashes();
    this.drawSpeedLines(moving ? Math.min(1, 0.4 + this.multi * 0.12) : 0);

    if (this.phase === "racing") {
      // Multiplier grows; rate accelerates the higher it climbs.
      this.multi += dt * (0.6 + this.multi * 0.35);
      this.multiText.text = `${this.multi.toFixed(2)}×`;
      const t = Math.min((this.multi - 1) / 6, 1);
      this.multiText.style.fill = interpColor(0xffffff, 0xff4d6d, t);

      if (this.multi >= this.crashPoint) {
        this.triggerLeadCrash();
      }
    }

    if (this.phase === "leadCrashed") {
      // Chaser closes the depth gap toward the wrecked lead car ahead of it.
      this.pileupTimer -= dt;
      const target = this.leadDepth - CrashRaceGame.PILEUP_GAP;
      this.chaseDepth += (target - this.chaseDepth) * Math.min(1, dt * 4);
      this.placeCars();
      if (this.pileupTimer <= 0) this.triggerPileup();
    }

    if (this.phase === "pileup") {
      this.animateExplosion(dt);
    }

    if (this.phase === "done") {
      this.restartTimer -= dt;
      if (this.restartTimer <= 0) this.resetForNext();
    }
  }

  private triggerLeadCrash() {
    this.phase = "leadCrashed";
    this.pileupTimer = 0.6;
    this.leadCar.crash();
    this.scrollSpeed = 0;
    this.spawnExplosion(this.leadCar.view.position.x, this.leadCar.view.position.y, 0.7 * this.depthScale(this.leadDepth));
    if (this.anyLiveBet()) {
      this.statusText.text = `LEAD CAR CRASHED @ ${this.crashPoint.toFixed(2)}×`;
      this.statusText.style.fill = 0xff4d6d;
    }
  }

  private triggerPileup() {
    this.phase = "pileup";
    this.chaseCar.crash();
    this.spawnExplosion((this.leadCar.view.position.x + this.chaseCar.view.position.x) / 2, (this.leadCar.view.position.y + this.chaseCar.view.position.y) / 2, 1.1 * this.depthScale(this.leadDepth));
    // Any bet not cashed out before the lead wrecked busts in the pile-up.
    let busted = false;
    this.panel.forEach((slot) => {
      if (!this.resolved[slot] && this.panel.isRunning(slot)) {
        this.resolved[slot] = true;
        this.panel.setState(slot, "crashed");
        busted = true;
      }
    });
    if (busted) {
      this.statusText.text = `PILE-UP! Busted @ ${this.crashPoint.toFixed(2)}×`;
      this.statusText.style.fill = 0xff4d6d;
    }
    this.phase = "done";
    this.restartTimer = 2.6;
  }

  /** Is any placed bet still live (not yet cashed out)? */
  private anyLiveBet(): boolean {
    let live = false;
    this.panel.forEach((slot) => {
      if (!this.resolved[slot] && this.panel.isRunning(slot)) live = true;
    });
    return live;
  }

  private spawnExplosion(x: number, y: number, scale: number) {
    this.explosion.visible = true;
    this.explosion.position.set(x, y);
    this.explosion.scale.set(scale);
    (this.explosion as any)._anim = 0;
  }

  private animateExplosion(dt: number) {
    const e = this.explosion as any;
    e._anim = (e._anim ?? 0) + dt * 3;
    this.drawExplosion(Math.min(e._anim, 1));
  }

  private drawExplosion(t: number) {
    const g = this.explosion;
    g.clear();
    const r = 30 + t * 60;
    g.circle(0, 0, r).fill({ color: 0xffd166, alpha: (1 - t) * 0.9 });
    g.circle(0, 0, r * 0.7).fill({ color: 0xff7b00, alpha: (1 - t) * 0.9 });
    g.circle(0, 0, r * 0.4).fill({ color: 0xff2b2b, alpha: (1 - t) });
    // spikes
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rr = r * (1.1 + 0.3 * Math.sin(i));
      g.moveTo(0, 0)
        .lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
        .lineTo(Math.cos(a + 0.3) * r * 0.6, Math.sin(a + 0.3) * r * 0.6)
        .closePath()
        .fill({ color: 0xffb703, alpha: (1 - t) * 0.7 });
    }
  }

  private resetForNext() {
    this.phase = "idle";
    this.explosion.visible = false;
    this.leadCar.reset();
    this.chaseCar.reset();
    this.leadDepth = CrashRaceGame.LEAD_DEPTH;
    this.chaseDepth = CrashRaceGame.CHASE_DEPTH;
    this.placeCars();
    this.multi = 1;
    this.multiText.text = "1.00×";
    this.multiText.style.fill = 0xffffff;
    this.statusText.text = "Place up to two bets to start the race";
    this.statusText.style.fill = 0xff4d6d;
    this.resolved = [true, true];
    this.panel.setStateAll("betting");
  }

  destroy(): void {
    this.view.removeChildren();
  }
}

/** Linear interpolate between two 0xRRGGBB colors. */
function interpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
