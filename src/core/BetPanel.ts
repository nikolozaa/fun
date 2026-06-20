import { Container, Graphics } from "pixi.js";
import { makeText, makeButton, wallet, clamp, type ButtonContainer } from "./utils";
import { GAME_WIDTH, GAME_HEIGHT } from "./types";

export type RoundState = "betting" | "running" | "crashed";

export interface BetPanelHooks {
  /** User pressed the main button to place a bet. Return false to reject. */
  onPlaceBet: (amount: number) => boolean;
  /** User pressed cash out while running. */
  onCashOut: () => void;
}

export interface BetPanelLayout {
  x: number;
  y: number;
  width: number;
  height?: number;
  /** Optional label shown in the corner, e.g. "BET 1". */
  title?: string;
}

/**
 * A single bet slot: bet stepper, balance, and a context-sensitive primary
 * button (Place Bet → Cash Out → Busted). Lay one out on its own, or pair two
 * via {@link DualBetPanel} for an Aviator-style two-bet setup.
 */
export class BetPanel {
  readonly view = new Container();
  private betAmount = 10;
  private state: RoundState = "betting";
  private accent: number;
  private layout: BetPanelLayout;
  /** Live potential cash-out (bet × current multiplier) while running. */
  private potential = 0;

  private balanceText = makeText("", { fill: 0xffffff, fontSize: 18, fontWeight: "700" });
  private betText = makeText("", { fill: 0xffffff, fontSize: 24, fontWeight: "800" });
  private titleText = makeText("", { fill: 0xffffff, fontSize: 14, fontWeight: "700" });
  private mainButton!: ButtonContainer;
  private buttonHolder = new Container();
  private hooks: BetPanelHooks;

  constructor(accent: number, hooks: BetPanelHooks, layout?: Partial<BetPanelLayout>) {
    this.accent = accent;
    this.hooks = hooks;
    const panelW = layout?.width ?? 460;
    this.layout = {
      x: layout?.x ?? (GAME_WIDTH - panelW) / 2,
      y: layout?.y ?? GAME_HEIGHT - (layout?.height ?? 150) - 20,
      width: panelW,
      height: layout?.height ?? 150,
      title: layout?.title,
    };
    this.build();
    this.refresh();
  }

  private build() {
    const { x, y, width: panelW, height: panelH, title } = this.layout;
    const h = panelH ?? 150;

    const bg = new Graphics();
    bg.roundRect(x, y, panelW, h, 16).fill({ color: 0x141426, alpha: 0.92 });
    bg.roundRect(x, y, panelW, h, 16).stroke({ color: this.accent, width: 2, alpha: 0.5 });
    this.view.addChild(bg);

    if (title) {
      this.titleText.text = title;
      this.titleText.style.fill = this.accent;
      this.titleText.position.set(x + panelW - 16, y + 12);
      this.titleText.anchor.set(1, 0);
      this.view.addChild(this.titleText);
    }

    // Balance
    this.balanceText.position.set(x + 18, y + 12);
    this.view.addChild(this.balanceText);

    // Bet stepper row
    const stepperY = y + 44;
    const btn = 44;
    const minus = makeButton({
      width: btn, height: btn, label: "−", fill: 0x2a2a44, fontSize: 22,
      onClick: () => this.changeBet(-this.step()),
    });
    minus.position.set(x + 18, stepperY);
    this.view.addChild(minus);

    const boxW = panelW - 18 * 2 - btn * 2 - 12 * 2;
    const boxX = x + 18 + btn + 12;
    const betBox = new Graphics();
    betBox.roundRect(boxX, stepperY, boxW, btn, 10).fill({ color: 0x0c0c18 });
    this.view.addChild(betBox);
    this.betText.anchor.set(0.5);
    this.betText.position.set(boxX + boxW / 2, stepperY + btn / 2);
    this.view.addChild(this.betText);

    const plus = makeButton({
      width: btn, height: btn, label: "+", fill: 0x2a2a44, fontSize: 22,
      onClick: () => this.changeBet(this.step()),
    });
    plus.position.set(boxX + boxW + 12, stepperY);
    this.view.addChild(plus);

    // Primary action button — full width on its own row.
    this.buttonHolder.position.set(x + 18, stepperY + btn + 12);
    this.view.addChild(this.buttonHolder);
    this.rebuildMainButton();
  }

  private step(): number {
    if (this.betAmount >= 100) return 50;
    if (this.betAmount >= 20) return 10;
    return 5;
  }

  private changeBet(delta: number) {
    if (this.state !== "betting") return;
    this.betAmount = clamp(Math.round(this.betAmount + delta), 5, Math.max(5, wallet.balance));
    this.refresh();
  }

  private rebuildMainButton() {
    this.buttonHolder.removeChildren();
    let label = "PLACE BET";
    let fill = this.accent;
    if (this.state === "running") { label = this.cashOutLabel(); fill = 0xf2b705; }
    if (this.state === "crashed") { label = "BUSTED"; fill = 0x802030; }

    const { width: panelW } = this.layout;
    this.mainButton = makeButton({
      width: panelW - 36, height: 46, label, fill, fontSize: 18,
      onClick: () => this.handleMain(),
    });
    this.buttonHolder.addChild(this.mainButton);
  }

  /** Label for the live cash-out button, showing the current potential win. */
  private cashOutLabel(): string {
    return `CASH OUT  $${this.potential.toFixed(2)}`;
  }

  /**
   * Push the current round multiplier so the running button shows the live
   * potential cash-out (stake × multiplier). Call every frame while running.
   */
  setMultiplier(multi: number) {
    this.potential = this.betAmount * multi;
    if (this.state === "running") this.mainButton.setLabel(this.cashOutLabel());
  }

  private handleMain() {
    if (this.state === "betting") {
      if (this.betAmount > wallet.balance) return;
      if (this.hooks.onPlaceBet(this.betAmount)) {
        wallet.balance -= this.betAmount;
        this.setState("running");
      }
    } else if (this.state === "running") {
      this.hooks.onCashOut();
    }
  }

  get currentBet(): number {
    return this.betAmount;
  }

  /** Whether a bet is currently placed and live (cash-out available). */
  get isRunning(): boolean {
    return this.state === "running";
  }

  /** Credit a win to the wallet (stake already deducted at bet time). */
  payout(amount: number) {
    wallet.balance += amount;
    this.refresh();
  }

  setState(s: RoundState) {
    this.state = s;
    this.rebuildMainButton();
    this.refresh();
  }

  private refresh() {
    this.balanceText.text = `Balance: $${wallet.balance.toFixed(2)}`;
    this.betText.text = `$${this.betAmount}`;
  }
}
