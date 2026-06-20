import { Container } from "pixi.js";
import { GAME_WIDTH, GAME_HEIGHT } from "./types";
import { BetPanel, type RoundState } from "./BetPanel";

export interface DualBetHooks {
  /**
   * A bet was placed in a slot. Return false to reject. The game should start
   * the round on the first accepted bet of a round.
   */
  onPlaceBet: (slot: number, amount: number) => boolean;
  /** Cash out the given slot. */
  onCashOut: (slot: number) => void;
}

/**
 * Two independent {@link BetPanel} slots laid out side by side — the
 * Aviator-style two-bet setup. Each slot owns its stake, button and state, so
 * the player can place one or both bets and cash each out independently.
 */
export class DualBetPanel {
  readonly view = new Container();
  private slots: BetPanel[];

  constructor(accent: number, hooks: DualBetHooks) {
    const gap = 24;
    const panelH = 168;
    const totalW = Math.min(720, GAME_WIDTH - 80);
    const slotW = (totalW - gap) / 2;
    const x0 = (GAME_WIDTH - totalW) / 2;
    const y = GAME_HEIGHT - panelH - 16;

    this.slots = [0, 1].map((i) =>
      new BetPanel(
        accent,
        {
          onPlaceBet: (amount) => hooks.onPlaceBet(i, amount),
          onCashOut: () => hooks.onCashOut(i),
        },
        {
          x: x0 + i * (slotW + gap),
          y,
          width: slotW,
          height: panelH,
          title: `BET ${i + 1}`,
        },
      ),
    );
    for (const s of this.slots) this.view.addChild(s.view);
  }

  /** Stake currently set in a slot. */
  currentBet(slot: number): number {
    return this.slots[slot].currentBet;
  }

  /** Whether a slot has a live bet that can still be cashed out. */
  isRunning(slot: number): boolean {
    return this.slots[slot].isRunning;
  }

  /** True if either slot has a live bet. */
  anyRunning(): boolean {
    return this.slots.some((s) => s.isRunning);
  }

  payout(slot: number, amount: number) {
    this.slots[slot].payout(amount);
  }

  setState(slot: number, state: RoundState) {
    this.slots[slot].setState(state);
  }

  /** Apply a state to both slots (e.g. reset to betting for a new round). */
  setStateAll(state: RoundState) {
    for (const s of this.slots) s.setState(state);
  }

  /** Run a callback for each slot index. */
  forEach(fn: (slot: number) => void) {
    this.slots.forEach((_, i) => fn(i));
  }
}
