import { Text, TextStyle, Graphics, Container } from "pixi.js";

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Sample a crash multiplier from a heavy-tailed distribution, the way real
 * crash games do. ~3% instant busts, long tail toward big multipliers.
 */
export function sampleCrashPoint(): number {
  if (Math.random() < 0.03) return 1.0;
  const r = Math.random();
  // 99% house edge style curve: 0.99 / (1 - r)
  const m = 0.99 / (1 - r);
  return Math.max(1.0, Math.min(m, 1000));
}

export function makeText(value: string, style: Partial<TextStyle>): Text {
  return new Text({ text: value, style: new TextStyle(style) });
}

/** A rounded rectangle button with hover/press states and a label. */
export interface ButtonOpts {
  width: number;
  height: number;
  label: string;
  fill: number;
  textColor?: number;
  fontSize?: number;
  onClick: () => void;
}

export function makeButton(opts: ButtonOpts): Container {
  const c = new Container();
  c.eventMode = "static";
  c.cursor = "pointer";

  const bg = new Graphics();
  const draw = (fill: number, alpha: number) => {
    bg.clear();
    bg.roundRect(0, 0, opts.width, opts.height, 12).fill({ color: fill, alpha });
  };
  draw(opts.fill, 1);
  c.addChild(bg);

  const label = makeText(opts.label, {
    fill: opts.textColor ?? 0xffffff,
    fontSize: opts.fontSize ?? 24,
    fontWeight: "700",
  });
  label.anchor.set(0.5);
  label.position.set(opts.width / 2, opts.height / 2);
  c.addChild(label);

  c.on("pointerover", () => draw(opts.fill, 0.82));
  c.on("pointerout", () => draw(opts.fill, 1));
  c.on("pointerdown", () => {
    c.scale.set(0.96);
    draw(opts.fill, 0.7);
  });
  c.on("pointerup", () => {
    c.scale.set(1);
    draw(opts.fill, 0.82);
    opts.onClick();
  });
  c.on("pointerupoutside", () => {
    c.scale.set(1);
    draw(opts.fill, 1);
  });

  return c;
}

/** Simple in-memory wallet shared across the session. */
export const wallet = {
  balance: 1000,
};
