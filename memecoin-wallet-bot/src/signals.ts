import { Config } from "./config";
import { Storage } from "./storage";
import { PositionEntry, Signal, SwapEvent, TokenPosition } from "./types";

function emptyPosition(mint: string): TokenPosition {
  return { mint, buyers: {}, sellers: {} };
}

export class SignalEngine {
  constructor(private storage: Storage, private config: Config) {}

  handleSwap(event: SwapEvent): Signal | null {
    const position = this.storage.getPosition(event.mint) ?? emptyPosition(event.mint);

    if (event.direction === "buy") {
      return this.handleBuy(position, event);
    }
    return this.handleSell(position, event);
  }

  private handleBuy(position: TokenPosition, event: SwapEvent): Signal | null {
    position.buyers[event.wallet] = {
      wallet: event.wallet,
      timestamp: event.timestamp,
      signature: event.signature,
    };
    this.storage.upsertPosition(position);

    if (position.signaledBuyAt) {
      // Already alerted on this token; further buys just add to the position.
      return null;
    }

    const windowSeconds = this.config.buySignalWindowMinutes * 60;
    const recentBuyers = Object.values(position.buyers).filter(
      (b) => event.timestamp - b.timestamp <= windowSeconds
    );

    if (recentBuyers.length < this.config.minWalletsForBuySignal) {
      return null;
    }

    position.signaledBuyAt = event.timestamp;
    this.storage.upsertPosition(position);

    return {
      type: "BUY",
      mint: event.mint,
      buyers: recentBuyers,
    };
  }

  private handleSell(position: TokenPosition, event: SwapEvent): Signal | null {
    const alreadyRecordedSell = Boolean(position.sellers[event.wallet]);
    if (alreadyRecordedSell) {
      // Partial/repeat sell tx from a wallet we've already flagged as exited.
      return null;
    }

    const sellEntry: PositionEntry = {
      wallet: event.wallet,
      timestamp: event.timestamp,
      signature: event.signature,
    };
    position.sellers[event.wallet] = sellEntry;
    this.storage.upsertPosition(position);

    if (!position.signaledBuyAt) {
      // We never issued a BUY alert for this token, so don't spam SELL alerts.
      return null;
    }

    const totalBuyers = Object.keys(position.buyers).length;
    const sellersSoFar = Object.keys(position.sellers).length;

    if (this.config.sellAlertOnAnySell) {
      return {
        type: "SELL",
        mint: event.mint,
        seller: sellEntry,
        sellersSoFar,
        totalBuyers,
      };
    }

    const majoritySold = sellersSoFar / Math.max(totalBuyers, 1) > 0.5;
    if (majoritySold && !position.signaledSellAt) {
      position.signaledSellAt = event.timestamp;
      this.storage.upsertPosition(position);
      return {
        type: "SELL",
        mint: event.mint,
        seller: sellEntry,
        sellersSoFar,
        totalBuyers,
      };
    }

    return null;
  }
}
