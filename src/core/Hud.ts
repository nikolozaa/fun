import { Container } from "pixi.js";
import { makeButton } from "./utils";

/** A "← Menu" button anchored top-left, used by every game. */
export function makeBackButton(onExit: () => void): Container {
  const b = makeButton({
    width: 110, height: 44, label: "← Menu", fill: 0x2a2a44,
    fontSize: 18, onClick: onExit,
  });
  b.position.set(20, 20);
  return b;
}
