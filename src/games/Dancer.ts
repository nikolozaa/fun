import { Container, Graphics } from "pixi.js";

/**
 * A stylized female silhouette figure drawn with vector graphics. As the climb
 * progresses her outfit is shed through three stages:
 *
 *   robe (0)  →  dress (1)  →  lingerie (2)
 *
 * Each stage is a separate Graphics layer; setProgress() cross-fades from one
 * to the next so a garment "disappears" as the multiplier rises, revealing the
 * lighter layer underneath. Nothing explicit is rendered — the final stage is
 * a tasteful lingerie set. This is deliberately abstract placeholder art — drop
 * your own sprite frames in to replace it.
 */
export class Dancer {
  readonly view = new Container();
  private figure = new Container();

  /** Outfit layers, drawn back-to-front; index 0 is the outermost garment. */
  private robe!: Graphics;
  private dress!: Graphics;
  private lingerie!: Graphics;

  private sway = 0;
  private skin = 0xf2c8a0;

  /** Names of the three stages, exposed so the HUD can label the current one. */
  static readonly STAGES = ["Robe", "Dress", "Lingerie"] as const;

  constructor() {
    this.buildBody();
    // Drawn lingerie-first so the outer garments paint on top of it.
    this.buildLingerie();
    this.buildDress();
    this.buildRobe();
    this.view.addChild(this.figure);
  }

  private buildBody() {
    const g = new Graphics();
    // Hair
    g.ellipse(0, -120, 38, 46).fill({ color: 0x3a2a22 });
    // Head
    g.circle(0, -110, 26).fill({ color: this.skin });
    // Neck
    g.rect(-7, -88, 14, 18).fill({ color: this.skin });
    // Torso (hourglass via two arcs)
    g.moveTo(-26, -72)
      .quadraticCurveTo(-34, -30, -20, 0)
      .quadraticCurveTo(-30, 30, -22, 70)
      .lineTo(22, 70)
      .quadraticCurveTo(30, 30, 20, 0)
      .quadraticCurveTo(34, -30, 26, -72)
      .closePath()
      .fill({ color: this.skin });
    // Legs
    g.roundRect(-22, 66, 18, 90, 8).fill({ color: this.skin });
    g.roundRect(4, 66, 18, 90, 8).fill({ color: this.skin });
    // Arms
    g.roundRect(-40, -66, 12, 80, 6).fill({ color: this.skin });
    g.roundRect(28, -66, 12, 80, 6).fill({ color: this.skin });
    // Face hint
    g.circle(-9, -112, 2.5).fill({ color: 0x222 });
    g.circle(9, -112, 2.5).fill({ color: 0x222 });
    g.moveTo(-6, -100).quadraticCurveTo(0, -96, 6, -100).stroke({ color: 0xc0392b, width: 2 });
    this.figure.addChild(g);
  }

  /** Stage 2 (innermost): a two-piece lingerie set — the final layer. */
  private buildLingerie() {
    const g = new Graphics();
    const lace = 0x111118;
    const trim = 0xff8fc0;

    // Bra: two triangle cups + connecting tie + neck/back straps.
    g.moveTo(-26, -64).lineTo(-2, -64).lineTo(-14, -40).closePath().fill({ color: lace });
    g.moveTo(2, -64).lineTo(26, -64).lineTo(14, -40).closePath().fill({ color: lace });
    g.circle(0, -58, 4).fill({ color: trim });
    g.moveTo(-20, -64).lineTo(-8, -86).stroke({ color: lace, width: 4 });
    g.moveTo(20, -64).lineTo(8, -86).stroke({ color: lace, width: 4 });
    g.moveTo(-26, -58).lineTo(26, -58).stroke({ color: lace, width: 3 });

    // Briefs across the hips with side ties.
    g.moveTo(-24, 52)
      .lineTo(24, 52)
      .quadraticCurveTo(18, 84, 0, 84)
      .quadraticCurveTo(-18, 84, -24, 52)
      .closePath()
      .fill({ color: lace });
    g.moveTo(-24, 54).lineTo(24, 54).stroke({ color: trim, width: 3 });
    g.circle(-24, 56, 4).fill({ color: trim });
    g.circle(24, 56, 4).fill({ color: trim });

    this.lingerie = g;
    this.figure.addChild(g);
  }

  /** Stage 1 (middle): a fitted cocktail dress covering the torso and hips. */
  private buildDress() {
    const g = new Graphics();
    const cloth = 0xc1294f;
    const sheen = 0xe0738f;

    // Bodice + flared skirt following the torso silhouette down to the thighs.
    g.moveTo(-28, -68)
      .lineTo(28, -68)
      .quadraticCurveTo(34, -30, 22, 0)
      .quadraticCurveTo(34, 40, 30, 96)
      .lineTo(-30, 96)
      .quadraticCurveTo(-34, 40, -22, 0)
      .quadraticCurveTo(-34, -30, -28, -68)
      .closePath()
      .fill({ color: cloth });
    // Shoulder straps.
    g.moveTo(-22, -66).lineTo(-12, -88).stroke({ color: cloth, width: 6 });
    g.moveTo(22, -66).lineTo(12, -88).stroke({ color: cloth, width: 6 });
    // Waist sheen highlight.
    g.moveTo(-20, 2).quadraticCurveTo(0, 10, 20, 2).stroke({ color: sheen, width: 3 });

    this.dress = g;
    this.figure.addChild(g);
  }

  /** Stage 0 (outermost): a long satin robe, the first thing to come off. */
  private buildRobe() {
    const g = new Graphics();
    const cloth = 0x5b3b8c;
    const trim = 0xcdb4f0;

    // Full-length robe draping from shoulders past the knees.
    g.moveTo(-36, -82)
      .lineTo(36, -82)
      .quadraticCurveTo(46, -20, 40, 60)
      .quadraticCurveTo(42, 130, 34, 150)
      .lineTo(-34, 150)
      .quadraticCurveTo(-42, 130, -40, 60)
      .quadraticCurveTo(-46, -20, -36, -82)
      .closePath()
      .fill({ color: cloth });
    // Collar/lapels parting down the front.
    g.moveTo(0, -82).lineTo(-14, 150).stroke({ color: trim, width: 5 });
    g.moveTo(0, -82).lineTo(14, 150).stroke({ color: trim, width: 5 });
    g.moveTo(-36, -82).lineTo(0, -82).lineTo(-14, -30).closePath().fill({ color: trim, alpha: 0.5 });
    g.moveTo(36, -82).lineTo(0, -82).lineTo(14, -30).closePath().fill({ color: trim, alpha: 0.5 });
    // Sash at the waist.
    g.rect(-40, 28, 80, 12).fill({ color: trim });

    this.robe = g;
    this.figure.addChild(g);
  }

  /**
   * progress 0..1 across the whole climb. The outfit sheds through three stages:
   * robe → dress → lingerie. Each stage owns a third of the climb and the
   * outgoing garment fades out over the back portion of its slice so it
   * "disappears" as the multiplier rises.
   */
  setProgress(progress: number) {
    // robe visible for [0, 1/3), fading out across the second half of that slice.
    this.robe.alpha = 1 - stageReveal(progress, 0);
    // dress visible until [2/3), fading out across its second half.
    this.dress.alpha = 1 - stageReveal(progress, 1);
    // lingerie is the final layer — always present underneath.
    this.lingerie.alpha = 1;
  }

  /** Index 0..2 of the garment currently on top, for HUD labelling. */
  currentStage(progress: number): number {
    if (progress >= 2 / 3) return 2;
    if (progress >= 1 / 3) return 1;
    return 0;
  }

  /** Idle sway + rise animation flourish. */
  animate(dt: number, intensity: number) {
    this.sway += dt * (2 + intensity * 3);
    this.figure.rotation = Math.sin(this.sway) * 0.05 * (0.5 + intensity);
    this.figure.x = Math.sin(this.sway * 0.7) * 6 * intensity;
  }

  /** Drop pose when the round crashes. */
  fall() {
    this.figure.rotation = 0.4;
  }

  reset() {
    this.figure.rotation = 0;
    this.figure.x = 0;
    this.sway = 0;
    this.robe.alpha = 1;
    this.dress.alpha = 1;
    this.lingerie.alpha = 1;
  }
}

/**
 * How far the garment at `stage` (0 or 1) has been shed at the given progress.
 * Returns 0 while the climb is still within or before this stage's slice, then
 * ramps 0→1 over the back half of the slice so the garment fades cleanly off
 * just before the next stage begins.
 */
function stageReveal(progress: number, stage: number): number {
  const start = stage / 3; // slice start for this garment
  const fadeStart = start + 1 / 6; // begin fading at the slice midpoint
  const fadeEnd = start + 1 / 3; // fully gone by the slice end
  if (progress <= fadeStart) return 0;
  if (progress >= fadeEnd) return 1;
  return (progress - fadeStart) / (fadeEnd - fadeStart);
}
