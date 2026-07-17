export interface TrackedWallet {
  address: string;
  label?: string;
  addedAt: number;
  // Populated when a wallet was added via /discover or `npm run rank --add-top`;
  // absent for manually-added wallets. Drives conviction weighting (src/conviction.ts).
  realizedPnlSol?: number;
  winRate?: number;
}

export type SwapDirection = "buy" | "sell";

export interface SwapEvent {
  wallet: string;
  mint: string;
  direction: SwapDirection;
  solAmount: number;
  tokenAmount: number;
  signature: string;
  timestamp: number; // unix seconds
}

export interface PositionEntry {
  wallet: string;
  timestamp: number;
  signature: string;
}

export interface TokenPosition {
  mint: string;
  buyers: Record<string, PositionEntry>;
  sellers: Record<string, PositionEntry>;
  signaledBuyAt?: number;
  signaledSellAt?: number;
}

export type PaperTradeExitReason = "signal_sell" | "stop_loss";

export interface PaperTrade {
  mint: string;
  entryMarketCapSol: number;
  entryTimestamp: number;
  sizeSol: number;
  stopLossMarketCapSol?: number;
  rugFlagged: boolean;
  exit?: {
    marketCapSol: number;
    timestamp: number;
    reason: PaperTradeExitReason;
    pnlSol: number;
    pnlPercent: number;
  };
}

export interface StoreShape {
  wallets: TrackedWallet[];
  lastSignature: Record<string, string>;
  positions: Record<string, TokenPosition>;
  paperPositions: Record<string, PaperTrade>;
  closedPaperTrades: PaperTrade[];
}

export type Signal =
  | {
      type: "BUY";
      mint: string;
      buyers: PositionEntry[];
      convictionScore: number;
    }
  | {
      type: "SELL";
      mint: string;
      seller: PositionEntry;
      sellersSoFar: number;
      totalBuyers: number;
    };
