import { Container, Graphics } from "pixi.js";

/**
 * A stylized female figure drawn with vector graphics. As the climb progresses
 * her outfit is shed through three stages:
 *
 *   robe (0)  →  dress (1)  →  lingerie (2)
 *
 * Each stage is a separate Graphics layer; setProgress() cross-fades from one
 * to the next so a garment "disappears" as the multiplier rises, revealing the
 * lighter layer underneath. Nothing explicit is rendered — the final stage is
 * a tasteful lingerie set. Deliberately abstract placeholder art — drop your
 * own sprite frames in to replace it.
 *
 * Layout note: the figure is built around an origin near the hips. The torso
 * rises to roughly y=-150 (head) and the legs fall to about y=180 (feet).
 */
export class Dancer {
  readonly view = new Container();
  private figure = new Container();

  /** Sub-containers so limbs can sway independently of the body. */
  private bodyLayer = new Container();

  /** Outfit layers, drawn back-to-front; index 0 is the outermost garment. */
  private robe!: Graphics;
  private dress!: Graphics;
  private lingerie!: Graphics;

  private sway = 0;
  private skin = 0xf4caa4;
  private skinShade = 0xd9a87f;

  /** Names of the three stages, exposed so the HUD can label the current one. */
  static readonly STAGES = ["Robe", "Dress", "Lingerie"] as const;

  constructor() {
    // Body first (bare figure), then garments paint on top of it back-to-front:
    // lingerie (innermost) → dress → robe (outermost).
    this.figure.addChild(this.bodyLayer);
    this.buildBody();
    this.buildLingerie();
    this.buildDress();
    this.buildRobe();
    this.view.addChild(this.figure);
  }

  private buildBody() {
    const g = new Graphics();
    const skin = this.skin;
    const shade = this.skinShade;

    // --- Legs (smooth tapered thighs → calves), drawn first (behind torso).
    const leg = (dir: number) => {
      g.moveTo(dir * 4, 70)
        .quadraticCurveTo(dir * 26, 110, dir * 18, 150)
        .quadraticCurveTo(dir * 15, 174, dir * 10, 182)
        .lineTo(dir * 2, 182)
        .quadraticCurveTo(dir * 4, 150, dir * 2, 110)
        .quadraticCurveTo(dir * 1, 88, 0, 72)
        .closePath()
        .fill({ color: skin });
    };
    leg(-1);
    leg(1);
    // Inner-leg shading seam.
    g.moveTo(0, 74).lineTo(0, 178).stroke({ color: shade, width: 3, alpha: 0.4 });
    // Feet hint.
    g.ellipse(-9, 184, 8, 5).fill({ color: shade });
    g.ellipse(9, 184, 8, 5).fill({ color: shade });

    // --- Arms, relaxed at the sides with a slight bend.
    const arm = (dir: number) => {
      g.moveTo(dir * 30, -64)
        .quadraticCurveTo(dir * 44, -30, dir * 40, 6)
        .quadraticCurveTo(dir * 38, 30, dir * 32, 44)
        .lineTo(dir * 24, 40)
        .quadraticCurveTo(dir * 30, 10, dir * 28, -20)
        .quadraticCurveTo(dir * 26, -48, dir * 20, -62)
        .closePath()
        .fill({ color: skin });
    };
    arm(-1);
    arm(1);

    // --- Torso: a smooth hourglass from shoulders to hips.
    g.moveTo(-30, -70)
      .quadraticCurveTo(-40, -34, -24, -4)
      .quadraticCurveTo(-34, 30, -26, 64)
      .quadraticCurveTo(-14, 80, 0, 80)
      .quadraticCurveTo(14, 80, 26, 64)
      .quadraticCurveTo(34, 30, 24, -4)
      .quadraticCurveTo(40, -34, 30, -70)
      .quadraticCurveTo(0, -84, -30, -70)
      .fill({ color: skin });
    // Soft body contour shading down one side for dimension.
    g.moveTo(24, -60)
      .quadraticCurveTo(34, -30, 22, -2)
      .quadraticCurveTo(30, 30, 22, 60)
      .quadraticCurveTo(16, 70, 8, 72)
      .lineTo(14, 60)
      .quadraticCurveTo(20, 30, 14, -2)
      .quadraticCurveTo(24, -32, 16, -58)
      .closePath()
      .fill({ color: shade, alpha: 0.35 });
    // Collarbone + waist hint.
    g.moveTo(-18, -62).quadraticCurveTo(0, -54, 18, -62).stroke({ color: shade, width: 2, alpha: 0.4 });

    // --- Neck.
    g.moveTo(-9, -78).lineTo(9, -78).lineTo(8, -96).lineTo(-8, -96).closePath().fill({ color: skin });
    g.moveTo(-9, -78).quadraticCurveTo(0, -72, 9, -78).stroke({ color: shade, width: 2, alpha: 0.3 });

    // --- Hair behind the head.
    g.moveTo(-30, -120)
      .quadraticCurveTo(-44, -150, -26, -168)
      .quadraticCurveTo(0, -184, 26, -168)
      .quadraticCurveTo(44, -150, 30, -120)
      .quadraticCurveTo(36, -96, 22, -84)
      .quadraticCurveTo(0, -92, -22, -84)
      .quadraticCurveTo(-36, -96, -30, -120)
      .fill({ color: 0x4a2f26 });

    // --- Head.
    g.ellipse(0, -122, 24, 28).fill({ color: skin });
    // Cheek blush + jaw shading.
    g.circle(-12, -116, 5).fill({ color: 0xe8a98c, alpha: 0.5 });
    g.circle(12, -116, 5).fill({ color: 0xe8a98c, alpha: 0.5 });

    // --- Hair front (framing locks over the shoulders).
    g.moveTo(-24, -132)
      .quadraticCurveTo(-30, -150, -16, -160)
      .quadraticCurveTo(-26, -140, -22, -120)
      .quadraticCurveTo(-26, -96, -32, -78)
      .lineTo(-24, -80)
      .quadraticCurveTo(-18, -104, -18, -130)
      .closePath()
      .fill({ color: 0x5a382b });
    g.moveTo(24, -132)
      .quadraticCurveTo(30, -150, 16, -160)
      .quadraticCurveTo(26, -140, 22, -120)
      .quadraticCurveTo(26, -96, 32, -78)
      .lineTo(24, -80)
      .quadraticCurveTo(18, -104, 18, -130)
      .closePath()
      .fill({ color: 0x5a382b });

    // --- Face: eyes, brows, lips.
    g.ellipse(-9, -124, 3.2, 4).fill({ color: 0x2a1a1a });
    g.ellipse(9, -124, 3.2, 4).fill({ color: 0x2a1a1a });
    g.circle(-8, -125, 1).fill({ color: 0xffffff, alpha: 0.8 });
    g.circle(10, -125, 1).fill({ color: 0xffffff, alpha: 0.8 });
    g.moveTo(-13, -132).quadraticCurveTo(-9, -134, -5, -132).stroke({ color: 0x3a241c, width: 1.6 });
    g.moveTo(5, -132).quadraticCurveTo(9, -134, 13, -132).stroke({ color: 0x3a241c, width: 1.6 });
    g.moveTo(-5, -110).quadraticCurveTo(0, -106, 5, -110).stroke({ color: 0xd84b6a, width: 2.5 });

    this.bodyLayer.addChild(g);
  }

  /** Stage 2 (innermost): a two-piece lingerie set — the final layer. */
  private buildLingerie() {
    const g = new Graphics();
    const lace = 0x1a1020;
    const trim = 0xff9ec8;

    // Bra cups, contoured to the chest.
    g.moveTo(-26, -56)
      .quadraticCurveTo(-26, -38, -8, -36)
      .quadraticCurveTo(-2, -38, -2, -50)
      .quadraticCurveTo(-14, -56, -26, -56)
      .fill({ color: lace });
    g.moveTo(26, -56)
      .quadraticCurveTo(26, -38, 8, -36)
      .quadraticCurveTo(2, -38, 2, -50)
      .quadraticCurveTo(14, -56, 26, -56)
      .fill({ color: lace });
    g.circle(0, -46, 3).fill({ color: trim });
    // Straps.
    g.moveTo(-22, -56).lineTo(-12, -78).stroke({ color: lace, width: 3 });
    g.moveTo(22, -56).lineTo(12, -78).stroke({ color: lace, width: 3 });
    g.moveTo(-26, -52).quadraticCurveTo(0, -44, 26, -52).stroke({ color: lace, width: 3 });

    // Briefs hugging the hips, with a lace trim.
    g.moveTo(-24, 48)
      .quadraticCurveTo(-26, 56, -20, 56)
      .quadraticCurveTo(-10, 74, 0, 76)
      .quadraticCurveTo(10, 74, 20, 56)
      .quadraticCurveTo(26, 56, 24, 48)
      .quadraticCurveTo(0, 56, -24, 48)
      .fill({ color: lace });
    g.moveTo(-24, 49).quadraticCurveTo(0, 57, 24, 49).stroke({ color: trim, width: 2 });

    this.lingerie = g;
    this.figure.addChild(g);
  }

  /** Stage 1 (middle): a fitted cocktail dress covering the torso and hips. */
  private buildDress() {
    const g = new Graphics();
    const cloth = 0xd11f54;
    const dark = 0x9c103c;
    const sheen = 0xff6f96;

    // Bodice + skirt following the silhouette to mid-thigh.
    g.moveTo(-30, -66)
      .quadraticCurveTo(-40, -32, -24, -4)
      .quadraticCurveTo(-34, 30, -28, 64)
      .quadraticCurveTo(-32, 92, -26, 108)
      .lineTo(26, 108)
      .quadraticCurveTo(32, 92, 28, 64)
      .quadraticCurveTo(34, 30, 24, -4)
      .quadraticCurveTo(40, -32, 30, -66)
      .quadraticCurveTo(0, -80, -30, -66)
      .fill({ color: cloth });
    // Side shading.
    g.moveTo(20, -60).quadraticCurveTo(32, -28, 22, -2)
      .quadraticCurveTo(30, 30, 24, 64).quadraticCurveTo(28, 90, 22, 104)
      .lineTo(14, 104).quadraticCurveTo(20, 70, 16, 40)
      .quadraticCurveTo(22, 4, 14, -30).quadraticCurveTo(20, -52, 14, -62)
      .closePath().fill({ color: dark, alpha: 0.5 });
    // Sweetheart neckline + waist sheen.
    g.moveTo(-26, -62).quadraticCurveTo(-14, -50, 0, -56)
      .quadraticCurveTo(14, -50, 26, -62).stroke({ color: dark, width: 3 });
    g.moveTo(-18, 4).quadraticCurveTo(0, 14, 18, 4).stroke({ color: sheen, width: 3, alpha: 0.8 });
    // Thin shoulder straps.
    g.moveTo(-24, -64).lineTo(-12, -82).stroke({ color: cloth, width: 5 });
    g.moveTo(24, -64).lineTo(12, -82).stroke({ color: cloth, width: 5 });

    this.dress = g;
    this.figure.addChild(g);
  }

  /** Stage 0 (outermost): a long satin robe, the first thing to come off. */
  private buildRobe() {
    const g = new Graphics();
    const cloth = 0x6c3fae;
    const dark = 0x4a2980;
    const trim = 0xd9c2f5;

    // Full-length robe draping from shoulders past the knees.
    g.moveTo(-36, -78)
      .quadraticCurveTo(-50, -30, -44, 40)
      .quadraticCurveTo(-46, 110, -38, 156)
      .lineTo(38, 156)
      .quadraticCurveTo(46, 110, 44, 40)
      .quadraticCurveTo(50, -30, 36, -78)
      .quadraticCurveTo(0, -92, -36, -78)
      .fill({ color: cloth });
    // Inner shadow along the right drape for dimension.
    g.moveTo(24, -70).quadraticCurveTo(42, -20, 38, 50)
      .quadraticCurveTo(42, 110, 36, 152).lineTo(22, 152)
      .quadraticCurveTo(28, 100, 24, 40).quadraticCurveTo(30, -20, 20, -64)
      .closePath().fill({ color: dark, alpha: 0.4 });
    // Modest V-neckline at the collar only (the robe is otherwise closed).
    g.moveTo(-14, -76).lineTo(0, -40).lineTo(14, -76).closePath().fill({ color: dark, alpha: 0.5 });
    // Satin lapels running down the closed center seam.
    g.moveTo(-14, -76).lineTo(0, -40).lineTo(-6, 150).lineTo(-14, 150)
      .quadraticCurveTo(-22, 40, -18, -70).closePath().fill({ color: trim, alpha: 0.8 });
    g.moveTo(14, -76).lineTo(0, -40).lineTo(6, 150).lineTo(14, 150)
      .quadraticCurveTo(22, 40, 18, -70).closePath().fill({ color: trim, alpha: 0.8 });
    // Tied sash at the waist.
    g.roundRect(-42, 30, 84, 14, 4).fill({ color: dark });
    g.roundRect(-42, 30, 84, 5, 2).fill({ color: trim, alpha: 0.6 });
    // Sash knot + tails.
    g.circle(0, 37, 7).fill({ color: trim });
    g.moveTo(-4, 42).lineTo(-12, 78).lineTo(-2, 76).closePath().fill({ color: cloth });
    g.moveTo(4, 42).lineTo(12, 78).lineTo(2, 76).closePath().fill({ color: cloth });

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
    this.robe.alpha = 1 - stageReveal(progress, 0);
    this.dress.alpha = 1 - stageReveal(progress, 1);
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
    // Gentle hip sway + breathing bob.
    this.figure.rotation = Math.sin(this.sway) * 0.04 * (0.5 + intensity);
    this.figure.x = Math.sin(this.sway * 0.7) * 5 * intensity;
    this.bodyLayer.y = Math.sin(this.sway * 1.3) * 1.5;
  }

  /** Drop pose when the round crashes. */
  fall() {
    this.figure.rotation = 0.4;
  }

  reset() {
    this.figure.rotation = 0;
    this.figure.x = 0;
    this.bodyLayer.y = 0;
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
  const start = stage / 3;
  const fadeStart = start + 1 / 6;
  const fadeEnd = start + 1 / 3;
  if (progress <= fadeStart) return 0;
  if (progress >= fadeEnd) return 1;
  return (progress - fadeStart) / (fadeEnd - fadeStart);
}
