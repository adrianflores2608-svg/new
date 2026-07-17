export interface TrackedWallet {
  address: string;
  label?: string;
  addedAt: number;
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

export interface StoreShape {
  wallets: TrackedWallet[];
  lastSignature: Record<string, string>;
  positions: Record<string, TokenPosition>;
}

export type Signal =
  | {
      type: "BUY";
      mint: string;
      buyers: PositionEntry[];
      tokenName?: string;
      tokenSymbol?: string;
      marketCapSol?: number;
    }
  | {
      type: "SELL";
      mint: string;
      seller: PositionEntry;
      sellersSoFar: number;
      totalBuyers: number;
      tokenName?: string;
      tokenSymbol?: string;
    };
