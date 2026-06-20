import { Container, Graphics } from "pixi.js";
import { makeText, wallet } from "./utils";
import { GAME_WIDTH, GAME_HEIGHT, type GameDescriptor } from "./types";

/** Landing screen: pick one of the available games. */
export class Menu {
  readonly view = new Container();

  constructor(games: GameDescriptor[], onSelect: (g: GameDescriptor) => void) {
    const title = makeText("CRASH ARCADE", {
      fill: 0xffffff, fontSize: 64, fontWeight: "900", letterSpacing: 4,
    });
    title.anchor.set(0.5);
    title.position.set(GAME_WIDTH / 2, 110);
    this.view.addChild(title);

    const sub = makeText("front-end demo · play money only", {
      fill: 0x8888aa, fontSize: 20, fontWeight: "500",
    });
    sub.anchor.set(0.5);
    sub.position.set(GAME_WIDTH / 2, 160);
    this.view.addChild(sub);

    const balance = makeText(`Play balance: $${wallet.balance.toFixed(2)}`, {
      fill: 0x4ade80, fontSize: 24, fontWeight: "700",
    });
    balance.anchor.set(0.5);
    balance.position.set(GAME_WIDTH / 2, 200);
    this.view.addChild(balance);

    const cardW = 420;
    const cardH = 280;
    const gap = 60;
    const totalW = games.length * cardW + (games.length - 1) * gap;
    let startX = (GAME_WIDTH - totalW) / 2;
    const cardY = (GAME_HEIGHT - cardH) / 2 + 60;

    for (const g of games) {
      const card = this.makeCard(g, cardW, cardH, () => onSelect(g));
      card.position.set(startX, cardY);
      this.view.addChild(card);
      startX += cardW + gap;
    }
  }

  private makeCard(g: GameDescriptor, w: number, h: number, onClick: () => void): Container {
    const c = new Container();
    c.eventMode = "static";
    c.cursor = "pointer";

    const bg = new Graphics();
    const draw = (alpha: number, lift: number) => {
      bg.clear();
      bg.roundRect(0, -lift, w, h, 20).fill({ color: 0x16162a, alpha: 1 });
      bg.roundRect(0, -lift, w, h, 20).stroke({ color: g.accent, width: 3, alpha });
    };
    draw(0.6, 0);
    c.addChild(bg);

    // Accent header strip
    const strip = new Graphics();
    strip.roundRect(0, 0, w, 70, 20).fill({ color: g.accent, alpha: 0.18 });
    c.addChild(strip);

    const title = makeText(g.title, { fill: 0xffffff, fontSize: 34, fontWeight: "800" });
    title.position.set(28, 22);
    c.addChild(title);

    const subtitle = makeText(g.subtitle, {
      fill: 0xaab, fontSize: 18, wordWrap: true, wordWrapWidth: w - 56, lineHeight: 26,
    });
    subtitle.position.set(28, 100);
    c.addChild(subtitle);

    const play = makeText("▶ PLAY", { fill: g.accent, fontSize: 26, fontWeight: "800" });
    play.position.set(28, h - 56);
    c.addChild(play);

    c.on("pointerover", () => { draw(1, 8); c.y -= 0; });
    c.on("pointerout", () => draw(0.6, 0));
    c.on("pointertap", onClick);

    return c;
  }
}
