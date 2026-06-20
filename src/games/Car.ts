import { Container, Graphics } from "pixi.js";

/**
 * A top-down race car drawn entirely with vector graphics. The car points
 * UP (nose toward smaller Y) so it reads correctly in a vertical, downward-
 * scrolling race. Origin (0,0) is the car's center.
 */
export class Car {
  readonly view = new Container();
  private wheels: Graphics[] = [];
  private spin = 0;
  private body = new Container();

  constructor(color: number, accent: number) {
    const w = 58; // width across the car
    const h = 104; // length nose-to-tail
    const top = -h / 2; // nose
    const bot = h / 2; // tail
    const dark = shade(color, -0.4); // darker trim of the body color
    const light = shade(color, 0.28); // panel highlight

    // Four wheels (front pair + rear pair), drawn beneath the body.
    const mkWheel = () => {
      const g = new Graphics();
      g.roundRect(-8, -16, 16, 32, 5).fill({ color: 0x0a0a0d });
      g.roundRect(-8, -16, 16, 32, 5).stroke({ color: 0x2a2a30, width: 2 });
      // hub + tread marks (animate via rotation)
      g.rect(-8, -2, 16, 4).fill({ color: 0x3a3a42 });
      return g;
    };
    const wheelX = w / 2 - 3;
    const positions = [
      [-wheelX, top + 22], [wheelX, top + 22], // front
      [-wheelX, bot - 22], [wheelX, bot - 22], // rear
    ];
    for (const [x, y] of positions) {
      const wheel = mkWheel();
      wheel.position.set(x, y);
      this.wheels.push(wheel);
      this.view.addChild(wheel);
    }

    const chassis = new Graphics();

    // Rear wing / spoiler poking out behind the tail.
    chassis.roundRect(-w / 2 - 4, bot - 10, w + 8, 12, 4).fill({ color: dark });

    // Main body — a tapered hull: narrower at the nose, fuller at the cabin.
    chassis.moveTo(-w / 2 + 10, top + 4)
      .quadraticCurveTo(-w / 2 - 2, top + 30, -w / 2, 0)
      .lineTo(-w / 2, bot - 14)
      .quadraticCurveTo(-w / 2, bot, -w / 2 + 12, bot)
      .lineTo(w / 2 - 12, bot)
      .quadraticCurveTo(w / 2, bot, w / 2, bot - 14)
      .lineTo(w / 2, 0)
      .quadraticCurveTo(w / 2 + 2, top + 30, w / 2 - 10, top + 4)
      .quadraticCurveTo(0, top - 8, -w / 2 + 10, top + 4)
      .fill({ color });

    // Panel highlight down the body for a glossy read.
    chassis.roundRect(-w / 2 + 8, top + 18, w - 16, h - 34, 12)
      .fill({ color: light, alpha: 0.18 });

    // Hood vents (two short slits near the nose).
    chassis.roundRect(-12, top + 16, 8, 16, 3).fill({ color: dark, alpha: 0.7 });
    chassis.roundRect(4, top + 16, 8, 16, 3).fill({ color: dark, alpha: 0.7 });

    // Cabin: a darker shell with a tinted windshield + rear window.
    chassis.roundRect(-w / 2 + 9, -16, w - 18, 44, 10).fill({ color: dark });
    // Windshield (front)
    chassis.moveTo(-15, -10).lineTo(15, -10).lineTo(11, 2).lineTo(-11, 2).closePath()
      .fill({ color: 0xbfeeff, alpha: 0.9 });
    // Rear window
    chassis.moveTo(-12, 14).lineTo(12, 14).lineTo(15, 24).lineTo(-15, 24).closePath()
      .fill({ color: 0x8fd4ee, alpha: 0.7 });
    // Roof accent stripe between the windows
    chassis.rect(-5, 2, 10, 12).fill({ color: accent });

    // Side mirrors.
    chassis.roundRect(-w / 2 - 5, -14, 7, 9, 2).fill({ color: dark });
    chassis.roundRect(w / 2 - 2, -14, 7, 9, 2).fill({ color: dark });

    // Twin nose racing stripes.
    chassis.rect(-9, top + 2, 5, 30).fill({ color: 0xffffff, alpha: 0.85 });
    chassis.rect(4, top + 2, 5, 30).fill({ color: 0xffffff, alpha: 0.85 });

    // Headlights at the nose.
    chassis.circle(-w / 2 + 13, top + 8, 4).fill({ color: 0xfff2b0 });
    chassis.circle(w / 2 - 13, top + 8, 4).fill({ color: 0xfff2b0 });

    // Tail lights.
    chassis.roundRect(-w / 2 + 8, bot - 8, 12, 5, 2).fill({ color: 0xff5a4d });
    chassis.roundRect(w / 2 - 20, bot - 8, 12, 5, 2).fill({ color: 0xff5a4d });

    this.body.addChild(chassis);
    this.view.addChild(this.body);
  }

  /** Advance wheel rotation proportional to speed. */
  drive(dt: number, speed: number) {
    this.spin += dt * speed * 0.5;
    // Spin the tread marks for a rolling read.
    for (const wheel of this.wheels) wheel.rotation = Math.sin(this.spin) * 0.12;
    // subtle side-to-side wobble
    this.body.x = Math.sin(this.spin * 4) * 1.2;
  }

  /** Spin and tilt the car into a crashed pose. */
  crash() {
    this.body.rotation = -0.35;
    this.body.x = 8;
  }

  /** Restore the car to its upright driving pose. */
  reset() {
    this.body.rotation = 0;
    this.body.x = 0;
    this.spin = 0;
    for (const wheel of this.wheels) wheel.rotation = 0;
  }
}

/** Lighten (amt>0) or darken (amt<0) a 0xRRGGBB color by a fraction. */
function shade(color: number, amt: number): number {
  const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
  const adj = (c: number) =>
    amt >= 0 ? Math.round(c + (255 - c) * amt) : Math.round(c * (1 + amt));
  return (adj(r) << 16) | (adj(g) << 8) | adj(b);
}
