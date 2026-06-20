import { Application, Container } from "pixi.js";
import { GAME_WIDTH, GAME_HEIGHT, type Game, type GameDescriptor } from "./core/types";
import { Menu } from "./core/Menu";
import { CrashRaceGame } from "./games/CrashRace";
import { AviatorGame } from "./games/Aviator";
import { showWelcomeGate } from "./core/WelcomeGate";

const GAMES: GameDescriptor[] = [
  {
    id: "aviator",
    title: "RISE",
    subtitle: "An Aviator-style multiplier. The dancer rises and the multiplier climbs through stages — but she can drop at any moment. Cash out at the peak.",
    accent: 0xb14dff,
    create: (ctx) => new AviatorGame(ctx),
  },
  {
    id: "crash-race",
    title: "CRASH RACE",
    subtitle: "Two cars race down the strip. The lead car crashes at a random point — and the chaser slams into it right after. Cash out before the pile-up.",
    accent: 0xff4d6d,
    create: (ctx) => new CrashRaceGame(ctx),
  },
];

async function bootstrap() {
  const app = new Application();
  await app.init({
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    background: 0x0a0a14,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio, 2),
    autoDensity: true,
  });

  const host = document.getElementById("app")!;
  host.appendChild(app.canvas);

  // Scale the fixed-size stage to fit the viewport while preserving aspect.
  const fit = () => {
    const scale = Math.min(
      window.innerWidth / GAME_WIDTH,
      window.innerHeight / GAME_HEIGHT,
    );
    app.canvas.style.width = `${GAME_WIDTH * scale}px`;
    app.canvas.style.height = `${GAME_HEIGHT * scale}px`;
  };
  fit();
  window.addEventListener("resize", fit);

  const root = new Container();
  app.stage.addChild(root);

  let activeGame: Game | null = null;
  let tickerFn: ((ticker: { deltaMS: number }) => void) | null = null;

  const clearScene = () => {
    if (tickerFn) { app.ticker.remove(tickerFn); tickerFn = null; }
    if (activeGame) { activeGame.destroy(); activeGame = null; }
    root.removeChildren();
  };

  const showMenu = () => {
    clearScene();
    const menu = new Menu(GAMES, (g) => launchGame(g));
    root.addChild(menu.view);
  };

  const launchGame = (descriptor: GameDescriptor) => {
    clearScene();
    const game = descriptor.create({ app, exit: showMenu });
    activeGame = game;
    root.addChild(game.view);
    game.start();
    tickerFn = (ticker) => game.update(ticker.deltaMS / 1000);
    app.ticker.add(tickerFn);
  };

  showMenu();
}

// Gate the arcade behind the signature screen: the games only load once both
// Ana and Elene have signed off on the beer they owe.
showWelcomeGate().then(bootstrap);
